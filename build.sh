#!/bin/bash
# Render 部署构建脚本
# 1. 构建前端
# 2. 安装后端依赖

set -e

echo "=== Building frontend ==="
cd baby-app-frontend
npm install
npm run build
cd ..

echo "=== Installing backend deps ==="
cd baby-app-backend
pip install -r requirements.txt

echo "=== Build complete ==="
