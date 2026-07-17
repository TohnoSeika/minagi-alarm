import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Alarm } from '../hooks/useAlarms'
import { SoundOption } from '../hooks/useAudio'
import AlarmItem from './AlarmItem'
import AlarmEditor from './AlarmEditor'

interface Props {
  alarms: Alarm[]
  onAdd: (alarm: Omit<Alarm, 'id' | 'createdAt'>) => void
  onUpdate: (id: string, updates: Partial<Alarm>) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
  globalSound?: string
  customSounds?: SoundOption[]
  onPreviewStart?: () => void
}

export default function AlarmList({ alarms, onAdd, onUpdate, onDelete, onToggle, globalSound, customSounds, onPreviewStart }: Props) {
  const { t } = useTranslation()
  const [showEditor, setShowEditor] = useState(false)
  const [editingAlarm, setEditingAlarm] = useState<Alarm | null>(null)

  const handleClick = (alarm: Alarm) => { setEditingAlarm(alarm); setShowEditor(true) }
  const handleAdd = () => { setEditingAlarm(null); setShowEditor(true) }

  const handleSave = (data: Omit<Alarm, 'id' | 'createdAt'>) => {
    if (editingAlarm) { onUpdate(editingAlarm.id, data) }
    else { onAdd(data) }
    setShowEditor(false)
    setEditingAlarm(null)
  }

  // 悬浮按钮磁吸效果
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

  return (
    <>
      <div className="alarm-page">
        <div className="alarm-list">
          {alarms.length === 0 ? (
            <div className="alarm-list__empty">
              <div className="alarm-list__empty-icon">⏰</div>
              <div className="alarm-list__empty-text">
                {t('alarm.emptyTitle')}～<br />{t('alarm.emptyHint')}
              </div>
            </div>
          ) : (
            alarms.map(alarm => (
              <AlarmItem key={alarm.id} alarm={alarm}
                onUpdate={onUpdate} onDelete={onDelete}
                onToggle={onToggle} onClick={handleClick}
                customSounds={customSounds} />
            ))
          )}
          {/* 底部留白，避免最后一个闹钟被悬浮按钮遮挡 */}
          <div className="alarm-list__bottom-spacer" />
        </div>
        <button
          className="add-fab"
          ref={fabRef}
          onClick={handleAdd}
          onMouseMove={handleFabMove}
          onMouseLeave={handleFabLeave}
          title={t('alarm.add')}
          style={{
            transform: `translate(calc(-50% + ${magnet.x}px), ${magnet.y}px)`,
            transition: leaving
              ? 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
              : 'transform 0.1s ease-out',
          }}
        >
          <span>+</span>
        </button>
      </div>

      {showEditor && (
        <AlarmEditor
          alarm={editingAlarm}
          onSave={handleSave}
          onClose={() => { setShowEditor(false); setEditingAlarm(null) }}
          onDelete={editingAlarm ? () => { onDelete(editingAlarm.id); setShowEditor(false); setEditingAlarm(null) } : undefined}
          globalSound={globalSound}
          customSounds={customSounds}
          onPreviewStart={onPreviewStart}
        />
      )}
    </>
  )
}
