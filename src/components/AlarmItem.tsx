/**
 * 闹钟卡片组件
 * 显示单个闹钟的时间、标签、重复模式，带开关和删除
 */

import i18n from '../i18n'
import { Alarm, RepeatMode } from '../hooks/useAlarms'
import { BUILTIN_SOUNDS } from '../hooks/useAudio'

interface Props {
  alarm: Alarm
  onUpdate: (id: string, updates: Partial<Alarm>) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
  onClick: (alarm: Alarm) => void
  customSounds?: { id: string; name: string }[]
}

function repeatLabel(repeat: RepeatMode, repeatDays: number[]): string {
  const t = i18n.t.bind(i18n)
  switch (repeat) {
    case 'once': return t('alarm.repeat.once')
    case 'daily': return t('alarm.repeat.daily')
    case 'weekdays': return t('alarm.repeat.weekdays')
    case 'weekends': return t('alarm.repeat.weekends')
    case 'custom': {
      const wd = t('alarm.weekday', { returnObjects: true }) as Record<string, string>
      const names = [wd.sun, wd.mon, wd.tue, wd.wed, wd.thu, wd.fri, wd.sat]
      return names.filter((_, i) => repeatDays.includes(i)).join('·')
    }
  }
}

function soundName(soundId: string, customSounds?: { id: string; name: string }[]): string {
  const t = i18n.t.bind(i18n)
  const builtin = BUILTIN_SOUNDS.find(s => s.id === soundId)
  if (builtin) return t(`sounds.${soundId}` as any) || builtin.name
  const custom = customSounds?.find(s => s.id === soundId)
  return custom?.name || '—'
}

export default function AlarmItem({ alarm, onDelete, onToggle, onClick, customSounds }: Props) {
  return (
    <div
      className={`alarm-item ${!alarm.enabled ? 'alarm-item--disabled' : ''}`}
      onClick={() => onClick(alarm)}
    >
      <div className="alarm-item__time">{alarm.time}</div>
      <div className="alarm-item__info">
        {alarm.label && (
          <div className="alarm-item__label">{alarm.label}</div>
        )}
        <div className="alarm-item__meta">
          <span className="alarm-item__repeat">
            {repeatLabel(alarm.repeat, alarm.repeatDays)}
          </span>
          <span className="alarm-item__sound-tag">
            {soundName(alarm.sound, customSounds)}
          </span>
        </div>
      </div>

      <div
        className={`toggle ${alarm.enabled ? 'toggle--on' : ''} alarm-item__toggle`}
        onClick={e => {
          e.stopPropagation()
          onToggle(alarm.id)
        }}
      />

    </div>
  )
}
