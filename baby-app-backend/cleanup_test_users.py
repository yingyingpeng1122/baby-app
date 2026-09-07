#!/usr/bin/env python3
"""
cleanup_test_users.py — 清理测试用户 + 孤儿账户（dry-run 预览，--confirm 才真删）

用法:
    预览（不删任何东西）:  docker exec baby-app python cleanup_test_users.py
    真删:                  docker exec baby-app python cleanup_test_users.py --confirm

删除策略:
    按 user_id 找到关联的 family_id 和 baby_id，整条链路级联删：
    sessions / family_members / babies / feeding_records_v2 / checklist_items_v2
    / growth_records_v2 / sleep_records_v2 / travel_records / travel_lists
    / temperature_records / vaccine_records / milestone_records / users

    如果一个 family_id 下还有其他真实成员，会跳过 family_members/babies，
    只删该用户自己的 sessions + users 行（避免误删共享家庭）。

保留清单（写死，不会被删）:
    - 6 个真实用户（妈妈/爸爸×2/小姨/Mama/奶奶）
    - 周五早上朋友注册的账户（如果能识别出来）
"""
import sys
from main import db

# ============ 保留清单：手机号集合 ============
# 这些手机号对应的用户**绝不删除**，即使用户输入 --confirm
KEEP_PHONES = {
    "13510938999",  # 妈妈（用户本人）
    "13410604571",  # 爸爸（用户老公）
    "18823165608",  # 小姨
    "15015881505",  # 爸爸
    "15712170807",  # Mama（疑似朋友，先保留）
    "13715081832",  # 奶奶（周日真实注册）
}

# ============ 删除清单：手机号集合 ============
# 明确要删的测试手机号（写死，不接受外部输入避免误删）
# 如果手机号为空或存的是 UUID，按 user_id 直接判定为孤儿删除
DELETE_PHONES = {
    # 5 个"测试妈"连号段
    "13888230866", "13888230933", "13888230982", "13888231022", "13988242900",
    # 3 个"测"连号段
    "13888244257", "13888244292", "13888244343",
    # 其他测试
    "13988244208",  # 新昵称
    "13800000999",  # 测试
    "13900000999",  # 线上验证
    "13900001777",  # 身高体重测试
}


def is_uuid_or_empty(phone: str) -> bool:
    """判断 phone 字段是不是空串或存了 UUID（孤儿账户）"""
    if not phone or phone.strip() == "":
        return True
    # UUID 格式：8-4-4-4-12
    import re
    return bool(re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", phone.strip()))


def get_all_users():
    """返回 [(user_id, phone, nickname)] 列表"""
    rs = db.execute(
        "SELECT user_id, phone, nickname FROM users ORDER BY rowid"
    ).fetchall()
    return [(r[0], r[1] if r[1] else "", r[2] if r[2] else "") for r in rs]


def get_user_family_babies(user_id: str):
    """返回 user_id 关联的所有 (family_id, role) 和 (baby_id) 列表"""
    fm = db.execute(
        "SELECT family_id, role FROM family_members WHERE user_id = ?", [user_id]
    ).fetchall()
    # TursoRow 不支持 len()，只支持整数下标；SELECT 固定取 family_id/role 两列，r[1] 必有效
    families = [(r[0], r[1] if r[1] else "") for r in fm]
    babies = []
    for fid, _ in families:
        bs = db.execute(
            "SELECT baby_id FROM babies WHERE family_id = ?", [fid]
        ).fetchall()
        for r in bs:
            babies.append(r[0])
    return families, babies


def count_family_other_members(family_id: str, exclude_user_id: str) -> int:
    """这个家庭里除了 exclude_user_id 外还有多少成员"""
    rs = db.execute(
        "SELECT COUNT(*) FROM family_members WHERE family_id = ? AND user_id != ?",
        [family_id, exclude_user_id]
    ).fetchall()
    return rs[0][0] if rs else 0


def delete_user_chain(user_id: str, family_ids: list, baby_ids: list, confirm: bool):
    """级联删除一个用户的所有相关数据"""
    stats = {}
    # 1. 按 baby_id 删的业务表（checklist/growth 没 user_id 列，必须按 baby_id）
    # 注意：没有 sleep_records_v2 这张表——睡眠记录存在 feeding_records_v2 (type='sleep')，随其级联删除
    baby_tables_by_baby = [
        "feeding_records_v2", "checklist_items_v2", "growth_records_v2",
        "travel_records", "travel_lists",
        "temperature_records", "vaccine_records", "milestone_records",
    ]
    for table in baby_tables_by_baby:
        for bid in baby_ids:
            # vaccine_records/milestone_records 用 baby_id 列；其他表也都有 baby_id 列
            rs = db.execute(f"DELETE FROM {table} WHERE baby_id = ?", [bid])
            stats[table] = stats.get(table, 0) + 1

    # 2. 按 user_id 删（兜底，针对有 user_id 列的表；checklist_items_v2 无 user_id 列，不在内）
    user_tables = [
        "feeding_records_v2",
        "growth_records_v2",
        "travel_records", "travel_lists",
        "temperature_records", "vaccine_records",
        "milestone_records",
    ]
    for table in user_tables:
        db.execute(f"DELETE FROM {table} WHERE user_id = ?", [user_id])

    # 3. 删 babies（如果家庭里没有其他成员）
    for fid, _ in [(f[0], f[1]) for f in [(x, 0) for x in family_ids]]:
        if count_family_other_members(fid, user_id) == 0:
            # 家庭里只剩这一个人 → 删 babies + family_members + families
            db.execute("DELETE FROM babies WHERE family_id = ?", [fid])
            db.execute("DELETE FROM family_members WHERE family_id = ?", [fid])
            db.execute("DELETE FROM families WHERE family_id = ?", [fid])
        else:
            # 家庭里还有其他人 → 只删该用户的 family_members 行
            db.execute(
                "DELETE FROM family_members WHERE user_id = ? AND family_id = ?",
                [user_id, fid]
            )

    # 4. 删 sessions + users
    db.execute("DELETE FROM sessions WHERE user_id = ?", [user_id])
    db.execute("DELETE FROM users WHERE user_id = ?", [user_id])
    return stats


def main():
    confirm = "--confirm" in sys.argv
    print("=" * 60)
    print("用户清理脚本" + ("【真删模式 --confirm】" if confirm else "【预览模式 dry-run】"))
    print("=" * 60)

    users = get_all_users()
    print(f"\n库中共 {len(users)} 个用户\n")

    # 分类
    to_delete = []  # (user_id, phone, nick, reason)
    to_keep = []
    for uid, phone, nick in users:
        if phone in KEEP_PHONES:
            to_keep.append((uid, phone, nick, "保留清单"))
        elif phone in DELETE_PHONES:
            to_delete.append((uid, phone, nick, "测试手机号"))
        elif is_uuid_or_empty(phone):
            to_delete.append((uid, phone, nick, "孤儿(UUID/空phone)"))
        else:
            to_keep.append((uid, phone, nick, "未识别-保留"))

    print("--- 保留 ---")
    for uid, phone, nick, reason in to_keep:
        print(f"  {phone:<22} {nick:<14} ({reason})")
    print(f"\n--- 删除 ({len(to_delete)} 个) ---")
    for uid, phone, nick, reason in to_delete:
        print(f"  {phone:<22} {nick:<14} ({reason})  user_id={uid[:8]}...")

    if not to_delete:
        print("\n没有要删除的用户")
        return

    # 预览每个要删用户的关联数据
    print("\n--- 关联数据预览 ---")
    total_babies = 0
    total_families = 0
    for uid, phone, nick, _ in to_delete:
        families, babies = get_user_family_babies(uid)
        # 判断家庭是否独占
        solo = all(count_family_other_members(fid, uid) == 0 for fid, _ in families) if families else True
        flag = "独占(整家删)" if solo else "共享(只删本人)"
        print(f"  {phone:<22} family={len(families)}({flag}) babies={len(babies)}")
        total_babies += len(babies)
        total_families += len(families)

    print(f"\n汇总: 将删除 {len(to_delete)} 用户, {total_families} 家庭记录, {total_babies} 宝宝及关联业务记录")

    if not confirm:
        print("\n>>> 这是 dry-run 预览，未删除任何数据")
        print(">>> 确认无误后加 --confirm 重跑: docker exec baby-app python cleanup_test_users.py --confirm")
    else:
        print("\n>>> 开始删除...")
        for uid, phone, nick, _ in to_delete:
            families, babies = get_user_family_babies(uid)
            family_ids = [f[0] for f in families]
            baby_ids = babies
            stats = delete_user_chain(uid, family_ids, baby_ids, confirm=True)
            print(f"  [OK] {phone:<22} {nick}  babies={len(baby_ids)}")
        db.sync()
        print("\n>>> 删除完成，已 sync 到 Turso")
        # 验证
        remaining = get_all_users()
        print(f">>> 剩余用户数: {len(remaining)}")


if __name__ == "__main__":
    main()
