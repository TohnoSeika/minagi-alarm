/**
 * 推迟倒计时指示器
 * 闹钟被推迟后显示剩余时间，取消需确认
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  snoozeUntil: number
  label: string
  onCancel: () => void
}

export default function SnoozeIndicator({ snoozeUntil, label, onCancel }: Props) {
  const { t } = useTranslation()
  const [remaining, setRemaining] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((snoozeUntil - Date.now()) / 1000))
      const m = Math.floor(left / 60)
      const s = left % 60
      setRemaining(`${m}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [snoozeUntil])

  return (
    <>
      <div className="snooze-indicator">
        <span className="snooze-indicator__icon">💤</span>
        <span className="snooze-indicator__text">
          {t('snooze.hint').replace('%time%', remaining)}
        </span>
        <button className="snooze-indicator__cancel" onClick={() => setConfirmOpen(true)}>✕</button>
      </div>

      {confirmOpen && (
        <div className="sticky-confirm-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="sticky-confirm" onClick={e => e.stopPropagation()} style={{ maxWidth: 340 }}>
            <div className="sticky-confirm__icon">🔔</div>
            <div className="sticky-confirm__title">{t('snooze.cancelConfirm')}</div>
            <div className="sticky-confirm__preview" style={{ textAlign: 'center', maxHeight: 200, paddingBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--pink-dark)', marginBottom: 4 }}>{label || t('alarm.alert.title')}</div>
              <div>{t('snooze.hint').replace('%time%', remaining)}</div>
            </div>
            <div className="sticky-confirm__actions">
              <button className="sticky-confirm__btn sticky-confirm__btn--cancel" onClick={() => setConfirmOpen(false)}>{t('snooze.back')}</button>
              <button className="sticky-confirm__btn sticky-confirm__btn--danger" onClick={onCancel}>{t('snooze.confirmBtn')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
