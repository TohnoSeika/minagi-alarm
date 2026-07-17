/**
 * 提醒弹窗
 * 闹钟或倒计时到期时弹出，带响铃动画 + 全局鼠标视差
 */
import { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  type: 'alarm' | 'timer'
  label: string
  onDismiss: () => void
  onSnooze?: () => void
}

export default function AlertDialog({ type, label, onDismiss, onSnooze }: Props) {
  const { t } = useTranslation()
  const isTimer = type === 'timer'
  const customMsg = isTimer && label !== t('timer.alert.title') ? label : ''

  const cardRef = useRef<HTMLDivElement>(null)
  const dismissRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const card = cardRef.current
    const btn = dismissRef.current
    if (!card || !btn) return

    const onAnimEnd = () => { card.style.animation = 'none' }
    card.addEventListener('animationend', onAnimEnd, { once: true })

    const handleMove = (e: MouseEvent) => {
      const cr = card.getBoundingClientRect()
      const cdx = (e.clientX - (cr.left + cr.width / 2)) / (window.innerWidth / 2)
      const cdy = (e.clientY - (cr.top + cr.height / 2)) / (window.innerHeight / 2)
      card.style.transform = `translate(${cdx * 6}px, ${cdy * 6}px)`

      const br = btn.getBoundingClientRect()
      const bdx = (e.clientX - (br.left + br.width / 2)) / (br.width / 2)
      const bdy = (e.clientY - (br.top + br.height / 2)) / (br.height / 2)
      btn.style.transform = `translate(${bdx * 1}px, ${bdy * 1}px)`
      btn.style.transition = 'transform 0.1s ease-out'
    }

    const handleBtnLeave = () => {
      btn.style.transform = 'translate(0px, 0px)'
      btn.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }

    const handleReset = () => {
      card.style.transform = 'translate(0px, 0px)'
      btn.style.transform = 'translate(0px, 0px)'
      btn.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }

    btn.addEventListener('mouseleave', handleBtnLeave)
    document.addEventListener('mouseleave', handleReset)
    window.addEventListener('mousemove', handleMove, { passive: true })
    return () => {
      card.removeEventListener('animationend', onAnimEnd)
      window.removeEventListener('mousemove', handleMove)
      btn.removeEventListener('mouseleave', handleBtnLeave)
      document.removeEventListener('mouseleave', handleReset)
    }
  }, [])

  return (
    <div className="alert-dialog">
      <div
        ref={cardRef}
        className={`alert-dialog__card ${isTimer ? 'alert-dialog__card--timer' : ''}`}
        style={{ transition: 'transform 0.6s ease-out' }}
      >
        <div className="alert-dialog__header">
          <div className="alert-dialog__icon">
            {isTimer ? '⏱' : '⏰'}
          </div>
          <div className="alert-dialog__title">
            {isTimer ? t('timer.alert.title') : label}
          </div>
        </div>

        {isTimer && (
          <div className="alert-dialog__hero-text">
            {customMsg || t('timer.finished')}
          </div>
        )}

        <div className="alert-dialog__actions">
          {!isTimer && onSnooze && (
            <button className="alert-dialog__snooze" onClick={onSnooze}>
              💤 {t('alarm.alert.snooze')}
            </button>
          )}
          <button
            ref={dismissRef}
            className="alert-dialog__dismiss"
            onClick={onDismiss}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
