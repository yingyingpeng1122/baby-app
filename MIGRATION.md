# 换电脑迁移指南（baby-app）

本项目 = 前端(Vite+React) + 后端(FastAPI) + Docker 部署。迁移到新电脑分三步：

## 一、克隆代码

```bash
git clone https://github.com/yingyingpeng1122/baby-app.git
cd baby-app
```

> 只需 clone 源码即可。**不要**拷贝 `node_modules/`、`.venv/`、`dist/`——它们是本地缓存/构建产物，任何机器都能重新生成，拷了反而又大又容易坏。`.gitignore` 已把它们排除。

## 二、安装依赖

前端（在 `baby-app-frontend/` 下）：

```bash
cd baby-app-frontend
npm install        # 依据 package-lock.json 安装，能精确复现版本
```

后端（在 `baby-app-backend/` 下）：

```bash
cd ../baby-app-backend
python -m venv .venv
.venv/Scripts/activate        # Windows；macOS/Linux 用 source .venv/bin/activate
pip install -r requirements.txt
```

## 三、环境变量与密钥

项目有两个关键文件**不在 git 里**（被 .gitignore 忽略），需手动迁移：

| 文件 | 内容 | 说明 |
|---|---|---|
| `.env` | Turso 数据库连接、API token 等环境变量 | 从旧电脑拷过来，或找当时的值重新填。**生产数据库是云端 Turso，不在这台机器上**，所以数据天然跟着账号走，不会丢 |
| `baby-app-backend/video_cache.json` | B 站视频搜索缓存（可选） | 不拷也行，启动后会自动重建 |

- 数据库：不在 `.env` 里就在 `main.py` 的硬编码默认值里（Turso HTTP）。库本身在云端（Turso SaaS），**换电脑不丢数据**，只要 `.env` 里的连接信息对即可。
- 如果本地调试时没配置 `.env`，后端会 fallback 到代码里的默认值。

## 四、启动

```bash
# 后端
cd baby-app-backend
uvicorn main:app --reload --port 8000

# 前端（另开终端）
cd baby-app-frontend
npm run dev        # 默认 http://localhost:5174
```

（如需在本地用 Docker 完整跑：`docker compose up -d --build`，需先配好 `.env`。）

## 五、（可选）本地数据备份

项目根的 `db_backup_*.json` 是历史数据备份，已被 .gitignore 忽略。若旧机器上本地数据库（`*.db`）有独特数据，可一并拷走；否则依赖云端 Turso 即可，无需备份。

---

## 项目体积说明（哪些能删、哪些不能）

```
全项目约 162MB，大头是本地缓存：
- baby-app-frontend/node_modules  121MB  → 可再生，删了 npm install 即回
- baby-app-backend/.venv           37MB   → 可再生，删了重建 venv 即回
- baby-app-frontend/dist           ~1MB   → 构建产物，npm run build 即回
- .git                             3.5MB  → 勿删
```
真正的源码（前后端 + 配置）不到 2MB，全部在 git 里。

**安全删除**（均被 .gitignore 忽略，不进 git）：
- `debug.log`（运行日志）
- `__pycache__/`、`*.pyc`（Python 缓存）
- `nul` 空文件（Windows 残留，因是保留设备名多数工具删不掉，可无视）
- `node_modules/`、`.venv/`、`dist/`（需要时重建即可）

**切勿删除**：
- `.env`（环境变量/密钥，不在 git，删了要重新配置）
- `db_backup_*.json`、任何 `.db`/`.sqlite*`（真实数据）
- `.workbuddy/`（项目记忆与工作区数据，不是缓存）
- `.git/`、`main.py`、`src/`、`docker-compose.yml`、`Dockerfile`、`nginx/`、`DEPLOY.md`