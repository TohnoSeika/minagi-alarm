/**
 * Minagi Alarm — 倒计时主组件
 */

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import TimerRing from './TimerRing'
import TimerPresets from './TimerPresets'

export interface TimerProps {
  totalSeconds: number
  remainingSeconds: number
  isRunning: boolean
  isPaused: boolean
  sound: string
  reminderText: string
  setTime: (h: number, m: number, s: number) => void
  start: () => void
  pause: () => void
  reset: () => void
  setReminderText: (text: string) => void
  setSound: (sound: string) => void
  alertActive: boolean
  dismissAlert: () => void
}

function safe(n: number, fallback: number = 0): number {
  return (typeof n === 'number' && isFinite(n)) ? n : fallback
}

export default function Timer({ timer }: { timer: TimerProps }) {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [customH, setCustomH] = useState(0)
  const [customM, setCustomM] = useState(5)
  const [customS, setCustomS] = useState(0)
  const [reminderText, setReminderTextLocal] = useState(timer.reminderText || '')
  const [reminderFocused, setReminderFocused] = useState(false)
  const reminderExpanded = reminderFocused || reminderText.length > 0

  const total = safe(timer.totalSeconds, 300)
  const remaining = safe(timer.remainingSeconds, total)
  const running = timer.isRunning === true
  const paused = timer.isPaused === true

  const isIdle = !running && !paused && remaining === total
  const isFinished = !running && !paused && remaining === 0 && total > 0

  const handlePreset = (secs: number) => {
    timer.setTime(0, Math.floor(secs / 60), secs % 60)
  }

  const handleDoubleClick = () => {
    if (!isIdle) return
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    setCustomH(h)
    setCustomM(m)
    setCustomS(s)
    setDialogOpen(true)
  }

  const handleCustomConfirm = () => {
    const tc = safe(customH, 0) * 3600 + safe(customM, 0) * 60 + safe(customS, 0)
    if (tc > 0) {
      timer.setTime(safe(customH, 0), safe(customM, 0), safe(customS, 0))
    }
    setDialogOpen(false)
  }

  const fabRef = useRef<HTMLButtonElement>(null)
  const [magnet, setMagnet] = useState({ x: 0, y: 0 })
  const [leaving, setLeaving] = useState(false)

  const handleFabMove = useCallback((e: React.MouseEvent) => {
    setLeaving(false)
    const rect = fabRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = (e.clientX - cx) / (rect.width / 2)
    const dy = (e.clientY - cy) / (rect.height / 2)
    setMagnet({ x: dx * 4, y: dy * 4 })
  }, [])

  const handleFabLeave = useCallback(() => {
    setLeaving(true)
    setMagnet({ x: 0, y: 0 })
  }, [])

  const fabStyle = {
    transform: `translate(calc(-50% + ${magnet.x}px), ${magnet.y}px)`,
    transition: leaving
      ? 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
      : 'transform 0.1s ease-out',
  }

  return (
    <div className={`timer-container ${(running || paused) && !timer.reminderText ? 'timer-container--no-note' : ''}`}>
      <div className="timer-top">
        <TimerRing
          totalSeconds={total}
          remainingSeconds={remaining}
          isRunning={running}
          isPaused={paused}
          onDoubleClick={handleDoubleClick}
          label={isFinished ? t('timer.finishedLabel') : undefined}
        />

        {isIdle && (
          <TimerPresets activeSeconds={total} onSelect={handlePreset} />
        )}
      </div>

      {isIdle && (
        <div className={`timer-reminder ${reminderExpanded ? 'timer-reminder--expanded' : ''}`}>
          <div className="timer-reminder__wrap">
            <input
              className="timer-reminder__input"
              type="text"
              value={reminderText}
              onChange={e => { setReminderTextLocal(e.target.value); timer.setReminderText(e.target.value) }}
              onFocus={() => setReminderFocused(true)}
              onBlur={() => setReminderFocused(false)}
              onMouseEnter={() => setReminderFocused(true)}
              onMouseLeave={() => setReminderFocused(false)}
              placeholder={reminderExpanded ? t('timer.reminderPlaceholderLong') : t('timer.reminderPlaceholder')}
              maxLength={30}
            />
            {reminderText && (
              <button
                className="timer-reminder__clear"
                onClick={() => { setReminderTextLocal(''); timer.setReminderText('') }}
                title={t('timer.clearHint')}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {(running || paused) && timer.reminderText && (
        <div className="timer-message">{timer.reminderText}</div>
      )}

      {isFinished && (
        <div className="timer-finished-hero">
          {timer.reminderText || t('timer.finished')}
        </div>
      )}

      <button
        className="timer-fab"
        ref={fabRef}
        onClick={running || isFinished ? timer.reset : timer.start}
        onMouseMove={handleFabMove}
        onMouseLeave={handleFabLeave}
        disabled={!running && !isFinished && total <= 0}
        title={running ? t('timer.reset') : isFinished ? t('timer.restart') : t('timer.start')}
        style={fabStyle}
      >
        <span>{running || isFinished ? '↺' : '▶'}</span>
      </button>

      {dialogOpen && createPortal(
        <div className="timer-dialog-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setDialogOpen(false) }}>
          <div className="timer-dialog" onClick={e => e.stopPropagation()}>
            <div className="timer-dialog__title">{t('timer.customTitle')}</div>
            <div className="timer-setup">
              <input className="timer-setup__field" type="number" min={0} max={99}
                value={customH || ''} placeholder="0"
                onChange={e => setCustomH(Math.max(0, Math.min(99, parseInt(e.target.value) || 0)))}
                onWheel={e => { e.preventDefault(); setCustomH(h => Math.max(0, Math.min(99, h + (e.deltaY > 0 ? -1 : 1)))) }}
                autoFocus />
              <span className="timer-setup__label">{t('timer.hour')}</span>
              <input className="timer-setup__field" type="number" min={0} max={59}
                value={customM || ''} placeholder="0"
                onChange={e => setCustomM(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                onWheel={e => { e.preventDefault(); setCustomM(m => Math.max(0, Math.min(59, m + (e.deltaY > 0 ? -1 : 1)))) }} />
              <span className="timer-setup__label">{t('timer.minute')}</span>
              <input className="timer-setup__field" type="number" min={0} max={59}
                value={customS || ''} placeholder="0"
                onChange={e => setCustomS(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                onWheel={e => { e.preventDefault(); setCustomS(s => Math.max(0, Math.min(59, s + (e.deltaY > 0 ? -1 : 1)))) }} />
              <span className="timer-setup__label">{t('timer.second')}</span>
            </div>
            <button className="timer-dialog__confirm" onClick={handleCustomConfirm} title={t('timer.confirm')}>
              ✓
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
