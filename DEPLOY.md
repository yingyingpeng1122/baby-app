# Baby App — Docker Compose 部署操作手册

## 前置条件

服务器需安装：
- **Docker** ≥ 24.x
- **Docker Compose** ≥ 2.x（或 `docker compose` 插件）
- **Git**

验证安装：
```bash
docker --version
docker compose version
git --version
```

---

## 第一步：克隆代码到服务器

```bash
# 创建目录
sudo mkdir -p /opt/coding
cd /opt/coding

# 克隆项目
git clone https://github.com/yingyingpeng1122/baby-app.git
cd baby-app

# 确认文件完整性
ls -la  # 应该能看到 Dockerfile、docker-compose.yml、.env.example 等
```

---

## 第二步：配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入你的 Turso Token
nano .env
```

`.env` 文件内容：
```env
TURSO_DB_NAME=babyapp-yingyingpeng1122
TURSO_AUTH_TOKEN=你的Turso Token
```

> ⚠️ Token 可从 Turso Dashboard → Databases → 你的数据库 → Generate Token 获取

---

## 第三步：构建并启动

```bash
# 构建镜像并启动容器（后台运行）
docker compose up -d --build

# 查看启动日志
docker compose logs -f
```

看到 `Uvicorn running on http://0.0.0.0:8000` 说明启动成功。

---

## 第四步：验证部署

```bash
# 健康检查
curl http://localhost:8000/health
# 应返回: {"status":"ok"}

# 查看容器状态
docker compose ps
# 应看到 baby-app 和 baby-app-nginx 两个容器都是 Up
```

然后在浏览器访问 `http://<服务器IP>`（80 端口，无需加端口号）

---

## 常用运维命令

```bash
# 查看日志
docker compose logs -f              # 实时日志
docker compose logs --tail=100      # 最近 100 行

# 重启容器
docker compose restart

# 停止容器
docker compose stop

# 停止并删除容器
docker compose down

# 重新构建（代码更新后）
docker compose up -d --build

# 进入容器调试
docker compose exec baby-app bash
```

---

## 更新部署

代码更新后，在服务器上执行：

```bash
cd /opt/coding/baby-app
git pull origin main --force
docker compose up -d --build
```

---

## 防火墙配置

现在只需要开放 80 端口（Nginx 反向代理），8000 端口不再暴露到公网：

```bash
# Ubuntu / Debian (ufw)
sudo ufw allow 80/tcp

# CentOS / RHEL (firewalld)
sudo firewall-cmd --add-service=http --permanent
sudo firewall-cmd --reload
```

> ⚠️ 别忘了在云厂商**安全组**中也放行 80 端口（TCP、0.0.0.0/0）。

---

## 目录结构

```
/opt/coding/baby-app/
├── Dockerfile              # 多阶段构建
├── docker-compose.yml      # 容器编排（baby-app + Nginx）
├── nginx/
│   └── nginx.conf          # Nginx 反向代理配置
├── .env                    # 环境变量（不提交到 Git）
├── .env.example            # 环境变量模板
├── .dockerignore           # 排除文件
├── baby-app-backend/
│   ├── main.py             # FastAPI 后端
│   ├── requirements.txt    # Python 依赖
│   └── video_cache.json    # B站视频缓存
└── baby-app-frontend/
    ├── src/                # React 源码
    ├── package.json        # Node 依赖
    └── dist/               # 构建产物（容器内生成）
```

---

## 故障排查

| 问题 | 排查命令 |
|------|----------|
| 容器启动失败 | `docker compose logs baby-app` |
| 端口被占用 | `sudo lsof -i :8000` |
| 数据库连接失败 | `docker compose exec baby-app curl -s https://babyapp-yingyingpeng1122.turso.io` |
| 磁盘空间不足 | `docker system prune -a` |