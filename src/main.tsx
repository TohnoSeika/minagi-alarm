/**
 * Minagi Alarm — React 入口
 * 桃华帮 Minagi 做的作品——Tauri 迁移版 ✨
 *
 * 先初始化 Tauri API 再渲染 React 应用
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/quicksand'
import '@fontsource/quicksand/500.css'
import '@fontsource/quicksand/700.css'
import '@fontsource/noto-sans-sc'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import '@fontsource/noto-sans-sc/700.css'
import './i18n'        // 初始化国际化
import './api/tauri'   // 初始化 window.electronAPI（Tauri 实现）
import { invoke } from '@tauri-apps/api/core'
import App from './App'
import './App.css'
import './types'

// 全局阻止浏览器右键菜单——双重保险
// 1. document 级别 capture 拦截
document.addEventListener('contextmenu', (e) => e.preventDefault(), { capture: true })
// 2. window 级别 bubble 拦截
window.addEventListener('contextmenu', (e) => e.preventDefault())

// 全局错误捕获——万一哪里崩溃了，桃华想知道原因
window.addEventListener('error', (e) => {
  const msg = `[桃华] 错误: ${e.message} (${e.filename}:${e.lineno})`
  console.error(msg)
  try { invoke('log_error', { message: msg }).catch(() => {}) } catch {}
})
window.addEventListener('unhandledrejection', (e) => {
  const msg = `[桃华] 未捕获 Promise: ${e.reason}`
  console.error(msg)
  try { invoke('log_error', { message: msg }).catch(() => {}) } catch {}
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
