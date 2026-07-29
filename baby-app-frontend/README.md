# baby-app-frontend

本仓库是一个基于 Vite + React 的前端演示应用（宝宝成长档案）。

快速开始

1. 安装依赖

```bash
npm install
```

2. 启动开发服务器

```bash
npm run dev
```

默认打开地址： http://localhost:5173/

后端接口

应用默认调用后端基址 `http://localhost:8000`，请求 `/dashboard` 和 `/profile`。如果后端未启动，页面会进入“建立宝宝档案”编辑表单。

常见问题

- Windows PowerShell 报错 "禁止运行脚本"：可改用 `npm.cmd run dev`，或在管理员权限下运行 `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`（了解风险后执行）。

文件位置

- 入口组件: [src/App.jsx](src/App.jsx)

许可证

仅用于示例与开发。

后端启动（本地）

后端目录：`C:\Users\yingyingpeng\baby-app-backend`

启动命令：

```bash
cd C:\Users\yingyingpeng\baby-app-backend
python main.py
```

默认监听地址： http://localhost:8000 。前端默认 `API_BASE` 为该地址（在 [src/App.jsx](src/App.jsx) 中定义）。如需更改前端对接地址，可编辑 `API_BASE` 常量。

创建初始档案（示例请求）：

```bash
curl -X POST http://localhost:8000/profile -H "Content-Type: application/json" -d '{"name":"小小","gender":"boy","birthday":"2024-01-01","height":60,"weight":6.5}'
```

或者使用 Node.js 直接发送请求：

```bash
node -e "fetch('http://localhost:8000/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'小小',gender:'boy',birthday:'2024-01-01',height:60,weight:6.5})}).then(r=>r.json()).then(console.log)"
```

如果后端返回 `404` 且响应为 `{"detail":"Profile not found. Please create one first."}`，表示尚未创建档案，请用上述 POST 请求创建一个初始档案，随后刷新前端页面（`http://localhost:5173/`）将显示仪表盘。

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
