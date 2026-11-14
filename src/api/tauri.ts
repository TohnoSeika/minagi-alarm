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

const PLATFORM = detectPlatform()

// 当前窗口透明度——动画和手动设置共用这一个值
// （以前用 window.__savedOpacity，动画半路被再次触发时会从旧值重新起跳，还会两段一起抢）
let currentOpacity = 0.98
let opacityFrame: number | null = null

function clampOpacity(value: number): number {
  return Math.max(0.2, Math.min(1, value))
}

function stopOpacityAnimation() {
  if (opacityFrame !== null) {
    cancelAnimationFrame(opacityFrame)
    opacityFrame = null
  }
}

/**
 * 平滑过渡窗口透明度——easeOutCubic 让渐变看起来温柔又自然呢
 * 和 Electron 版本完全相同的动画曲线 ✨
 *
 * 注意：Tauri v2 的前端 API 没有 setOpacity，所以桃华用 Rust 命令实现～
 */
function animateOpacity(target: number, duration: number): Promise<void> {
  stopOpacityAnimation()

  const from = currentOpacity
  const to = clampOpacity(target)
  if (Math.abs(from - to) < 0.005) {
    currentOpacity = to
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    const startTime = Date.now()
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOutCubic：开始快，结束缓，像轻飘飘落下的花瓣
      const eased = 1 - Math.pow(1 - progress, 3)
      currentOpacity = clampOpacity(from + (to - from) * eased)
      invoke('set_window_opacity', { opacity: currentOpacity }).catch(() => {})
      if (progress >= 1) {
        currentOpacity = to
        opacityFrame = null
        resolve()
      } else {
        opacityFrame = requestAnimationFrame(animate)
      }
    }
    opacityFrame = requestAnimationFrame(animate)
  })
}

// ─── 背景图持久化 ───────────────────────────────────────────────────
// 内存里一直是 data URL，写盘时换成 "file:路径"，这样设置 JSON 永远不会变大

const FILE_PREFIX = 'file:'
let persistedBackground = { image: '', stored: '' }
// 同一张图正在写盘时后来的调用等它就好——拖滑块一秒能触发几十次设置保存
let backgroundInFlight: { image: string; promise: Promise<string> } | null = null

/** 把 data URL 存成 app data 里的图片文件，返回 "file:路径" */
async function persistBackground(image: string): Promise<string> {
  if (!image.startsWith('data:')) {
    // 清空背景图时把磁盘上那张也删掉，别留一个没人用的孤儿文件
    if (image === '' && persistedBackground.stored) {
      persistedBackground = { image: '', stored: '' }
      await invoke('clear_background_image').catch(() => {})
    }
    return image
  }
  if (image === persistedBackground.image) return persistedBackground.stored
  if (backgroundInFlight?.image === image) return backgroundInFlight.promise

  const promise = invoke<string>('save_background_image', { dataUrl: image })
    .then(path => {
      persistedBackground = { image, stored: `${FILE_PREFIX}${path}` }
      return persistedBackground.stored
    })
    .finally(() => {
      if (backgroundInFlight?.image === image) backgroundInFlight = null
    })

  backgroundInFlight = { image, promise }
  return promise
}

/** 把 "file:路径" 读回 data URL，供 <img> 用 */
async function restoreBackground(stored: string): Promise<string> {
  if (!stored.startsWith(FILE_PREFIX)) return stored

  const path = stored.slice(FILE_PREFIX.length)
  const data = await invoke<string | null>('read_file_as_data_url', { path })
  if (!data) return ''

  persistedBackground = { image: data, stored }
  return data
}

/**
 * 监听一个后端事件，返回取消函数
 * listen() 是异步的——组件卸载比它 resolve 还快时，这里把迟到的 unlisten 顺手调掉
 */
function onEvent<T>(event: string, callback: (payload: T) => void): () => void {
  let unlisten: UnlistenFn | undefined
  let cancelled = false

  listen<T>(event, e => callback(e.payload))
    .then(fn => {
      if (cancelled) fn()
      else unlisten = fn
    })
    .catch(() => {})

  return () => {
    cancelled = true
    if (unlisten) {
      unlisten()
      unlisten = undefined
    }
  }
}

// ─── ElectronAPI 接口的完整 Tauri 实现 ────────────────────────────────

export const tauriAPI: ElectronAPI = {
  // ─── 存储 ────────────────────────────────────────────────────────
  storeGet: (key: string) => invoke('get_store', { key }),

  storeSet: (key: string, value: unknown) => invoke('set_store', { key, value }),

  // ─── 系统通知 ───────────────────────────────────────────────────
  // Windows 的通知交给 Rust 发——那边挂得上点击回调，点一下就能回到软件界面
  // 其他平台没有这个待遇，还是走插件的 API
  showNotification: async (title: string, body: string) => {
    if (PLATFORM === 'win32') {
      await invoke('show_alert_notification', { title, body }).catch(() => {})
      return
    }

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

  // 真正退出进程——只有 exit 能结束托盘常驻的应用
  exitApp: () => invoke('exit_app'),

  // 打开外部链接——B站/GitHub 用系统默认浏览器打开
  openExternal: (url: string) => invoke('open_external', { url }),

  setOpacity: async (opacity: number) => {
    // 手动设值就打断正在跑的动画，免得两边一起往窗口写
    stopOpacityAnimation()
    currentOpacity = clampOpacity(opacity)
    await invoke('set_window_opacity', { opacity: currentOpacity }).catch(() => {})
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

  // ─── 背景图 ──────────────────────────────────────────────────────
  persistBackground,
  restoreBackground,

  // ─── 事件监听（从托盘唤出、桌面模式切换） ──────────────────────
  onShowFromTray: (callback: () => void) => onEvent('show-from-tray', () => callback()),

  onWallpaperModeChanged: (callback: (enabled: boolean) => void) => onEvent<boolean>('wallpaper-mode-changed', callback),

  onToggleWallpaperMode: (callback: () => void) => onEvent('toggle-wallpaper-mode', () => callback()),

  // ─── 平台 ────────────────────────────────────────────────────────
  platform: PLATFORM,
}

// 全局暴露——这样所有现有组件不用改 import，直接 window.electronAPI.xxx()
;(window as any).electronAPI = tauriAPI
