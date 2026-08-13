import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 不在构建前清空 dist：避免 WorkBuddy safe-delete shim 拦截 trash 操作。
    // vite 会直接覆盖写入 assets 子目录，旧的 public 静态文件保留不动。
    emptyOutDir: false,
  },
})
