/**
 * Minagi Alarm — 倒计时进度环
 * 鼠标靠近时圆环和文字会产生磁吸偏移，离开时弹性复位
 * 桃华觉得这个动效让倒计时界面更有灵气了呢 ✨
 */

import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  totalSeconds: number
  remainingSeconds: number
  isRunning: boolean
  isPaused: boolean
  onDoubleClick?: () => void
  label?: string
}

function formatTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TimerRing({ totalSeconds, remainingSeconds, isRunning, isPaused, onDoubleClick, label }: Props) {
  const { t } = useTranslation()
  const radius = 62
  const strokeWidth = 6
  const circumference = 2 * Math.PI * radius
  const center = radius + strokeWidth + 2

  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0
  const offset = circumference * (1 - progress)

  let progressClass = ''
  if (isRunning || isPaused) {
    if (progress < 0.1) progressClass = 'timer-ring__progress--urgent'
    else if (progress < 0.3) progressClass = 'timer-ring__progress--warning'
  }

  const showProgress = isRunning || isPaused
  const display = formatTime(totalSeconds > 0 ? remainingSeconds : 0)

  // 鼠标磁吸效果
  const ringRef = useRef<HTMLDivElement>(null)
  const [magnet, setMagnet] = useState({ x: 0, y: 0 })
  const [leaving, setLeaving] = useState(false)
  const maxPull = 6 // 文字最大偏移像素

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setLeaving(false)
    const rect = ringRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    // 归一化到 [-1, 1]，鼠标越靠近边缘偏移越大
    const dx = (e.clientX - cx) / (rect.width / 2)
    const dy = (e.clientY - cy) / (rect.height / 2)
    setMagnet({ x: dx * maxPull, y: dy * maxPull })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setLeaving(true)
    setMagnet({ x: 0, y: 0 })
  }, [])

  // 环偏移小一点，文字偏移大一点，形成视差层次
  const ringStyle = {
    transform: `translate(${magnet.x * 0.45}px, ${magnet.y * 0.45}px)`,
    transition: leaving
      ? 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
      : 'transform 0.12s ease-out',
  }

  const textStyle = {
    transform: `translate(${magnet.x}px, ${magnet.y}px)`,
    transition: leaving
      ? 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)'
      : 'transform 0.15s ease-out',
  }

  const isActive = isRunning || isPaused

  return (
    <div
      className={`timer-ring ${isActive ? 'timer-ring--active' : ''}`}
      ref={ringRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={onDoubleClick}
    >
      <svg
        width={center * 2}
        height={center * 2}
        viewBox={`0 0 ${center * 2} ${center * 2}`}
        style={ringStyle}
      >
        <circle
          className="timer-ring__bg"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          className={`timer-ring__progress ${progressClass}`}
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={showProgress ? offset : 0}
          fill="none"
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="timer-ring__time" style={textStyle}>
        <div className="timer-ring__digits">{display}</div>
        {/* 运行中不显示标签，让时间居中 */}
        {(!isRunning || isPaused) && (
          <div className="timer-ring__label">
            {label || (!showProgress ? t('timer.custom') : t('timer.paused') || '已暂停')}
          </div>
        )}
      </div>
    </div>
  )
}
