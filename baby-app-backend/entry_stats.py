#!/usr/bin/env python3
"""
entry_stats.py — 统计喂养记录的录入入口分布（一键记录 vs 添加记录弹窗）
用法：python entry_stats.py [天数]   # 默认30天，含全部历史可传 3650
"""
import sys
from collections import defaultdict
from main import db

DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 30

rows = db.execute(
    "SELECT date, entry_source, type, user_id FROM feeding_records_v2 "
    "WHERE date >= date('now', ?)", [f"-{DAYS} day"]).fetchall()

if not rows:
    print(f"近{DAYS}天没有记录")
    sys.exit(0)

src_label = {'quick': '一键记录', 'modal': '添加记录弹窗', '': '(旧数据/未知)'}
type_label = {'milk': '喂奶', 'solids': '辅食', 'diaper': '换尿布', 'sleep': '睡觉'}

# ---- 总分布 ----
by_src = defaultdict(int)
for r in rows:
    by_src[r[1] or ''] += 1
total = len(rows)
print(f"===== 近{DAYS}天 · 录入入口分布（共{total}条）=====")
for src, n in sorted(by_src.items(), key=lambda x: -x[1]):
    print(f"  {src_label.get(src, src):　<10} {n:>4} 条  {n*100//total}%")

# ---- 入口 × 记录类型 ----
print("\n===== 入口 × 记录类型 =====")
by_src_type = defaultdict(int)
for r in rows:
    by_src_type[(r[1] or '', r[2] or '?')] += 1
for (src, typ), n in sorted(by_src_type.items()):
    print(f"  {src_label.get(src, src):　<8} · {type_label.get(typ, typ):　<4} {n:>4} 条")

# ---- 按天趋势（最近14天）----
print("\n===== 最近14天逐日 =====")
by_day = defaultdict(lambda: defaultdict(int))
for r in rows:
    by_day[r[0]][r[1] or ''] += 1
for d in sorted(by_day.keys())[-14:]:
    day = by_day[d]
    q, m = day.get('quick', 0), day.get('modal', 0)
    print(f"  {d}  一键{q:>3} | 弹窗{m:>3}")

# ---- 记录人 × 入口（家里谁用哪个入口）----
print("\n===== 记录人 × 入口 =====")
uid_set = {(r[3] or '') for r in rows}
names = {}
for uid in uid_set:
    if not uid:
        names[''] = '(未知)'
        continue
    rs = db.execute(
        "SELECT nickname FROM family_members WHERE user_id = ? LIMIT 1", [uid]).fetchall()
    names[uid] = (rs[0][0] if rs and rs[0][0] else uid[:8])
by_user = defaultdict(lambda: defaultdict(int))
for r in rows:
    by_user[names.get(r[3] or '', '(未知)')][r[1] or ''] += 1
for name, d in sorted(by_user.items(), key=lambda x: -sum(x[1].values())):
    q, m = d.get('quick', 0), d.get('modal', 0)
    print(f"  {name:　<8} 一键{q:>3} | 弹窗{m:>3}")
