/**
 * 时钟模式音乐列表
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { SoundOption } from '../hooks/useAudio'

interface Props {
  customSounds: SoundOption[]
  onClose: () => void
  playingId: string | null
  onPlay: (sound: SoundOption, _loop?: boolean, shuffle?: boolean) => void
  onStop: () => void
  playerVolume: number
  onVolumeChange: (vol: number) => void
}

export default function ClockMusicList({ customSounds, onClose, playingId, onPlay, onStop, playerVolume, onVolumeChange }: Props) {
  const { t } = useTranslation()
  const [showHelp, setShowHelp] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const [vinylStopping, setVinylStopping] = useState(false)

  useEffect(() => {
    if (!showHint) return
    const timer = setTimeout(() => setShowHint(false), 5000)
    return () => clearTimeout(timer)
  }, [showHint])

  if (customSounds.length === 0) return null

  const playingTrack = customSounds.find(s => s.id === playingId)
  const vinylRef = useRef<HTMLButtonElement>(null)

  const handleVinylClick = useCallback(() => {
    if (playingId) {
      vinylRef.current?.style.removeProperty('transform')
      vinylRef.current?.style.removeProperty('transition')
      setVinylStopping(true)
      onStop()
      setTimeout(() => setVinylStopping(false), 400)
    } else {
      const idx = Math.floor(Math.random() * customSounds.length)
      onPlay(customSounds[idx], false, true)
    }
  }, [playingId, customSounds, onPlay, onStop])

  useEffect(() => {
    const btn = vinylRef.current
    if (!btn) return
    const handleMove = (e: MouseEvent) => {
      const rect = btn.getBoundingClientRect()
      const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
      const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
      btn.style.transform = `translate(${dx * 2}px, ${dy * 2}px)`
      btn.style.transition = 'transform 0.1s ease-out'
    }
    const handleLeave = () => {
      btn.style.transform = 'translate(0px, 0px)'
      btn.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }
    btn.addEventListener('mousemove', handleMove)
    btn.addEventListener('mouseleave', handleLeave)
    return () => {
      btn.removeEventListener('mousemove', handleMove)
      btn.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  return (
    <div className="sound-modal-overlay" onClick={onClose} onDoubleClick={e => e.stopPropagation()}>
      <div className="music-player" onClick={e => e.stopPropagation()}>
        <div className="music-player__cover">
          <button
            ref={vinylRef}
            className={`music-player__vinyl ${playingId ? 'music-player__vinyl--spinning' : ''} ${vinylStopping ? 'music-player__vinyl--stopping' : ''}`}
            onClick={handleVinylClick}
            onDoubleClick={e => e.stopPropagation()}
            title={playingId ? t('music.stop') || '点击停止' : t('music.shuffle') || '随机播放'}
          >
            <span className="music-player__vinyl-note">♫</span>
          </button>
          <div className="music-player__now">
            {playingTrack ? (
              <>
                <div className="music-player__now-label">{t('music.nowPlaying')}</div>
                <div className="music-player__now-title">{playingTrack.name}</div>
              </>
            ) : (
              <div className="music-player__now-idle">{t('music.playlist') || '播放列表'}</div>
            )}
          </div>
          <div className="music-player__volume">
            <span className="music-player__volume-icon">{
              playerVolume === 0 ? '🔇' : playerVolume < 0.34 ? '🔈' : playerVolume < 0.67 ? '🔉' : '🔊'
            }</span>
            <input
              type="range"
              className="music-player__volume-slider"
              min="0"
              max="100"
              value={Math.round(playerVolume * 100)}
              onChange={e => onVolumeChange(Number(e.target.value) / 100)}
              title={`${t('music.volume') || '音量'} ${Math.round(playerVolume * 100)}%`}
            />
          </div>
          <button className="music-player__help" onClick={() => setShowHelp(!showHelp)} title={t('clock.helpTitle')}>?</button>
        </div>

        <div className="music-player__list">
          {customSounds.map((sound, i) => {
            const isPlaying = playingId === sound.id
            return (
              <div
                key={sound.id}
                className={`music-player__track ${isPlaying ? 'music-player__track--active' : ''}`}
              >
                <span className="music-player__track-num">
                  {isPlaying ? (
                    <span className="music-player__eq">
                      <i /><i /><i />
                    </span>
                  ) : (
                    String(i + 1).padStart(2, '0')
                  )}
                </span>
                <span className="music-player__track-name">{sound.name}</span>
                <button
                  className={`music-player__track-btn ${isPlaying ? 'music-player__track-btn--stop' : ''}`}
                  onClick={() => isPlaying ? onStop() : onPlay(sound)}
                  title={isPlaying ? t('music.stop') || '停止' : t('music.play') || '播放'}
                >
                  {isPlaying ? '■' : '▶'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className={`music-player__hint ${showHint ? '' : 'music-player__hint--hidden'}`}>
        {t('music.backHint') || '点击空白处返回 音乐将继续播放'}
      </div>

      {showHelp && (
        <div className="sound-modal-overlay" onClick={(e) => { e.stopPropagation(); setShowHelp(false) }} style={{ zIndex: 310 }}>
          <div className="sound-modal" onClick={e => e.stopPropagation()} style={{ width: 500 }}>
            <div className="sound-modal__header">
              <span className="sound-modal__title">{t('clock.helpTitle')}</span>
              <button className="sound-modal__close" onClick={() => setShowHelp(false)}>✕</button>
            </div>
            <div className="sound-modal__body" style={{ fontSize: 13, lineHeight: 2, color: 'var(--text-secondary)' }}>
              {(i18n.t('clock.help', { returnObjects: true }) as string[]).map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
