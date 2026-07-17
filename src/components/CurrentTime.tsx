/**
 * 当前时间显示
 * 大字号时钟 + 日期，每秒更新
 * 「桃华觉得，看时间这件事本身就应该让人心情好」
 */

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

interface Props {
  clockMode?: boolean
  showSeconds?: boolean
  onEnterClockMode?: () => void
}

export default function CurrentTime({ clockMode, showSeconds, onEnterClockMode }: Props) {
  const { t } = useTranslation()
  const [now, setNow] = useState(new Date())
  const [bouncing, setBouncing] = useState(false)
  const elRef = useRef<HTMLDivElement>(null)
  const weekdays = t('date.weekdays', { returnObjects: true }) as string[]

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleDoubleClick = () => {
    if (clockMode || !onEnterClockMode) return
    setBouncing(true)
    setTimeout(() => onEnterClockMode(), 80)
  }

  // 鼠标跟随视差（仅普通模式，时钟模式下自行定位）
  useEffect(() => {
    if (clockMode) return
    const el = elRef.current
    if (!el) return

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
      const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
      el.style.transform = `translate(${dx * 2}px, ${dy * 2}px)`
      el.style.transition = 'transform 0.15s ease-out'
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
  }, [clockMode])

  const h = pad(now.getHours())
  const m = pad(now.getMinutes())
  const s = pad(now.getSeconds())

  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const weekday = weekdays[now.getDay()]
  const prefix = t('date.weekdayPrefix')

  const dateStr = t('date.format')
    .replace('{{year}}', String(year))
    .replace('{{month}}', String(month))
    .replace('{{day}}', String(day))

  return (
    <div
      ref={elRef}
      className={`current-time ${clockMode ? 'current-time--center' : ''} ${bouncing ? 'current-time--bounce' : ''}`}
      onDoubleClick={handleDoubleClick}
      title={clockMode ? undefined : t('date.enterClockMode')}
      style={clockMode ? undefined : { cursor: 'pointer' }}
    >
      <div className="current-time__time">
        <span className="current-time__hm">{h}:{m}</span>
        {showSeconds && <span className="current-time__sec">{s}</span>}
      </div>
      <div className="current-time__date">
        {dateStr} {prefix}{weekday}
      </div>
    </div>
  )
}
