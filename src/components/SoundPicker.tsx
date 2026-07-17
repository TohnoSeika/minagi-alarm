/**
 * 提示音选择器
 * 列出内置提示音 + 已导入的自定义音频，支持预览、导入、删除
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { BUILTIN_SOUNDS, useAudio, SoundOption } from '../hooks/useAudio'

interface Props {
  selected: string
  customSounds: SoundOption[]
  onSelect: (soundId: string) => void
  onImport: (sound: SoundOption) => void
  onRemove?: (soundId: string) => void
  onPreviewStart?: () => void
  hideImport?: boolean
  hideDelete?: boolean
}

/** 获取提示音的显示名称（内置音用翻译，自定义音用原名） */
function useSoundName(sound: SoundOption): string {
  const { t } = useTranslation()
  if (sound.source === 'builtin') {
    const translated = t(`sounds.${sound.id}`, { defaultValue: sound.name })
    return translated || sound.name
  }
  return sound.name
}

export default function SoundPicker({ selected, customSounds, onSelect, onImport, onRemove, onPreviewStart, hideImport, hideDelete }: Props) {
  const { t } = useTranslation()
  const { previewSound, stopSound, setOnAudioEnded } = useAudio()
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SoundOption | null>(null)
  const autoResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      stopSound()
      if (autoResetRef.current) { clearTimeout(autoResetRef.current); autoResetRef.current = null }
      setOnAudioEnded(null)
    }
  }, [stopSound, setOnAudioEnded])

  const allSounds = [...BUILTIN_SOUNDS, ...customSounds]

  const BUILTIN_DURATIONS: Record<string, number> = {
    chime: 1500, gentle: 2200, bell: 2500, birds: 2000, piano: 3300,
  }

  const clearAutoReset = useCallback(() => {
    if (autoResetRef.current) { clearTimeout(autoResetRef.current); autoResetRef.current = null }
    setOnAudioEnded(null)
  }, [setOnAudioEnded])

  const handlePreview = useCallback((sound: SoundOption) => {
    if (playingId === sound.id) {
      clearAutoReset()
      stopSound()
      setPlayingId(null)
    } else {
      clearAutoReset()
      stopSound()
      setPlayingId(sound.id)
      onPreviewStart?.()
      previewSound(sound.id, sound.path)

      if (sound.source === 'builtin') {
        const duration = BUILTIN_DURATIONS[sound.id] || 2000
        autoResetRef.current = setTimeout(() => {
          setPlayingId(null)
          autoResetRef.current = null
        }, duration)
      } else {
        setOnAudioEnded(() => {
          setPlayingId(null)
        })
      }
    }
  }, [playingId, previewSound, stopSound, onPreviewStart, clearAutoReset, setOnAudioEnded])

  const handleImport = useCallback(async () => {
    setImporting(true)
    try {
      const path = await window.electronAPI.openAudioDialog()
      if (path) {
        const fileName = path.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '')
        const id = `custom-${Date.now()}`
        onImport({ id, name: `🎵 ${fileName}`, source: 'custom', path })
        onSelect(id)
      }
    } catch {
      // 用户取消
    } finally {
      setImporting(false)
    }
  }, [onImport, onSelect])

  return (
    <div className="sound-picker">
      {allSounds.map(sound => (
        <SoundOptionRow
          key={sound.id}
          sound={sound}
          selected={selected === sound.id}
          playing={playingId === sound.id}
          onSelect={() => onSelect(sound.id)}
          onPreview={() => handlePreview(sound)}
          onDelete={sound.source === 'custom' && onRemove && !hideDelete ? () => setDeleteTarget(sound) : undefined}
          t={t}
        />
      ))}

      {!hideImport && (
        <button className="sound-import" onClick={handleImport} disabled={importing}>
          {importing ? t('soundPicker.importing') : t('soundPicker.import')}
        </button>
      )}

      {deleteTarget && createPortal(
        <div className="sticky-confirm-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="sticky-confirm" onClick={e => e.stopPropagation()}>
            <div className="sticky-confirm__icon">🎵</div>
            <div className="sticky-confirm__title">{t('soundPicker.deleteConfirm')}</div>
            <div className="sticky-confirm__preview" style={{ textAlign: 'center' }}>
              {deleteTarget.name}
            </div>
            <div className="sticky-confirm__actions">
              <button className="sticky-confirm__btn sticky-confirm__btn--cancel" onClick={() => setDeleteTarget(null)}>{t('soundPicker.deleteCancel')}</button>
              <button className="sticky-confirm__btn sticky-confirm__btn--danger" onClick={() => {
                if (selected === deleteTarget.id) onSelect('chime')
                if (onRemove) onRemove(deleteTarget.id)
                if (playingId === deleteTarget.id) { stopSound(); setPlayingId(null) }
                setDeleteTarget(null)
              }}>{t('soundPicker.deleteConfirmBtn')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

/** 单行音效选项（提取为子组件以便使用 useSoundName） */
function SoundOptionRow({ sound, selected, playing, onSelect, onPreview, onDelete, t }: {
  sound: SoundOption
  selected: boolean
  playing: boolean
  onSelect: () => void
  onPreview: () => void
  onDelete?: () => void
  t: (key: string, opts?: any) => string
}) {
  const displayName = useSoundName(sound)

  return (
    <div
      className={`sound-option ${selected ? 'sound-option--selected' : ''}`}
      onClick={onSelect}
    >
      <div className="sound-option__radio" />
      <span className="sound-option__name">{displayName}</span>
      <button
        className="sound-option__preview"
        onClick={e => { e.stopPropagation(); onPreview() }}
        title={playing ? t('soundPicker.stop') : t('soundPicker.preview')}
      >
        {playing ? '■' : '▶'}
      </button>
      {onDelete && (
        <button
          className="sound-option__delete"
          onClick={e => { e.stopPropagation(); onDelete() }}
          title={t('soundPicker.deleteCancel')}
        >
          ✕
        </button>
      )}
    </div>
  )
}
