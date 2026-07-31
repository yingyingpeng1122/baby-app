# ============================================
# Baby App - 多阶段 Docker 构建
# 阶段1: 构建前端 (Node.js)
# 阶段2: 运行后端 (Python)
# ============================================

# ---- 阶段1: 前端构建 ----
FROM node:22-alpine AS frontend-build
WORKDIR /build
COPY baby-app-frontend/package*.json ./
RUN npm ci --registry=https://registry.npmmirror.com
COPY baby-app-frontend/ ./
RUN npm run build

# ---- 阶段2: 后端运行 ----
FROM python:3.11-slim
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY baby-app-backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 复制后端代码
COPY baby-app-backend/ ./

# 从前端构建阶段复制 dist
COPY --from=frontend-build /build/dist ./baby-app-frontend/dist

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["python", "main.py"]