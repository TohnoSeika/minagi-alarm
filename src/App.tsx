/**
 * Minagi Alarm — 主应用
 * 全局设置 + 背景图 + 提醒播放/停止
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import CurrentTime from './components/CurrentTime'
import ClockModeDisplay from './components/ClockModeDisplay'
import AlarmList from './components/AlarmList'
import Timer from './components/Timer'
import TabBar from './components/TabBar'
import AlertDialog from './components/AlertDialog'
import SettingsPage, { SettingsData } from './components/SettingsPage'
import BgPreview from './components/BgPreview'
import SakuraEffect from './components/SakuraEffect'
import StickyNote, { StickyData } from './components/StickyNote'
import ClockMusicList from './components/ClockMusicList'

import SnoozeIndicator from './components/SnoozeIndicator'
import ErrorBoundary from './components/ErrorBoundary'
import defaultBgImage from './assets/default-bg.jpg'
import { invoke } from '@tauri-apps/api/core'
import { useTranslation } from 'react-i18next'
import i18n, { detectSystemLanguage } from './i18n'
import { useAlarms } from './hooks/useAlarms'
import { useTimer } from './hooks/useTimer'
import { useCustomSounds, useAudio, SoundOption } from './hooks/useAudio'
import { useWindowTitlebar } from './hooks/useWindowTitlebar'

type Page = 'alarm' | 'timer' | 'settings'

const SETTINGS_KEY = 'minagi-alarm-settings'

export function useClockHelpLines(): string[] {
  const { t } = useTranslation()
  return t('clock.help', { returnObjects: true }) as string[]
}


const DEFAULT_SETTINGS: SettingsData = {
  sound: 'chime',
  opacity: 0.98,
  wallpaperOpacity: 0.75,
  minimizeToTray: false,
  closeToTray: true,
  startupPage: 'alarm',
  showClockHelp: true,
  showSeconds: false,
  language: detectSystemLanguage(),
  bgImage: '',  // 默认无背景图
  bgOpacity: 0.2,
  bgScale: 1,
  bgOffsetX: 0,
  bgOffsetY: 0,
  themeColor: '#F8A5B6',
  sakuraColor: '#F8A5B6',
  sakuraEnabled: false,
  sakuraOpacity: 0.5,
  autoLaunch: false,
}

const DEFAULT_BG_SCALE = 0.5
const DEFAULT_BG_OFFSET_X = 23
const DEFAULT_BG_OFFSET_Y = 162

/** 用当前语言刷新托盘菜单文字 */
function refreshTrayMenu() {
  const show = i18n.t('tray.showWindow')
  const wallpaperText = `${i18n.t('tray.desktopMode')} ON/OFF`
  const quit = i18n.t('tray.quit')
  invoke('set_tray_menu_texts', { show, wallpaperOff: wallpaperText, wallpaperOn: wallpaperText, quit }).catch(() => {})
}

/** 从 hex 颜色生成变体：light / dark / glow */
function deriveColors(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lighten = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.35))
  const darken = (v: number) => Math.max(0, Math.round(v * 0.78))
  const toHex = (...vals: number[]) => '#' + vals.map(v => v.toString(16).padStart(2, '0')).join('')
  return {
    pink: hex,
    pinkLight: toHex(lighten(r), lighten(g), lighten(b)),
    pinkDark: toHex(darken(r), darken(g), darken(b)),
    pinkGlow: `rgba(${r},${g},${b},0.3)`,
  }
}

function App() {
  const [page, setPage] = useState<Page>('alarm')
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS)
  const alarms = useAlarms()
  const timer = useTimer()
  const { customSounds, addCustomSound, removeCustomSound } = useCustomSounds()
  const { playSound, stopSound, setOnAudioEnded, setVolume } = useAudio()
  const { handleMinimize, handleClose } = useWindowTitlebar()
  const soundPlayedRef = useRef(false)
  const [wallpaperMode, setWallpaperMode] = useState(false)
  const wallpaperModeRef = useRef(false)  // 供副效应闭包读取最新值
  const settingsRef = useRef(settings)    // 供副效应闭包读取最新设置
  const [previewImage, setPreviewImage] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [appIcon, setAppIcon] = useState('')
  const [clockMode, setClockMode] = useState(false)
  const [clockBgOpacity, setClockBgOpacity] = useState(0.35)
  const [clockTitlebarVisible, setClockTitlebarVisible] = useState(false)
  const [clockHelpVisible, setClockHelpVisible] = useState(true)
  const [stickyNotes, setStickyNotes] = useState<StickyData[]>([])
  const [noteOrder, setNoteOrder] = useState<string[]>([])
  const [clockHelpLeaving, setClockHelpLeaving] = useState(false)
  const [showClockMusic, setShowClockMusic] = useState(false)
  const [musicLeaving, setMusicLeaving] = useState(false)
  const musicIndicatorRef = useRef<HTMLDivElement>(null)
  const [clockMusicId, setClockMusicId] = useState<string | null>(null)
  const [playerVolume, setPlayerVolume] = useState(0.6)
  const clockHelpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clockHelpLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startupPageRef = useRef(settings.startupPage)
  // 闹钟触发时使用的音效信息——由闹钟自身的 sound 决定，而非全局设置
  const alertSoundRef = useRef<{ soundId: string; customPath?: string }>({ soundId: 'chime' })

  // 保持 ref 与 settings 同步，供 tray 回调使用
  useEffect(() => {
    startupPageRef.current = settings.startupPage
  }, [settings.startupPage])

  // 保持 ref 与 wallpaperMode 同步，供副效应闭包读取最新值
  useEffect(() => {
    wallpaperModeRef.current = wallpaperMode
  }, [wallpaperMode])

  // 保持 ref 与 settings 同步，供 wallpaperMode 副效应读取最新透明度值
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  // 从托盘唤出时，如果启动页面设为时钟模式，自动进入
  useEffect(() => {
    const cleanup = window.electronAPI.onShowFromTray(() => {
      if (startupPageRef.current === 'clock') {
        setClockMode(true)
      }
    })
    return cleanup
  }, [])

  // 桌面模式由托盘切换时，同步渲染进程状态
  useEffect(() => {
    const cleanup = window.electronAPI.onWallpaperModeChanged((enabled) => {
      setWallpaperMode(enabled)
      if (enabled) {
        // 从托盘进入桌面模式时，也先切到时钟界面
        setClockMode(true)
      }
    })
    return cleanup
  }, [])

  // 时钟模式帮助信息——5秒后下沉消失，鼠标悬停保持
  const hideClockHelp = () => {
    setClockHelpLeaving(true)
    clockHelpLeaveTimer.current = setTimeout(() => {
      setClockHelpVisible(false)
      setClockHelpLeaving(false)
    }, 400) // 动画时长
  }

  useEffect(() => {
    if (!clockMode) {
      setClockHelpVisible(true)
      setClockHelpLeaving(false)
      return
    }
    if (!settings.showClockHelp) {
      setClockHelpVisible(false)
      return
    }
    setClockHelpVisible(true)
    setClockHelpLeaving(false)
    clockHelpTimer.current = setTimeout(hideClockHelp, 5000)
    return () => {
      if (clockHelpTimer.current) clearTimeout(clockHelpTimer.current)
      if (clockHelpLeaveTimer.current) clearTimeout(clockHelpLeaveTimer.current)
    }
  }, [clockMode, settings.showClockHelp])
  const bgImgRef = useRef<HTMLImageElement>(null)

  // 加载时钟模式背景透明度
  useEffect(() => {
    window.electronAPI.storeGet('minagi-alarm-clock-bg-opacity').then(v => {
      if (typeof v === 'number') setClockBgOpacity(v)
    }).catch(() => {})
  }, [])

  // 时钟模式下滚轮调整背景透明度
  useEffect(() => {
    if (!clockMode) return
    const handleWheel = (e: WheelEvent) => {
      // 只在点击背景区域时调整透明度（排除时钟组件、弹窗、播放器）
      const target = e.target as HTMLElement
      if (target.closest('.clock-mode-overlay > div, .sound-modal-overlay, .sticky-confirm-overlay, .music-player')) return
      const delta = e.deltaY > 0 ? -0.03 : 0.03
      const next = Math.round(Math.max(0.05, Math.min(0.9, clockBgOpacity + delta)) * 100) / 100
      setClockBgOpacity(next)
      window.electronAPI.storeSet('minagi-alarm-clock-bg-opacity', next)
    }
    window.addEventListener('wheel', handleWheel, { passive: true })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [clockMode, clockBgOpacity])

  // 背景图跟随鼠标微偏移——桃华觉得这样背景就「活」起来了 ✨
  useEffect(() => {
    const img = bgImgRef.current
    if (!img || !settings.bgImage) return

    const updateTransform = (mx = 0, my = 0) => {
      img.style.transform = `translate(-50%, -50%) translate(${settings.bgOffsetX + mx}px, ${settings.bgOffsetY + my}px) scale(${settings.bgScale})`
    }

    updateTransform()

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX / window.innerWidth - 0.5) * 2
      const dy = (e.clientY / window.innerHeight - 0.5) * 2
      updateTransform(dx * 8, dy * 8)
    }

    const handleMouseLeave = () => updateTransform(0, 0)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [settings.bgImage, settings.bgOffsetX, settings.bgOffsetY, settings.bgScale])

  const STICKY_KEY = 'minagi-alarm-sticky-notes'

  useEffect(() => {
    window.electronAPI.storeGet(SETTINGS_KEY).then(data => {
      if (data && typeof data === 'object') {
        const loaded = data as Partial<SettingsData> & { startInClockMode?: boolean }
        // 兼容旧版本 boolean → 迁移到新字段
        if (typeof loaded.startInClockMode === 'boolean') {
          loaded.startupPage = loaded.startInClockMode ? 'clock' : 'alarm'
          delete loaded.startInClockMode
        }
        setSettings(prev => ({ ...prev, ...loaded }))
        // 冷启动时根据启动页面设置自动切换
        if (loaded.startupPage === 'clock') {
          setClockMode(true)
        } else if (loaded.startupPage) {
          setPage(loaded.startupPage)
        }
      }
    }).catch(() => {})
  }, [])

  // 加载便利贴
  useEffect(() => {
    window.electronAPI.storeGet(STICKY_KEY).then(data => {
      if (Array.isArray(data)) {
        const notes = data as StickyData[]
        setStickyNotes(notes)
        setNoteOrder(notes.map(n => n.id))
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    window.electronAPI.getAppIcon().then(url => {
      if (url) setAppIcon(url)
    }).catch(() => {})
  }, [])

  // 语言切换——监听设置变化并更新 i18n 和托盘菜单
  useEffect(() => {
    const lang = settings.language || 'zh-CN'
    if (lang !== i18n.language) {
      i18n.changeLanguage(lang)
    }
    // 每次语言设定变化都更新托盘（含首次加载）
    refreshTrayMenu()
  }, [settings.language])

  // 主题颜色应用到 CSS 变量
  useEffect(() => {
    const colors = deriveColors(settings.themeColor)
    const r = parseInt(settings.themeColor.slice(1, 3), 16)
    const g = parseInt(settings.themeColor.slice(3, 5), 16)
    const b = parseInt(settings.themeColor.slice(5, 7), 16)
    const root = document.documentElement
    root.style.setProperty('--pink', colors.pink)
    root.style.setProperty('--pink-light', colors.pinkLight)
    root.style.setProperty('--pink-dark', colors.pinkDark)
    root.style.setProperty('--pink-glow', colors.pinkGlow)
    root.style.setProperty('--shadow-pink', `0 3px 16px rgba(${r},${g},${b},0.25)`)
  }, [settings.themeColor])

  const handleSettingsChange = useCallback((s: SettingsData) => {
    setSettings(s)
    window.electronAPI.storeSet(SETTINGS_KEY, s).catch(() => {})
  }, [])

  const handleDismissAlert = useCallback(() => {
    stopSound()
    alarms.dismissAlert()
    timer.dismissAlert()
    soundPlayedRef.current = false
    // 倒计时结束后保留结束状态，让用户看到「时间到啦」界面，手动点↺重置
  }, [alarms, timer, stopSound])

  const handleSnooze = useCallback(() => {
    stopSound()
    soundPlayedRef.current = false
    alarms.snoozeAlert()
  }, [alarms, stopSound])

  const handleMinimizeWithSetting = useCallback(() => {
    settings.minimizeToTray ? window.electronAPI.closeWindow() : window.electronAPI.minimizeWindow()
  }, [settings.minimizeToTray])

  const handleCloseWithSetting = useCallback(() => {
    settings.closeToTray ? window.electronAPI.closeWindow() : window.electronAPI.minimizeWindow()
  }, [settings.closeToTray])

  const toggleWallpaperMode = useCallback(async () => {
    const next = !wallpaperMode
    setWallpaperMode(next)
    if (next) {
      setClockMode(true)
    }
    await window.electronAPI.setWallpaperMode(next)
    refreshTrayMenu()
  }, [wallpaperMode])

  // 桌面模式切换时，统一在此处理透明度渐变动画
  // 标题栏按钮、托盘菜单、闹钟触发退出——不管哪条路径，都会走到这里
  useEffect(() => {
    const target = wallpaperMode
      ? settingsRef.current.wallpaperOpacity
      : settingsRef.current.opacity
    window.electronAPI.animateOpacity(target, 400)
  }, [wallpaperMode])

  // 托盘菜单「桌面模式」按钮被点击时——前端来执行实际的切换
  useEffect(() => {
    const cleanup = window.electronAPI.onToggleWallpaperMode(() => {
      toggleWallpaperMode()
    })
    return cleanup
  }, [toggleWallpaperMode])

  const openPreview = useCallback((img: string) => {
    setPreviewImage(img)
    setPreviewOpen(true)
  }, [])

  const handlePreviewConfirm = useCallback((s: number, ox: number, oy: number) => {
    setSettings(prev => {
      const next = { ...prev, bgImage: previewImage, bgScale: s, bgOffsetX: ox, bgOffsetY: oy }
      window.electronAPI.storeSet(SETTINGS_KEY, next)
      return next
    })
    setPreviewOpen(false)
  }, [previewImage])

  const handleRestoreDefaultBg = useCallback(() => {
    setSettings(prev => {
      const next = { ...prev, bgImage: defaultBgImage, bgScale: DEFAULT_BG_SCALE, bgOffsetX: DEFAULT_BG_OFFSET_X, bgOffsetY: DEFAULT_BG_OFFSET_Y }
      window.electronAPI.storeSet(SETTINGS_KEY, next)
      return next
    })
  }, [])

  const handleEnterClockMode = useCallback(() => {
    setClockMode(true)
  }, [])

  // 时钟模式音乐播放 —— 使用播放器独立音量，不影响闹钟和倒计时
  const handleClockMusicPlay = useCallback((sound: SoundOption, _loop = false, shuffle = false) => {
    stopSound()
    playSound(sound.id, sound.path, false, playerVolume)   // 始终不循环单曲，shuffle 模式下由 onended 负责切歌
    setClockMusicId(sound.id)
    clockMusicShuffleRef.current = shuffle
  }, [playSound, stopSound, playerVolume])

  const handleClockMusicStop = useCallback(() => {
    stopSound()
    setMusicLeaving(true)
    setTimeout(() => {
      setMusicLeaving(false)
      setClockMusicId(null)
    }, 350)
  }, [stopSound])

  // 试听铃声时直接停止播放器音乐，不恢复
  const handlePreviewStart = useCallback(() => {
    if (clockMusicId) {
      stopSound()
      setClockMusicId(null)
    }
  }, [clockMusicId, stopSound])

  // 音频播放完毕回调：随机模式自动切歌，单曲模式停止
  const clockMusicRef = useRef(clockMusicId)
  clockMusicRef.current = clockMusicId
  const clockMusicShuffleRef = useRef(false)
  const playerVolumeRef = useRef(playerVolume)
  playerVolumeRef.current = playerVolume
  const customSoundsRef = useRef(customSounds)
  customSoundsRef.current = customSounds

  useEffect(() => {
    setOnAudioEnded(() => {
      if (clockMusicShuffleRef.current) {
        // 随机播放模式：自动切下一首不同的歌
        const all = customSoundsRef.current
        if (all.length === 0) {
          stopSound()
          setClockMusicId(null)
          return
        }
        let next: SoundOption
        if (all.length === 1) {
          next = all[0]
        } else {
          do { next = all[Math.floor(Math.random() * all.length)] }
          while (next.id === clockMusicRef.current)
        }
        stopSound()
        playSound(next.id, next.path, false, playerVolumeRef.current)
        setClockMusicId(next.id)
      } else {
        // 单曲模式：放完就停
        stopSound()
        setMusicLeaving(true)
        setTimeout(() => {
          setMusicLeaving(false)
          setClockMusicId(null)
        }, 350)
      }
    })
    return () => setOnAudioEnded(null)
  }, [setOnAudioEnded, stopSound, playSound])

  // 同步闹钟触发时的音效信息——用闹钟自己的 sound，而不是全局设置
  useEffect(() => {
    const triggeredAlarm = alarms.alarms.find(a => a.id === alarms.triggeredAlarmId)
    if (triggeredAlarm) {
      const customPath = customSounds.find(s => s.id === triggeredAlarm.sound)?.path
      alertSoundRef.current = { soundId: triggeredAlarm.sound, customPath }
    }
  }, [alarms.triggeredAlarmId, alarms.alarms, customSounds])

  const handleClockMusicContextMenu = useCallback((e: React.MouseEvent) => {
    if (customSounds.length === 0) return
    setShowClockMusic(true)
  }, [customSounds.length])

  // 退出时钟模式（双击空白）—— 如果在桌面模式中也一并退出
  const exitClockMode = useCallback(() => {
    if (wallpaperMode) {
      setWallpaperMode(false)
      window.electronAPI.setWallpaperMode(false).then(() => refreshTrayMenu())
    }
    setShowClockMusic(false)
    setClockMode(false)
  }, [wallpaperMode])

  // 主界面唱片图标磁吸动效
  useEffect(() => {
    const el = musicIndicatorRef.current
    if (!el || !clockMusicId || clockMode) return

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
      const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
      el.style.transform = `translate(${dx * 2}px, ${dy * 2}px)`
      el.style.transition = 'transform 0.1s ease-out'
    }

    const handleLeave = () => {
      el.style.transform = 'translate(0px, 0px)'
      el.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }

    el.addEventListener('mousemove', handleMove)
    el.addEventListener('mouseleave', handleLeave)
    return () => {
      el.removeEventListener('mousemove', handleMove)
      el.removeEventListener('mouseleave', handleLeave)
    }
  }, [clockMusicId, clockMode])

  // 从播放器返回 —— 保持音乐继续
  const closeClockMusic = useCallback(() => {
    setShowClockMusic(false)
  }, [])

  // 便利贴操作
  const pendingStickySave = useRef<StickyData[] | null>(null)
  const saveStickyNotes = useCallback((notes: StickyData[]) => {
    window.electronAPI.storeSet(STICKY_KEY, notes).catch(() => {
      // IPC 写入失败，暂存内存等下次机会重试
      pendingStickySave.current = notes
    })
  }, [])

  // 重试暂存的便利贴保存
  useEffect(() => {
    if (!pendingStickySave.current) return
    const notes = pendingStickySave.current
    window.electronAPI.storeSet(STICKY_KEY, notes).then(() => {
      pendingStickySave.current = null
    }).catch(() => {})
  })  // 每次渲染都检查，有暂存就重试

  const handleNoteChange = useCallback((updated: StickyData) => {
    setStickyNotes(prev => {
      const next = prev.map(n => n.id === updated.id ? updated : n)
      saveStickyNotes(next)
      return next
    })
  }, [saveStickyNotes])

  const handleNoteDelete = useCallback((id: string) => {
    setStickyNotes(prev => {
      const next = prev.filter(n => n.id !== id)
      saveStickyNotes(next)
      return next
    })
    setNoteOrder(prev => prev.filter(i => i !== id))
  }, [saveStickyNotes])

  const handleNoteAdd = useCallback((x: number, y: number) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    // 约束位置确保图钉不会跑出窗口
    const cx = Math.max(2, Math.min(98, x))
    const cy = Math.max(26, Math.min(96, y))
    setStickyNotes(prev => {
      if (prev.length >= 5) return prev
      const next = [...prev, { id, text: '', x: cx, y: cy }]
      saveStickyNotes(next)
      return next
    })
    setNoteOrder(prev => [...prev, id])
  }, [saveStickyNotes])

  const handleNoteFocus = useCallback((id: string) => {
    setNoteOrder(prev => {
      if (prev[prev.length - 1] === id) return prev // 已经是最前
      return [...prev.filter(i => i !== id), id]
    })
  }, [])

  // 右键菜单——始终阻止浏览器默认菜单，再由具体逻辑决定是否新建便签
  const handleNoteAddContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (!clockMode) return
    const target = e.target as HTMLElement
    // 只在背景空白处响应，不在便利贴或时钟组件上
    if (target.closest('.sticky-note') || target.closest('.sticky-menu') || target.closest('.sticky-confirm-overlay')) return
    if (target.closest('[style*="grab"]') || target.closest('.clock-mode-overlay > div')) return
    const x = (e.clientX / window.innerWidth) * 100
    const y = (e.clientY / window.innerHeight) * 100
    handleNoteAdd(Math.round(x * 10) / 10, Math.round(y * 10) / 10)
  }, [clockMode, handleNoteAdd])

  const activeAlert = alarms.alertActive
    ? { type: 'alarm' as const, label: alarms.alertLabel || i18n.t('alarm.alert.title') }
    : timer.alertActive
      ? { type: 'timer' as const, label: timer.reminderText || i18n.t('timer.alert.title') }
      : null

  // 闹钟或倒计时触发时，打断时钟音乐并播放提醒音
  // 只依赖 activeAlert——其余值通过 ref 获取，避免副效应重复触发
  useEffect(() => {
    if (!activeAlert || soundPlayedRef.current) return

    // 如果当前处于桌面模式，自动退出——闹钟响了当然要回到前台提醒 Minagi 呢
    if (wallpaperModeRef.current) {
      setWallpaperMode(false)
      window.electronAPI.setWallpaperMode(false)
    }

    // 如果时钟模式音乐正在播放，打断它——闹钟和倒计时优先哦
    if (clockMusicRef.current) {
      stopSound()
      setClockMusicId(null)
      setShowClockMusic(false)
      setMusicLeaving(false)
    }

    soundPlayedRef.current = true
    // 闹钟使用自己的 sound 字段，倒计时使用全局设置
    if (activeAlert.type === 'alarm') {
      const { soundId, customPath } = alertSoundRef.current
      playSound(soundId, customPath, true)
    } else {
      const customPath = customSounds.find(s => s.id === settings.sound)?.path
      playSound(settings.sound, customPath, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAlert])

  // 背景图层（独立控制透明度，不影响内容）
  const bgLayerStyle: React.CSSProperties = settings.bgImage ? {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    overflow: 'hidden',
    opacity: clockMode ? clockBgOpacity : settings.bgOpacity,
    pointerEvents: 'none',
  } : { display: 'none' }

  const bgImgStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    maxWidth: 'none',
    transition: 'transform 0.35s ease-out',
    pointerEvents: 'none',
    userSelect: 'none',
  }

  return (
    <div
      className={`app ${settings.bgImage ? 'app--has-bg' : ''} ${clockMode ? 'app--clock-mode' : ''} ${wallpaperMode ? 'app--wallpaper-mode' : ''}`}
      onDoubleClick={clockMode ? exitClockMode : undefined}
      onMouseMove={clockMode ? (e) => setClockTitlebarVisible(e.clientY <= 60) : undefined}
      onContextMenu={handleNoteAddContextMenu}
    >
      {/* 背景图层 */}
      {settings.bgImage && (
        <div style={bgLayerStyle}>
          <img ref={bgImgRef} src={settings.bgImage} style={bgImgStyle} alt="" />
        </div>
      )}
      {/* 时钟模式顶部触发条——鼠标靠近最上方时显示标题栏 */}
      {clockMode && (
        <div
          className="clock-titlebar-trigger"
          style={clockTitlebarVisible ? { pointerEvents: 'none' } : undefined}
          onMouseEnter={() => setClockTitlebarVisible(true)}
        />
      )}
      <div
        className={`titlebar ${(clockMode && !clockTitlebarVisible) || wallpaperMode ? 'titlebar--hidden' : ''}`}
        onMouseLeave={clockMode ? () => setClockTitlebarVisible(false) : undefined}
      >
        <div className="titlebar__title">
          {appIcon ? <img className="titlebar__icon" src={appIcon} alt="" /> : <span className="titlebar__icon">⏰</span>}
          <span className="titlebar__text">Minagi Alarm</span>
        </div>
        <div className="titlebar__controls">
          <button
            className={`titlebar__btn ${wallpaperMode ? 'titlebar__btn--wallpaper-active' : ''}`}
            onClick={toggleWallpaperMode}
            title={wallpaperMode ? i18n.t('titlebar.exitDesktopMode') : i18n.t('titlebar.enterDesktopMode')}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="1.5" y="1.5" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
              <path d="M1.5 5.5 L12 1" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
              <circle cx="9.5" cy="3.5" r="0.6" fill="currentColor" opacity="0.5" />
            </svg>
          </button>
          <button className="titlebar__btn" onClick={handleMinimizeWithSetting} title={i18n.t('titlebar.minimize')}>
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1" y="5.5" width="10" height="1" rx="0.5" fill="currentColor" />
            </svg>
          </button>
          <button className="titlebar__btn titlebar__btn--close" onClick={handleCloseWithSetting} title={i18n.t('titlebar.close')}>
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className={`app__content ${clockMode ? 'app__content--hidden' : ''}`}>
        {/* 音乐播放中指示器 */}
      {clockMusicId && !clockMode && (
        <div
          className={`music-now-playing ${musicLeaving ? 'music-now-playing--leaving' : ''}`}
          ref={musicIndicatorRef}
          onClick={handleClockMusicStop}
          title={i18n.t('clock.stopMusic')}
        >
          <div className="music-now-playing__vinyl">
            <span className="music-now-playing__note">♫</span>
          </div>
        </div>
      )}

      {!clockMode && <CurrentTime showSeconds={settings.showSeconds} onEnterClockMode={handleEnterClockMode} />}
        <ErrorBoundary key={page}>
          {page === 'alarm' && (
            <AlarmList alarms={alarms.alarms} onAdd={alarms.addAlarm}
              onUpdate={alarms.updateAlarm} onDelete={alarms.deleteAlarm} onToggle={alarms.toggleAlarm}
              globalSound={settings.sound} customSounds={customSounds}
              onPreviewStart={handlePreviewStart} />
          )}
          {page === 'timer' && <Timer timer={timer} />}
          {page === 'settings' && (
            <SettingsPage customSounds={customSounds} onImportSound={addCustomSound}
              onRemoveSound={removeCustomSound}
              settings={settings} onSettingsChange={handleSettingsChange}
              onOpenPreview={openPreview} onRestoreDefaultBg={handleRestoreDefaultBg}
              onPreviewStart={handlePreviewStart} wallpaperMode={wallpaperMode} />
          )}
        </ErrorBoundary>
      </div>

      {/* 时钟模式——可拖拽缩放的中央时钟 */}
      {clockMode && (
        <>
          <div className="clock-mode-overlay">
            <ClockModeDisplay showSeconds={settings.showSeconds} onClockContextMenu={handleClockMusicContextMenu} />
            {stickyNotes.map(note => (
              <StickyNote
                key={note.id}
                note={note}
                zIndex={55 + noteOrder.indexOf(note.id)}
                onChange={handleNoteChange}
                onDelete={handleNoteDelete}
                onFocus={handleNoteFocus}
              />
            ))}
          </div>

          {/* 时钟模式音乐列表 */}
          {showClockMusic && (
            <ClockMusicList
              customSounds={customSounds}
              onClose={closeClockMusic}
              playingId={clockMusicId}
              onPlay={handleClockMusicPlay}
              onStop={handleClockMusicStop}
              playerVolume={playerVolume}
              onVolumeChange={(vol: number) => {
                setPlayerVolume(vol)
                setVolume(vol)
              }}
            />
          )}

          {clockHelpVisible && (
            <div
              className={`clock-help ${clockHelpLeaving ? 'clock-help--leaving' : ''}`}
              onMouseEnter={() => {
                setClockHelpLeaving(false)
                if (clockHelpTimer.current) clearTimeout(clockHelpTimer.current)
                if (clockHelpLeaveTimer.current) clearTimeout(clockHelpLeaveTimer.current)
              }}
              onMouseLeave={() => {
                clockHelpTimer.current = setTimeout(hideClockHelp, 3000)
              }}
            >
              {(i18n.t('clock.help', { returnObjects: true }) as string[]).map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
              ))}
            </div>
          )}
        </>
      )}

      {page === 'alarm' && alarms.snoozeUntil > 0 && (
        <SnoozeIndicator snoozeUntil={alarms.snoozeUntil} label={alarms.alertLabel}
          onCancel={() => { alarms.dismissAlert(); stopSound(); soundPlayedRef.current = false }} />
      )}

      {!clockMode && <TabBar current={page} onChange={setPage} />}

      {activeAlert && (
        <AlertDialog type={activeAlert.type} label={activeAlert.label}
          onDismiss={handleDismissAlert} onSnooze={handleSnooze} />
      )}

      {settings.sakuraEnabled && <SakuraEffect color={settings.sakuraColor} opacity={settings.sakuraOpacity} />}

      {/* 倒计时运行时的呼吸光效——淡雅的明暗律动 */}


      {/* 背景预览——渲染在应用容器外部，覆盖整个窗口 */}
      {previewOpen && (
        <BgPreview
          image={previewImage}
          opacity={settings.bgOpacity}
          scale={settings.bgScale}
          offsetX={settings.bgOffsetX}
          offsetY={settings.bgOffsetY}
          onConfirm={handlePreviewConfirm}
          onCancel={() => setPreviewOpen(false)}
        />
      )}
    </div>
  )
}

export default App
