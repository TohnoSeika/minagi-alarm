/**
 * 时钟模式——可拖拽、可缩放的中央时钟
 * 桃华觉得这样用户就能把时钟放在最舒服的位置了 ✨
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import CurrentTime from './CurrentTime'

const STORE_KEY = 'minagi-alarm-clock-config'

interface ClockConfig {
  x: number   // % of window width
  y: number   // % of window height
  scale: number
}

const DEFAULT_CONFIG: ClockConfig = { x: 50, y: 50, scale: 1 }

const MIN_SCALE = 1
const MAX_SCALE = 2.2  // roughly 1/4 of 640x480 window

export default function ClockModeDisplay({ showSeconds, onClockContextMenu }: { showSeconds?: boolean; onClockContextMenu?: (e: React.MouseEvent) => void }) {
  const [config, setConfig] = useState<ClockConfig>(DEFAULT_CONFIG)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // 加载已保存的配置
  useEffect(() => {
    window.electronAPI.storeGet(STORE_KEY).then((data) => {
      if (data && typeof data === 'object') {
        setConfig({
          x: (data as ClockConfig).x ?? 50,
          y: (data as ClockConfig).y ?? 50,
          scale: (data as ClockConfig).scale ?? 1,
        })
      }
    }).catch(() => {})
  }, [])

  const saveConfig = useCallback((cfg: ClockConfig) => {
    window.electronAPI.storeSet(STORE_KEY, cfg)
  }, [])

  // 拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, cx: config.x, cy: config.y }
  }, [config])

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      const newConfig = {
        ...config,
        x: Math.max(5, Math.min(95, dragStart.current.cx + (dx / window.innerWidth) * 100)),
        y: Math.max(5, Math.min(90, dragStart.current.cy + (dy / window.innerHeight) * 100)),
      }
      setConfig(newConfig)
    }
    const handleUp = () => {
      setDragging(false)
      // 松手后保存
      saveConfig(config)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging, config, saveConfig])

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, config.scale + delta))
    const newConfig = { ...config, scale: Math.round(newScale * 100) / 100 }
    setConfig(newConfig)
    saveConfig(newConfig)
  }, [config, saveConfig])

  // 双击打开音乐播放器
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onClockContextMenu?.(e)
  }, [onClockContextMenu])

  // 右键重置位置和大小
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const reset: ClockConfig = { x: 50, y: 50, scale: 1 }
    setConfig(reset)
    saveConfig(reset)
  }, [saveConfig])

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${config.x}%`,
    top: `${config.y}%`,
    transform: `translate(-50%, -50%) scale(${config.scale})`,
    cursor: dragging ? 'grabbing' : 'grab',
    userSelect: 'none',
  }

  return (
    <div
      ref={containerRef}
      style={style}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <CurrentTime clockMode={true} showSeconds={showSeconds} />
    </div>
  )
}
