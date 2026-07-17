/**
 * Minagi Alarm — Tauri API 封装层
 * 桃华把 Electron 的 electronAPI 全部换成 Tauri 的实现啦～
 * 前端所有 window.electronAPI.xxx() 不变，底层全部走 Tauri 🎀
 */

import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { open, save } from '@tauri-apps/plugin-dialog'
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'
import { enable as enableAutoLaunch, disable as disableAutoLaunch } from '@tauri-apps/plugin-autostart'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { ElectronAPI } from '../types'

const appWindow = getCurrentWindow()

/**
 * 判断当前平台
 * 使用 User-Agent 判断，因为 Tauri 没有同步的 platform API
 */
const detectPlatform = (): string => {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'win32'
  if (ua.includes('mac')) return 'darwin'
  if (ua.includes('linux')) return 'linux'
  return 'win32'
}

/**
 * 平滑过渡窗口透明度——easeOutCubic 让渐变看起来温柔又自然呢
 * 和 Electron 版本完全相同的动画曲线 ✨
 *
 * 注意：Tauri v2 的前端 API 没有 setOpacity，所以桃华用 Rust 命令实现～
 */
function animateOpacity(target: number, duration: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const from = window.__savedOpacity ?? 0.98
    if (Math.abs(from - target) < 0.005) {
      resolve()
      return
    }

    const startTime = Date.now()
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOutCubic：开始快，结束缓，像轻飘飘落下的花瓣
      const eased = 1 - Math.pow(1 - progress, 3)
      const val = from + (target - from) * eased
      const clamped = Math.max(0.2, Math.min(1, val))
      invoke('set_window_opacity', { opacity: clamped }).catch(() => {})
      if (progress >= 1) {
        window.__savedOpacity = target
        resolve()
      } else {
        requestAnimationFrame(animate)
      }
    }
    animate()
  })
}

// ─── ElectronAPI 接口的完整 Tauri 实现 ────────────────────────────────

export const tauriAPI: ElectronAPI = {
  // ─── 存储 ────────────────────────────────────────────────────────
  storeGet: (key: string) => invoke('get_store', { key }),

  storeSet: (key: string, value: unknown) => invoke('set_store', { key, value }),

  // ─── 系统通知 ───────────────────────────────────────────────────
  showNotification: async (title: string, body: string) => {
    try {
      let granted = await isPermissionGranted()
      if (!granted) {
        const permission = await requestPermission()
        granted = permission === 'granted'
      }
      if (granted) {
        sendNotification({ title, body })
      }
    } catch {
      // 通知权限失败——不影响核心功能
    }
  },

  // ─── 对话框 ──────────────────────────────────────────────────────
  openAudioDialog: async () => {
    try {
      const result = await open({
        title: '选择自定义提示音',
        filters: [{ name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'] }],
        multiple: false,
        directory: false,
      })
      return result || null
    } catch {
      return null
    }
  },

  audioRead: (filePath: string) => invoke('read_file_as_data_url', { path: filePath }),

  openImageDialog: async () => {
    try {
      const result = await open({
        title: '选择背景图片',
        filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
        multiple: false,
        directory: false,
      })
      return result || null
    } catch {
      return null
    }
  },

  imageRead: (filePath: string) => invoke('read_file_as_data_url', { path: filePath }),

  saveFile: async (defaultName: string, content: string) => {
    try {
      const result = await save({
        title: '导出便利贴',
        defaultPath: defaultName,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })
      if (!result) return false
      await invoke('write_text_file', { path: result, content })
      return true
    } catch {
      return false
    }
  },

  // ─── 窗口控制 ────────────────────────────────────────────────────
  minimizeWindow: () => appWindow.minimize(),

  closeWindow: () => appWindow.hide(),

  setOpacity: async (opacity: number) => {
    const clamped = Math.max(0.2, Math.min(1, opacity))
    await invoke('set_window_opacity', { opacity: clamped }).catch(() => {})
    window.__savedOpacity = clamped
  },

  animateOpacity: (target: number, duration: number) => animateOpacity(target, duration),

  setAlwaysOnTop: (onTop: boolean) => appWindow.setAlwaysOnTop(onTop),

  setWallpaperMode: (enabled: boolean) => invoke('set_wallpaper_mode', { enabled }),

  // ─── 开机自启 ────────────────────────────────────────────────────
  setAutoLaunch: async (enabled: boolean) => {
    try {
      if (enabled) {
        await enableAutoLaunch()
      } else {
        await disableAutoLaunch()
      }
    } catch {
      // 开机自启设置失败——不影响核心功能
    }
  },

  // ─── 应用图标 ────────────────────────────────────────────────────
  getAppIcon: () => invoke('get_app_icon'),

  // ─── 事件监听（从托盘唤出、桌面模式切换） ──────────────────────
  onShowFromTray: (callback: () => void) => {
    let unlistenFn: UnlistenFn | undefined
    listen('show-from-tray', () => {
      callback()
    }).then(fn => {
      unlistenFn = fn
    })
    return () => {
      if (unlistenFn) unlistenFn()
    }
  },

  onWallpaperModeChanged: (callback: (enabled: boolean) => void) => {
    let unlistenFn: UnlistenFn | undefined
    listen<boolean>('wallpaper-mode-changed', (event) => {
      callback(event.payload)
    }).then(fn => {
      unlistenFn = fn
    })
    return () => {
      if (unlistenFn) unlistenFn()
    }
  },

  onToggleWallpaperMode: (callback: () => void) => {
    let unlistenFn: UnlistenFn | undefined
    listen('toggle-wallpaper-mode', () => {
      callback()
    }).then(fn => {
      unlistenFn = fn
    })
    return () => {
      if (unlistenFn) unlistenFn()
    }
  },

  // ─── 平台 ────────────────────────────────────────────────────────
  platform: detectPlatform(),
}

// 全局暴露——这样所有现有组件不用改 import，直接 window.electronAPI.xxx()
;(window as any).electronAPI = tauriAPI
