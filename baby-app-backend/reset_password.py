#!/usr/bin/env python3
"""
reset_password.py — 管理员重置用户密码脚本（无短信验证场景下的兜底方案）

用法（在 VPS 项目根目录 / 服务器 baby-app-backend 目录下）:
    python reset_password.py <手机号> <新密码>

示例:
    python reset_password.py 13410603471 newpass123

安全说明:
    - 只能由能 ssh 上服务器的人执行，等同于"服务器即权限"
    - 新密码 PBKDF2-HMAC-SHA256 + 随机 salt 哈希后写入 users 表
    - 执行后旧 session token 仍然有效（30 天），如需强制下线可一并清理 sessions 表
    - 不会打印任何密钥/哈希，只输出操作结果

依赖:
    复用 main.py 里的 TursoDB 和 _hash_password，避免重复实现导致哈希不一致
"""
import sys
import os
import re

# 确保能 import 同目录下的 main.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 复用 main.py 的数据库实例和哈希函数，保证与注册/登录走同一套逻辑
from main import db, _hash_password, _new_salt, PHONE_RE

def reset_password(phone: str, new_password: str) -> dict:
    """重置指定手机号用户的密码，返回 {ok, user_id, cleared_sessions}"""
    phone = phone.strip()
    if not PHONE_RE.match(phone):
        raise ValueError(f"手机号格式不正确: {phone}")
    if len(new_password) < 6:
        raise ValueError("新密码至少 6 位")

    # 查用户
    rs = db.execute("SELECT user_id FROM users WHERE phone = ?", [phone]).fetchall()
    if not rs:
        raise ValueError(f"手机号 {phone} 未注册")
    user_id = rs[0][0]

    # 生成新 salt + hash
    new_salt = _new_salt()
    new_hash = _hash_password(new_password, new_salt)

    # 更新密码
    db.execute(
        "UPDATE users SET password_hash = ?, password_salt = ? WHERE user_id = ?",
        [new_hash, new_salt, user_id]
    )

    # 清理该用户所有 session，强制重新登录（更安全）
    db.execute("DELETE FROM sessions WHERE user_id = ?", [user_id])

    db.sync()
    return {"ok": True, "user_id": user_id, "phone": phone}


def main():
    if len(sys.argv) != 3:
        print("用法: python reset_password.py <手机号> <新密码>")
        print("示例: python reset_password.py 13410603471 newpass123")
        sys.exit(1)

    phone, new_password = sys.argv[1], sys.argv[2]

    try:
        result = reset_password(phone, new_password)
    except ValueError as e:
        print(f"[失败] {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[失败] 重置密码时出错: {e}")
        sys.exit(1)

    print(f"[成功] 已重置密码")
    print(f"  手机号: {result['phone']}")
    print(f"  用户ID: {result['user_id']}")
    print(f"  已清理该用户所有会话，需用新密码重新登录")
    print(f"  （不会输出密码/哈希，请妥善保管新密码）")


if __name__ == "__main__":
    main()
