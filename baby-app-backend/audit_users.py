#!/usr/bin/env python3
"""
audit_users.py — 审计 users 表，列出每个用户关联的 family/baby/records 数量
用法: docker exec baby-app python audit_users.py
"""
from main import db

# 1. 所有用户
rs = db.execute("SELECT user_id, phone, nickname FROM users ORDER BY user_id").fetchall()
print(f"=== 用户审计 ({len(rs)} 个) ===\n")
print(f"{'#':<3} {'phone':<22} {'nickname':<14} {'fm':<4} {'babies':<7} {'feeds':<6} {'checklist':<9} {'sleep':<5} {'growth':<7} {'travel':<7}")
print("-" * 95)
for i, r in enumerate(rs, 1):
    uid, phone, nick = r[0], r[1] if r[1] else "(empty)", r[2] if r[2] else "-"
    # family_members
    fm = db.execute("SELECT family_id, role FROM family_members WHERE user_id = ?", [uid]).fetchall()
    fm_count = len(fm)
    family_ids = [r2[0] for r2 in fm]
    # babies（按 family_id 查，需先聚合）
    baby_count = 0
    if family_ids:
        for fid in family_ids:
            bs = db.execute("SELECT baby_id FROM babies WHERE family_id = ?", [fid]).fetchall()
            baby_count += len(bs)
    # 业务记录（按 user_id 直接查 _v2 表）
    feeds = len(db.execute("SELECT 1 FROM feeding_records_v2 WHERE user_id = ? LIMIT 1", [uid]).fetchall())
    chk = len(db.execute("SELECT 1 FROM checklist_items_v2 WHERE user_id = ? LIMIT 1", [uid]).fetchall())
    sleep = len(db.execute("SELECT 1 FROM sleep_records_v2 WHERE user_id = ? LIMIT 1", [uid]).fetchall())
    growth = len(db.execute("SELECT 1 FROM growth_records_v2 WHERE user_id = ? LIMIT 1", [uid]).fetchall())
    travel = len(db.execute("SELECT 1 FROM travel_records_v2 WHERE user_id = ? LIMIT 1", [uid]).fetchall())
    flag = ""
    if not phone or phone == uid or not phone.startswith("1"):
        flag = " ← UUID/空"
    elif phone.startswith("13800") or phone.startswith("13900"):
        flag = " ← 测试号段"
    print(f"{i:<3} {phone:<22} {nick:<14} {fm_count:<4} {baby_count:<7} {feeds:<6} {chk:<9} {sleep:<5} {growth:<7} {travel:<7}{flag}")

print("\n=== 说明 ===")
print("fm: 家庭成员数 | babies: 宝宝数 | feeds/chk/sleep/growth/travel: 业务记录数(0/1)")
print("← UUID/空: phone 为空或存了 UUID 的孤儿账户")
print("← 测试号段: 13800000999/13900000999 等")
