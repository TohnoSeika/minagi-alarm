/**
 * 类型声明
 * 让 TypeScript 认识 electronAPI 和 Tauri 相关的全局变量
 *
 * 「桃华帮 Minagi 做的 Tauri 迁移版——类型也是一样工整呢 ✨」
 */

export interface ElectronAPI {
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<void>
  showNotification: (title: string, body: string) => Promise<void>
  openAudioDialog: () => Promise<string | null>
  audioRead: (filePath: string) => Promise<string | null>
  openImageDialog: () => Promise<string | null>
  imageRead: (filePath: string) => Promise<string | null>
  minimizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  exitApp: () => Promise<void>
  openExternal: (url: string) => Promise<void>
  setOpacity: (opacity: number) => Promise<void>
  animateOpacity: (target: number, duration: number) => Promise<void>
  setAlwaysOnTop: (onTop: boolean) => Promise<void>
  setWallpaperMode: (enabled: boolean) => Promise<void>
  setAutoLaunch: (enabled: boolean) => Promise<void>
  getAppIcon: () => Promise<string | null>
  saveFile: (defaultName: string, content: string) => Promise<boolean>
  /** 背景图落盘：data URL → "file:路径" */
  persistBackground: (image: string) => Promise<string>
  /** 背景图还原："file:路径" → data URL */
  restoreBackground: (stored: string) => Promise<string>
  onShowFromTray: (callback: () => void) => () => void
  onWallpaperModeChanged: (callback: (enabled: boolean) => void) => () => void
  onToggleWallpaperMode: (callback: () => void) => () => void
  platform: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
