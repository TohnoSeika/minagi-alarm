import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  // 防止 Vite 遮盖 Rust 的错误信息
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
})
