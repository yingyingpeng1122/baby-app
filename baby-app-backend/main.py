from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime
import calendar as _calendar
import uvicorn
import urllib.request
import urllib.parse
import json
import re
import os
import uuid

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
        req = urllib.request.Request(self._url, data=body, headers=self._headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30, context=_ssl_ctx) as r:
                data = json.loads(r.read().decode("utf-8"))
                return data.get("results", [])
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

def init_db():
    db.execute("""CREATE TABLE IF NOT EXISTS profiles (
        user_id TEXT PRIMARY KEY,
        name TEXT, gender TEXT, birthday TEXT,
        height REAL, weight REAL,
        created_at TEXT DEFAULT (datetime('now'))
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS feeding_records (
        id TEXT, user_id TEXT, date TEXT,
        time TEXT, amount REAL, type TEXT, note TEXT DEFAULT '',
        PRIMARY KEY (user_id, date, id)
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS checklist_items (
        user_id TEXT, date TEXT, item_id TEXT, checked INTEGER,
        PRIMARY KEY (user_id, date, item_id)
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT (datetime('now'))
    )""")
    # 家庭系统表
    db.execute("""CREATE TABLE IF NOT EXISTS families (
        family_id TEXT PRIMARY KEY,
        family_name TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS family_members (
        user_id TEXT PRIMARY KEY,
        family_id TEXT NOT NULL,
        role TEXT DEFAULT 'member',
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
    db.execute("""CREATE TABLE IF NOT EXISTS checklist_items_v2 (
        baby_id TEXT, date TEXT, item_id TEXT, checked INTEGER,
        PRIMARY KEY (baby_id, date, item_id)
    )""")
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
    type: str
    title: str
    desc: str
    ageRange: List[int]
    videoUrl: str

class FeedingRecord(BaseModel):
    id: str = ''
    time: str
    amount: float
    type: str
    note: str = ''

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

class DashboardResponse(BaseModel):
    profile: BabyProfile
    months: int
    growthStandard: dict
    isWeightNormal: bool
    isHeightNormal: bool
    feedingAdvice: FeedingAdvice
    activities: List[Activity]

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
    uid = request.headers.get("X-User-Id", "").strip()
    if not uid:
        raise HTTPException(status_code=400, detail="X-User-Id header required")
    return uid

def _get_profile(uid: str) -> Optional[BabyProfile]:
    rs = db.execute("SELECT name, gender, birthday, height, weight FROM profiles WHERE user_id = ?", [uid]).fetchall()
    if not rs:
        return None
    r = rs[0]
    return BabyProfile(name=r[0], gender=r[1], birthday=r[2], height=r[3], weight=r[4])

# ---------------- 家庭系统辅助函数 ----------------
def generate_family_id():
    """生成 6 位随机家庭 ID（排除易混淆字符 O0I1）"""
    import random
    import string
    chars = string.ascii_uppercase + string.digits
    chars = ''.join(c for c in chars if c not in 'O0I1')
    return ''.join(random.choices(chars, k=6))

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

def _get_baby_profile(baby_id: str) -> Optional[dict]:
    """按 baby_id 获取宝宝档案（返回 dict，兼容旧代码）"""
    rs = db.execute("SELECT name, gender, birthday, height, weight FROM babies WHERE baby_id = ?", [baby_id]).fetchall()
    if not rs:
        return None
    r = rs[0]
    return {"name": r[0], "gender": r[1], "birthday": r[2], "height": r[3], "weight": r[4]}

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
        html = _http_get(url, {"User-Agent": UA, "Referer": "https://www.bilibili.com/"})
        bvs = re.findall(r'href="//www\.bilibili\.com/video/(BV[0-9A-Za-z]{10})"', html)
        if not bvs:
            bvs = re.findall(r'BV[0-9A-Za-z]{10}', html)
        if bvs:
            bvid = bvs[0]
            player = f"https://player.bilibili.com/player.html?bvid={bvid}&page=1&high_quality=1&danmaku=0"
            _video_cache[keyword] = player
            _save_cache()
            return player
    except Exception as e:
        print("[search_bilibili] error:", keyword, "->", e)
    return ''

_load_cache()

# ---------------- 业务逻辑 ----------------
def calculate_months(birthday_str: str) -> int:
    birth = datetime.strptime(birthday_str, "%Y-%m-%d").date()
    today = date.today()
    months = (today.year - birth.year) * 12 + (today.month - birth.month)
    return max(0, months)

def get_growth_standard(gender: str, months: int) -> dict:
    if months < 0:
        months = 0
    base_w_boy = 3.3 + (months * 0.7)
    base_w_girl = 3.2 + (months * 0.65)
    base_h_boy = 50 + (months * 2.5)
    base_h_girl = 49 + (months * 2.3)
    if gender == 'boy':
        return {
            "minW": round(base_w_boy * 0.8, 1), "maxW": round(base_w_boy * 1.2, 1),
            "minH": round(base_h_boy * 0.9, 1), "maxH": round(base_h_boy * 1.1, 1),
        }
    return {
        "minW": round(base_w_girl * 0.8, 1), "maxW": round(base_w_girl * 1.2, 1),
        "minH": round(base_h_girl * 0.9, 1), "maxH": round(base_h_girl * 1.1, 1),
    }

FEED_VIDEO_KEYWORD = {
    "纯乳期": "新生儿 母乳喂养 冲奶粉 教程",
    "辅食添加初期": "婴儿 第一口辅食 高铁米粉 制作",
    "咀嚼吞咽期": "宝宝 辅食 制作 手指食物 教程",
    "幼儿饮食过渡期": "幼儿 一日三餐 辅食 制作 教程",
}

ACTIVITY_VIDEO_KEYWORD = {
    "莫扎特效应：安睡曲": "莫扎特 摇篮曲 宝宝 安睡曲",
    "黑白卡追视": "婴儿 黑白卡 追视 训练",
    "躲猫猫": "宝宝 躲猫猫 游戏",
    "儿歌律动": "儿歌律动 认识身体 宝宝",
    "积木堆高高": "宝宝 搭积木 堆高高",
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

def get_activities(months: int) -> List[Activity]:
    all_activities = [
        Activity(id=1, type='music', title='莫扎特效应：安睡曲', desc='轻柔古典音乐助眠。', ageRange=[0, 12], videoUrl='#'),
        Activity(id=2, type='game', title='黑白卡追视', desc='锻炼视觉聚焦。', ageRange=[0, 3], videoUrl='#'),
        Activity(id=3, type='game', title='躲猫猫', desc='理解客体永久性。', ageRange=[4, 10], videoUrl='#'),
        Activity(id=4, type='music', title='儿歌律动', desc='认识身体部位。', ageRange=[6, 18], videoUrl='#'),
        Activity(id=5, type='game', title='积木堆高高', desc='锻炼手眼协调。', ageRange=[10, 24], videoUrl='#'),
    ]
    results = [a for a in all_activities if a.ageRange[0] <= months <= a.ageRange[1]]
    for a in results:
        if not a.videoUrl or a.videoUrl == '#':
            kw = ACTIVITY_VIDEO_KEYWORD.get(a.title, a.title)
            a.videoUrl = search_bilibili(kw)
    for a in results:
        if a.id in activity_videos:
            a.videoUrl = activity_videos[a.id]
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
    """前端首次访问时调用，生成一个 guest 用户 ID。"""
    uid = str(uuid.uuid4())
    db.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", [uid])
    db.sync()
    return {"userId": uid}

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
    db.execute("INSERT INTO family_members (family_id, user_id, role) VALUES (?, ?, 'creator')", [fid, uid])
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
    db.execute("INSERT INTO family_members (family_id, user_id, role) VALUES (?, ?, 'member')", [req.family_id, uid])
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
    members = db.execute("SELECT user_id, role FROM family_members WHERE family_id = ?", [fid]).fetchall()
    babies = db.execute("SELECT baby_id, name, gender, birthday, height, weight FROM babies WHERE family_id = ?", [fid]).fetchall()
    return {
        "family_id": fid,
        "family_name": fam[0][0] if fam else "",
        "role": member[0][1],
        "members": [{"user_id": m[0], "role": m[1]} for m in members],
        "babies": [{"baby_id": b[0], "name": b[1], "gender": b[2], "birthday": b[3], "height": b[4], "weight": b[5]} for b in babies],
    }

@app.get("/family/babies")
async def list_babies(request: Request):
    """获取当前家庭的所有宝宝"""
    fid = get_family_id(request)
    babies = db.execute("SELECT baby_id, name, gender, birthday, height, weight FROM babies WHERE family_id = ?", [fid]).fetchall()
    return [{"baby_id": b[0], "name": b[1], "gender": b[2], "birthday": b[3], "height": b[4], "weight": b[5]} for b in babies]

@app.post("/family/babies")
async def add_baby(req: BabyCreateRequest, request: Request):
    """添加宝宝到家庭"""
    fid = get_family_id(request)
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
    if req.name is not None: updates["name"] = req.name
    if req.gender is not None: updates["gender"] = req.gender
    if req.birthday is not None: updates["birthday"] = req.birthday
    if req.height is not None: updates["height"] = req.height
    if req.weight is not None: updates["weight"] = req.weight
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
    db.execute("DELETE FROM babies WHERE baby_id = ? AND family_id = ?", [baby_id, fid])
    db.execute("DELETE FROM feeding_records_v2 WHERE baby_id = ?", [baby_id])
    db.execute("DELETE FROM checklist_items_v2 WHERE baby_id = ?", [baby_id])
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
    today = date.today().isoformat()
    record.id = str(uuid.uuid4())[:8]
    db.execute(
        "INSERT INTO feeding_records_v2 (id, baby_id, date, time, amount, type, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [record.id, bid, today, record.time, record.amount, record.type, record.note])
    db.sync()
    return record

@app.get("/feeding-records", response_model=List[FeedingRecord])
async def get_feeding_records(request: Request, date_str: str = Query(default=None, alias="date")):
    bid = get_baby_id(request)
    d = date_str or date.today().isoformat()
    rs = db.execute(
        "SELECT id, time, amount, type, note FROM feeding_records_v2 WHERE baby_id = ? AND date = ?",
        [bid, d]).fetchall()
    return [FeedingRecord(id=r[0], time=r[1], amount=r[2], type=r[3], note=r[4]) for r in rs]

@app.put("/feeding-records/{record_id}", response_model=FeedingRecord)
async def update_feeding_record(record_id: str, record: FeedingRecord, request: Request):
    bid = get_baby_id(request)
    today = date.today().isoformat()
    rs = db.execute(
        "SELECT id FROM feeding_records_v2 WHERE id = ? AND baby_id = ? AND date = ?",
        [record_id, bid, today]).fetchall()
    if not rs:
        raise HTTPException(status_code=404, detail="Record not found")
    db.execute(
        "UPDATE feeding_records_v2 SET time=?, amount=?, type=?, note=? WHERE id=? AND baby_id=? AND date=?",
        [record.time, record.amount, record.type, record.note, record_id, bid, today])
    db.sync()
    record.id = record_id
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

@app.get("/feeding-evaluation", response_model=FeedingEvaluation)
async def get_feeding_evaluation(request: Request, date_str: str = Query(default=None, alias="date")):
    bid = get_baby_id(request)
    d = date_str or date.today().isoformat()

    rs = db.execute(
        "SELECT id, time, amount, type, note FROM feeding_records_v2 WHERE baby_id = ? AND date = ?",
        [bid, d]).fetchall()
    records = [FeedingRecord(id=r[0], time=r[1], amount=r[2], type=r[3], note=r[4]) for r in rs]

    milk_records = [r for r in records if r.type == 'milk']
    solids_records = [r for r in records if r.type == 'solids']
    total_milk = sum(r.amount for r in milk_records)
    total_solids = sum(r.amount for r in solids_records)

    profile = _get_baby_profile(bid)
    if not profile:
        raise HTTPException(status_code=404, detail="Baby profile not found")
    months = calculate_months(profile["birthday"])
    fa = get_feeding_advice(months)
    fa = get_feeding_advice(months)
    target_milk = parse_target_milk(fa.milk)

    # 奶量评估
    milk_status = 'good'
    milk_msg = ''
    if target_milk > 0:
        ratio = total_milk / target_milk
        if ratio < 0.7:
            milk_status = 'low'
            milk_msg = f"奶量 {total_milk:.0f}ml，低于建议量 {target_milk:.0f}ml 的 70%"
        elif ratio > 1.3:
            milk_status = 'high'
            milk_msg = f"奶量 {total_milk:.0f}ml，超过建议量 {target_milk:.0f}ml 的 130%"
        else:
            milk_msg = f"奶量 {total_milk:.0f}ml，在建议范围 {target_milk:.0f}ml 附近"

    # 辅食评估
    solids_status = 'good'
    solids_msg = ''
    target_solids_times = 0
    if fa.solids == '不需要':
        if total_solids > 0:
            solids_status = 'high'
            solids_msg = f"当前阶段暂不建议添加辅食，已记录辅食 {total_solids:.0f}g"
    else:
        if months < 8:
            target_solids_times = 2
        elif months < 12:
            target_solids_times = 3
        else:
            target_solids_times = 3
        if len(solids_records) == 0 and fa.solids == '需要':
            solids_status = 'low'
            solids_msg = f"今日尚未记录辅食（建议 {target_solids_times} 次，每次约 {fa.solidAmount}）"
        elif len(solids_records) < target_solids_times:
            solids_status = 'low'
            solids_msg = f"辅食 {len(solids_records)} 次，建议 {target_solids_times} 次（每次约 {fa.solidAmount}）"
        else:
            solids_msg = f"辅食 {len(solids_records)} 次，合计 {total_solids:.0f}g"

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

    # 综合状态
    statuses = [s for s in [milk_status, solids_status] if s != 'good']
    if not statuses:
        overall = 'good'
    elif 'high' in statuses:
        overall = 'high'
    else:
        overall = 'low'

    # 动态建议
    suggestions = []
    if milk_status == 'low':
        if feed_count < 5 and months < 12:
            suggestions.append(f"今日仅喂奶 {len(milk_records)} 次，可增加 1-2 次喂养，每次 {target_milk/max(len(milk_records),1):.0f}ml 左右")
        else:
            suggestions.append(f"可适当增加单次奶量，当前平均每次 {total_milk/max(len(milk_records),1):.0f}ml")
    elif milk_status == 'high':
        suggestions.append("奶量偏高，注意观察是否有吐奶或胀气，可适当减少单次量")

    if solids_status == 'low' and fa.solids == '需要':
        suggestions.append(f"建议增加辅食次数至 {target_solids_times} 次，尝试 {', '.join(fa.types)}")
    elif solids_status == 'high' and fa.solids == '不需要':
        suggestions.append(f"当前月龄 ({months} 个月) 以奶为主，暂不建议添加辅食")

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
    if now_hour >= 20 and total_milk < target_milk * 0.7:
        suggestions.append("已到晚间，奶量仍偏低，建议睡前补一次奶")
    elif now_hour >= 14 and now_hour < 20 and len(solids_records) == 0 and fa.solids == '需要':
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
    )

# ---------------- 每日照护清单 ----------------
def get_checklist_template(months: int) -> list:
    if months < 6:
        return [
            {"id": "vitamin_ad", "label": "维生素 AD 滴剂", "desc": "每日 1 粒，出生后 2 周起补充", "icon": "pill"},
            {"id": "sunlight",   "label": "晒太阳 / 户外透气", "desc": "避开正午，15-30 分钟", "icon": "sun"},
            {"id": "tummy_time", "label": "趴着练习 (Tummy Time)", "desc": "清醒时趴 3-5 分钟，每日数次", "icon": "baby"},
            {"id": "interact",   "label": "亲子互动 / 说话", "desc": "面对面聊天、微笑回应", "icon": "heart"},
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

    return DashboardResponse(
        profile=profile,
        months=months,
        growthStandard=std,
        isWeightNormal=is_w_normal,
        isHeightNormal=is_h_normal,
        feedingAdvice=get_feeding_advice(months),
        activities=get_activities(months),
    )

# ---------------- 静态文件托管（生产环境） ----------------
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
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
