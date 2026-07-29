"""Vercel Serverless Function 入口"""
import sys, os
import importlib.util

# 直接加载 main.py 文件（绕过目录名含连字符的问题）
main_path = os.path.join(os.path.dirname(__file__), "..", "baby-app-backend", "main.py")
spec = importlib.util.spec_from_file_location("main", main_path)
main_module = importlib.util.module_from_spec(spec)
sys.modules["main"] = main_module
spec.loader.exec_module(main_module)

from mangum import Mangum

# 将 FastAPI ASGI app 转换为 Vercel serverless handler
handler = Mangum(main_module.app)
