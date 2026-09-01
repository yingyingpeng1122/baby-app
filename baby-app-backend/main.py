from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime, timedelta
import calendar as _calendar
import uvicorn
import urllib.request
import urllib.parse
import json
import re
import os
import uuid
import random
import html as _html
import hashlib
import secrets
import hmac
from collections import deque

# ---------------- 应用 & 跨域 ----------------
app = FastAPI(title="Baby Growth Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Turso HTTP API 封装 ----------------
# 无需 libsql-experimental，直接走 HTTP 接口，零外部依赖
import ssl as _ssl

TURSO_DB_NAME = os.environ.get("TURSO_DB_NAME", "babyapp-yingyingpeng1122")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODUzMDcyMjEsImlkIjoiMDE5ZmFjOTktOTMwMS03YzRlLTg2YjktNDJjMDUzNjRmY2IwIiwia2lkIjoicEZwY243bzlLUXZFZmxuU1lueDhMTVAwSUdlamI1Rmp4LVduTWEtdGtWOCIsInJpZCI6IjY4YWJhM2ZkLTBkNWUtNGIwZC04ZDYzLTFkY2JhMzAzMjlhZSJ9.gzqVZnlcOaon1PClp2eWMY51VDnC_tGwYZlmXMdNdAqHGKxZ-1heSq0J1OeA-RVN2-t4_FhkaiJKRflMagclCA")
TURSO_API = f"https://{TURSO_DB_NAME}.turso.io/v2/pipeline"

# Windows Python 经常缺少根证书，创建一个宽松但安全的 SSL 上下文
_ssl_ctx = _ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = _ssl.CERT_NONE

# 复用单条长连接，避免每次查询都重建 TLS 握手
# 本地/跨地域网络下，这一改动可把 GET /family 这类多查询接口的延迟从 ~7s 降到 ~1s
import http.client as _http_client
_turso_parsed = urllib.parse.urlparse(TURSO_API)
_turso_host = _turso_parsed.netloc
_turso_path = _turso_parsed.path
_turso_conn = None

def _turso_post(body_bytes):
    global _turso_conn
    headers = {
        "Authorization": f"Bearer {TURSO_TOKEN}",
        "Content-Type": "application/json",
    }
    try:
        if _turso_conn is None:
            _turso_conn = _http_client.HTTPSConnection(_turso_host, timeout=30, context=_ssl_ctx)
        _turso_conn.request("POST", _turso_path, body=body_bytes, headers=headers)
        resp = _turso_conn.getresponse()
        return json.loads(resp.read().decode("utf-8")).get("results", [])
    except Exception:
        # 连接可能已断开，重建后重试一次
        _turso_conn = None
        try:
            _turso_conn = _http_client.HTTPSConnection(_turso_host, timeout=30, context=_ssl_ctx)
            _turso_conn.request("POST", _turso_path, body=body_bytes, headers=headers)
            resp = _turso_conn.getresponse()
            return json.loads(resp.read().decode("utf-8")).get("results", [])
        except Exception as e:
            print(f"[turso] request failed: {e}")
            raise

class TursoRow:
    """模拟 libsql Row，支持下标访问"""
    def __init__(self, values):
        self._v = values
    def __getitem__(self, i):
        return self._v[i]

class TursoResult:
    """模拟 fetchall() 返回"""
    def __init__(self, rows):
        self._rows = rows
    def fetchall(self):
        return self._rows

class TursoDB:
    """Turso HTTP API 轻量封装，提供 execute / sync 接口"""
    def __init__(self, api_url, token):
        self._url = api_url
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        self._batch = []

    def execute(self, sql, params=None):
        stmt = {"sql": sql}
        if params is not None:
            # Turso API args 格式：每个参数包一层 {"type": "...", "value": "..."}
            stmt["args"] = [_turso_arg(v) for v in params]
        self._batch.append({"type": "execute", "stmt": stmt})
        # 立即执行（简单场景），返回 TursoResult
        return self._flush_one()

    def sync(self):
        """批量提交残留语句（如果有）"""
        if self._batch:
            self._send_batch()
            self._batch = []

    def _flush_one(self):
        if not self._batch:
            return TursoResult([])
        resp = self._send_batch()
        self._batch = []
        # 解析返回的行
        try:
            result = resp[0]
            if result.get("type") == "ok":
                rows_data = result["response"]["result"].get("rows", [])
                cols = result["response"]["result"].get("cols", [])
                rows = []
                for row in rows_data:
                    values = [_parse_value(v) for v in row]
                    rows.append(TursoRow(values))
                return TursoResult(rows)
        except (IndexError, KeyError, TypeError) as e:
            print(f"[turso] parse error: {e}, resp={resp}")
        return TursoResult([])

    def _send_batch(self):
        body = json.dumps({"requests": self._batch}).encode("utf-8")
        try:
            return _turso_post(body)
        except Exception as e:
            print(f"[turso] request failed: {e}")
            raise

def _turso_arg(v):
    """将 Python 值转为 Turso API 参数格式"""
    if v is None:
        return {"type": "null"}
    if isinstance(v, bool):
        return {"type": "integer", "value": str(int(v))}
    if isinstance(v, int):
        return {"type": "integer", "value": str(v)}
    if isinstance(v, float):
        return {"type": "float", "value": v}
    return {"type": "text", "value": str(v)}

def _parse_value(v):
    """解析 Turso 返回的值"""
    if v is None:
        return None
    if isinstance(v, dict):
        t = v.get("type", "text")
        val = v.get("value")
        if t == "null" or val is None:
            return None
        if t == "integer":
            return int(val)
        if t == "float":
            return float(val)
        return val
    return v

db = TursoDB(TURSO_API, TURSO_TOKEN)

def generate_family_id():
    """生成 6 位随机家庭 ID（排除易混淆字符 O0I1）"""
    import random
    import string
    chars = string.ascii_uppercase + string.digits
    chars = ''.join(c for c in chars if c not in 'O0I1')
    return ''.join(random.choices(chars, k=6))

def init_db():
    db.execute("""CREATE TABLE IF NOT EXISTS profiles (
        user_id TEXT PRIMARY KEY,
        name TEXT, gender TEXT, birthday TEXT,
        height REAL, weight REAL,
        created_at TEXT DEFAULT (datetime('now'))
    )""")
    # 家庭系统表
    db.execute("""CREATE TABLE IF NOT EXISTS families (
        family_id TEXT PRIMARY KEY,
        family_name TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )""")
    # 注：旧的 users 表（仅 user_id + created_at）已在下方完整定义处用 CREATE OR REPLACE 重建，
    # 这里不再重复定义，避免 IF NOT EXISTS 跳过导致缺列。
    db.execute("""CREATE TABLE IF NOT EXISTS family_members (
        user_id TEXT PRIMARY KEY,
        family_id TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        nickname TEXT DEFAULT '',
        joined_at TEXT DEFAULT (datetime('now'))
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS babies (
        baby_id TEXT PRIMARY KEY,
        family_id TEXT NOT NULL,
        name TEXT, gender TEXT, birthday TEXT,
        height REAL, weight REAL,
        created_at TEXT DEFAULT (datetime('now'))
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS feeding_records_v2 (
        id TEXT, baby_id TEXT, date TEXT,
        time TEXT, amount REAL, type TEXT, note TEXT DEFAULT '',
        PRIMARY KEY (baby_id, date, id)
    )""")
    # 新增食物种类列（兼容旧库，列已存在则忽略）
    try:
        db.execute("ALTER TABLE feeding_records_v2 ADD COLUMN food_groups TEXT DEFAULT ''")
    except Exception:
        pass
    # 新增活动扩展列：duration(睡眠时长分钟) / kind(尿布类型 屎/尿/都有)
    try:
        db.execute("ALTER TABLE feeding_records_v2 ADD COLUMN duration INTEGER DEFAULT 0")
    except Exception:
        pass
    try:
        db.execute("ALTER TABLE feeding_records_v2 ADD COLUMN kind TEXT DEFAULT ''")
    except Exception:
        pass
    # 新增记录人列：哪位家庭成员记的（兼容旧库，列已存在则忽略）
    try:
        db.execute("ALTER TABLE feeding_records_v2 ADD COLUMN user_id TEXT DEFAULT ''")
    except Exception:
        pass
    # 新增成员昵称列（兼容旧库，列已存在则忽略）
    try:
        db.execute("ALTER TABLE family_members ADD COLUMN nickname TEXT DEFAULT ''")
    except Exception:
        pass
    # 新增生病模式开关列（按宝宝同步，兼容旧库，列已存在则忽略）
    try:
        db.execute("ALTER TABLE babies ADD COLUMN sick_mode INTEGER DEFAULT 0")
    except Exception:
        pass
    # 新增夜间作息时间列（每日作息规律：入睡时间 / 起床时间，HH:MM）
    try:
        db.execute("ALTER TABLE babies ADD COLUMN night_bedtime TEXT DEFAULT ''")
    except Exception:
        pass
    try:
        db.execute("ALTER TABLE babies ADD COLUMN night_wake_time TEXT DEFAULT ''")
    except Exception:
        pass
    db.execute("""CREATE TABLE IF NOT EXISTS checklist_items_v2 (
        baby_id TEXT, date TEXT, item_id TEXT, checked INTEGER,
        PRIMARY KEY (baby_id, date, item_id)
    )""")
    # 身高体重成长记录（可录入历史与最新数据）
    db.execute("""CREATE TABLE IF NOT EXISTS growth_records_v2 (
        id TEXT, baby_id TEXT, date TEXT,
        height REAL, weight REAL, note TEXT DEFAULT '',
        PRIMARY KEY (baby_id, date, id)
    )""")
    # 新增记录人列：哪位家庭成员记的（兼容旧库，列已存在则忽略）
    try:
        db.execute("ALTER TABLE growth_records_v2 ADD COLUMN user_id TEXT DEFAULT ''")
    except Exception:
        pass
    # 生病模式：体温记录
    db.execute("""CREATE TABLE IF NOT EXISTS temperature_records (
        id TEXT PRIMARY KEY, baby_id TEXT NOT NULL,
        datetime TEXT, temp REAL, note TEXT DEFAULT ''
    )""")
    # 新增记录人列：哪位家庭成员记的（兼容旧库，列已存在则忽略）
    try:
        db.execute("ALTER TABLE temperature_records ADD COLUMN user_id TEXT DEFAULT ''")
    except Exception:
        pass
    # 出行区：打包清单（生成记录 + 勾选状态）
    db.execute("""CREATE TABLE IF NOT EXISTS travel_lists (
        id TEXT, baby_id TEXT NOT NULL,
        dest_type TEXT, age_months INTEGER,
        items TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (baby_id, id)
    )""")
    # 新增记录人列：哪位家庭成员记的（兼容旧库，列已存在则忽略）
    try:
        db.execute("ALTER TABLE travel_lists ADD COLUMN user_id TEXT DEFAULT ''")
    except Exception:
        pass
    # 出行区：出行历史（独立轻量记录，不关联清单、不记带了什么）
    db.execute("""CREATE TABLE IF NOT EXISTS travel_records (
        id TEXT, baby_id TEXT NOT NULL,
        dest_name TEXT, dest_type TEXT,
        travel_date TEXT, age_months INTEGER,
        rating INTEGER, note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (baby_id, id)
    )""")
    # 新增记录人列：哪位家庭成员记的（兼容旧库，列已存在则忽略）
    try:
        db.execute("ALTER TABLE travel_records ADD COLUMN user_id TEXT DEFAULT ''")
    except Exception:
        pass
    # travel_records 兼容旧库：补 category 列（地点类型 park/amusement/farm/mall/museum/beach/mountain/ancient/garden）
    try:
        db.execute("ALTER TABLE travel_records ADD COLUMN category TEXT DEFAULT ''")
    except Exception:
        pass
    # 成长区：疫苗实际接种记录（VACCINE_LIBRARY 是静态表，存内存即可）
    db.execute("""CREATE TABLE IF NOT EXISTS vaccine_records (
        id TEXT PRIMARY KEY,
        baby_id TEXT NOT NULL,
        vaccine_id INTEGER NOT NULL,   -- 对应 VACCINE_LIBRARY.id
        administered_date TEXT NOT NULL,
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
    )""")
    # 新增记录人列：哪位家庭成员记的（兼容旧库，列已存在则忽略）
    try:
        db.execute("ALTER TABLE vaccine_records ADD COLUMN user_id TEXT DEFAULT ''")
    except Exception:
        pass
    try:
        db.execute("CREATE INDEX IF NOT EXISTS idx_vaccine_baby ON vaccine_records(baby_id, vaccine_id)")
    except Exception:
        pass
    # 成长区：里程碑首达记录（MILESTONE_LIBRARY 是静态库）
    db.execute("""CREATE TABLE IF NOT EXISTS milestone_records (
        id TEXT PRIMARY KEY,
        baby_id TEXT NOT NULL,
        milestone_id INTEGER NOT NULL,
        achieved_date TEXT NOT NULL,
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
    )""")
    # 新增记录人列：哪位家庭成员记的（兼容旧库，列已存在则忽略）
    try:
        db.execute("ALTER TABLE milestone_records ADD COLUMN user_id TEXT DEFAULT ''")
    except Exception:
        pass
    try:
        db.execute("CREATE INDEX IF NOT EXISTS idx_milestone_baby ON milestone_records(baby_id, milestone_id)")
    except Exception:
        pass
    # 账号体系：手机号 + 密码登录，替代 localStorage 随机 user_id
    # 注意：旧版代码可能已建过 users 表（仅 user_id + created_at），用 IF NOT EXISTS 会跳过导致缺列。
    # 先尝试建完整表（首次部署有效），再用 ALTER TABLE 补齐缺失列（已存在旧表时）。
    db.execute("""CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        nickname TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
    )""")
    # 兼容旧表：补齐缺失列（列已存在则忽略异常）
    # 注意 SQLite 不允许 ALTER TABLE ADD COLUMN 带 UNIQUE，phone 列加普通 TEXT，再建唯一索引
    for col, decl in [
        ("phone", "TEXT DEFAULT ''"),
        ("password_hash", "TEXT DEFAULT ''"),
        ("password_salt", "TEXT DEFAULT ''"),
        ("nickname", "TEXT DEFAULT ''"),
    ]:
        try:
            db.execute(f"ALTER TABLE users ADD COLUMN {col} {decl}")
        except Exception:
            pass
    try:
        db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)")
    except Exception:
        # 可能有旧 guest 行 phone 为空串/NULL 导致唯一索引冲突：先把空 phone 设为各自 user_id 保证唯一
        try:
            db.execute("UPDATE users SET phone = user_id WHERE phone = '' OR phone IS NULL")
            db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)")
        except Exception:
            pass
    db.execute("""CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL
    )""")
    # sessions 过期索引（清理用）
    try:
        db.execute("CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)")
    except Exception:
        pass
    # 旧数据迁移：profiles → 家庭 + 宝宝
    _migrate_profiles()

def _migrate_profiles():
    """将旧 profiles 表数据迁移到家庭系统"""
    try:
        rs = db.execute("SELECT user_id, name, gender, birthday, height, weight FROM profiles").fetchall()
        if not rs:
            return
        for r in rs:
            uid, name, gender, birthday, height, weight = r[0], r[1], r[2], r[3], r[4], r[5]
            # 检查是否已有家庭
            existing = db.execute("SELECT family_id FROM family_members WHERE user_id = ?", [uid]).fetchall()
            if existing:
                continue
            fid = generate_family_id()
            db.execute("INSERT OR IGNORE INTO families (family_id, family_name) VALUES (?, ?)", [fid, f"{name}的家庭"])
            db.execute("INSERT OR IGNORE INTO family_members (family_id, user_id, role) VALUES (?, ?, 'creator')", [fid, uid])
            bid = str(uuid.uuid4())[:8]
            db.execute("INSERT OR IGNORE INTO babies (baby_id, family_id, name, gender, birthday, height, weight) VALUES (?, ?, ?, ?, ?, ?, ?)",
                       [bid, fid, name, gender, birthday, height, weight])
        db.sync()
    except Exception as e:
        print(f"[migrate] profiles migration failed: {e}")

init_db()

# ---------------- 数据模型 ----------------
class BabyProfile(BaseModel):
    name: str
    gender: str
    birthday: str
    height: float
    weight: float

class FeedingAdvice(BaseModel):
    stage: str
    milk: str
    solids: str
    solidAmount: str
    types: List[str]
    videoTip: str
    videoUrl: str = ''
    feedingInterval: str = ''

class Activity(BaseModel):
    id: int
    type: str = ''
    title: str = ''
    desc: str = ''
    ageRange: List[int] = [0, 24]
    videoUrl: str = ''
    icon: str = ''        # 前端按 icon 渲染彩色图标（视觉/语言/运动/认知…）
    keyword: str = ''     # B 站搜索词
    stage: str = ''       # 所属阶段标签（纯乳期/辅食添加初期…）
    lang: str = ''        # 音乐区标签（中文儿歌/英文童谣），早教活动留空

class FeedingRecord(BaseModel):
    id: str = ''
    time: str
    amount: float
    type: str
    note: str = ''
    foodGroups: str = ''  # 逗号分隔的 WHO 食物组
    duration: int = 0     # 睡眠时长（分钟），仅 type=sleep 使用
    kind: str = ''        # 尿布类型：pee=尿 / poop=屎 / both=都有，仅 type=diaper 使用
    recorderName: str = ''  # 记录人昵称（家庭成员昵称）

class FeedingEvaluation(BaseModel):
    totalMilk: float
    totalSolids: float
    targetMilk: float
    targetSolidsText: str
    status: str
    milkStatus: str = 'good'
    solidsStatus: str = 'good'
    message: str
    suggestions: List[str] = []
    feedCount: int = 0
    avgInterval: str = ''
    records: List[FeedingRecord] = []
    # WHO 三项指标扩展
    effectiveTargetMilk: float = 0      # 辅食抵扣后的有效奶量目标
    milkDisplaced: bool = False         # 目标是否因辅食下调
    targetSolidsMeals: int = 0          # 建议辅食餐次
    solidsMealCount: int = 0            # 当日实际辅食餐次
    solidsDiversity: int = 0            # 当日食物种类数（去重）
    targetDiversity: int = 4            # WHO 最低食物种类
    solidsAmountPerMeal: float = 0      # 平均每餐克数
    solidsGroupsLogged: bool = False    # 是否记录了食物种类
    # 今日建议卡专用字段（批次4）
    recommendFeeds: int = 0            # 建议每日喂奶次数（5 if months>=6 else 6）
    perFeedMl: float = 0               # 建议单次奶量 = effectiveTargetMilk / recommendFeeds

class DashboardResponse(BaseModel):
    profile: BabyProfile
    months: int
    growthStandard: dict
    isWeightNormal: bool
    isHeightNormal: bool
    weightStatus: str = "normal"   # normal | high | low
    heightStatus: str = "normal"   # normal | high | low
    feedingAdvice: FeedingAdvice
    activities: List[Activity]
    music: List[Activity] = []
    stories: List[Activity] = []   # 绘本区：按月龄推荐经典绘本 + 共读示范视频
    stageTip: dict = {}   # 阶段提醒：{ featured, current, after }

class ChecklistItem(BaseModel):
    id: str
    label: str
    desc: str = ''
    icon: str = 'check'
    checked: bool = False

class ChecklistToggleRequest(BaseModel):
    itemId: str
    checked: bool

# 运行时覆盖的活动视频 URL（全局，不按用户区分）
activity_videos = {}

# ---------------- 多用户辅助 ----------------
def get_uid(request: Request) -> str:
    """身份识别：优先 Authorization: Bearer token；兼容期 fallback 到 X-User-Id header。"""
    # 1) token 解析（推荐路径）
    uid = _resolve_token(request)
    if uid:
        return uid
    # 2) 兼容期：旧的 localStorage 随机 user_id（让旧前端在迁移过渡期仍可用）
    uid = request.headers.get("X-User-Id", "").strip()
    if not uid:
        raise HTTPException(status_code=401, detail="未登录：请先登录")
    return uid

def _get_profile(uid: str) -> Optional[BabyProfile]:
    rs = db.execute("SELECT name, gender, birthday, height, weight FROM profiles WHERE user_id = ?", [uid]).fetchall()
    if not rs:
        return None
    r = rs[0]
    return BabyProfile(name=r[0], gender=r[1], birthday=r[2], height=r[3], weight=r[4])

# ---------------- 家庭系统辅助函数 ----------------
def get_baby_id(request: Request) -> str:
    """从 X-Baby-Id header 获取当前操作的宝宝 ID"""
    bid = request.headers.get("X-Baby-Id", "").strip()
    if not bid:
        raise HTTPException(status_code=400, detail="X-Baby-Id header required")
    return bid

def get_family_id(request: Request) -> str:
    """从 X-User-Id 查找用户所属家庭 ID"""
    uid = get_uid(request)
    rs = db.execute("SELECT family_id FROM family_members WHERE user_id = ?", [uid]).fetchall()
    if not rs:
        raise HTTPException(status_code=403, detail="Not in any family. Please create or join one first.")
    return rs[0][0]

# 记录人昵称缓存：进程内 LRU，避免 N+1 查询（疫苗 44 / 里程碑 50 / 各类列表每条都查一次）
# 改昵称时通过 _invalidate_recorder_cache(uid) 主动失效
import functools
import threading

_recorder_lock = threading.Lock()

@functools.lru_cache(maxsize=512)
def _recorder_name_cached(uid: str) -> str:
    """把 user_id 翻译成家庭成员昵称；查不到返回空串。结果缓存进进程 LRU。"""
    if not uid:
        return ''
    try:
        rs = db.execute("SELECT nickname FROM family_members WHERE user_id = ?", [uid]).fetchall()
        if rs:
            return rs[0][0] or ''
        # 退化路径：若未在 family_members 中，尝试 users.nickname
        rs2 = db.execute("SELECT nickname FROM users WHERE user_id = ?", [uid]).fetchall()
        if rs2:
            return rs2[0][0] or ''
    except Exception:
        pass
    return ''

def _invalidate_recorder_cache(uid: str | None = None):
    """改昵称后清缓存：传 uid 只清那一个；不传清全部"""
    with _recorder_lock:
        if uid is None:
            _recorder_name_cached.cache_clear()
        else:
            _recorder_name_cached.cache_clear()  # lru_cache 不支持单条清除，整表清即可（量小）

def _recorder_name(uid: str) -> str:
    """对外接口保持不变，走缓存版"""
    return _recorder_name_cached(uid)
    return ''

def _get_baby_profile(baby_id: str) -> Optional[dict]:
    """按 baby_id 获取宝宝档案（返回 dict，兼容旧代码）"""
    rs = db.execute("SELECT name, gender, birthday, height, weight, night_bedtime, night_wake_time FROM babies WHERE baby_id = ?", [baby_id]).fetchall()
    if not rs:
        return None
    r = rs[0]
    return {"name": r[0], "gender": r[1], "birthday": r[2], "height": r[3], "weight": r[4], "night_bedtime": r[5] or "", "night_wake_time": r[6] or ""}

# ---------------- B 站视频自动检索 ----------------
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "video_cache.json")
_video_cache = {}

def _load_cache():
    global _video_cache
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            _video_cache = json.load(f)
    except Exception:
        _video_cache = {}

def _save_cache():
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(_video_cache, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def _http_get(url, headers=None, timeout=15):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout, context=_ssl_ctx) as r:
        return r.read().decode("utf-8", "ignore")

def search_bilibili(keyword):
    if not keyword:
        return ''
    if keyword in _video_cache:
        return _video_cache[keyword]
    try:
        url = "https://search.bilibili.com/all?" + urllib.parse.urlencode({"keyword": keyword})
        page = _http_get(url, {"User-Agent": UA, "Referer": "https://www.bilibili.com/"})
        # 抽取所有视频结果锚点，并尽量取到标题，用于“按标题相关度挑选”，
        # 避免取到的第一个结果标题与卡片名称（关键词）对不上。
        anchors = re.findall(r'<a\b[^>]*?href="//www\.bilibili\.com/video/BV[0-9A-Za-z]{10}"[^>]*>', page)
        cand = []
        for a in anchors:
            bv = re.search(r'BV[0-9A-Za-z]{10}', a)
            if not bv:
                continue
            tm = re.search(r'title="([^"]*)"', a)
            title = _html.unescape(tm.group(1)) if tm else ''
            cand.append((bv.group(0), title))
        if not cand:
            # 退化：仅按 BV 号
            bvs = re.findall(r'BV[0-9A-Za-z]{10}', page)
            cand = [(b, '') for b in bvs]
        if cand:
            kw = re.sub(r'\s+', '', keyword).lower()
            tokens = [t for t in re.split(r'[，,。、\s]+', kw) if t]
            # 音乐/儿歌相关度加成词：标题含这些词的视频是演唱版/演奏版，加分
            _music_pos = ['儿歌', '童谣', '演唱', '唱歌', '演奏', '律动', '摇篮曲',
                          'song', 'sing', 'nursery', 'rhyme', 'lullaby', 'kids', 'children']
            # 降分词：标题含这些词的视频多半是动画/故事片/配音版，不是纯音乐
            _music_neg = ['动画', '故事', '配音', '中文版', '英文版', '全集', 'episode',
                           'cartoon', 'story', 'dubbed', 'full episode']
            def _score(t):
                if not t:
                    return 0
                t2 = re.sub(r'\s+', '', t).lower()
                base = sum(1 for tok in tokens if tok and tok in t2)
                tl = t.lower()
                # 音乐相关度加成
                for w in _music_pos:
                    if w in tl:
                        base += 0.5
                        break
                # 非音乐降分
                for w in _music_neg:
                    if w in tl:
                        base -= 0.6
                        break
                return base
            cand.sort(key=lambda x: _score(x[1]), reverse=True)
            bvid = cand[0][0]
            player = f"https://player.bilibili.com/player.html?bvid={bvid}&page=1&high_quality=1&danmaku=0"
            _video_cache[keyword] = player
            _save_cache()
            return player
    except Exception as e:
        print("[search_bilibili] error:", keyword, "->", e)
    return ''

_load_cache()

# ---------------- 业务逻辑 ----------------
def calculate_months(birthday_str: str, as_of: date | None = None) -> int:
    birth = datetime.strptime(birthday_str, "%Y-%m-%d").date()
    ref = as_of or date.today()
    months = (ref.year - birth.year) * 12 + (ref.month - birth.month)
    return max(0, months)

def _weight_status(value, base) -> str:
    """体重细分：达标 / 略轻 / 超轻 / 略重 / 超重"""
    if value is None or base is None:
        return 'normal'
    if value < base * 0.75:
        return 'under'   # 超轻
    if value < base * 0.90:
        return 'light'   # 略轻
    if value <= base * 1.10:
        return 'normal'  # 达标
    if value <= base * 1.25:
        return 'heavy'   # 略重
    return 'over'        # 超重


def _height_status(value, base) -> str:
    """身高细分：达标 / 偏矮 / 偏高"""
    if value is None or base is None:
        return 'normal'
    if value < base * 0.92:
        return 'short'   # 偏矮
    if value <= base * 1.08:
        return 'normal'  # 达标
    return 'tall'        # 偏高


def get_growth_standard(gender: str, months: int) -> dict:
    if months < 0:
        months = 0
    base_w_boy = 3.3 + (months * 0.7)
    base_w_girl = 3.2 + (months * 0.65)
    base_h_boy = 50 + (months * 2.5)
    base_h_girl = 49 + (months * 2.3)
    if gender == 'boy':
        base_w, base_h = base_w_boy, base_h_boy
    else:
        base_w, base_h = base_w_girl, base_h_girl
    return {
        # 达标区间（用于进度条「参考区间」展示）
        "minW": round(base_w * 0.9, 1), "maxW": round(base_w * 1.1, 1),
        "minH": round(base_h * 0.92, 1), "maxH": round(base_h * 1.08, 1),
        # 基准值，用于细分判定（偏高/偏矮、超重/略重…）
        "baseW": round(base_w, 2), "baseH": round(base_h, 2),
    }

FEED_VIDEO_KEYWORD = {
    "纯乳期": "新生儿 母乳喂养 冲奶粉 教程",
    "辅食添加初期": "婴儿 第一口辅食 高铁米粉 制作",
    "咀嚼吞咽期": "宝宝 辅食 制作 手指食物 教程",
    "幼儿饮食过渡期": "幼儿 一日三餐 辅食 制作 教程",
}

# ---------------- 早教活动库（按阶段 + 类型，每次随机抽 3-4 个覆盖多类型）----------------
# category 作为前端图标/配色 key；stage 作为副标题；keyword 走 B 站搜索
STAGE_LABEL = {0: '纯乳期', 1: '辅食添加初期', 2: '咀嚼吞咽期', 3: '幼儿期'}

def _stage_key(months: int) -> int:
    if months < 6:
        return 0
    if months < 8:
        return 1
    if months < 12:
        return 2
    return 3

ACTIVITY_LIBRARY = {
    0: [  # 纯乳期 (<6月)
        {'id': 101, 'category': 'vision',   'title': '黑白卡追视',   'desc': '黑白高对比卡锻炼视觉聚焦与追视', 'keyword': '婴儿 黑白卡 追视训练', 'ageRange': [0, 3], 'stage': '纯乳期'},
        {'id': 103, 'category': 'language', 'title': '面对面说话',   'desc': '多和宝宝说话，建立语言启蒙', 'keyword': '婴儿 语言启蒙 多说话', 'ageRange': [0, 6], 'stage': '纯乳期'},
        {'id': 104, 'category': 'social',   'title': '夸张表情互动', 'desc': '做鬼脸、微笑回应，促进社交', 'keyword': '婴儿 表情互动 社交', 'ageRange': [0, 6], 'stage': '纯乳期'},
        {'id': 105, 'category': 'motor',    'title': '俯卧抬头练习', 'desc': '清醒时趴卧，锻炼颈肩力量', 'keyword': '婴儿 俯卧抬头 tummy time', 'ageRange': [0, 6], 'stage': '纯乳期'},
        {'id': 106, 'category': 'cog',      'title': '摇铃追声',     'desc': '用摇铃引导转头寻声', 'keyword': '婴儿 追声 摇铃 听觉训练', 'ageRange': [0, 4], 'stage': '纯乳期'},
        {'id': 107, 'category': 'reading',  'title': '布书触摸',     'desc': '软布书刺激触觉与专注', 'keyword': '婴儿 布书 触摸书', 'ageRange': [0, 6], 'stage': '纯乳期'},
        {'id': 108, 'category': 'vision',   'title': '红色挂饰追视', 'desc': '红色高对比物吸引注视', 'keyword': '婴儿 红色玩具 追视', 'ageRange': [0, 4], 'stage': '纯乳期'},
    ],
    1: [  # 辅食添加初期 (6-8月)
        {'id': 111, 'category': 'fine',     'title': '抓握牙胶',     'desc': '练习手掌抓握', 'keyword': '婴儿 抓握 牙胶 精细动作', 'ageRange': [4, 8], 'stage': '辅食添加初期'},
        {'id': 112, 'category': 'motor',    'title': '辅助独坐',     'desc': '靠坐练习腰腹力量', 'keyword': '宝宝 辅助坐 练习', 'ageRange': [5, 9], 'stage': '辅食添加初期'},
        {'id': 113, 'category': 'language', 'title': '辅食发声模仿', 'desc': '吃饭时模仿咿呀声', 'keyword': '婴儿 语言启蒙 发音 互动 游戏', 'ageRange': [6, 10], 'stage': '辅食添加初期'},
        {'id': 114, 'category': 'cog',      'title': '躲猫猫',       'desc': '理解客体永久性', 'keyword': '宝宝 躲猫猫 游戏', 'ageRange': [4, 10], 'stage': '辅食添加初期'},
        {'id': 116, 'category': 'reading',  'title': '绘本指认',     'desc': '指认绘本大幅图', 'keyword': '宝宝 绘本 亲子阅读', 'ageRange': [6, 18], 'stage': '辅食添加初期'},
        {'id': 117, 'category': 'life',     'title': '学用勺感知',   'desc': '让宝宝抓勺玩食物', 'keyword': '宝宝 精细动作 抓握 训练', 'ageRange': [6, 12], 'stage': '辅食添加初期'},
        {'id': 118, 'category': 'vision',   'title': '蔬果卡片认知', 'desc': '彩色蔬果图刺激视觉', 'keyword': '宝宝 认物 卡片 认知 游戏', 'ageRange': [6, 12], 'stage': '辅食添加初期'},
        {'id': 119, 'category': 'social',   'title': '照镜子认脸',   'desc': '镜前指认五官', 'keyword': '宝宝 照镜子 认脸', 'ageRange': [6, 12], 'stage': '辅食添加初期'},
        {'id': 120, 'category': 'fine',     'title': '捏取溶豆',     'desc': '拇指食指捏小食', 'keyword': '宝宝 精细动作 捏取 训练', 'ageRange': [7, 12], 'stage': '辅食添加初期'},
    ],
    2: [  # 咀嚼吞咽期 (8-12月)
        {'id': 121, 'category': 'motor',    'title': '爬行训练',     'desc': '创设环境鼓励爬行', 'keyword': '宝宝 爬行 训练', 'ageRange': [7, 12], 'stage': '咀嚼吞咽期'},
        {'id': 122, 'category': 'fine',     'title': '手指食物自喂', 'desc': '抓握小块食物自己吃', 'keyword': '宝宝 拇指食指 捏取 训练', 'ageRange': [8, 14], 'stage': '咀嚼吞咽期'},
        {'id': 123, 'category': 'language', 'title': '指物命名',     'desc': '指认物品说名称', 'keyword': '宝宝 指物 命名 语言', 'ageRange': [8, 18], 'stage': '咀嚼吞咽期'},
        {'id': 124, 'category': 'cog',      'title': '套杯叠叠乐',   'desc': '大小杯嵌套认知', 'keyword': '宝宝 套杯 叠叠乐', 'ageRange': [9, 18], 'stage': '咀嚼吞咽期'},
        {'id': 126, 'category': 'reading',  'title': '故事共读',     'desc': '每天固定故事时间', 'keyword': '宝宝 绘本 讲故事', 'ageRange': [8, 24], 'stage': '咀嚼吞咽期'},
        {'id': 127, 'category': 'life',     'title': '水杯学饮',     'desc': '用学饮杯喝水', 'keyword': '宝宝 学饮杯 喝水', 'ageRange': [9, 18], 'stage': '咀嚼吞咽期'},
        {'id': 128, 'category': 'social',   'title': '分享游戏',     'desc': '轮流玩培养等待', 'keyword': '宝宝 分享 轮流 游戏', 'ageRange': [9, 24], 'stage': '咀嚼吞咽期'},
        {'id': 129, 'category': 'vision',   'title': '形状配对',     'desc': '形状积木配对', 'keyword': '宝宝 形状 配对 积木', 'ageRange': [10, 18], 'stage': '咀嚼吞咽期'},
        {'id': 130, 'category': 'motor',    'title': '扶站练习',     'desc': '扶物站立练腿力', 'keyword': '宝宝 扶站 练习', 'ageRange': [9, 14], 'stage': '咀嚼吞咽期'},
    ],
    3: [  # 幼儿期 (>=12月)
        {'id': 131, 'category': 'motor',    'title': '独立行走',     'desc': '鼓励独走与平衡', 'keyword': '幼儿 学走路 平衡', 'ageRange': [12, 36], 'stage': '幼儿期'},
        {'id': 132, 'category': 'fine',     'title': '积木垒高',     'desc': '垒高与推倒理解因果', 'keyword': '幼儿 搭积木 垒高', 'ageRange': [12, 36], 'stage': '幼儿期'},
        {'id': 133, 'category': 'language', 'title': '唱儿歌识字',   'desc': '儿歌中认物识字', 'keyword': '幼儿 儿歌 识字', 'ageRange': [12, 36], 'stage': '幼儿期'},
        {'id': 134, 'category': 'cog',      'title': '拼图入门',     'desc': '简单拼图练逻辑', 'keyword': '幼儿 拼图 入门', 'ageRange': [18, 36], 'stage': '幼儿期'},
        {'id': 135, 'category': 'life',     'title': '自己吃饭',     'desc': '练习用勺叉自主进餐', 'keyword': '幼儿 精细动作 用勺 训练', 'ageRange': [12, 36], 'stage': '幼儿期'},
        {'id': 136, 'category': 'social',   'title': '同伴游戏',     'desc': '和其他宝宝互动', 'keyword': '幼儿 同伴 社交 游戏', 'ageRange': [12, 36], 'stage': '幼儿期'},
        {'id': 137, 'category': 'reading',  'title': '图画书精读',   'desc': '读图讲故事问答', 'keyword': '幼儿 绘本 精读', 'ageRange': [12, 36], 'stage': '幼儿期'},
        {'id': 139, 'category': 'life',     'title': '穿脱鞋子',     'desc': '练习自己穿鞋', 'keyword': '幼儿 穿鞋 练习', 'ageRange': [24, 48], 'stage': '幼儿期'},
        {'id': 140, 'category': 'vision',   'title': '颜色认知',     'desc': '辨认基础颜色', 'keyword': '幼儿 颜色 认知', 'ageRange': [18, 36], 'stage': '幼儿期'},
    ],
}

def get_feeding_advice(months: int) -> FeedingAdvice:
    if months < 6:
        fa = FeedingAdvice(
            stage="纯乳期", milk="按需喂养，约 800-1000ml/天", solids="不需要",
            solidAmount="0g", types=["母乳", "配方奶"], videoTip="此阶段无需辅食",
            feedingInterval="建议间隔 2-3 小时（约 8-12 次/天）")
    elif months < 8:
        fa = FeedingAdvice(
            stage="辅食添加初期", milk="保持 600-800ml/天", solids="需要",
            solidAmount="10-20g", types=["强化铁米粉", "菜泥"], videoTip="第一口辅食建议高铁米粉",
            feedingInterval="奶间隔 3-4 小时，辅食 1-2 次/天")
    elif months < 12:
        fa = FeedingAdvice(
            stage="咀嚼吞咽期", milk="保持 600ml/天左右", solids="需要",
            solidAmount="50-100g/餐", types=["肉泥", "稠粥", "蛋黄"], videoTip="尝试手指食物",
            feedingInterval="奶间隔 3-4 小时，辅食 2-3 次/天")
    else:
        fa = FeedingAdvice(
            stage="幼儿饮食过渡期", milk="350-500ml/天", solids="主要营养来源",
            solidAmount="正常三餐", types=["软饭", "小块肉类", "全蛋"], videoTip="培养自主进食",
            feedingInterval="一日三餐定时，上午/下午各加餐 1 次")
    keyword = FEED_VIDEO_KEYWORD.get(fa.stage, f"{fa.stage} 辅食 制作")
    fa.videoUrl = search_bilibili(keyword)
    return fa

def parse_target_milk(milk_str: str) -> float:
    nums = re.findall(r'(\d+)\s*[-~]\s*(\d+)', milk_str)
    if nums:
        return (int(nums[0][0]) + int(nums[0][1])) / 2
    nums = re.findall(r'(\d+)', milk_str)
    if nums:
        return float(nums[-1])
    return 0

# ---------------- 喂养评估辅助（WHO/IYCF 口径）----------------
def _solids_displace_threshold(months: int) -> float:
    """当日辅食总克数达到该值，奶量目标下调（辅食挤占奶）。"""
    if months < 8:
        return 120.0
    if months < 12:
        return 150.0
    return 200.0

def _norm_feed_type(raw):
    """把喂养记录里的 type 统一成规范值 'milk' / 'solids' / 'diaper' / 'sleep' / 'other'。
    兼容历史数据（中文：母乳/配方奶/辅食）与当前前端写入的英文（milk/solids/diaper/sleep）。"""
    if not raw:
        return 'other'
    t = str(raw).strip().lower()
    if t in ('milk', '母乳', '配方奶', 'breast', 'formula', 'breast_milk', 'formula_milk'):
        return 'milk'
    if t in ('solids', '辅食', 'solid', 'food'):
        return 'solids'
    if t in ('diaper', '换尿布', '尿布', '尿不湿'):
        return 'diaper'
    if t in ('sleep', '睡觉', '睡眠'):
        return 'sleep'
    return 'other'

def _target_meals(months: int) -> int:
    if months < 8:
        return 2
    return 3

def _parse_food_groups(food_groups) -> list:
    if not food_groups:
        return []
    return [g.strip() for g in str(food_groups).split(',') if g.strip()]

def _day_level(total_milk, total_solids, meal_count, diversity, months, target_milk, needs_solids):
    """返回 'good' / 'low' / 'high'（奶量用动态目标；辅食仅看「是否吃到了」，餐次/种类为建议项）。
    奶量需达到目标（含辅食下调后的目标）才算充足，未达即不足。"""
    eff = target_milk
    if target_milk > 0 and total_solids >= _solids_displace_threshold(months):
        eff = target_milk * 0.75
    milk_status = 'good'
    if eff > 0:
        ratio = total_milk / eff
        if ratio < 1.0:
            milk_status = 'low'
        elif ratio > 1.3:
            milk_status = 'high'
    solids_status = 'good'
    # 辅食仅在「需要辅食却完全没吃」时判不足；餐次/种类不足只作为建议，不拉低整体结论
    if needs_solids and total_solids == 0:
        solids_status = 'low'
    statuses = [s for s in (milk_status, solids_status) if s != 'good']
    if not statuses:
        return 'good'
    if 'low' in statuses:
        return 'low'
    if 'high' in statuses:
        return 'high'
    return 'good'

def get_activities(months: int) -> List[Activity]:
    """按阶段返回 3-4 个活动，保证覆盖多种类型，每次调用重新随机。"""
    sk = _stage_key(months)
    pool = ACTIVITY_LIBRARY.get(sk, [])
    if not pool:
        return []

    # 按类型分组，保证多样性
    by_cat = {}
    for item in pool:
        by_cat.setdefault(item['category'], []).append(item)

    cats = list(by_cat.keys())
    random.shuffle(cats)
    n = min(random.choice([3, 4]), len(cats))

    chosen = []
    for c in cats[:n]:
        chosen.append(random.choice(by_cat[c]))
    random.shuffle(chosen)

    results = []
    for item in chosen:
        a = Activity(
            id=item['id'],
            type=item['category'],
            title=item['title'],
            desc=item['desc'],
            ageRange=item['ageRange'],
            videoUrl='#',
            icon=item['category'],
            keyword=item['keyword'],
            stage=item['stage'],
        )
        if not a.videoUrl or a.videoUrl == '#':
            a.videoUrl = search_bilibili(item['keyword'])
        if a.id in activity_videos:
            a.videoUrl = activity_videos[a.id]
        results.append(a)
    return results

# ---------------- 音乐区（中文儿歌/童谣 + 英文 nursery rhymes，每次随机 3-4 个，中英文都有）----------------
# lang 用于前端标签（中文儿歌 / 英文童谣）；keyword 走 B 站搜索；icon 统一用 music
MUSIC_LIBRARY = [
    # —— 中文儿歌 / 童谣（keyword 末尾统一加"演唱"限定，避免 B 站返回动画/故事片）——
    {'id': 201, 'title': '小星星',       'desc': '一闪一闪亮晶晶，经典中文儿歌', 'keyword': '小星星 儿歌 演唱 中文', 'lang': '中文儿歌'},
    {'id': 202, 'title': '两只老虎',     'desc': '简单旋律，认识动物', 'keyword': '两只老虎 儿歌 演唱', 'lang': '中文儿歌'},
    {'id': 203, 'title': '摇篮曲',       'desc': '轻柔哼唱，安抚入睡', 'keyword': '摇篮曲 儿歌 演唱 催眠', 'lang': '中文儿歌'},
    {'id': 204, 'title': '找朋友',       'desc': '互动游戏，培养社交', 'keyword': '找朋友 儿歌 演唱 互动', 'lang': '中文儿歌'},
    {'id': 205, 'title': '小毛驴',       'desc': '俏皮节奏，跟唱律动', 'keyword': '小毛驴 儿歌 演唱', 'lang': '中文儿歌'},
    {'id': 206, 'title': '数鸭子',       'desc': '数数启蒙，欢快好记', 'keyword': '数鸭子 儿歌 演唱', 'lang': '中文儿歌'},
    {'id': 207, 'title': '拔萝卜',       'desc': '合作主题，亲子共唱', 'keyword': '拔萝卜 儿歌 演唱', 'lang': '中文儿歌'},
    {'id': 208, 'title': '小白兔白又白', 'desc': '认识小动物，轻快童谣', 'keyword': '小白兔白又白 童谣 演唱 儿歌', 'lang': '中文儿歌'},
    {'id': 209, 'title': '身体音阶歌',   'desc': '指认身体部位，边唱边动', 'keyword': '身体音阶歌 儿歌 演唱 认识身体', 'lang': '中文儿歌'},
    {'id': 210, 'title': '刷牙歌',       'desc': '养成刷牙好习惯', 'keyword': '刷牙歌 儿歌 演唱 习惯', 'lang': '中文儿歌'},
    {'id': 211, 'title': '三只小熊',     'desc': '中文版亲子律动', 'keyword': '三只小熊 儿歌 演唱', 'lang': '中文儿歌'},
    # —— 从早教活动区迁移过来的音乐律动类（中文）——
    {'id': 102, 'title': '莫扎特安睡曲', 'desc': '轻柔古典乐安抚情绪助眠', 'keyword': '莫扎特 摇篮曲 安睡曲 演奏', 'lang': '中文儿歌'},
    {'id': 115, 'title': '儿歌律动',     'desc': '跟儿歌拍手律动', 'keyword': '儿歌律动 演唱 认识身体', 'lang': '中文儿歌'},
    {'id': 125, 'title': '节奏打击',     'desc': '敲打乐器感受节奏', 'keyword': '宝宝 打击乐 节奏 演奏', 'lang': '中文儿歌'},
    {'id': 138, 'title': '律动跳舞',     'desc': '随音乐自由舞动', 'keyword': '幼儿 律动 跳舞 儿歌', 'lang': '中文儿歌'},
    # —— 英文 nursery rhymes / songs（keyword 加 "sing along" 让 B 站返回演唱版而非动画故事）——
    {'id': 221, 'title': 'Twinkle Twinkle Little Star', 'desc': '英文经典摇篮曲', 'keyword': 'Twinkle Twinkle Little Star nursery rhyme sing along', 'lang': '英文童谣'},
    {'id': 222, 'title': 'Old MacDonald Had a Farm', 'desc': '认识农场动物与叫声', 'keyword': 'Old MacDonald Had a Farm nursery rhyme sing along', 'lang': '英文童谣'},
    {'id': 223, 'title': 'Wheels on the Bus', 'desc': '交通工具拟声儿歌', 'keyword': 'Wheels on the Bus nursery rhyme sing along', 'lang': '英文童谣'},
    {'id': 224, 'title': 'Baby Shark', 'desc': '活泼洗脑，亲子共舞', 'keyword': 'Baby Shark song sing along kids', 'lang': '英文童谣'},
    {'id': 225, 'title': 'If You Are Happy', 'desc': '情绪动作儿歌', 'keyword': 'If You are Happy and You Know It nursery rhyme sing along', 'lang': '英文童谣'},
    {'id': 226, 'title': 'Head Shoulders Knees and Toes', 'desc': '指认身体部位英文歌', 'keyword': 'Head Shoulders Knees and Toes song sing along kids', 'lang': '英文童谣'},
    {'id': 227, 'title': 'The ABC Song', 'desc': '字母启蒙英文歌', 'keyword': 'ABC song alphabet nursery rhyme sing', 'lang': '英文童谣'},
    # —— Five Little Monkeys 已迁移到绘本区（id=339）——本质是 Eileen Christelow 的经典绘本
    {'id': 229, 'title': 'Row Your Boat', 'desc': '轻柔英文摇篮曲', 'keyword': 'Row Row Row Your Boat nursery rhyme sing along', 'lang': '英文童谣'},
    {'id': 230, 'title': 'London Bridge', 'desc': '经典英文童谣', 'keyword': 'London Bridge is Falling Down nursery rhyme sing along', 'lang': '英文童谣'},
    {'id': 231, 'title': 'Itsy Bitsy Spider', 'desc': '动作英文儿歌', 'keyword': 'Itsy Bitsy Spider nursery rhyme sing along kids', 'lang': '英文童谣'},
]

# ---------------- 成长区：疫苗日历 ----------------
# 中国《国家免疫规划疫苗儿童免疫程序表》及 commonly 接种的自费替代苗（按月龄排序）
# month: 接种起始月龄（0 = 出生时；-1 表示按年龄复种，如 6 岁 booster）
# doses: 该疫苗总共需要的剂次数（同一种疫苗多次接种）
# seq: 当前剂次序号（1-based）
# is_nip: True = 国家免疫规划（免费，必须打）；False = 自费替代苗（推荐）
# prevent: 预防的疾病
# 来源：国家疾控局《国家免疫规划疫苗儿童免疫程序表（2021 版）》
VACCINE_LIBRARY = [
    # —— 0 月（出生时）——
    {'id': 1,  'name': '乙肝疫苗',         'seq': 1, 'month': 0,  'doses': 3, 'is_nip': True,  'prevent': '乙型病毒性肝炎',         'note': '出生 24h 内接种第 1 剂'},
    {'id': 2,  'name': '卡介苗',           'seq': 1, 'month': 0,  'doses': 1, 'is_nip': True,  'prevent': '结核病',               'note': '出生 24h 内接种 1 剂'},
    # —— 1 月 ——
    {'id': 3,  'name': '乙肝疫苗',         'seq': 2, 'month': 1,  'doses': 3, 'is_nip': True,  'prevent': '乙型病毒性肝炎',         'note': '第 2 剂'},
    # —— 2 月 ——
    {'id': 4,  'name': '脊灰灭活疫苗',      'seq': 1, 'month': 2,  'doses': 4, 'is_nip': True,  'prevent': '脊髓灰质炎',            'note': 'IPV，第 1 剂'},
    # —— 3 月 ——
    {'id': 5,  'name': '脊灰减毒疫苗',      'seq': 2, 'month': 3,  'doses': 4, 'is_nip': True,  'prevent': '脊髓灰质炎',            'note': 'bOPV，第 2 剂（滴剂/糖丸）'},
    {'id': 6,  'name': '百白破疫苗',        'seq': 1, 'month': 3,  'doses': 4, 'is_nip': True,  'prevent': '百日咳/白喉/破伤风',     'note': 'DTaP，第 1 剂'},
    # —— 4 月 ——
    {'id': 7,  'name': '脊灰减毒疫苗',      'seq': 3, 'month': 4,  'doses': 4, 'is_nip': True,  'prevent': '脊髓灰质炎',            'note': 'bOPV，第 3 剂'},
    {'id': 8,  'name': '百白破疫苗',        'seq': 2, 'month': 4,  'doses': 4, 'is_nip': True,  'prevent': '百日咳/白喉/破伤风',     'note': 'DTaP，第 2 剂'},
    # —— 5 月 ——
    {'id': 9,  'name': '百白破疫苗',        'seq': 3, 'month': 5,  'doses': 4, 'is_nip': True,  'prevent': '百日咳/白喉/破伤风',     'note': 'DTaP，第 3 剂'},
    # —— 6 月 ——
    {'id': 10, 'name': '乙肝疫苗',         'seq': 3, 'month': 6,  'doses': 3, 'is_nip': True,  'prevent': '乙型病毒性肝炎',         'note': '第 3 剂'},
    {'id': 11, 'name': 'A 群流脑多糖疫苗', 'seq': 1, 'month': 6,  'doses': 2, 'is_nip': True,  'prevent': '流行性脑脊髓膜炎',       'note': 'A 群，第 1 剂'},
    # —— 8 月 ——
    {'id': 12, 'name': '麻腮风疫苗',       'seq': 1, 'month': 8,  'doses': 2, 'is_nip': True,  'prevent': '麻疹/流行性腮腺炎/风疹', 'note': 'MMR，第 1 剂'},
    {'id': 13, 'name': '乙脑减毒疫苗',     'seq': 1, 'month': 8,  'doses': 2, 'is_nip': True,  'prevent': '流行性乙型脑炎',        'note': 'JE-L，第 1 剂'},
    # —— 9 月 ——
    {'id': 14, 'name': 'A 群流脑多糖疫苗', 'seq': 2, 'month': 9,  'doses': 2, 'is_nip': True,  'prevent': '流行性脑脊髓膜炎',       'note': 'A 群，第 2 剂'},
    # —— 18 月（1 岁半）——
    {'id': 15, 'name': '百白破疫苗',        'seq': 4, 'month': 18, 'doses': 4, 'is_nip': True,  'prevent': '百日咳/白喉/破伤风',     'note': 'DTaP，第 4 剂（加强）'},
    {'id': 16, 'name': '麻腮风疫苗',       'seq': 2, 'month': 18, 'doses': 2, 'is_nip': True,  'prevent': '麻疹/流行性腮腺炎/风疹', 'note': 'MMR，第 2 剂'},
    {'id': 17, 'name': '甲肝减毒疫苗',     'seq': 1, 'month': 18, 'doses': 1, 'is_nip': True,  'prevent': '甲型病毒性肝炎',         'note': 'HepA-L，1 剂'},
    # —— 2 岁 ——
    {'id': 18, 'name': '乙脑减毒疫苗',     'seq': 2, 'month': 24, 'doses': 2, 'is_nip': True,  'prevent': '流行性乙型脑炎',        'note': 'JE-L，第 2 剂'},
    {'id': 19, 'name': '甲肝灭活疫苗',     'seq': 1, 'month': 24, 'doses': 2, 'is_nip': False, 'prevent': '甲型病毒性肝炎',         'note': '自费替代苗：HepA-I 第 1 剂（替代减毒）'},
    # —— 3 岁 ——
    {'id': 20, 'name': 'A+C 群流脑多糖疫苗', 'seq': 1, 'month': 36, 'doses': 1, 'is_nip': True,  'prevent': '流行性脑脊髓膜炎',       'note': 'A+C 群，1 剂'},
    # —— 4 岁 ——
    {'id': 21, 'name': '脊灰减毒疫苗',      'seq': 4, 'month': 48, 'doses': 4, 'is_nip': True,  'prevent': '脊髓灰质炎',            'note': 'bOPV，第 4 剂（加强）'},
    # —— 6 岁 ——
    {'id': 22, 'name': '百白破疫苗',        'seq': 5, 'month': 72, 'doses': 5, 'is_nip': True,  'prevent': '百日咳/白喉/破伤风',     'note': 'DTaP，第 5 剂（6 岁加强）'},
    {'id': 23, 'name': 'A+C 群流脑多糖疫苗', 'seq': 2, 'month': 72, 'doses': 2, 'is_nip': True,  'prevent': '流行性脑脊髓膜炎',       'note': 'A+C 群，第 2 剂（6 岁加强）'},
    # —— 自费推荐（13 价肺炎 / 23 价肺炎 / 轮状 / 手足口 / 流感 / HPV 等）——
    {'id': 31, 'name': '13 价肺炎球菌疫苗',  'seq': 1, 'month': 2,  'doses': 4, 'is_nip': False, 'prevent': '肺炎链球菌疾病',         'note': 'PCV13，自费推荐，6 月龄前完成基础免疫'},
    {'id': 32, 'name': '轮状病毒疫苗',      'seq': 1, 'month': 2,  'doses': 3, 'is_nip': False, 'prevent': '轮状病毒肠炎',          'note': '自费推荐，2-6 月龄口服 3 剂'},
    {'id': 33, 'name': 'Hib 疫苗',         'seq': 1, 'month': 2,  'doses': 4, 'is_nip': False, 'prevent': 'b 型流感嗜血杆菌',      'note': '自费推荐，2-6 月龄 3 剂基础 + 1 剂加强'},
    {'id': 34, 'name': '手足口 EV71 疫苗',  'seq': 1, 'month': 6,  'doses': 2, 'is_nip': False, 'prevent': 'EV71 引起的手足口病',   'note': '自费推荐，6 月龄-5 岁，2 剂间隔 1 月'},
    {'id': 35, 'name': '流感疫苗',         'seq': 1, 'month': 6,  'doses': 2, 'is_nip': False, 'prevent': '流行性感冒',            'note': '自费推荐，6 月龄以上，每年接种'},
    {'id': 36, 'name': '水痘疫苗',         'seq': 1, 'month': 12, 'doses': 2, 'is_nip': False, 'prevent': '水痘',                 'note': '自费推荐，1-12 岁接种 2 剂'},
    {'id': 37, 'name': '23 价肺炎疫苗',     'seq': 1, 'month': 24, 'doses': 1, 'is_nip': False, 'prevent': '肺炎链球菌疾病',         'note': '自费推荐，2 岁以上高危儿童'},
    # —— 五联疫苗 DTaP-IPV/Hib（自费，一针覆盖百白破+脊灰+Hib，可替代 NIP 对应剂次）——
    {'id': 41, 'name': '五联疫苗', 'seq': 1, 'month': 3,  'doses': 4, 'is_nip': False, 'prevent': '百日咳/白喉/破伤风/脊灰/b型流感嗜血杆菌', 'note': 'DTaP-IPV/Hib，第 1 剂（替代百白破第1剂 + 脊灰第2剂 + Hib）'},
    {'id': 42, 'name': '五联疫苗', 'seq': 2, 'month': 4,  'doses': 4, 'is_nip': False, 'prevent': '百日咳/白喉/破伤风/脊灰/b型流感嗜血杆菌', 'note': 'DTaP-IPV/Hib，第 2 剂（替代百白破第2剂 + 脊灰第3剂）'},
    {'id': 43, 'name': '五联疫苗', 'seq': 3, 'month': 5,  'doses': 4, 'is_nip': False, 'prevent': '百日咳/白喉/破伤风/脊灰/b型流感嗜血杆菌', 'note': 'DTaP-IPV/Hib，第 3 剂（替代百白破第3剂 + Hib 加强）'},
    {'id': 44, 'name': '五联疫苗', 'seq': 4, 'month': 18, 'doses': 4, 'is_nip': False, 'prevent': '百日咳/白喉/破伤风/脊灰/b型流感嗜血杆菌', 'note': 'DTaP-IPV/Hib，第 4 剂（替代百白破第4剂加强）'},
]

# 五联疫苗剂次 → 其覆盖的 NIP 单苗剂次（用于联动：打了五联剂后自动覆盖对应 NIP 剂）
# 映射键 = 五联 vaccine_id，值 = [被覆盖的 vaccine_id 列表]
PENTAVALENT_COVERS = {
    41: [6, 5],     # 五联1(3月) → 百白破第1剂(id=6) + bOPV第2剂(id=5)
    42: [8, 7],     # 五联2(4月) → 百白破第2剂(id=8) + bOPV第3剂(id=7)
    43: [9, 33],    # 五联3(5月) → 百白破第3剂(id=9) + Hib(id=33)
    44: [15],       # 五联4(18月) → 百白破第4剂加强(id=15)
}


# ---------------- 成长区：里程碑打卡 ----------------
# 依据美国 CDC「Learn the Signs. Act Early.」（2022 修订版）+ WHO 多中心研究 + 香港卫生署
# 按 4 大领域分组：motor（粗大动作）/ fine（精细动作）/ language（语言）/ social（社交情感）
# month: 多数宝宝达成该里程碑的月龄（中位数）；窗口约 ±2 个月都正常
# red_flag: True = 该里程碑未达成需警惕（建议咨询儿科医生）
MILESTONE_LIBRARY = [
    # —— 0-2 月 ——
    {'id': 1,  'domain': 'motor',     'month': 1,  'desc': '俯卧抬头短暂（下巴离床）',            'red_flag': False},
    {'id': 2,  'domain': 'motor',     'month': 2,  'desc': '俯卧抬头 45°',                       'red_flag': False},
    {'id': 3,  'domain': 'fine',      'month': 2,  'desc': '注视人脸/高对比图案',                 'red_flag': False},
    {'id': 4,  'domain': 'social',    'month': 2,  'desc': '社交性微笑（被逗引时微笑回应）',      'red_flag': True},
    {'id': 5,  'domain': 'language',  'month': 2,  'desc': '发出 a/o 等元音声',                  'red_flag': False},
    # —— 3-5 月 ——
    {'id': 6,  'domain': 'motor',     'month': 3,  'desc': '俯卧抬头 90° + 用前臂支撑',           'red_flag': False},
    {'id': 7,  'domain': 'motor',     'month': 4,  'desc': '仰卧翻身到俯卧',                      'red_flag': False},
    {'id': 8,  'domain': 'fine',      'month': 4,  'desc': '双手凑到中线 / 抓握拨浪鼓',          'red_flag': False},
    {'id': 9,  'domain': 'language',  'month': 4,  'desc': '笑出声 / 尖叫',                       'red_flag': False},
    {'id': 10, 'domain': 'social',    'month': 4,  'desc': '回应互动（被逗引时大声笑）',          'red_flag': False},
    {'id': 11, 'domain': 'motor',     'month': 5,  'desc': '俯卧翻身到仰卧（双向翻身）',         'red_flag': True},
    {'id': 12, 'domain': 'fine',      'month': 5,  'desc': '伸手抓物（主动够物）',               'red_flag': True},
    # —— 6-8 月 ——
    {'id': 13, 'domain': 'motor',     'month': 6,  'desc': '不需支撑能独坐片刻',                  'red_flag': True},
    {'id': 14, 'domain': 'fine',      'month': 6,  'desc': '双手传递物品',                        'red_flag': False},
    {'id': 15, 'domain': 'language',  'month': 6,  'desc': '连续辅音 bababa/mamama',             'red_flag': False},
    {'id': 16, 'domain': 'social',    'month': 6,  'desc': '认生（区分熟悉/陌生人）',             'red_flag': False},
    {'id': 17, 'domain': 'motor',     'month': 7,  'desc': '独坐稳（手可自由玩物）',              'red_flag': True},
    {'id': 18, 'domain': 'motor',     'month': 8,  'desc': '扶站（扶家具站立）',                  'red_flag': False},
    {'id': 19, 'domain': 'fine',      'month': 8,  'desc': '拇食指捏取（pincer grasp）',         'red_flag': True},
    {'id': 20, 'domain': 'language',  'month': 8,  'desc': '懂得「不」/ 听到自己名字转头',        'red_flag': False},
    # —— 9-11 月 ——
    {'id': 21, 'domain': 'motor',     'month': 9,  'desc': '爬行（手膝爬行）',                    'red_flag': True},
    {'id': 22, 'domain': 'social',    'month': 9,  'desc': '躲猫猫 / 物体永恒概念',               'red_flag': False},
    {'id': 23, 'domain': 'fine',      'month': 10, 'desc': '用食指指物（proto-declarative）',     'red_flag': True},
    {'id': 24, 'domain': 'language',  'month': 10, 'desc': '说「妈妈/爸爸」有所指',               'red_flag': True},
    {'id': 25, 'domain': 'motor',     'month': 11, 'desc': '扶物横走（cruising）',                'red_flag': False},
    # —— 12-17 月 ——
    {'id': 26, 'domain': 'motor',     'month': 12, 'desc': '独走几步',                            'red_flag': True},
    {'id': 27, 'domain': 'fine',      'month': 12, 'desc': '把物品放入容器',                      'red_flag': False},
    {'id': 28, 'domain': 'language',  'month': 12, 'desc': '说 1-3 个有意义单词',                 'red_flag': True},
    {'id': 29, 'domain': 'social',    'month': 12, 'desc': '模仿动作（如挥手再见）',              'red_flag': False},
    {'id': 30, 'domain': 'language',  'month': 15, 'desc': '说 4-6 个单词',                      'red_flag': False},
    {'id': 31, 'domain': 'fine',      'month': 15, 'desc': '用蜡笔涂鸦',                          'red_flag': False},
    {'id': 32, 'domain': 'social',    'month': 15, 'desc': '指认身体部位',                        'red_flag': False},
    # —— 18-23 月 ——
    {'id': 33, 'domain': 'motor',     'month': 18, 'desc': '稳走 / 跑（虽易摔）',                 'red_flag': True},
    {'id': 34, 'domain': 'fine',      'month': 18, 'desc': '叠 3-4 块积木',                       'red_flag': False},
    {'id': 35, 'domain': 'language',  'month': 18, 'desc': '说 10-20 个词',                       'red_flag': False},
    {'id': 36, 'domain': 'social',    'month': 18, 'desc': '用勺子吃饭（虽撒）',                  'red_flag': False},
    {'id': 37, 'domain': 'language',  'month': 20, 'desc': '说 2 词短语（「妈妈抱」）',           'red_flag': True},
    # —— 24-35 月 ——
    {'id': 38, 'domain': 'motor',     'month': 24, 'desc': '双脚跳',                              'red_flag': True},
    {'id': 39, 'domain': 'fine',      'month': 24, 'desc': '叠 6-7 块积木 / 旋开瓶盖',            'red_flag': False},
    {'id': 40, 'domain': 'language',  'month': 24, 'desc': '说 50+ 词 / 2-3 词句',                'red_flag': True},
    {'id': 41, 'domain': 'social',    'month': 24, 'desc': '与其他孩子并行游戏',                  'red_flag': False},
    {'id': 42, 'domain': 'motor',     'month': 30, 'desc': '单脚站 1 秒',                          'red_flag': False},
    {'id': 43, 'domain': 'language',  'month': 30, 'desc': '说 3 词句 / 用「我」',                'red_flag': False},
    # —— 36-48 月 ——
    {'id': 44, 'domain': 'motor',     'month': 36, 'desc': '单脚站 3 秒 / 骑三轮车',              'red_flag': False},
    {'id': 45, 'domain': 'fine',      'month': 36, 'desc': '画圆 / 穿珠子',                       'red_flag': False},
    {'id': 46, 'domain': 'language',  'month': 36, 'desc': '说清陌生人能听懂 75% 的话',           'red_flag': True},
    {'id': 47, 'domain': 'social',    'month': 36, 'desc': '与其他孩子合作游戏 / 分享',           'red_flag': False},
    {'id': 48, 'domain': 'fine',      'month': 42, 'desc': '画十字 / 画 V',                        'red_flag': False},
    {'id': 49, 'domain': 'motor',     'month': 48, 'desc': '单脚跳',                              'red_flag': False},
    {'id': 50, 'domain': 'language',  'month': 48, 'desc': '讲简单故事 / 用 5-6 词句',            'red_flag': False},
]

STORY_LIBRARY = [
    # —— 6-12 月：认知启蒙 / 视觉刺激 / 拟声词（8 本）——
    {'id': 301, 'title': '好饿的毛毛虫', 'author': '艾瑞·卡尔', 'months': [6, 24],
     'desc': '共读要点：指认食物名称、数一数吃了几个、模仿毛毛虫爬行，认知食物/数量/星期与生命循环',
     'keyword': '好饿的毛毛虫 绘本 朗读'},
    {'id': 302, 'title': '棕色的熊，棕色的熊，你在看什么', 'author': '艾瑞·卡尔', 'months': [6, 18],
     'desc': '共读要点：模仿动物叫声、指认颜色、感受重复句式的节奏，认知动物与颜色',
     'keyword': '棕色的熊 绘本 朗读 艾瑞卡尔'},
    {'id': 303, 'title': '蹦！', 'author': '松冈达英', 'months': [6, 18],
     'desc': '共读要点：跟读拟声词「蹦」、模仿动物跳跃动作、指认小动物，语言萌芽与动作认知',
     'keyword': '蹦 绘本 松冈达英 朗读'},
    {'id': 304, 'title': '点点点', 'author': '赫维·杜雷', 'months': [9, 24],
     'desc': '共读要点：按指令点按、摇晃、吹气，感受因果关系与互动乐趣，颜色与方向认知',
     'keyword': '点点点 绘本 互动 朗读'},
    {'id': 305, 'title': '哇！', 'author': '松冈达英', 'months': [6, 18],
     'desc': '共读要点：模仿各种动物「哇」的惊讶表情、翻页制造惊喜，情绪表达与翻页期待',
     'keyword': '哇 松冈达英 绘本 朗读'},
    {'id': 306, 'title': '舔一舔', 'author': '宫西达也', 'months': [6, 18],
     'desc': '共读要点：模仿动物舔东西的动作、感受不同舌头的触感，动物认知与拟态游戏',
     'keyword': '舔一舔 宫西达也 绘本'},
    {'id': 307, 'title': '噗噗噗', 'author': '谷川俊太郎', 'months': [6, 18],
     'desc': '共读要点：模仿拟声词「噗」、感受形状变化、指认颜色块，声音与形状认知',
     'keyword': '噗噗噗 绘本 谷川俊太郎 朗读'},
    {'id': 308, 'title': '抱抱', 'author': '杰兹·阿波罗', 'months': [6, 18],
     'desc': '共读要点：边读边抱宝宝、模仿动物拥抱、强化亲子依恋，情感联结与安全感',
     'keyword': '抱抱 绘本 朗读 亲子'},

    # —— 12-18 月：语言萌芽 / 生活认知 / 亲子依恋（8 本）——
    {'id': 311, 'title': '小蓝和小黄', 'author': '李欧·李奥尼', 'months': [12, 30],
     'desc': '共读要点：指认蓝色黄色、感受拥抱变绿的颜色混合、讨论好朋友，颜色与友谊认知',
     'keyword': '小蓝和小黄 绘本 朗读'},
    {'id': 312, 'title': '连在一起', 'author': '三浦太郎', 'months': [12, 24],
     'desc': '共读要点：指认动物和宝宝连在一起、感受亲子联结、模仿贴脸动作，亲子依恋与共同感',
     'keyword': '连在一起 绘本 三浦太郎 朗读'},
    {'id': 313, 'title': '月亮，晚安', 'author': '玛格丽特·怀兹', 'months': [12, 30],
     'desc': '共读要点：逐一道晚安、指认房间物品、建立睡前仪式，睡眠习惯与物体恒存',
     'keyword': '月亮晚安 绘本 朗读 睡前'},
    {'id': 314, 'title': '我爸爸', 'author': '安东尼·布朗', 'months': [12, 36],
     'desc': '共读要点：指认爸爸的特征、模仿表情动作、表达对爸爸的爱，家庭关系与情感表达',
     'keyword': '我爸爸 绘本 安东尼布朗 朗读'},
    {'id': 315, 'title': '我妈妈', 'author': '安东尼·布朗', 'months': [12, 36],
     'desc': '共读要点：指认妈妈的特征、模仿表情动作、表达对妈妈的爱，家庭关系与情感表达',
     'keyword': '我妈妈 绘本 安东尼布朗 朗读'},
    {'id': 316, 'title': '好饿的小蛇', 'author': '宫西达也', 'months': [12, 30],
     'desc': '共读要点：猜小蛇吃了什么、指认颜色形状、模仿吃东西的声音，颜色形状与食物认知',
     'keyword': '好饿的小蛇 绘本 宫西达也 朗读'},
    {'id': 317, 'title': '小金鱼逃走了', 'author': '五味太郎', 'months': [12, 30],
     'desc': '共读要点：一起找小金鱼、指认躲藏位置、感受寻找的成就感，观察力与寻找游戏',
     'keyword': '小金鱼逃走了 绘本 朗读 五味太郎'},
    {'id': 318, 'title': '首先有一个苹果', 'author': '伊东宽', 'months': [12, 30],
     'desc': '共读要点：数数 1-10、指认动物、感受递增节奏，数量启蒙与序列认知',
     'keyword': '首先有一个苹果 绘本 朗读 数数'},

    # —— 18-24 月：语言爆发 / 行为边界 / 观察力（8 本）——
    {'id': 321, 'title': '大卫，不可以', 'author': '大卫·香农', 'months': [18, 36],
     'desc': '共读要点：讨论大卫为什么不可以、引导说出规则、模仿「不可以」语气，行为边界与规则感',
     'keyword': '大卫不可以 绘本 朗读'},
    {'id': 322, 'title': '是谁嗯嗯在我的头上', 'author': '维尔纳·霍尔茨瓦特', 'months': [18, 36],
     'desc': '共读要点：认识不同动物的便便、讨论如厕、模仿小鼹鼠生气的样子，如厕认知与幽默感',
     'keyword': '是谁嗯嗯在我的头上 绘本 朗读'},
    {'id': 323, 'title': '好忙的蜘蛛', 'author': '艾瑞·卡尔', 'months': [18, 36],
     'desc': '共读要点：模仿织网动作、感受蜘蛛的专注、指认来访动物，专注力与重复句式',
     'keyword': '好忙的蜘蛛 绘本 朗读 艾瑞卡尔'},
    {'id': 324, 'title': '变色龙卡梅拉', 'author': '艾瑞·卡尔', 'months': [18, 36],
     'desc': '共读要点：指认变色龙的颜色变化、讨论动物如何伪装、模仿变色龙慢动作，颜色与动物认知',
     'keyword': '变色龙 绘本 艾瑞卡尔 朗读'},
    {'id': 325, 'title': '我绝对绝对不吃番茄', 'author': '罗伦·乔尔德', 'months': [18, 36],
     'desc': '共读要点：讨论挑食、想象番茄是别的食物、鼓励尝试新食物，饮食习惯与想象力',
     'keyword': '我绝对绝对不吃番茄 绘本 朗读'},
    {'id': 326, 'title': '彩虹色的花', 'author': '麦克·格雷涅茨', 'months': [18, 36],
     'desc': '共读要点：指认花瓣颜色、讨论分享与帮助、感受四季变化，颜色与分享认知',
     'keyword': '彩虹色的花 绘本 朗读'},
    {'id': 327, 'title': '阿罗有支彩色笔', 'author': '克罗格特·约翰逊', 'months': [18, 36],
     'desc': '共读要点：跟着阿罗画线条、想象月光下的冒险、鼓励宝宝自己涂鸦，想象力与绘画启蒙',
     'keyword': '阿罗有支彩色笔 绘本 朗读'},
    {'id': 328, 'title': '活了100万次的猫', 'author': '佐野洋子', 'months': [18, 48],
     'desc': '共读要点：讨论猫为什么不爱主人、感受爱的力量、指认不同主人，生命教育与情感认知',
     'keyword': '活了100万次的猫 绘本 朗读'},

    # —— 24+ 月：语言丰富 / 情绪管理 / 想象力（8 本）——
    {'id': 331, 'title': '猜猜我有多爱你', 'author': '山姆·麦克布雷尼', 'months': [24, 48],
     'desc': '共读要点：用手臂比划有多爱、模仿兔子对话、表达对彼此的爱，情感表达与比较概念',
     'keyword': '猜猜我有多爱你 绘本 朗读'},
    {'id': 332, 'title': '逃家小兔', 'author': '玛格丽特·怀兹', 'months': [24, 48],
     'desc': '共读要点：玩「如果你变成…我就变成…」游戏、感受妈妈永远追得上，安全感与依恋',
     'keyword': '逃家小兔 绘本 朗读'},
    {'id': 333, 'title': '菲菲生气了', 'author': '莫莉·卞', 'months': [24, 48],
     'desc': '共读要点：讨论菲菲为什么生气、模仿深呼吸平静下来、说说自己生气时怎么办，情绪管理',
     'keyword': '菲菲生气了 绘本 朗读'},
    {'id': 334, 'title': '爷爷一定有办法', 'author': '菲比·吉尔曼', 'months': [24, 48],
     'desc': '共读要点：讨论毯子变成什么、感受爷爷的爱与智慧、指认物品变化，亲情与物尽其用',
     'keyword': '爷爷一定有办法 绘本 朗读'},
    {'id': 335, 'title': '花婆婆', 'author': '芭芭拉·库尼', 'months': [24, 48],
     'desc': '共读要点：讨论让世界更美丽的方法、指认不同风景、感受一生的追求，人生意义与美育',
     'keyword': '花婆婆 绘本 朗读'},
    {'id': 336, 'title': '蚯蚓的日记', 'author': '朵琳·克罗宁', 'months': [24, 48],
     'desc': '共读要点：讨论蚯蚓的一天、模仿写日记、感受小动物的视角，观察力与日记启蒙',
     'keyword': '蚯蚓的日记 绘本 朗读'},
    {'id': 337, 'title': '母鸡萝丝去散步', 'author': '佩特·哈群斯', 'months': [24, 48],
     'desc': '共读要点：讨论狐狸为什么抓不到、指认农场动物、感受画面对比，观察力与幽默感',
     'keyword': '母鸡萝丝去散步 绘本 朗读'},
    {'id': 338, 'title': '爱心树', 'author': '谢尔·希尔弗斯坦', 'months': [24, 60],
     'desc': '共读要点：讨论树的付出、感受无条件的爱、指认成长变化，给予与爱的认知',
     'keyword': '爱心树 绘本 朗读'},

    # —— 英文经典绘本（适合 2-5 岁，借共读示范视频进入绘本区）——
    {'id': 339, 'title': 'Five Little Monkeys', 'author': '艾琳·克里斯泰洛', 'months': [24, 60],
     'desc': '共读要点：跟读 5→1 倒数、模仿猴子跳床掉下床、讨论"医生说不能再跳了"的规则意识，数数与边界认知',
     'keyword': 'Five Little Monkeys Jumping on the Bed 绘本 朗读 picture book read aloud'},
]

def get_stories(months: int) -> List[Activity]:
    """绘本区：按宝宝月龄筛 3-4 本经典绘本，附共读要点与共读示范视频。
    AAP / Zero to Three：共读真正"受益"从约 6 个月开始（宝宝能看到全彩、能坐、能抓握、
    开始理解图片代表物体）。<6 个月返回空列表，前端不渲染绘本区。

    随机性优化：用全局 deque 记录最近推过的 id（长度 = 月龄档可用书数的一半向下取整，
    至少 2 最多 6），优先从"最近没推过"的书里选，避免每次打开都看到相同几本。
    """
    global _recent_story_ids
    if months < 6:
        return []
    pool = [s for s in STORY_LIBRARY if s['months'][0] <= months <= s['months'][1]]
    if not pool:
        pool = STORY_LIBRARY[:]   # 兜底：月龄范围没命中就全量

    # 记忆窗口：档内书数的一半向下取整，最少 2 最多 6
    import math
    window = max(2, min(6, math.floor(len(pool) / 2)))
    if not hasattr(get_stories, '_recent'):
        get_stories._recent = deque(maxlen=window)
    _recent = get_stories._recent
    # 如果窗口长度跟当前 pool 不匹配（pool 大小变了），重建 deque
    if _recent.maxlen != window:
        get_stories._recent = deque(_recent, maxlen=window)
        _recent = get_stories._recent

    # 优先从最近没推过的里选
    fresh = [s for s in pool if s['id'] not in _recent]
    if not fresh:
        fresh = pool[:]
    n = min(random.choice([3, 4]), len(pool))
    # 如果 fresh 不够 n 个，从 pool 里补
    if len(fresh) < n:
        chosen = fresh[:]
        rest = [s for s in pool if s not in chosen]
        random.shuffle(rest)
        chosen += rest[:n - len(fresh)]
    else:
        chosen = random.sample(fresh, n)
    # 记录本次推的 id
    for s in chosen:
        _recent.append(s['id'])

    results = []
    for item in chosen:
        a = Activity(
            id=item['id'],
            type='story',
            title=item['title'],
            desc=item['desc'],
            ageRange=item['months'],
            videoUrl='#',
            icon='reading',
            keyword=item['keyword'],
            stage='',
            lang=f"{item['author']} · 适合 {item['months'][0]}–{item['months'][1]} 月",
        )
        if not a.videoUrl or a.videoUrl == '#':
            a.videoUrl = search_bilibili(item['keyword'])
        if a.id in activity_videos:
            a.videoUrl = activity_videos[a.id]
        results.append(a)
    return results

def get_music() -> List[Activity]:
    """音乐区：每次随机 3-4 个，且中英文都会覆盖到。全阶段适用。"""
    pool = MUSIC_LIBRARY
    if not pool:
        return []

    by_lang = {}
    for item in pool:
        by_lang.setdefault(item['lang'], []).append(item)

    n = min(random.choice([3, 4]), len(pool))
    chosen = []
    # 优先保证中英文各至少 1 个
    for lang, items in by_lang.items():
        if len(chosen) < n:
            chosen.append(random.choice(items))
    # 再从全部里补足到 n 个
    rest = [it for it in pool if it not in chosen]
    random.shuffle(rest)
    while len(chosen) < n and rest:
        chosen.append(rest.pop())
    random.shuffle(chosen)

    results = []
    for item in chosen:
        a = Activity(
            id=item['id'],
            type='music',
            title=item['title'],
            desc=item['desc'],
            ageRange=[0, 36],
            videoUrl='#',
            icon='music',
            keyword=item['keyword'],
            stage='',
            lang=item['lang'],
        )
        if not a.videoUrl or a.videoUrl == '#':
            a.videoUrl = search_bilibili(item['keyword'])
        if a.id in activity_videos:
            a.videoUrl = activity_videos[a.id]
        results.append(a)
    return results

@app.post('/activities/{id}/video')
async def set_activity_video(id: int, payload: dict):
    url = payload.get('videoUrl')
    if not url:
        raise HTTPException(status_code=400, detail='videoUrl required')
    activity_videos[id] = url
    return {"id": id, "videoUrl": url}

# ---------------- API 路由 ----------------
@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/init-user")
async def init_user():
    """前端首次访问时调用，生成一个 guest 用户 ID（兼容旧前端；新前端走 /auth/register）。"""
    uid = str(uuid.uuid4())
    # 插入 guest 行：phone 用 user_id 兜底（保证唯一，不与注册用户冲突）
    db.execute("INSERT OR IGNORE INTO users (user_id, phone, password_hash, password_salt, nickname) VALUES (?, ?, '', '', '')", [uid, uid])
    db.sync()
    return {"userId": uid}

@app.post("/family/leave")
async def leave_family(request: Request):
    """退出当前家庭：移除成员关系；若家庭已无成员，则一并清理家庭与宝宝数据。"""
    uid = get_uid(request)
    member = db.execute("SELECT family_id FROM family_members WHERE user_id = ?", [uid]).fetchall()
    if not member:
        raise HTTPException(status_code=404, detail="Not in any family")
    fid = member[0][0]
    db.execute("DELETE FROM family_members WHERE user_id = ?", [uid])
    # 家庭成员已全部离开 → 清理孤儿家庭及其宝宝数据，避免脏数据堆积
    remain = db.execute("SELECT 1 FROM family_members WHERE family_id = ?", [fid]).fetchall()
    if not remain:
        baby_ids = db.execute("SELECT baby_id FROM babies WHERE family_id = ?", [fid]).fetchall()
        for b in baby_ids:
            bid = b[0]
            db.execute("DELETE FROM feeding_records_v2 WHERE baby_id = ?", [bid])
            db.execute("DELETE FROM checklist_items_v2 WHERE baby_id = ?", [bid])
        db.execute("DELETE FROM babies WHERE family_id = ?", [fid])
        db.execute("DELETE FROM families WHERE family_id = ?", [fid])
    db.sync()
    return {"ok": True, "family_id": fid}

# ---------------- 账号认证系统 API ----------------
# 手机号 + 密码登录，签发 session token；替代 localStorage 随机 user_id
SESSION_TTL_DAYS = 30
PHONE_RE = re.compile(r"^1[3-9]\d{9}$")

class AuthRegisterRequest(BaseModel):
    phone: str
    password: str
    nickname: str = ""

class AuthLoginRequest(BaseModel):
    phone: str
    password: str

class UpdateProfileRequest(BaseModel):
    nickname: str | None = None      # 新昵称（可改）
    new_password: str | None = None  # 新密码（可改，需同时提供 old_password 验证）
    old_password: str | None = None   # 旧密码（改密码时必填）

def _hash_password(password: str, salt: str) -> str:
    """PBKDF2-HMAC-SHA256，100000 轮，32 字节 → hex。零依赖（标准库 hashlib）。"""
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()

def _new_salt() -> str:
    return secrets.token_hex(16)

def _new_token() -> str:
    return secrets.token_urlsafe(32)

def _issue_session(user_id: str) -> str:
    token = _new_token()
    from datetime import timedelta
    exp = (datetime.utcnow() + timedelta(days=SESSION_TTL_DAYS)).isoformat()
    db.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", [token, user_id, exp])
    return token

def _resolve_token(request: Request) -> Optional[str]:
    """从 Authorization: Bearer <token> 解析 user_id；token 无效/过期返回 None。"""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    rs = db.execute(
        "SELECT user_id, expires_at FROM sessions WHERE token = ?", [token]
    ).fetchall()
    if not rs:
        return None
    uid, exp = rs[0][0], rs[0][1]
    try:
        if datetime.fromisoformat(exp) < datetime.utcnow():
            return None
    except Exception:
        return None
    return uid

@app.post("/auth/register")
async def auth_register(req: AuthRegisterRequest):
    phone = req.phone.strip()
    if not PHONE_RE.match(phone):
        raise HTTPException(400, "手机号格式不正确")
    if len(req.password) < 6:
        raise HTTPException(400, "密码至少 6 位")
    # 检查手机号是否已注册
    existing = db.execute("SELECT user_id FROM users WHERE phone = ?", [phone]).fetchall()
    if existing:
        raise HTTPException(409, "该手机号已注册")
    user_id = str(uuid.uuid4())
    salt = _new_salt()
    pw_hash = _hash_password(req.password, salt)
    nickname = req.nickname.strip()[:20]
    db.execute(
        "INSERT INTO users (user_id, phone, password_hash, password_salt, nickname) VALUES (?, ?, ?, ?, ?)",
        [user_id, phone, pw_hash, salt, nickname]
    )
    token = _issue_session(user_id)
    return {"token": token, "user_id": user_id, "phone": phone, "nickname": nickname}

@app.post("/auth/login")
async def auth_login(req: AuthLoginRequest):
    phone = req.phone.strip()
    rs = db.execute(
        "SELECT user_id, password_hash, password_salt, nickname FROM users WHERE phone = ?", [phone]
    ).fetchall()
    if not rs:
        raise HTTPException(401, "手机号或密码错误")
    user_id, pw_hash, salt, nickname = rs[0]
    if not hmac.compare_digest(_hash_password(req.password, salt), pw_hash):
        raise HTTPException(401, "手机号或密码错误")
    token = _issue_session(user_id)
    return {"token": token, "user_id": user_id, "phone": phone, "nickname": nickname or ""}

@app.post("/auth/logout")
async def auth_logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:].strip()
        db.execute("DELETE FROM sessions WHERE token = ?", [token])
    return {"ok": True}

@app.get("/auth/me")
async def auth_me(request: Request):
    uid = _resolve_token(request)
    if not uid:
        raise HTTPException(401, "未登录或会话已过期")
    rs = db.execute("SELECT phone, nickname FROM users WHERE user_id = ?", [uid]).fetchall()
    if not rs:
        raise HTTPException(401, "用户不存在")
    phone, nickname = rs[0]
    # 顺带返回家庭信息（若有）
    family = None
    fm = db.execute("SELECT family_id, role, nickname FROM family_members WHERE user_id = ?", [uid]).fetchall()
    if fm:
        fid, role, mnick = fm[0]
        family = {"family_id": fid, "role": role, "nickname": mnick or nickname or ""}
    return {"user_id": uid, "phone": phone, "nickname": nickname or "", "family": family}

@app.put("/auth/me")
async def auth_update_me(req: UpdateProfileRequest, request: Request):
    """修改个人信息：可改昵称和密码，手机号不可改。改密码需验证旧密码。"""
    uid = _resolve_token(request)
    if not uid:
        raise HTTPException(401, "未登录或会话已过期")
    rs = db.execute("SELECT phone, password_hash, password_salt, nickname FROM users WHERE user_id = ?", [uid]).fetchall()
    if not rs:
        raise HTTPException(401, "用户不存在")
    phone, pw_hash, pw_salt, cur_nick = rs[0]
    updated = {}
    # 改昵称
    if req.nickname is not None:
        nick = req.nickname.strip()[:20]
        db.execute("UPDATE users SET nickname = ? WHERE user_id = ?", [nick, uid])
        # 同步更新 family_members 里的成员昵称（让家庭成员列表即时显示新昵称）
        db.execute("UPDATE family_members SET nickname = ? WHERE user_id = ?", [nick, uid])
        _invalidate_recorder_cache(uid)
        updated["nickname"] = nick
    # 改密码：需验证旧密码
    if req.new_password is not None:
        if not req.old_password:
            raise HTTPException(400, "修改密码需提供旧密码")
        if not pw_hash or not pw_salt or _hash_password(req.old_password, pw_salt) != pw_hash:
            raise HTTPException(403, "旧密码错误")
        if len(req.new_password) < 6:
            raise HTTPException(400, "新密码至少 6 位")
        new_salt = _new_salt()
        new_hash = _hash_password(req.new_password, new_salt)
        db.execute("UPDATE users SET password_hash = ?, password_salt = ? WHERE user_id = ?", [new_hash, new_salt, uid])
        updated["password"] = "updated"
    db.sync()
    if not updated:
        raise HTTPException(400, "没有需要更新的字段")
    return {"ok": True, "updated": updated, "phone": phone, "nickname": updated.get("nickname", cur_nick or "")}

# ---------------- 家庭系统 API ----------------
class FamilyCreateRequest(BaseModel):
    family_name: str

class FamilyJoinRequest(BaseModel):
    family_id: str

class BabyCreateRequest(BaseModel):
    name: str
    gender: str
    birthday: str
    height: float
    weight: float

class BabyUpdateRequest(BaseModel):
    name: str = None
    gender: str = None
    birthday: str = None
    height: float = None
    weight: float = None
    sick_mode: int = None
    night_bedtime: str = None
    night_wake_time: str = None

@app.post("/family")
async def create_family(req: FamilyCreateRequest, request: Request):
    """创建家庭：生成唯一 ID，创建者自动成为家庭成员"""
    uid = get_uid(request)
    # 检查是否已在家庭中
    existing = db.execute("SELECT family_id FROM family_members WHERE user_id = ?", [uid]).fetchall()
    if existing:
        raise HTTPException(status_code=400, detail="Already in a family. Leave current family first.")
    # 生成唯一 ID，重试避免冲突
    for _ in range(10):
        fid = generate_family_id()
        dup = db.execute("SELECT 1 FROM families WHERE family_id = ?", [fid]).fetchall()
        if not dup:
            break
    else:
        raise HTTPException(status_code=500, detail="Failed to generate unique family ID")
    db.execute("INSERT INTO families (family_id, family_name) VALUES (?, ?)", [fid, req.family_name])
    # 用注册时填的昵称作为成员默认名（users 表查不到则空，前端走兜底文案）
    urow = db.execute("SELECT nickname FROM users WHERE user_id = ?", [uid]).fetchall()
    dnick = urow[0][0] if urow and urow[0][0] else ""
    db.execute("INSERT INTO family_members (family_id, user_id, role, nickname) VALUES (?, ?, 'creator', ?)", [fid, uid, dnick])
    db.sync()
    return {"family_id": fid, "family_name": req.family_name, "role": "creator"}

@app.post("/family/join")
async def join_family(req: FamilyJoinRequest, request: Request):
    """加入家庭：通过家庭 ID 加入"""
    uid = get_uid(request)
    # 检查是否已在家庭中
    existing = db.execute("SELECT family_id FROM family_members WHERE user_id = ?", [uid]).fetchall()
    if existing:
        if existing[0][0] == req.family_id:
            return {"family_id": req.family_id, "message": "Already in this family"}
        raise HTTPException(status_code=400, detail="Already in another family. Leave current family first.")
    # 检查家庭是否存在
    fam = db.execute("SELECT family_id, family_name FROM families WHERE family_id = ?", [req.family_id]).fetchall()
    if not fam:
        raise HTTPException(status_code=404, detail="Family not found. Check the family ID.")
    # 用注册时填的昵称作为成员默认名
    urow = db.execute("SELECT nickname FROM users WHERE user_id = ?", [uid]).fetchall()
    dnick = urow[0][0] if urow and urow[0][0] else ""
    db.execute("INSERT INTO family_members (family_id, user_id, role, nickname) VALUES (?, ?, 'member', ?)", [req.family_id, uid, dnick])
    db.sync()
    return {"family_id": fam[0][0], "family_name": fam[0][1], "role": "member"}

@app.get("/family")
async def get_family(request: Request):
    """获取当前用户的家庭信息（含成员列表和宝宝列表）"""
    uid = get_uid(request)
    member = db.execute("SELECT family_id, role FROM family_members WHERE user_id = ?", [uid]).fetchall()
    if not member:
        raise HTTPException(status_code=404, detail="Not in any family")
    fid = member[0][0]
    fam = db.execute("SELECT family_name FROM families WHERE family_id = ?", [fid]).fetchall()
    members = db.execute("SELECT user_id, role, nickname FROM family_members WHERE family_id = ?", [fid]).fetchall()
    babies = db.execute("SELECT baby_id, name, gender, birthday, height, weight FROM babies WHERE family_id = ?", [fid]).fetchall()
    return {
        "family_id": fid,
        "family_name": fam[0][0] if fam else "",
        "role": member[0][1],
        "members": [{"user_id": m[0], "role": m[1], "nickname": m[2] or ""} for m in members],
        "babies": [{"baby_id": b[0], "name": b[1], "gender": b[2], "birthday": b[3], "height": b[4], "weight": b[5]} for b in babies],
    }

@app.put("/family/member")
async def update_my_member(request: Request):
    """当前登录用户更新自己在家庭中的昵称（仅可改本人）"""
    uid = get_uid(request)
    try:
        body = await request.json()
    except Exception:
        body = {}
    nickname = (body.get("nickname") or "").strip()
    if len(nickname) > 20:
        raise HTTPException(status_code=400, detail="昵称不能超过 20 个字符")
    db.execute("UPDATE family_members SET nickname = ? WHERE user_id = ?", [nickname, uid])
    _invalidate_recorder_cache(uid)
    db.sync()
    return {"ok": True, "nickname": nickname}

@app.get("/family/babies")
async def list_babies(request: Request):
    """获取当前家庭的所有宝宝"""
    fid = get_family_id(request)
    babies = db.execute("SELECT baby_id, name, gender, birthday, height, weight, sick_mode, night_bedtime, night_wake_time FROM babies WHERE family_id = ?", [fid]).fetchall()
    return [{"baby_id": b[0], "name": b[1], "gender": b[2], "birthday": b[3], "height": b[4], "weight": b[5], "sick_mode": b[6] or 0, "night_bedtime": b[7] or "", "night_wake_time": b[8] or ""} for b in babies]

@app.post("/family/babies")
async def add_baby(req: BabyCreateRequest, request: Request):
    """添加宝宝到家庭"""
    fid = get_family_id(request)
    # 重名校验
    existing = db.execute("SELECT baby_id FROM babies WHERE family_id = ? AND name = ?", [fid, req.name]).fetchall()
    if existing:
        raise HTTPException(status_code=409, detail=f"宝宝「{req.name}」已存在，请使用其他名字")
    bid = str(uuid.uuid4())[:8]
    db.execute("INSERT INTO babies (baby_id, family_id, name, gender, birthday, height, weight) VALUES (?, ?, ?, ?, ?, ?, ?)",
               [bid, fid, req.name, req.gender, req.birthday, req.height, req.weight])
    db.sync()
    return {"baby_id": bid, "name": req.name, "gender": req.gender, "birthday": req.birthday, "height": req.height, "weight": req.weight}

@app.put("/family/babies/{baby_id}")
async def update_baby(baby_id: str, req: BabyUpdateRequest, request: Request):
    """更新宝宝信息"""
    fid = get_family_id(request)
    # 确认宝宝属于该家庭
    baby = db.execute("SELECT baby_id FROM babies WHERE baby_id = ? AND family_id = ?", [baby_id, fid]).fetchall()
    if not baby:
        raise HTTPException(status_code=404, detail="Baby not found")
    # 只更新提供的字段
    updates = {}
    if req.name is not None:
        # 重名校验（排除自身）
        dup = db.execute("SELECT baby_id FROM babies WHERE family_id = ? AND name = ? AND baby_id != ?", [fid, req.name, baby_id]).fetchall()
        if dup:
            raise HTTPException(status_code=409, detail=f"宝宝「{req.name}」已存在，请使用其他名字")
        updates["name"] = req.name
    if req.gender is not None: updates["gender"] = req.gender
    if req.birthday is not None: updates["birthday"] = req.birthday
    if req.height is not None: updates["height"] = req.height
    if req.weight is not None: updates["weight"] = req.weight
    if req.sick_mode is not None: updates["sick_mode"] = req.sick_mode
    if req.night_bedtime is not None: updates["night_bedtime"] = req.night_bedtime
    if req.night_wake_time is not None: updates["night_wake_time"] = req.night_wake_time
    if updates:
        cols = ", ".join(f"{k}=?" for k in updates)
        vals = list(updates.values()) + [baby_id, fid]
        db.execute(f"UPDATE babies SET {cols} WHERE baby_id = ? AND family_id = ?", vals)
        db.sync()
    return await list_babies(request)

@app.delete("/family/babies/{baby_id}")
async def delete_baby(baby_id: str, request: Request):
    """删除宝宝（同时删除相关记录）"""
    fid = get_family_id(request)
    # 检查是否为家庭最后一个宝宝
    count = db.execute("SELECT COUNT(*) FROM babies WHERE family_id = ?", [fid]).fetchall()
    if count and count[0][0] <= 1:
        raise HTTPException(status_code=400, detail="不能删除最后一个宝宝，家庭至少需要一个宝宝")
    db.execute("DELETE FROM babies WHERE baby_id = ? AND family_id = ?", [baby_id, fid])
    db.execute("DELETE FROM feeding_records_v2 WHERE baby_id = ?", [baby_id])
    db.execute("DELETE FROM checklist_items_v2 WHERE baby_id = ?", [baby_id])
    db.execute("DELETE FROM growth_records_v2 WHERE baby_id = ?", [baby_id])
    db.execute("DELETE FROM temperature_records WHERE baby_id = ?", [baby_id])
    db.sync()
    return {"ok": True}

@app.post("/profile", response_model=BabyProfile)
async def save_profile(profile: BabyProfile, request: Request):
    """兼容旧版：直接创建 profile 并自动创建家庭+宝宝"""
    uid = get_uid(request)
    # 检查是否已在家庭中
    member = db.execute("SELECT family_id FROM family_members WHERE user_id = ?", [uid]).fetchall()
    if member:
        # 已有家庭，更新第一个宝宝
        babies = db.execute("SELECT baby_id FROM babies WHERE family_id = ?", [member[0][0]]).fetchall()
        if babies:
            db.execute("UPDATE babies SET name=?, gender=?, birthday=?, height=?, weight=? WHERE baby_id=?",
                       [profile.name, profile.gender, profile.birthday, profile.height, profile.weight, babies[0][0]])
            db.sync()
            return profile
    # 创建新家庭+宝宝
    fid = generate_family_id()
    db.execute("INSERT INTO families (family_id, family_name) VALUES (?, ?)", [fid, f"{profile.name}的家庭"])
    db.execute("INSERT INTO family_members (family_id, user_id, role) VALUES (?, ?, 'creator')", [fid, uid])
    bid = str(uuid.uuid4())[:8]
    db.execute("INSERT INTO babies (baby_id, family_id, name, gender, birthday, height, weight) VALUES (?, ?, ?, ?, ?, ?, ?)",
               [bid, fid, profile.name, profile.gender, profile.birthday, profile.height, profile.weight])
    # 同时写入旧表做兼容
    db.execute("INSERT OR REPLACE INTO profiles (user_id, name, gender, birthday, height, weight) VALUES (?, ?, ?, ?, ?, ?)",
               [uid, profile.name, profile.gender, profile.birthday, profile.height, profile.weight])
    db.sync()
    return profile

# ---- 喂养记录 ----
@app.post("/feeding-records", response_model=FeedingRecord)
async def add_feeding_record(record: FeedingRecord, request: Request):
    bid = get_baby_id(request)
    uid = get_uid(request)
    today = date.today().isoformat()
    record.id = str(uuid.uuid4())[:8]
    db.execute(
        "INSERT INTO feeding_records_v2 (id, baby_id, date, time, amount, type, note, food_groups, duration, kind, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [record.id, bid, today, record.time, record.amount, record.type, record.note, record.foodGroups, record.duration, record.kind, uid])
    db.sync()
    record.recorderName = _recorder_name(uid)
    return record

@app.get("/feeding-records", response_model=List[FeedingRecord])
async def get_feeding_records(request: Request, date_str: str = Query(default=None, alias="date")):
    bid = get_baby_id(request)
    d = date_str or date.today().isoformat()
    rs = db.execute(
        "SELECT id, time, amount, type, note, food_groups, duration, kind, user_id FROM feeding_records_v2 WHERE baby_id = ? AND date = ?",
        [bid, d]).fetchall()
    return [FeedingRecord(id=r[0], time=r[1], amount=r[2], type=_norm_feed_type(r[3]), note=r[4] or '', foodGroups=r[5] or '', duration=r[6] or 0, kind=r[7] or '', recorderName=_recorder_name(r[8] or '')) for r in rs]

@app.put("/feeding-records/{record_id}", response_model=FeedingRecord)
async def update_feeding_record(record_id: str, record: FeedingRecord, request: Request):
    bid = get_baby_id(request)
    uid = get_uid(request)
    today = date.today().isoformat()
    rs = db.execute(
        "SELECT id FROM feeding_records_v2 WHERE id = ? AND baby_id = ? AND date = ?",
        [record_id, bid, today]).fetchall()
    if not rs:
        raise HTTPException(status_code=404, detail="Record not found")
    db.execute(
        "UPDATE feeding_records_v2 SET time=?, amount=?, type=?, note=?, food_groups=?, duration=?, kind=?, user_id=? WHERE id=? AND baby_id=? AND date=?",
        [record.time, record.amount, record.type, record.note, record.foodGroups, record.duration, record.kind, uid, record_id, bid, today])
    db.sync()
    record.id = record_id
    record.recorderName = _recorder_name(uid)
    return record

@app.delete("/feeding-records/{record_id}")
async def delete_feeding_record(record_id: str, request: Request):
    bid = get_baby_id(request)
    today = date.today().isoformat()
    rs = db.execute(
        "SELECT id FROM feeding_records_v2 WHERE id = ? AND baby_id = ? AND date = ?",
        [record_id, bid, today]).fetchall()
    if not rs:
        raise HTTPException(status_code=404, detail="Record not found")
    db.execute("DELETE FROM feeding_records_v2 WHERE id = ? AND baby_id = ? AND date = ?",
               [record_id, bid, today])
    db.sync()
    return {"status": "deleted", "id": record_id}

# ---- 身高体重成长记录 ----
class GrowthRecord(BaseModel):
    id: str = ''
    date: str
    height: float = 0.0   # cm
    weight: float = 0.0   # kg
    note: str = ''
    recorderName: str = ''  # 记录人昵称


@app.post("/growth-records", response_model=GrowthRecord)
async def add_growth_record(record: GrowthRecord, request: Request):
    bid = get_baby_id(request)
    uid = get_uid(request)
    record.id = str(uuid.uuid4())[:8]
    db.execute(
        "INSERT INTO growth_records_v2 (id, baby_id, date, height, weight, note, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [record.id, bid, record.date, record.height, record.weight, record.note, uid])
    db.sync()
    record.recorderName = _recorder_name(uid)
    return record


@app.get("/growth-records", response_model=List[GrowthRecord])
async def get_growth_records(request: Request):
    bid = get_baby_id(request)
    rs = db.execute(
        "SELECT id, date, height, weight, note, user_id FROM growth_records_v2 WHERE baby_id = ? ORDER BY date ASC",
        [bid]).fetchall()
    return [GrowthRecord(id=r[0], date=r[1], height=r[2] or 0.0, weight=r[3] or 0.0, note=r[4] or '', recorderName=_recorder_name(r[5] or '')) for r in rs]


@app.delete("/growth-records/{record_id}")
async def delete_growth_record(record_id: str, request: Request):
    bid = get_baby_id(request)
    db.execute("DELETE FROM growth_records_v2 WHERE id = ? AND baby_id = ?", [record_id, bid])
    db.sync()
    return {"status": "deleted", "id": record_id}


@app.put("/growth-records/{record_id}", response_model=GrowthRecord)
async def update_growth_record(record_id: str, record: GrowthRecord, request: Request):
    bid = get_baby_id(request)
    uid = get_uid(request)
    db.execute(
        "UPDATE growth_records_v2 SET date=?, height=?, weight=?, note=?, user_id=? WHERE id=? AND baby_id=?",
        [record.date, record.height, record.weight, record.note, uid, record_id, bid])
    db.sync()
    record.id = record_id
    record.recorderName = _recorder_name(uid)
    return record


# ---- 生病模式：体温记录 ----
class TemperatureRecord(BaseModel):
    id: str = ''
    datetime: str = ''
    temp: float
    note: str = ''
    recorderName: str = ''  # 记录人昵称


@app.post("/temperature-records", response_model=TemperatureRecord)
async def add_temperature_record(record: TemperatureRecord, request: Request):
    bid = get_baby_id(request)
    uid = get_uid(request)
    record.id = str(uuid.uuid4())[:8]
    record.datetime = record.datetime or datetime.now().strftime("%Y-%m-%d %H:%M")
    db.execute(
        "INSERT INTO temperature_records (id, baby_id, datetime, temp, note, user_id) VALUES (?, ?, ?, ?, ?, ?)",
        [record.id, bid, record.datetime, record.temp, record.note, uid])
    db.sync()
    record.recorderName = _recorder_name(uid)
    return record


@app.get("/temperature-records", response_model=List[TemperatureRecord])
async def get_temperature_records(request: Request):
    bid = get_baby_id(request)
    rs = db.execute(
        "SELECT id, datetime, temp, note, user_id FROM temperature_records WHERE baby_id = ? ORDER BY datetime DESC",
        [bid]).fetchall()
    return [TemperatureRecord(id=r[0], datetime=r[1], temp=r[2] or 0.0, note=r[3] or '', recorderName=_recorder_name(r[4] or '')) for r in rs]


@app.delete("/temperature-records/{record_id}")
async def delete_temperature_record(record_id: str, request: Request):
    bid = get_baby_id(request)
    db.execute("DELETE FROM temperature_records WHERE id = ? AND baby_id = ?", [record_id, bid])
    db.sync()
    return {"status": "deleted", "id": record_id}


@app.put("/temperature-records/{record_id}")
async def update_temperature_record(record_id: str, record: TemperatureRecord, request: Request):
    bid = get_baby_id(request)
    uid = get_uid(request)
    db.execute(
        "UPDATE temperature_records SET datetime = ?, temp = ?, note = ?, user_id = ? WHERE id = ? AND baby_id = ?",
        [record.datetime, record.temp, record.note, uid, record_id, bid])
    db.sync()
    record.id = record_id
    record.recorderName = _recorder_name(uid)
    return {"status": "updated", "id": record_id}


@app.get("/feeding-evaluation", response_model=FeedingEvaluation)
async def get_feeding_evaluation(request: Request, date_str: str = Query(default=None, alias="date")):
    bid = get_baby_id(request)
    d = date_str or date.today().isoformat()

    rs = db.execute(
        "SELECT id, time, amount, type, note, food_groups, duration, kind, user_id FROM feeding_records_v2 WHERE baby_id = ? AND date = ?",
        [bid, d]).fetchall()
    records = [FeedingRecord(id=r[0], time=r[1], amount=r[2], type=_norm_feed_type(r[3]), note=r[4] or '', foodGroups=r[5] or '', duration=r[6] or 0, kind=r[7] or '', recorderName=_recorder_name(r[8] or '')) for r in rs]

    milk_records = [r for r in records if r.type == 'milk']
    solids_records = [r for r in records if r.type == 'solids']
    total_milk = sum(r.amount for r in milk_records)
    total_solids = sum(r.amount for r in solids_records)

    profile = _get_baby_profile(bid)
    if not profile:
        raise HTTPException(status_code=404, detail="Baby profile not found")
    months = calculate_months(profile["birthday"])
    fa = get_feeding_advice(months)
    target_milk = parse_target_milk(fa.milk)
    needs_solids = (fa.solids == '需要')

    # 辅食三项（WHO 口径）
    meal_count = len(solids_records)
    groups = set()
    for r in solids_records:
        groups.update(_parse_food_groups(r.foodGroups))
    diversity = len(groups)
    groups_logged = diversity > 0
    per_meal = total_solids / meal_count if meal_count > 0 else 0
    target_meals = _target_meals(months)

    # 奶量目标动态化（辅食抵扣）
    milk_displaced = target_milk > 0 and total_solids >= _solids_displace_threshold(months)
    effective_target = target_milk * 0.75 if milk_displaced else target_milk

    # 奶量评估（需达到目标才算充足；上限 130% 判超出）
    milk_status = 'good'
    milk_msg = ''
    if effective_target > 0:
        ratio = total_milk / effective_target
        if ratio < 1.0:
            milk_status = 'low'
            milk_msg = f"奶量 {total_milk:.0f}ml，低于建议量 {effective_target:.0f}ml" + ("（目标已随辅食量下调）" if milk_displaced else "")
        elif ratio > 1.3:
            milk_status = 'high'
            milk_msg = f"奶量 {total_milk:.0f}ml，超过建议量 {effective_target:.0f}ml 的 130%"
        else:
            milk_msg = f"奶量 {total_milk:.0f}ml，已达到建议量 {effective_target:.0f}ml" + ("（已随辅食量下调目标）" if milk_displaced else "")

    # 辅食评估（餐次 + 种类多样性作为建议项；仅「需要辅食却完全没吃」判不足）
    solids_status = 'good'
    solids_msg = ''
    if not needs_solids:
        if total_solids > 0:
            solids_status = 'high'
            solids_msg = f"当前阶段暂不建议添加辅食，已记录辅食 {total_solids:.0f}g"
    else:
        if total_solids == 0:
            solids_status = 'low'
            solids_msg = f"今日尚未记录辅食（建议 {target_meals} 次，每次约 {fa.solidAmount}）"
        else:
            solids_msg = f"辅食 {meal_count} 次、合计 {total_solids:.0f}g" + (f"、种类 {diversity} 种" if groups_logged else "（未记录食物种类）")

    # 综合状态（不足优先）
    statuses = [s for s in (milk_status, solids_status) if s != 'good']
    if not statuses:
        overall = 'good'
    elif 'low' in statuses:
        overall = 'low'
    elif 'high' in statuses:
        overall = 'high'
    else:
        overall = 'good'

    # 喂养次数 & 间隔
    feed_count = len(records)
    avg_interval = ''
    if len(milk_records) >= 2:
        times = sorted([r.time for r in milk_records])
        intervals = []
        for i in range(1, len(times)):
            h1, m1 = map(int, times[i-1].split(':'))
            h2, m2 = map(int, times[i].split(':'))
            diff = (h2*60 + m2) - (h1*60 + m1)
            intervals.append(diff)
        avg_min = sum(intervals) / len(intervals)
        avg_h = int(avg_min // 60)
        avg_m = int(avg_min % 60)
        avg_interval = f"{avg_h}h{avg_m:02d}m"

    # 今日建议卡：建议每日喂奶次数 + 单次奶量（与 suggestions 内逻辑一致，独立暴露给前端）
    recommend_feeds = 5 if months >= 6 else 6
    per_feed_ml = effective_target / recommend_feeds if effective_target > 0 else 0

    # 动态建议
    suggestions = []
    if milk_status == 'low':
        if feed_count < 5 and months < 12:
            # 按「建议每日喂奶次数」拆分每日总量，得到合理的单次奶量（避免把全天总量当成单次量）
            suggestions.append(f"今日仅喂奶 {len(milk_records)} 次，建议每日喂奶约 {recommend_feeds} 次，每次约 {per_feed_ml:.0f}ml")
        else:
            suggestions.append(f"可适当增加单次奶量，当前平均每次 {total_milk/max(len(milk_records),1):.0f}ml")
    elif milk_status == 'high':
        suggestions.append("奶量偏高，注意观察是否有吐奶或胀气，可适当减少单次量")

    if solids_status == 'low' and needs_solids:
        if meal_count == 0:
            suggestions.append(f"建议开始添加辅食，尝试 {', '.join(fa.types)}")
    elif solids_status == 'high' and not needs_solids:
        suggestions.append(f"当前月龄 ({months} 个月) 以奶为主，暂不建议添加辅食")

    # 辅食已吃但餐次/种类不足：作为建议项，不影响「充足/不足」整体判定
    if needs_solids and total_solids > 0:
        if meal_count < target_meals:
            suggestions.append(f"建议逐步增加辅食次数至 {target_meals} 次（当前 {meal_count} 次），尝试 {', '.join(fa.types)}")
        if groups_logged and diversity < 4:
            suggestions.append(f"辅食种类偏少（{diversity}/4），建议搭配谷物、肉禽鱼、蛋、蔬果等多类食材")

    if not groups_logged and needs_solids and meal_count > 0:
        suggestions.append("记录辅食时可勾选「食物种类」，系统会按 WHO 标准评估营养多样性")

    if avg_interval and len(milk_records) >= 2:
        if months < 6:
            ideal_min, ideal_max = 120, 180
        elif months < 12:
            ideal_min, ideal_max = 180, 240
        else:
            ideal_min, ideal_max = 240, 300
        h, m = map(int, avg_interval.replace('m','').split('h'))
        avg_total = h * 60 + m
        if avg_total < ideal_min:
            suggestions.append(f"平均喂养间隔 {avg_interval} 偏短，建议间隔 {ideal_min//60}-{ideal_max//60} 小时")
        elif avg_total > ideal_max:
            suggestions.append(f"平均喂养间隔 {avg_interval} 偏长，宝宝可能饿了，建议缩短至 {ideal_min//60}-{ideal_max//60} 小时")

    now_hour = datetime.now().hour
    if now_hour >= 20 and total_milk < effective_target * 0.7:
        suggestions.append("已到晚间，奶量仍偏低，建议睡前补一次奶")
    elif now_hour >= 14 and now_hour < 20 and meal_count == 0 and needs_solids:
        suggestions.append("下午了还没添加辅食，建议安排一次")

    if not suggestions and overall == 'good':
        suggestions.append("今日喂养节奏不错，继续保持！")

    parts = [milk_msg]
    if solids_msg:
        parts.append(solids_msg)
    if avg_interval:
        parts.append(f"平均间隔 {avg_interval}")
    message = "；".join(parts) + "。"

    return FeedingEvaluation(
        totalMilk=total_milk, totalSolids=total_solids,
        targetMilk=target_milk, targetSolidsText=fa.solidAmount,
        status=overall, milkStatus=milk_status, solidsStatus=solids_status,
        message=message, suggestions=suggestions,
        feedCount=feed_count, avgInterval=avg_interval, records=records,
        effectiveTargetMilk=effective_target, milkDisplaced=milk_displaced,
        targetSolidsMeals=target_meals, solidsMealCount=meal_count,
        solidsDiversity=diversity, targetDiversity=4,
        solidsAmountPerMeal=per_meal, solidsGroupsLogged=groups_logged,
        recommendFeeds=recommend_feeds, perFeedMl=per_feed_ml,
    )

# ---------------- 喂养月历 & 统计 ----------------
@app.get("/feeding-calendar")
async def get_feeding_calendar(request: Request, year: int = Query(...), month: int = Query(...)):
    """返回指定月份每天的喂养水平（good/low/high/empty），奶量用动态目标、辅食看餐次+种类。"""
    bid = get_baby_id(request)
    profile = _get_baby_profile(bid)
    if not profile:
        raise HTTPException(status_code=404, detail="Baby profile not found")
    months = calculate_months(profile["birthday"])
    fa = get_feeding_advice(months)
    target_milk = parse_target_milk(fa.milk)
    needs_solids = (fa.solids == '需要')
    _, num_days = _calendar.monthrange(year, month)
    today = date.today()

    rs = db.execute(
        "SELECT date, amount, type, food_groups FROM feeding_records_v2 WHERE baby_id = ? AND date LIKE ?",
        [bid, f"{year:04d}-{month:02d}-%"]).fetchall()

    day_map = {}
    for r in rs:
        d = r[0]
        day_num = int(d.split('-')[2])
        rtype = _norm_feed_type(r[2])
        if day_num not in day_map:
            day_map[day_num] = {"total_milk": 0, "total_solids": 0, "meal_count": 0, "feed_count": 0, "groups": set()}
        if rtype == 'milk':
            day_map[day_num]["total_milk"] += (r[1] or 0)
        elif rtype == 'solids':
            day_map[day_num]["total_solids"] += (r[1] or 0)
            day_map[day_num]["meal_count"] += 1
        day_map[day_num]["feed_count"] += 1
        day_map[day_num]["groups"].update(_parse_food_groups(r[3]))

    days = {}
    for day in range(1, num_days + 1):
        dm = day_map.get(day, {})
        total_milk = dm.get("total_milk", 0)
        total_solids = dm.get("total_solids", 0)
        meal_count = dm.get("meal_count", 0)
        feed_count = dm.get("feed_count", 0)
        diversity = len(dm.get("groups", set()))
        is_future = date(year, month, day) > today

        if is_future:
            level = 'future'
        elif feed_count == 0:
            level = 'empty'
        else:
            level = _day_level(total_milk, total_solids, meal_count, diversity, months, target_milk, needs_solids)

        days[str(day)] = {
            "level": level,
            "totalMilk": total_milk,
            "totalSolids": total_solids,
            "feedCount": feed_count,
            "isFuture": is_future,
        }

    daily_milk = [day_map.get(d, {}).get("total_milk", 0) for d in range(1, num_days + 1)]

    return {"year": year, "month": month, "targetMilk": target_milk, "days": days, "dailyMilk": daily_milk}

@app.get("/feeding-stats-monthly")
async def get_feeding_stats_monthly(request: Request, year: int = Query(...), month: int = Query(...)):
    """返回指定月份的喂养统计（奶量动态目标 + 辅食餐次/种类）"""
    bid = get_baby_id(request)
    profile = _get_baby_profile(bid)
    if not profile:
        raise HTTPException(status_code=404, detail="Baby profile not found")
    months = calculate_months(profile["birthday"])
    fa = get_feeding_advice(months)
    target_milk = parse_target_milk(fa.milk)
    needs_solids = (fa.solids == '需要')
    _, num_days = _calendar.monthrange(year, month)
    today = date.today()

    rs = db.execute(
        "SELECT date, amount, type, food_groups FROM feeding_records_v2 WHERE baby_id = ? AND date LIKE ?",
        [bid, f"{year:04d}-{month:02d}-%"]).fetchall()

    total_milk = 0
    total_solids = 0
    total_feeds = 0
    days_with_data = set()

    day_map = {}
    for r in rs:
        d = r[0]
        day_num = int(d.split('-')[2])
        rtype = _norm_feed_type(r[2])
        days_with_data.add(d)
        if day_num not in day_map:
            day_map[day_num] = {"total_milk": 0, "total_solids": 0, "meal_count": 0, "groups": set()}
        if rtype == 'milk':
            day_map[day_num]["total_milk"] += (r[1] or 0)
            total_milk += (r[1] or 0)
        elif rtype == 'solids':
            day_map[day_num]["total_solids"] += (r[1] or 0)
            day_map[day_num]["meal_count"] += 1
            total_solids += (r[1] or 0)
        day_map[day_num]["groups"].update(_parse_food_groups(r[3]))
        total_feeds += 1

    good_days = low_days = high_days = 0
    solids_meal_good_days = 0
    solids_diverse_days = 0
    for day_num, dm in day_map.items():
        # 按当天实际日期算月龄/目标，避免跨月混用今天的月龄导致目标不准
        day_date = date(year, month, day_num)
        day_months = calculate_months(profile["birthday"], as_of=day_date)
        day_fa = get_feeding_advice(day_months)
        day_target = parse_target_milk(day_fa.milk)
        day_needs = (day_fa.solids == '需要')
        lvl = _day_level(dm["total_milk"], dm["total_solids"], dm["meal_count"], len(dm["groups"]), day_months, day_target, day_needs)
        if lvl == 'good':
            good_days += 1
        elif lvl == 'low':
            low_days += 1
        else:
            high_days += 1
        if day_needs and dm["meal_count"] >= _target_meals(day_months):
            solids_meal_good_days += 1
        if dm["groups"] and len(dm["groups"]) >= 4:
            solids_diverse_days += 1

    past_days = min(today.day, num_days) if today.year == year and today.month == month else num_days
    avg_daily_milk = round(total_milk / max(past_days, 1), 1)

    return {
        "year": year, "month": month,
        "totalMilk": total_milk, "totalSolids": total_solids,
        "totalFeeds": total_feeds, "daysWithData": len(days_with_data),
        "avgDailyMilk": avg_daily_milk, "targetMilk": target_milk,
        "goodDays": good_days, "lowDays": low_days, "highDays": high_days,
        "solidsMealGoodDays": solids_meal_good_days, "solidsDiverseDays": solids_diverse_days,
        "pastDays": past_days,
    }

@app.get("/sickness-calendar")
async def get_sickness_calendar(request: Request, year: int = Query(...), month: int = Query(...)):
    """返回指定月份每天的体温/生病情况，以及生病区间（连续有记录的日期）与持续天数。"""
    bid = get_baby_id(request)
    _, num_days = _calendar.monthrange(year, month)
    today = date.today()
    rs = db.execute(
        "SELECT datetime, temp FROM temperature_records WHERE baby_id = ? AND datetime LIKE ?",
        [bid, f"{year:04d}-{month:02d}-%"]).fetchall()

    day_map = {}
    for r in rs:
        dt = r[0] or ''
        try:
            d = int(dt[8:10])
        except (ValueError, IndexError):
            continue
        t = r[1] or 0
        if d not in day_map:
            day_map[d] = {"max_temp": t, "count": 0}
        day_map[d]["count"] += 1
        if t > day_map[d]["max_temp"]:
            day_map[d]["max_temp"] = t

    days = {}
    sick_days = 0
    fever_days = 0
    for d in range(1, num_days + 1):
        dm = day_map.get(d, {})
        count = dm.get("count", 0)
        max_temp = dm.get("max_temp", 0)
        is_future = date(year, month, d) > today
        if is_future:
            level = 'future'
        elif count == 0:
            level = 'empty'
        elif max_temp >= 38:
            level = 'fever'
            sick_days += 1
            fever_days += 1
        else:
            level = 'normal'
            sick_days += 1
        days[str(d)] = {"level": level, "maxTemp": round(max_temp, 1), "count": count}

    # 计算生病区间：连续有记录的日期归为一个区间
    sick_day_nums = sorted([d for d in range(1, num_days + 1) if day_map.get(d, {}).get("count", 0) > 0])
    episodes = []
    if sick_day_nums:
        start = prev = sick_day_nums[0]
        ep_max = day_map[start]["max_temp"]
        for d in sick_day_nums[1:]:
            if d - prev <= 1:
                prev = d
                ep_max = max(ep_max, day_map[d]["max_temp"])
            else:
                episodes.append({"start": start, "end": prev, "days": prev - start + 1, "maxTemp": round(ep_max, 1)})
                start = prev = d
                ep_max = day_map[d]["max_temp"]
        episodes.append({"start": start, "end": prev, "days": prev - start + 1, "maxTemp": round(ep_max, 1)})

    latest_ep = episodes[-1] if episodes else None
    current_duration = latest_ep["days"] if latest_ep else 0
    latest_temp = 0
    if today.year == year and today.month == month and today.day in day_map:
        latest_temp = round(day_map[today.day]["max_temp"], 1)

    return {
        "year": year, "month": month,
        "days": days,
        "sickDays": sick_days, "feverDays": fever_days,
        "episodes": episodes,
        "currentDuration": current_duration,
        "latestTemp": latest_temp,
    }

# ---------------- 每日照护清单 ----------------
def get_checklist_template(months: int) -> list:
    if months < 6:
        return [
            {"id": "vitamin_ad", "label": "维生素 AD 滴剂", "desc": "每日 1 粒，出生后 2 周起补充", "icon": "pill"},
            {"id": "sunlight",   "label": "晒太阳 / 户外透气", "desc": "避开正午，15-30 分钟", "icon": "sun"},
            {"id": "tummy_time", "label": "趴着练习 (Tummy Time)", "desc": "清醒时趴 3-5 分钟，每日数次", "icon": "baby"},
            {"id": "interact",   "label": "亲子互动 / 说话", "desc": "面对面聊天、微笑回应", "icon": "heart"},
            {"id": "oral_care",  "label": "清洁口腔", "desc": "湿纱布或硅胶指套擦拭牙龈，出牙前不用牙膏", "icon": "smile"},
        ]
    elif months < 12:
        return [
            {"id": "vitamin_ad", "label": "维生素 AD / D3", "desc": "每日 1 粒", "icon": "pill"},
            {"id": "solid_food", "label": "辅食喂养", "desc": "按阶段安排辅食次数", "icon": "utensils"},
            {"id": "sunlight",   "label": "晒太阳 / 户外活动", "desc": "30 分钟以上", "icon": "sun"},
            {"id": "motor_skill", "label": "大运动练习", "desc": "坐 / 爬 / 扶站练习", "icon": "baby"},
            {"id": "oral_care",  "label": "清洁口腔", "desc": "湿纱布或硅胶刷擦拭牙龈 / 牙齿", "icon": "smile"},
            {"id": "reading",   "label": "亲子阅读", "desc": "绘本 / 布书互动", "icon": "book"},
        ]
    else:
        return [
            {"id": "vitamin_ad", "label": "维生素 AD / D3", "desc": "每日 1 粒", "icon": "pill"},
            {"id": "three_meals", "label": "三餐规律进食", "desc": "自主进食，培养餐桌习惯", "icon": "utensils"},
            {"id": "outdoor",   "label": "户外活动", "desc": "1 小时以上", "icon": "sun"},
            {"id": "brush_teeth", "label": "刷牙", "desc": "早晚各 1 次，含氟牙膏米粒大", "icon": "smile"},
            {"id": "reading",   "label": "亲子阅读 / 认知游戏", "desc": "绘本 / 拼图 / 积木", "icon": "book"},
            {"id": "nap",       "label": "午睡安排", "desc": "保证白天 1-2 次小睡", "icon": "moon"},
        ]

@app.get("/daily-checklist", response_model=List[ChecklistItem])
async def get_daily_checklist(request: Request, date_str: str = Query(default=None, alias="date")):
    bid = get_baby_id(request)
    d = date_str or date.today().isoformat()
    profile = _get_baby_profile(bid)
    if not profile:
        raise HTTPException(status_code=404, detail="Baby profile not found")
    months = calculate_months(profile["birthday"])
    template = get_checklist_template(months)
    rs = db.execute(
        "SELECT item_id, checked FROM checklist_items_v2 WHERE baby_id = ? AND date = ?",
        [bid, d]).fetchall()
    checked_map = {r[0]: bool(r[1]) for r in rs}
    return [
        ChecklistItem(id=item["id"], label=item["label"], desc=item.get("desc", ""),
                      icon=item.get("icon", "check"), checked=checked_map.get(item["id"], False))
        for item in template
    ]

@app.post("/daily-checklist/toggle", response_model=ChecklistItem)
async def toggle_checklist_item(req: ChecklistToggleRequest, request: Request):
    bid = get_baby_id(request)
    today = date.today().isoformat()
    db.execute(
        "INSERT OR REPLACE INTO checklist_items_v2 (baby_id, date, item_id, checked) VALUES (?, ?, ?, ?)",
        [bid, today, req.itemId, 1 if req.checked else 0])
    db.sync()
    profile = _get_baby_profile(bid)
    if not profile:
        raise HTTPException(status_code=404, detail="Baby profile not found")
    months = calculate_months(profile["birthday"])
    template = get_checklist_template(months)
    for item in template:
        if item["id"] == req.itemId:
            return ChecklistItem(id=item["id"], label=item["label"], desc=item.get("desc", ""),
                                 icon=item.get("icon", "check"), checked=req.checked)
    raise HTTPException(status_code=404, detail="Checklist item not found")

@app.get("/checklist/history")
async def get_checklist_history(request: Request, year: int = Query(...), month: int = Query(...)):
    bid = get_baby_id(request)
    profile = _get_baby_profile(bid)
    if not profile:
        raise HTTPException(status_code=404, detail="Baby profile not found")
    months = calculate_months(profile["birthday"])
    template = get_checklist_template(months)
    total = len(template)
    _, num_days = _calendar.monthrange(year, month)
    # 批量读取该月所有勾选记录
    rs = db.execute(
        "SELECT date, item_id, checked FROM checklist_items_v2 WHERE baby_id = ? AND date LIKE ?",
        [bid, f"{year:04d}-{month:02d}-%"]).fetchall()
    day_map = {}
    for r in rs:
        d = r[0]
        day_num = int(d.split('-')[2])
        if day_num not in day_map:
            day_map[day_num] = {}
        day_map[day_num][r[1]] = bool(r[2])

    today = date.today()
    days = {}
    for day in range(1, num_days + 1):
        checked_map = day_map.get(day, {})
        checked_count = sum(1 for v in checked_map.values() if v)
        is_future = date(year, month, day) > today
        days[str(day)] = {
            "checked": checked_count,
            "total": total,
            "hasData": len(checked_map) > 0,
            "isFuture": is_future,
        }
    return {"year": year, "month": month, "total": total, "days": days}

@app.get("/daily-checklist/by-date", response_model=List[ChecklistItem])
async def get_checklist_by_date(request: Request, date_str: str = Query(..., alias="date")):
    bid = get_baby_id(request)
    profile = _get_baby_profile(bid)
    if not profile:
        raise HTTPException(status_code=404, detail="Baby profile not found")
    months = calculate_months(profile["birthday"])
    template = get_checklist_template(months)
    rs = db.execute(
        "SELECT item_id, checked FROM checklist_items_v2 WHERE baby_id = ? AND date = ?",
        [bid, date_str]).fetchall()
    checked_map = {r[0]: bool(r[1]) for r in rs}
    return [
        ChecklistItem(id=item["id"], label=item["label"], desc=item.get("desc", ""),
                      icon=item.get("icon", "check"), checked=checked_map.get(item["id"], False))
        for item in template
    ]

# ---------------- 阶段提醒（发育里程碑科普） ----------------
# 依据 WHO / 美国 CDC「Learn the Signs. Act Early.」发育里程碑、美国儿科学会(AAP)、
# 香港卫生署儿童生长发展资料，以及国内多家三甲医院儿科/口腔科科普整理。
# start / end 单位为「月」；所有月龄均为大致范围，存在明显个体差异。
STAGE_TIPS = [
    {
        "key": "colic",
        "title": "二月闹（肠绞痛）",
        "start": 0.5, "end": 4,
        "principle": "婴儿肠道神经系统和肌肉协调性尚未成熟，肠蠕动不规律易引发痉挛性腹痛；也与肠胀气、乳糖不耐受、食物过敏及喂奶时吞入空气有关。多在出生后 2-4 周出现、傍晚/夜间高发，通常 3-4 个月内自行缓解。",
        "signs": [
            "每天固定时段（多在傍晚或夜间）长时间哭闹，常持续 1-3 小时",
            "双腿蜷曲、握紧拳头、面色涨红，放屁或排便后缓解",
            "腹部胀气、频繁排气，吃奶时易哭闹",
        ],
        "advice": [
            "用「飞机抱」或竖抱拍嗝，帮助排出肠胃气体",
            "以温暖手掌顺时针轻柔按摩宝宝腹部",
            "包襁褓、播放白噪音、轻声安抚以稳定情绪",
            "母亲注意饮食，减少咖啡因与易产气食物，避免过度喂养",
            "若出现发热、血便、体重不增，或 4 个月后仍频繁发作，请及时就医",
        ],
        "sources": "美国儿科学会(AAP)、腾讯医典《肠绞痛》、北京医院儿科科普",
    },
    {
        "key": "milk-aversion",
        "title": "生理性厌奶期",
        "start": 2.5, "end": 6,
        "principle": "3-6 个月宝宝生长速度自然放缓，奶量需求暂时下降；同时视觉听觉发育、对外界好奇导致吃奶分心，出牙不适也会加重抗拒。多为生理性，精神与体重通常正常。",
        "signs": [
            "吃奶量减少但精神好、体重稳步增长",
            "吃奶时易分心、扭头拒奶、边吃边玩",
            "对单一奶味新鲜感消退",
        ],
        "advice": [
            "顺应喂养，不强迫、不追每顿定量",
            "营造安静环境，固定喂奶时段，关掉电视手机等干扰",
            "适当增加活动量（多趴、做被动操）消耗体能",
            "检查奶嘴孔径是否合适（奶瓶倒置每秒约 1 滴）",
            "满 6 月龄再添加辅食，勿过早；若体重不增、尿少脱水或厌奶超 1 个月需就医",
        ],
        "sources": "广州市妇女儿童医疗中心、首都医科大学附属北京同仁医院儿科、上海儿童医学中心(SCMC)科普",
    },
    {
        "key": "sleep-regression-4m",
        "title": "4月睡眠倒退",
        "start": 3.5, "end": 5.5,
        "principle": "约 4 个月时，宝宝睡眠模式从新生儿的「多相短睡」向成人式「昼夜节律 + 睡眠周期」过渡，浅睡比例增加、单个睡眠周期缩短到约 45-60 分钟；叠加翻身等大运动发展与感知觉飞速发育，容易出现频繁夜醒、哄睡困难、小睡变短。这是神经系统发育成熟的正常信号，通常持续 2-4 周自行缓解。",
        "signs": [
            "原本能睡整觉突然频繁夜醒（每 1-2 小时醒来）",
            "入睡变困难、哄睡时间拉长，常被放下就醒",
            "白天小睡变短、易惊醒，情绪略烦躁",
        ],
        "advice": [
            "建立固定睡前仪式（洗澡→抚触→喂奶→关灯→轻声哼唱），强化昼夜区分",
            "尝试「自主入睡」：在宝宝还醒着时放床，减少抱睡、奶睡依赖",
            "白天保证充足的活动量与自然光照，帮助建立生物钟",
            "夜醒时先观察片刻再响应，避免过度干预打断其自我接觉",
            "父母轮流值守、白天补觉保持状态；若伴发热、呼吸异常或长期无法安抚需就医",
        ],
        "sources": "美国睡眠医学会(AASM) / Sleep Foundation、Happiest Baby、国内儿科睡眠科普",
    },
    {
        "key": "teething",
        "title": "出牙期",
        "start": 4, "end": 12,
        "principle": "多数宝宝在 6 个月左右萌出第一颗乳牙（多为下颌中切牙），4-12 个月内萌出均属正常，受遗传与营养影响。牙齿顶推牙龈会刺激唾液腺并引起局部炎症，出现不适。",
        "signs": [
            "口水明显增多、爱咬手指或玩具",
            "牙龈红肿、喜欢摩擦牙龈",
            "情绪烦躁、夜间易醒、食欲略降",
        ],
        "advice": [
            "提供清洁的硅胶磨牙棒/牙胶（可稍冷藏冷敷镇痛）",
            "用干净纱布或指套牙刷轻擦牙龈与已萌出的牙",
            "及时擦干口水，预防口周口水疹，可薄涂凡士林",
            "多拥抱安抚，用玩具转移注意力",
            "萌出第一颗牙后即开始口腔清洁；若超过 13 个月仍无牙或伴高热腹泻需就医",
        ],
        "sources": "南京鼓楼医院儿科、博禾健康《婴儿长牙》、多家三甲医院口腔科科普",
    },
    {
        "key": "rolling",
        "title": "翻身",
        "start": 4, "end": 7,
        "principle": "4-6 个月宝宝颈背与核心肌群力量增强、神经肌肉协调成熟，俯卧抬头练习为翻身打下基础；多数 4 个月左右能从俯卧翻到仰卧，6-7 个月可双向翻身。",
        "signs": [
            "踢腿更有力、喜欢侧身",
            "尝试从仰卧翻向俯卧",
            "俯卧时能抬头并撑起上半身",
        ],
        "advice": [
            "保证每天清醒时的「俯卧时间(tummy time)」",
            "用色彩鲜艳的玩具在侧方引导翻身",
            "不要长时间把宝宝束缚在安全座椅或推车里",
            "床周加装护栏，翻身期注意防跌落",
        ],
        "sources": "美国 CDC《6 个月发育里程碑》、Mayo Clinic《4-6 个月婴儿发育》",
    },
    {
        "key": "solids",
        "title": "添加辅食",
        "start": 5.5, "end": 7,
        "principle": "满 6 月龄（约 180 天）是引入辅食的关键窗口：挺舌反射消失、肠胃与吞咽能力成熟，铁储备也接近耗尽，需通过辅食补充铁等营养素。WHO 与 AAP 均建议约 6 个月开始。",
        "signs": [
            "对大人食物表现出兴趣、盯着看",
            "挺舌反射减弱，能扶坐抬头",
            "母乳/配方奶已不能完全满足生长需求",
        ],
        "advice": [
            "首选强化铁米粉等富铁食物，由单一到多样、由稀到稠",
            "每引入一种新食物观察 2-3 天，留意过敏",
            "保持奶量基础（每日 600-800ml）",
            "不早于 4 月龄、不晚于 6 月龄过久；过敏家族史者咨询医生",
        ],
        "sources": "世界卫生组织(WHO)、美国儿科学会(AAP)、中国居民膳食指南",
    },
    {
        "key": "sitting",
        "title": "独坐",
        "start": 6, "end": 9,
        "principle": "6 个月左右宝宝腰腹力量增强，可在支撑下坐立；约 6-8 个月能在无需支撑时独坐片刻，这是双手解放、探索周围的重要前提。",
        "signs": [
            "被扶坐时头部稳定、腰背挺直",
            "能短暂独坐、身体前倾用双手支撑",
            "喜欢坐着玩玩具",
        ],
        "advice": [
            "在家长看护下练习扶坐与独坐，用枕头环绕保护",
            "多让宝宝仰卧/俯卧自由活动，强化核心",
            "避免长时间久坐影响脊柱发育",
        ],
        "sources": "美国 CDC《6 个月发育里程碑》、Mayo Clinic",
    },
    {
        "key": "babbling",
        "title": "语言萌芽（咿呀学语）",
        "start": 6, "end": 9,
        "principle": "6-9 个月宝宝进入「咿呀学语」期，开始把元音与辅音连成「ba-ba/ma-ma」等音节，并能对名字和情绪语调作出反应，是语言发展的关键准备期。",
        "signs": [
            "发出「baba/ma-ma/dada」等音节",
            "对自己的名字有反应",
            "用声音表达开心或不悦，喜欢模仿大人发音",
        ],
        "advice": [
            "多和宝宝「对话」：他发声你模仿，建立轮流交流",
            "每天读色彩鲜艳的绘本、指认身边物品命名",
            "唱歌、播放轻柔音乐，回应宝宝的每一次发声",
        ],
        "sources": "美国 CDC《6 个月发育里程碑》、Zero to Three",
    },
    {
        "key": "crawling",
        "title": "爬行",
        "start": 7, "end": 11,
        "principle": "7-10 个月宝宝四肢力量与协调进一步提升，多数开始腹爬、手膝爬，部分宝宝先向后爬。爬行促进双侧协调与空间认知，也为独站打基础。",
        "signs": [
            "俯卧时以手臂撑起、前后摇晃",
            "开始腹爬或手膝爬",
            "能追视并朝玩具方向移动",
        ],
        "advice": [
            "提供安全的爬行空间，移开尖角与危险物品",
            "用玩具在前方鼓励宝宝移动",
            "不必强求标准手膝爬，个体节奏不同",
            "看护下多趴多爬，减少久抱",
        ],
        "sources": "美国 CDC《9 个月发育里程碑》、Mayo Clinic",
    },
    {
        "key": "standing",
        "title": "扶站到独走",
        "start": 9, "end": 15,
        "principle": "9-12 个月宝宝可扶物站立、借力挪步；多数在 12-15 个月能独立行走。下肢力量、平衡与信心同步发展，是大运动的重要飞跃。",
        "signs": [
            "扶着沙发或围栏站立、挪步",
            "喜欢被牵手走",
            "能蹲下再站起",
        ],
        "advice": [
            "提供稳固的扶走家具，移除易倾倒物品",
            "光脚或穿防滑袜练习，利于足底感知",
            "多鼓励，不着急用学步车替代自主练习",
            "保证家中边角防护，预防磕碰",
        ],
        "sources": "美国 CDC《12 个月发育里程碑》",
    },
    {
        "key": "words",
        "title": "有意义词汇",
        "start": 12, "end": 18,
        "principle": "约 12 个月宝宝开始说出有指向意义的词（如「妈妈」「拿」），并能理解简单指令；语言理解先于表达，互动质量直接影响词汇积累。",
        "signs": [
            "能有意识地叫「爸爸妈妈」",
            "听懂「不行」「给妈妈」等简单指令",
            "用手势 + 声音表达需求",
        ],
        "advice": [
            "在日常生活中持续命名物品、描述正在做的事",
            "读绘本、唱儿歌，鼓励宝宝模仿发音",
            "减少屏幕时间，真实互动优于视频",
            "若 18 个月仍无有意义词汇，建议儿保评估",
        ],
        "sources": "美国 CDC《12 个月/18 个月发育里程碑》、Zero to Three",
    },
    {
        "key": "walking-steady",
        "title": "走稳与探索",
        "start": 15, "end": 24,
        "principle": "15-24 个月宝宝从蹒跚独走逐渐变得平稳，开始小跑、扶栏上楼梯，探索范围扩大，自主意识增强。",
        "signs": [
            "独走平稳、能蹲下站起不跌倒",
            "尝试小跑、扶栏上下台阶",
            "喜欢搬运、开关、探索各处",
        ],
        "advice": [
            "家中做好全面防撞防夹手防护",
            "鼓励大运动游戏，但控制屏幕与静坐时间",
            "用简单语言立规则，温柔而坚定",
            "保证每日户外活动与充足睡眠",
        ],
        "sources": "美国 CDC《18 个月/24 个月发育里程碑》",
    },
]


def get_stage_tip(months: float) -> dict:
    """根据宝宝月龄，返回『即将进入的阶段』(featured) 与『正在经历的阶段』(current)。

    规则：优先预告下一个尚未开始的阶段（start > months）；若当前正处于某阶段窗口内，
    则把它列入 current 供展示。所有月龄均存在个体差异，仅作科普参考。
    """
    stages = sorted(STAGE_TIPS, key=lambda s: s["start"])
    active = [s for s in stages if s["start"] <= months <= s["end"]]
    upcoming = [s for s in stages if s["start"] > months]

    if upcoming:
        feat = dict(upcoming[0])
        feat["status"] = "upcoming"
        feat["monthsAway"] = max(0, round(feat["start"] - months))
        after = upcoming[1]["title"] if len(upcoming) > 1 else None
    else:
        # 已无「即将进入」的阶段：展示当前正在经历中「最晚开始」的那一项，保持卡片有用
        feat = dict(active[-1]) if active else None
        if feat:
            feat["status"] = "active"
            feat["monthsAway"] = 0
        after = None

    # 当前正在经历的阶段：附带完整科普数据，供前端弹窗展示
    current = [
        {
            "key": s["key"],
            "title": s["title"],
            "principle": s.get("principle", ""),
            "signs": s.get("signs", []),
            "advice": s.get("advice", []),
            "sources": s.get("sources", ""),
        }
        for s in active
    ]
    return {"featured": feat, "current": current, "after": after}


@app.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(request: Request):
    bid = get_baby_id(request)
    p = _get_baby_profile(bid)
    if not p:
        raise HTTPException(status_code=404, detail="Baby profile not found. Please create one first.")
    profile = BabyProfile(name=p["name"], gender=p["gender"], birthday=p["birthday"], height=p["height"], weight=p["weight"])

    months = calculate_months(profile.birthday)
    std = get_growth_standard(profile.gender, months)
    is_w_normal = std['minW'] <= profile.weight <= std['maxW']
    is_h_normal = std['minH'] <= profile.height <= std['maxH']
    weight_status = _weight_status(profile.weight, std.get('baseW'))
    height_status = _height_status(profile.height, std.get('baseH'))

    return DashboardResponse(
        profile=profile,
        months=months,
        growthStandard=std,
        isWeightNormal=is_w_normal,
        isHeightNormal=is_h_normal,
        weightStatus=weight_status,
        heightStatus=height_status,
        feedingAdvice=get_feeding_advice(months),
        activities=get_activities(months),
        music=get_music(),
        stories=get_stories(months),
        stageTip=get_stage_tip(months),
    )

# ---------------- 出行区 ----------------
class TravelListItem(BaseModel):
    id: str = ''
    dest_type: str = ''          # short / long / abroad
    age_months: int = 0
    items: str = '[]'           # JSON: [{cat, name, checked, custom}]
    recorderName: str = ''  # 记录人昵称

class TravelRecord(BaseModel):
    id: str = ''
    dest_name: str = ''
    dest_type: str = ''
    category: str = ''        # 地点类型 park/amusement/farm/mall/museum/beach/mountain/ancient/garden
    travel_date: str = ''
    age_months: int = 0
    rating: int = 0              # 1-5
    note: str = ''
    recorderName: str = ''  # 记录人昵称

# 打包清单：GET 列表 / POST 新建 / PUT 更新 / DELETE 删除
@app.get("/travel/lists", response_model=List[TravelListItem])
async def get_travel_lists(request: Request):
    bid = get_baby_id(request)
    rs = db.execute(
        "SELECT id, dest_type, age_months, items, user_id FROM travel_lists WHERE baby_id = ? ORDER BY created_at DESC",
        [bid]).fetchall()
    return [TravelListItem(id=r[0], dest_type=r[1] or '', age_months=r[2] or 0, items=r[3] or '[]', recorderName=_recorder_name(r[4] or '')) for r in rs]

@app.post("/travel/lists", response_model=TravelListItem)
async def save_travel_list(item: TravelListItem, request: Request):
    bid = get_baby_id(request)
    uid = get_uid(request)
    item.id = str(uuid.uuid4())[:8]
    db.execute(
        "INSERT INTO travel_lists (id, baby_id, dest_type, age_months, items, user_id) VALUES (?, ?, ?, ?, ?, ?)",
        [item.id, bid, item.dest_type, item.age_months, item.items, uid])
    db.sync()
    item.recorderName = _recorder_name(uid)
    return item

@app.put("/travel/lists/{list_id}", response_model=TravelListItem)
async def update_travel_list(list_id: str, item: TravelListItem, request: Request):
    bid = get_baby_id(request)
    uid = get_uid(request)
    rs = db.execute("SELECT id FROM travel_lists WHERE id = ? AND baby_id = ?", [list_id, bid]).fetchall()
    if not rs:
        raise HTTPException(status_code=404, detail="Travel list not found")
    db.execute(
        "UPDATE travel_lists SET dest_type=?, age_months=?, items=?, user_id=? WHERE id=? AND baby_id=?",
        [item.dest_type, item.age_months, item.items, uid, list_id, bid])
    db.sync()
    item.id = list_id
    item.recorderName = _recorder_name(uid)
    return item

@app.delete("/travel/lists/{list_id}")
async def delete_travel_list(list_id: str, request: Request):
    bid = get_baby_id(request)
    rs = db.execute("SELECT id FROM travel_lists WHERE id = ? AND baby_id = ?", [list_id, bid]).fetchall()
    if not rs:
        raise HTTPException(status_code=404, detail="Travel list not found")
    db.execute("DELETE FROM travel_lists WHERE id = ? AND baby_id = ?", [list_id, bid])
    db.sync()
    return {"ok": True}

# 出行历史：GET 列表 / POST 新建 / DELETE 删除
@app.get("/travel/records", response_model=List[TravelRecord])
async def get_travel_records(request: Request):
    bid = get_baby_id(request)
    rs = db.execute(
        "SELECT id, dest_name, dest_type, category, travel_date, age_months, rating, note, user_id FROM travel_records WHERE baby_id = ? ORDER BY travel_date DESC, created_at DESC",
        [bid]).fetchall()
    return [TravelRecord(id=r[0], dest_name=r[1] or '', dest_type=r[2] or '', category=r[3] or '', travel_date=r[4] or '', age_months=r[5] or 0, rating=r[6] or 0, note=r[7] or '', recorderName=_recorder_name(r[8] or '')) for r in rs]

@app.post("/travel/records", response_model=TravelRecord)
async def save_travel_record(item: TravelRecord, request: Request):
    bid = get_baby_id(request)
    uid = get_uid(request)
    item.id = str(uuid.uuid4())[:8]
    db.execute(
        "INSERT INTO travel_records (id, baby_id, dest_name, dest_type, category, travel_date, age_months, rating, note, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [item.id, bid, item.dest_name, item.dest_type, item.category, item.travel_date, item.age_months, item.rating, item.note, uid])
    db.sync()
    item.recorderName = _recorder_name(uid)
    return item

@app.put("/travel/records/{record_id}", response_model=TravelRecord)
async def update_travel_record(record_id: str, item: TravelRecord, request: Request):
    bid = get_baby_id(request)
    uid = get_uid(request)
    rs = db.execute("SELECT id FROM travel_records WHERE id = ? AND baby_id = ?", [record_id, bid]).fetchall()
    if not rs:
        raise HTTPException(status_code=404, detail="Travel record not found")
    db.execute(
        "UPDATE travel_records SET dest_name=?, dest_type=?, category=?, travel_date=?, age_months=?, rating=?, note=?, user_id=? WHERE id=? AND baby_id=?",
        [item.dest_name, item.dest_type, item.category, item.travel_date, item.age_months, item.rating, item.note, uid, record_id, bid])
    db.sync()
    item.id = record_id
    item.recorderName = _recorder_name(uid)
    return item

@app.delete("/travel/records/{record_id}")
async def delete_travel_record(record_id: str, request: Request):
    bid = get_baby_id(request)
    rs = db.execute("SELECT id FROM travel_records WHERE id = ? AND baby_id = ?", [record_id, bid]).fetchall()
    if not rs:
        raise HTTPException(status_code=404, detail="Travel record not found")
    db.execute("DELETE FROM travel_records WHERE id = ? AND baby_id = ?", [record_id, bid])
    db.sync()
    return {"ok": True}

# ---------------- 疫苗日历：GET 列表 + POST 标记接种 + DELETE 撤销 ----------------
class VaccineItem(BaseModel):
    id: int
    name: str
    seq: int = 1                    # 第几剂（1-based）
    month: int = 0                  # 接种起始月龄（72 = 6 岁）
    doses: int = 1                  # 该疫苗总剂次
    isNip: bool = True              # 是否国家免疫规划（免费）
    prevent: str = ''                # 预防疾病
    note: str = ''                  # 接种说明
    status: str = 'pending'         # 'administered' | 'pending' | 'overdue'
    administeredDate: str = ''      # 实际接种日期（ISO），status=administered 时有值
    recordId: str = ''              # vaccine_records.id，用于撤销
    recorderName: str = ''          # 记录人昵称（谁标记接种的）
    coveredBy: str = ''             # 被五联覆盖的说明，如 '五联疫苗 第 1 剂'；非空时该剂次无需单独接种

def _calc_vaccine_status(month: int, administered_date: str, age_months: int) -> str:
    """根据接种起始月龄 + 实际月龄判断状态：
    - 已接种 -> 'administered'
    - 未接种 + 已到月龄 -> 'pending'（可打未打）-> 若超过 30 天再变 'overdue'
    - 未接种 + 未到月龄 -> 'upcoming'（前端统一显示 'pending'，到月龄后用户自判）
    """
    if administered_date:
        return 'administered'
    if age_months < month:
        return 'upcoming'
    # 已到月龄未打：超过 30 天标记 overdue（年长儿已远超的也算 overdue）
    if age_months - month >= 1:
        return 'overdue'
    return 'pending'

@app.get("/vaccines", response_model=List[VaccineItem])
async def get_vaccines(request: Request):
    bid = get_baby_id(request)
    # 查宝宝月龄
    baby = db.execute("SELECT birthday FROM babies WHERE baby_id = ?", [bid]).fetchall()
    if not baby:
        raise HTTPException(status_code=404, detail="Baby not found")
    from datetime import date
    bd = baby[0][0]
    try:
        bd_dt = date.fromisoformat(bd[:10])
        age_months = (date.today().year - bd_dt.year) * 12 + (date.today().month - bd_dt.month)
        if date.today().day < bd_dt.day:
            age_months -= 1
    except Exception:
        age_months = 0
    # 查接种记录
    recs = db.execute(
        "SELECT id, vaccine_id, administered_date, note, user_id FROM vaccine_records WHERE baby_id = ?",
        [bid]).fetchall()
    rec_map = {r[1]: (r[0], r[2], r[3] or '', r[4] or '') for r in recs}
    # 联动覆盖：标记了五联某剂后，自动覆盖对应 NIP 单苗剂次（不催种、不可单独撤销）
    # 反查：被覆盖剂次 → 五联剂次
    covered_by_map = {}  # {被覆盖 vaccine_id: '五联疫苗 第 N 剂'}
    for pv_id, covered_list in PENTAVALENT_COVERS.items():
        if pv_id in rec_map:
            pv_v = next((x for x in VACCINE_LIBRARY if x['id'] == pv_id), None)
            if pv_v:
                label = f"{pv_v['name']} 第 {pv_v['seq']} 剂"
                for cid in covered_list:
                    covered_by_map[cid] = label
    # 组装返回
    result = []
    for v in VACCINE_LIBRARY:
        rec = rec_map.get(v['id'])
        admin_date = rec[1] if rec else ''
        cover_label = covered_by_map.get(v['id'], '')
        # 被五联覆盖的剂次：视为已接种（administered），admin_date 同步成五联的接种日期
        if cover_label and not admin_date and rec_map.get(next(
            (k for k, vals in PENTAVALENT_COVERS.items() if v['id'] in vals), None), (None, ''))[1]:
            pv_id = next((k for k, vals in PENTAVALENT_COVERS.items() if v['id'] in vals), None)
            if pv_id and pv_id in rec_map:
                admin_date = rec_map[pv_id][1]
        status = _calc_vaccine_status(v['month'], admin_date, age_months)
        result.append(VaccineItem(
            id=v['id'], name=v['name'], seq=v['seq'], month=v['month'],
            doses=v['doses'], isNip=v['is_nip'], prevent=v['prevent'],
            note=v['note'], status=status,
            administeredDate=admin_date,
            recordId=rec[0] if rec else '',
            recorderName=_recorder_name(rec[3]) if rec else '',
            coveredBy=cover_label,
        ))
    return result

class VaccineRecordPayload(BaseModel):
    administeredDate: str
    note: str = ''

@app.post("/vaccines/{vaccine_id}/record", response_model=VaccineItem)
async def mark_vaccine_administered(vaccine_id: int, payload: VaccineRecordPayload, request: Request):
    bid = get_baby_id(request)
    uid = get_uid(request)
    # 校验 vaccine_id 合法
    v = next((x for x in VACCINE_LIBRARY if x['id'] == vaccine_id), None)
    if not v:
        raise HTTPException(status_code=404, detail="Vaccine not found")
    if not payload.administeredDate:
        raise HTTPException(status_code=400, detail="administeredDate required")
    # 已存在则更新，否则插入（同一宝宝同一疫苗只保留一条记录）
    existing = db.execute(
        "SELECT id FROM vaccine_records WHERE baby_id = ? AND vaccine_id = ?",
        [bid, vaccine_id]).fetchall()
    if existing:
        rec_id = existing[0][0]
        db.execute(
            "UPDATE vaccine_records SET administered_date = ?, note = ?, user_id = ? WHERE id = ?",
            [payload.administeredDate, payload.note, uid, rec_id])
    else:
        rec_id = str(uuid.uuid4())[:8]
        db.execute(
            "INSERT INTO vaccine_records (id, baby_id, vaccine_id, administered_date, note, user_id) VALUES (?, ?, ?, ?, ?, ?)",
            [rec_id, bid, vaccine_id, payload.administeredDate, payload.note, uid])
    db.sync()
    # 重新计算状态返回
    baby = db.execute("SELECT birthday FROM babies WHERE baby_id = ?", [bid]).fetchall()
    from datetime import date
    bd = baby[0][0]
    try:
        bd_dt = date.fromisoformat(bd[:10])
        age_months = (date.today().year - bd_dt.year) * 12 + (date.today().month - bd_dt.month)
        if date.today().day < bd_dt.day:
            age_months -= 1
    except Exception:
        age_months = 0
    return VaccineItem(
        id=v['id'], name=v['name'], seq=v['seq'], month=v['month'],
        doses=v['doses'], isNip=v['is_nip'], prevent=v['prevent'],
        note=v['note'], status='administered',
        administeredDate=payload.administeredDate, recordId=rec_id,
        recorderName=_recorder_name(uid),
    )

@app.delete("/vaccine-records/{record_id}")
async def delete_vaccine_record(record_id: str, request: Request):
    bid = get_baby_id(request)
    rs = db.execute(
        "SELECT id FROM vaccine_records WHERE id = ? AND baby_id = ?",
        [record_id, bid]).fetchall()
    if not rs:
        raise HTTPException(status_code=404, detail="Vaccine record not found")
    db.execute("DELETE FROM vaccine_records WHERE id = ? AND baby_id = ?", [record_id, bid])
    db.sync()
    return {"ok": True}

# ---------------- 里程碑打卡：GET 列表 + POST 标记首达 + DELETE 撤销 ----------------
class MilestoneItem(BaseModel):
    id: int
    domain: str                  # motor / fine / language / social
    month: int = 0               # 多数宝宝达成的月龄
    desc: str = ''
    red_flag: bool = False       # 未达成需警惕
    status: str = 'pending'      # 'achieved' | 'pending' | 'upcoming'
    achievedDate: str = ''       # 首达日期（ISO）
    recordId: str = ''
    recorderName: str = ''       # 记录人昵称（谁标记达成的）

DOMAIN_LABELS = {
    'motor': '粗大动作',
    'fine': '精细动作',
    'language': '语言',
    'social': '社交情感',
}

@app.get("/milestones", response_model=List[MilestoneItem])
async def get_milestones(request: Request):
    bid = get_baby_id(request)
    baby = db.execute("SELECT birthday FROM babies WHERE baby_id = ?", [bid]).fetchall()
    if not baby:
        raise HTTPException(status_code=404, detail="Baby not found")
    from datetime import date
    bd = baby[0][0]
    try:
        bd_dt = date.fromisoformat(bd[:10])
        age_months = (date.today().year - bd_dt.year) * 12 + (date.today().month - bd_dt.month)
        if date.today().day < bd_dt.day:
            age_months -= 1
    except Exception:
        age_months = 0
    recs = db.execute(
        "SELECT id, milestone_id, achieved_date, note, user_id FROM milestone_records WHERE baby_id = ?",
        [bid]).fetchall()
    rec_map = {r[1]: (r[0], r[2], r[3] or '', r[4] or '') for r in recs}
    result = []
    for m in MILESTONE_LIBRARY:
        rec = rec_map.get(m['id'])
        ach_date = rec[1] if rec else ''
        if ach_date:
            status = 'achieved'
        elif age_months < m['month']:
            status = 'upcoming'
        else:
            status = 'pending'
        result.append(MilestoneItem(
            id=m['id'], domain=m['domain'], month=m['month'],
            desc=m['desc'], red_flag=m['red_flag'], status=status,
            achievedDate=ach_date, recordId=rec[0] if rec else '',
            recorderName=_recorder_name(rec[3]) if rec else '',
        ))
    return result

class MilestoneRecordPayload(BaseModel):
    achievedDate: str
    note: str = ''

@app.post("/milestones/{milestone_id}/record", response_model=MilestoneItem)
async def mark_milestone_achieved(milestone_id: int, payload: MilestoneRecordPayload, request: Request):
    bid = get_baby_id(request)
    uid = get_uid(request)
    m = next((x for x in MILESTONE_LIBRARY if x['id'] == milestone_id), None)
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    if not payload.achievedDate:
        raise HTTPException(status_code=400, detail="achievedDate required")
    existing = db.execute(
        "SELECT id FROM milestone_records WHERE baby_id = ? AND milestone_id = ?",
        [bid, milestone_id]).fetchall()
    if existing:
        rec_id = existing[0][0]
        db.execute(
            "UPDATE milestone_records SET achieved_date = ?, note = ?, user_id = ? WHERE id = ?",
            [payload.achievedDate, payload.note, uid, rec_id])
    else:
        rec_id = str(uuid.uuid4())[:8]
        db.execute(
            "INSERT INTO milestone_records (id, baby_id, milestone_id, achieved_date, note, user_id) VALUES (?, ?, ?, ?, ?, ?)",
            [rec_id, bid, milestone_id, payload.achievedDate, payload.note, uid])
    db.sync()
    return MilestoneItem(
        id=m['id'], domain=m['domain'], month=m['month'],
        desc=m['desc'], red_flag=m['red_flag'], status='achieved',
        achievedDate=payload.achievedDate, recordId=rec_id,
        recorderName=_recorder_name(uid),
    )

@app.delete("/milestone-records/{record_id}")
async def delete_milestone_record(record_id: str, request: Request):
    bid = get_baby_id(request)
    rs = db.execute(
        "SELECT id FROM milestone_records WHERE id = ? AND baby_id = ?",
        [record_id, bid]).fetchall()
    if not rs:
        raise HTTPException(status_code=404, detail="Milestone record not found")
    db.execute("DELETE FROM milestone_records WHERE id = ? AND baby_id = ?", [record_id, bid])
    db.sync()
    return {"ok": True}


@app.get("/sleep-stats")
async def get_sleep_stats(request: Request):
    """睡眠 SweetSpot 预测数据：基于最近 7 天 sleep 记录算实际平均清醒时长 + 月龄标准清醒时长 + 犯困信号清单。"""
    bid = get_baby_id(request)
    # 月龄
    babies = db.execute("SELECT birthday FROM babies WHERE baby_id = ?", [bid]).fetchall()
    if not babies:
        raise HTTPException(status_code=404, detail="Baby not found")
    birthday_str = babies[0][0]
    months = calculate_months(birthday_str)

    # 月龄对应的标准清醒时长（分钟）
    std_wake_min = 120
    if months < 3: std_wake_min = 60
    elif months < 6: std_wake_min = 90
    elif months < 9: std_wake_min = 150
    elif months < 12: std_wake_min = 180
    elif months < 18: std_wake_min = 210
    elif months < 24: std_wake_min = 240
    else: std_wake_min = 300

    # 月龄对应的犯困信号
    sleep_signals = []
    if months < 3:
        sleep_signals = ["打哈欠", "眼神呆滞", "抓耳朵", "烦躁哭闹"]
    elif months < 6:
        sleep_signals = ["揉眼睛", "打哈欠", "目光躲闪", "拱背"]
    elif months < 12:
        sleep_signals = ["揉眼睛", "抓耳朵", "打哈欠", "变得粘人"]
    elif months < 18:
        sleep_signals = ["揉眼睛", "打哈欠", "变得安静", "指着床"]
    else:
        sleep_signals = ["打哈欠", "揉眼睛", "变得粘人", "说想睡觉"]

    # 取最近 7 天 sleep 记录，按日期分组算每日清醒间隔
    today = date.today()
    seven_days_ago = today - timedelta(days=7)
    rs = db.execute(
        "SELECT date, time, duration FROM feeding_records_v2 WHERE baby_id = ? AND type = ? AND date >= ? ORDER BY date ASC, time ASC",
        [bid, "sleep", seven_days_ago.isoformat()]
    ).fetchall()

    # 算每日内相邻 sleep 之间的清醒时长（醒时 = 上一次睡 time + duration，到下一次睡 time）
    # 同时算平均睡眠时长
    wake_intervals = []
    sleep_durations = []
    daily_sleeps = {}  # date -> list of (time, duration)
    for r in rs:
        d_str = r[0]
        t_str = r[1]
        dur = r[2] or 0
        if dur <= 0:
            continue
        sleep_durations.append(dur)
        daily_sleeps.setdefault(d_str, []).append((t_str, dur))

    # 算每日内清醒间隔
    def _hm_to_min(s):
        h, m = s.split(':')
        return int(h) * 60 + int(m)
    def _add_min(hm, mins):
        h, m = hm.split(':')
        t = (((int(h) * 60 + int(m)) + mins) % (24 * 60) + 24 * 60) % (24 * 60)
        return f"{t // 60:02d}:{t % 60:02d}"
    for d_str, sleeps in daily_sleeps.items():
        sleeps.sort(key=lambda x: x[0])
        for i in range(1, len(sleeps)):
            prev_time, prev_dur = sleeps[i-1]
            curr_time = sleeps[i][0]
            wake_at = _add_min(prev_time, prev_dur)
            wake_min = _hm_to_min(wake_at)
            curr_min = _hm_to_min(curr_time)
            interval = curr_min - wake_min
            if interval < 0:
                interval += 24 * 60  # 跨午夜
            # 排除异常值（< 15min 或 > 8h 视为脏数据）
            if 15 <= interval <= 8 * 60:
                wake_intervals.append(interval)

    # 实际平均清醒时长（≥3 条数据时启用，否则用月龄标准值）
    avg_wake_min = sum(wake_intervals) / len(wake_intervals) if len(wake_intervals) >= 3 else std_wake_min
    avg_sleep_min = sum(sleep_durations) / len(sleep_durations) if sleep_durations else 0

    # 今日已睡次数 + 总时长
    today_str = today.isoformat()
    today_sleeps = daily_sleeps.get(today_str, [])
    today_sleep_count = len(today_sleeps)
    today_sleep_total = sum(d for _, d in today_sleeps)

    # 夜间作息时长（跨午夜，如 20:00 入睡 → 07:00 起床 = 11h = 660min）
    baby_row = db.execute("SELECT night_bedtime, night_wake_time FROM babies WHERE baby_id = ?", [bid]).fetchall()
    night_bedtime = baby_row[0][0] if baby_row else ""
    night_wake_time = baby_row[0][1] if baby_row else ""
    night_sleep_min = 0
    if night_bedtime and night_wake_time:
        try:
            bh, bm = night_bedtime.split(':')
            wh, wm = night_wake_time.split(':')
            b_min = int(bh) * 60 + int(bm)
            w_min = int(wh) * 60 + int(wm)
            diff = w_min - b_min
            if diff <= 0: diff += 24 * 60  # 跨午夜
            # 仅当夜间睡眠合理（5~16h）才采纳，过滤脏数据
            if 5 * 60 <= diff <= 16 * 60:
                night_sleep_min = diff
        except Exception:
            night_sleep_min = 0
    # 今日总睡眠 = 今日小睡片段 + 夜间作息时长（夜间作息是规律性参考，不重复计入片段）
    today_sleep_total_with_night = today_sleep_total + night_sleep_min

    # 月龄建议小睡次数（参考：6 月以下 4-5 次、6-12 月 2-3 次、12 月以上 1-2 次）
    rec_naps = 5
    if months < 3: rec_naps = 5
    elif months < 6: rec_naps = 4
    elif months < 9: rec_naps = 3
    elif months < 18: rec_naps = 2
    else: rec_naps = 1

    # 月龄建议每日总睡眠时长（含夜间 + 小睡），参考 NSF/AASM（取范围中位值为建议量）
    if months < 3:
        rec_sleep_min, rec_sleep_text = 930, "14-17h"
    elif months < 12:
        rec_sleep_min, rec_sleep_text = 810, "12-15h"
    elif months < 24:
        rec_sleep_min, rec_sleep_text = 750, "11-14h"
    else:
        rec_sleep_min, rec_sleep_text = 690, "10-13h"

    return {
        "months": months,
        "avgWakeMin": round(avg_wake_min),
        "stdWakeMin": std_wake_min,
        "avgSleepMin": round(avg_sleep_min),
        "todaySleepCount": today_sleep_count,
        "todaySleepTotalMin": round(today_sleep_total_with_night),
        "nightSleepMin": night_sleep_min,
        "nightBedtime": night_bedtime,
        "nightWakeTime": night_wake_time,
        "recNaps": rec_naps,
        "recSleepMin": rec_sleep_min,
        "recSleepText": rec_sleep_text,
        "sleepSignals": sleep_signals,
        "sampleCount": len(wake_intervals),
    }

# 兼容本地开发和 Docker 容器两种目录结构
_here = os.path.dirname(os.path.abspath(__file__))
DIST_DIR_CANDIDATES = [
    os.path.join(os.path.dirname(_here), "baby-app-frontend", "dist"),   # 本地开发
    os.path.join(_here, "baby-app-frontend", "dist"),                    # Docker 容器
]
DIST_DIR = None
for d in DIST_DIR_CANDIDATES:
    if os.path.isdir(d):
        DIST_DIR = d
        break

if DIST_DIR:
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(DIST_DIR, full_path)
        if os.path.isfile(file_path):
            # 确保 PWA manifest 返回正确 MIME，避免浏览器拒绝
            media_type = (
                "application/manifest+json" if full_path.endswith(".webmanifest")
                else None
            )
            return FileResponse(file_path, media_type=media_type)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
