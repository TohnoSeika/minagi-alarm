/**
 * 闹钟编辑弹窗
 * 设置时间、标签、重复模式、铃声
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Alarm, RepeatMode } from '../hooks/useAlarms'
import { SoundOption, BUILTIN_SOUNDS } from '../hooks/useAudio'
import TimeWheel from './TimeWheel'
import SoundPicker from './SoundPicker'

function parseTime(t: string): [number, number] {
  const [h, m] = (t || '08:00').split(':').map(Number)
  return [h || 0, m || 0]
}

interface Props {
  alarm: Alarm | null
  onSave: (data: Omit<Alarm, 'id' | 'createdAt'>) => void
  onClose: () => void
  onDelete?: () => void
  globalSound?: string
  customSounds?: SoundOption[]
  onPreviewStart?: () => void
}

export default function AlarmEditor({ alarm, onSave, onClose, onDelete, globalSound, customSounds = [], onPreviewStart }: Props) {
  const { t } = useTranslation()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [initH, initM] = parseTime(alarm?.time || '08:00')
  const [hour, setHour] = useState(initH)
  const [minute, setMinute] = useState(initM)
  const [label, setLabel] = useState(alarm?.label || '')
  const [repeat, setRepeat] = useState<RepeatMode>(alarm?.repeat || 'once')
  const [repeatDays, setRepeatDays] = useState<number[]>(alarm?.repeatDays || [])
  const [sound, setSound] = useState(alarm?.sound || globalSound || 'chime')
  const [showSoundPicker, setShowSoundPicker] = useState(false)

  const weekdays = t('alarm.weekday', { returnObjects: true }) as Record<string, string>
  const weekdayNames = [weekdays.sun, weekdays.mon, weekdays.tue, weekdays.wed, weekdays.thu, weekdays.fri, weekdays.sat]

  const repeatLabels: [RepeatMode, string][] = [
    ['once', t('alarm.repeat.once')],
    ['daily', t('alarm.repeat.daily')],
    ['weekdays', t('alarm.repeat.weekdays')],
    ['weekends', t('alarm.repeat.weekends')],
    ['custom', t('alarm.repeat.custom')],
  ]

  const handleSave = () => {
    onSave({
      time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      label: label.trim(),
      enabled: alarm?.enabled ?? true,
      repeat,
      repeatDays,
      sound,
    })
  }

  const allSounds = [...BUILTIN_SOUNDS, ...customSounds]
  const currentSound = allSounds.find(s => s.id === sound)
  const currentSoundName = currentSound
    ? (currentSound.source === 'builtin' ? t(`sounds.${currentSound.id}` as any) : currentSound.name)
    : '—'

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const noopImport = (_s: SoundOption) => undefined

  const handleRepeatChange = (mode: RepeatMode) => {
    setRepeat(mode)
    if (mode === 'weekdays') setRepeatDays([1, 2, 3, 4, 5])
    else if (mode === 'weekends') setRepeatDays([0, 6])
    else if (mode === 'custom') setRepeatDays([1, 2, 3, 4, 5])
  }

  const toggleWeekday = (day: number) => {
    setRepeatDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__title">
          {alarm ? t('alarm.editor.editTitle') : t('alarm.editor.title')}
        </div>

        <div className="form-group">
          <div className="form-label">{t('alarm.editor.timeLabel')}</div>
          <TimeWheel hour={hour} minute={minute} onChange={(h, m) => { setHour(h); setMinute(m) }} />
        </div>

        <div className="form-group">
          <div className="form-label">{t('alarm.editor.label') || '备注（可选）'}</div>
          <input
            className="form-input"
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder={t('alarm.editor.labelPlaceholder')}
            maxLength={30}
          />
        </div>

        <div className="form-group">
          <div className="form-label">{t('alarm.editor.repeat')}</div>
          <div className="repeat-group">
            {repeatLabels.map(([mode, label]) => (
              <button
                key={mode}
                className={`repeat-btn ${repeat === mode ? 'repeat-btn--active' : ''}`}
                onClick={() => handleRepeatChange(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          {repeat === 'custom' && (
            <div className="weekday-group">
              {weekdayNames.map((name, i) => (
                <button
                  key={i}
                  className={`weekday-btn ${repeatDays.includes(i) ? 'weekday-btn--active' : ''}`}
                  onClick={() => toggleWeekday(i)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <div className="form-label">{t('alarm.editor.sound')}</div>
          <button
            className="alarm-editor__sound-btn"
            onClick={() => setShowSoundPicker(true)}
          >
            <span className="alarm-editor__sound-name">{currentSoundName}</span>
            <span className="alarm-editor__sound-arrow">▼</span>
          </button>
        </div>

        <div className="modal__actions">
          {onDelete && !confirmDelete && (
            <button className="btn btn--danger" onClick={() => setConfirmDelete(true)}>{t('alarm.editor.delete')}</button>
          )}
          {onDelete && confirmDelete && (
            <>
              <button className="btn btn--danger" onClick={onDelete} style={{ background: 'var(--red)', color: 'white' }}>{t('alarm.editor.confirmDelete') || '确认删除'}</button>
              <button className="btn btn--secondary" onClick={() => setConfirmDelete(false)}>{t('alarm.editor.cancel')}</button>
            </>
          )}
          {!confirmDelete && (
            <>
              <div style={{ flex: 1 }} />
              <button className="btn btn--secondary" onClick={onClose}>{t('alarm.editor.cancel')}</button>
              <button className="btn btn--primary" onClick={handleSave}>{t('alarm.editor.save')}</button>
            </>
          )}
        </div>

        {showSoundPicker && createPortal(
          <div className="sound-modal-overlay" onClick={() => setShowSoundPicker(false)}>
            <div className="sound-modal" onClick={e => e.stopPropagation()} style={{ width: 410 }}>
              <div className="sound-modal__header">
                <span className="sound-modal__title">{t('settings.soundPicker.title')}</span>
                <button className="sound-modal__close" onClick={() => setShowSoundPicker(false)}>✕</button>
              </div>
              <div className="sound-modal__body">
                <SoundPicker
                  selected={sound}
                  customSounds={customSounds}
                  onSelect={id => { setSound(id); setShowSoundPicker(false) }}
                  onImport={noopImport}
                  hideImport
                  hideDelete
                  onPreviewStart={onPreviewStart}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>,
    document.body
  )
}
