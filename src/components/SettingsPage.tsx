/**
 * Minagi Alarm — 设置页面
 * 全局提示音、背景图片、透明度、托盘行为
 */

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import SoundPicker from './SoundPicker'
import { SoundOption } from '../hooks/useAudio'
import i18n, { LANGUAGES } from '../i18n'

export interface SettingsData {
  sound: string
  opacity: number
  wallpaperOpacity: number
  minimizeToTray: boolean
  closeToTray: boolean
  startupPage: 'alarm' | 'timer' | 'settings' | 'clock'
  showClockHelp: boolean
  showSeconds: boolean
  language: string
  bgImage: string
  bgOpacity: number
  bgScale: number
  bgOffsetX: number
  bgOffsetY: number
  themeColor: string
  sakuraColor: string
  sakuraEnabled: boolean
  sakuraOpacity: number
  autoLaunch: boolean
}

interface Props {
  customSounds: SoundOption[]
  onImportSound: (sound: SoundOption) => void
  onRemoveSound: (id: string) => void
  settings: SettingsData
  onSettingsChange: (settings: SettingsData) => void
  onOpenPreview: (image: string) => void
  onRestoreDefaultBg: () => void
  onPreviewStart?: () => void
  wallpaperMode?: boolean
}

const SOUND_NAMES: Record<string, string> = {
  chime: '🎐 风铃', gentle: '🌸 温柔', bell: '⏰ 经典',
  birds: '🐦 晨曦', piano: '🎹 琴声',
}

export default function SettingsPage({ customSounds, onImportSound, onRemoveSound, settings, onSettingsChange, onOpenPreview, onRestoreDefaultBg, onPreviewStart, wallpaperMode }: Props) {
  const { t } = useTranslation()
  const [showSound, setShowSound] = useState(false)
  const [showLanguage, setShowLanguage] = useState(false)
  const [showSettingsHelp, setShowSettingsHelp] = useState(false)

  const update = useCallback((patch: Partial<SettingsData>) => {
    onSettingsChange({ ...settings, ...patch })
  }, [settings, onSettingsChange])

  useEffect(() => {
    window.electronAPI.setOpacity(settings.opacity)
  }, [settings.opacity])

  const isBuiltin = settings.sound in SOUND_NAMES
  const currentName = isBuiltin
    ? (t(`sounds.${settings.sound}` as any) || SOUND_NAMES[settings.sound])
    : (customSounds.find(s => s.id === settings.sound)?.name || '—')

  const handlePickBg = async () => {
    const path = await window.electronAPI.openImageDialog()
    if (!path) return
    const dataUrl = await window.electronAPI.imageRead(path)
    if (dataUrl) onOpenPreview(dataUrl)
  }

  return (
    <div className="settings-page">

      {/* 提示音 */}
      <div className="settings-section">
        <div className="settings-section__title">{t('settings.sound')}</div>
        <div className="settings-section__desc">{t('settings.soundDesc')}</div>
        <button className="settings-sound-btn" onClick={() => setShowSound(true)}>
          {t('settings.current')}：{currentName}
        </button>
      </div>

      {/* 软件语言 */}
      <div className="settings-section">
        <div className="settings-section__title" style={{ fontSize: 14 }}>{t('settings.language')}</div>
        <div className="settings-section__desc">{t('settings.languageDesc')}</div>
        <button className="settings-sound-btn" onClick={() => setShowLanguage(true)}>
          {t('settings.current')}：{LANGUAGES.find(l => l.code === settings.language)?.label || settings.language}
        </button>
      </div>

      {/* 界面视觉 */}
      <div className="settings-section">
        <div className="settings-section__title">{t('settings.visual')}</div>

        {/* 背景图片 */}
        <div className="settings-section__desc" style={{ marginTop: 4 }}>
          {settings.bgImage ? t('settings.bgImage.set') : t('settings.bgImage.notSet')}
        </div>

        <div className="settings-row">
          <button className="btn btn--secondary" onClick={handlePickBg} style={{ fontSize: 11 }}>
            📂 {settings.bgImage ? t('settings.bgImage.change') : t('settings.bgImage.select')}
          </button>
          {settings.bgImage && (
            <button className="btn btn--ghost" onClick={() => onOpenPreview(settings.bgImage)}
              style={{ fontSize: 11 }}>{t('settings.bgImage.adjust')}</button>
          )}
          <button className="btn btn--ghost" onClick={onRestoreDefaultBg}
            style={{ fontSize: 11 }}>{t('settings.bgImage.default')}</button>
          {settings.bgImage && (
              <button className="btn btn--ghost" onClick={() => update({ bgImage: '', bgScale: 1, bgOffsetX: 0, bgOffsetY: 0 })}
                style={{ fontSize: 11, color: 'var(--red)' }}>{t('settings.bgImage.clear')}</button>
          )}
        </div>

        {settings.bgImage && (
          <>
            <div className="form-label" style={{ marginTop: 8 }}>
              {t('settings.bgImage.opacity')} {Math.round(settings.bgOpacity * 100)}%
            </div>
            <input className="settings-slider" type="range" min="5" max="100"
              value={Math.round(settings.bgOpacity * 100)}
              onChange={e => update({ bgOpacity: parseInt(e.target.value) / 100 })} />
          </>
        )}

        {/* 软件界面透明度 */}
        <div className="form-label" style={{ marginTop: 12 }}>
          {t('settings.opacity')} {Math.round(settings.opacity * 100)}%
        </div>
        <input className="settings-slider" type="range" min="20" max="100"
          value={Math.round(settings.opacity * 100)}
          onChange={e => update({ opacity: parseInt(e.target.value) / 100 })} />

        {/* 桌面模式透明度——桃华专属的桌面质感调节呢 */}
        <div className="form-label" style={{ marginTop: 12 }}>
          {t('settings.wallpaperOpacity')} {Math.round(settings.wallpaperOpacity * 100)}%
          <span className="settings-hint" style={{ marginLeft: 8, fontWeight: 400 }}>
            <span className="settings-hint__text">{t('settings.wallpaperHint')}</span>
          </span>
        </div>
        <input className="settings-slider" type="range" min="20" max="100"
          value={Math.round(settings.wallpaperOpacity * 100)}
          onChange={e => {
            const val = parseInt(e.target.value) / 100
            update({ wallpaperOpacity: val })
            // 拖拽时实时预览桌面模式透明度
            window.electronAPI.setOpacity(val)
          }}
          onMouseUp={() => {
            // 松手后恢复到当前应该显示的透明度
            const restoreTo = wallpaperMode ? settings.wallpaperOpacity : settings.opacity
            window.electronAPI.setOpacity(restoreTo)
          }}
          onTouchEnd={() => {
            const restoreTo = wallpaperMode ? settings.wallpaperOpacity : settings.opacity
            window.electronAPI.setOpacity(restoreTo)
          }}
        />

      </div>

      {/* 主题颜色 */}
      <div className="settings-section">
        <div className="settings-section__title">{t('settings.theme')}</div>
        <div className="settings-section__desc">{t('settings.themeDesc')}</div>
        <div className="settings-color-row">
          <input type="color" className="settings-color-input"
            value={settings.themeColor}
            onChange={e => update({ themeColor: e.target.value })} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('settings.themeColor')}</span>
          <button className="btn btn--ghost" style={{ fontSize: 10 }}
            onClick={() => update({ themeColor: '#F8A5B6' })}>{t('settings.restoreDefault')}</button>
        </div>
        <div className="settings-color-row" style={{ marginTop: 6 }}>
          <input type="color" className="settings-color-input"
            value={settings.sakuraColor}
            onChange={e => update({ sakuraColor: e.target.value })} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('settings.sakuraColor')}</span>
          <button className="btn btn--ghost" style={{ fontSize: 10 }}
            onClick={() => update({ sakuraColor: '#F8A5B6' })}>{t('settings.restoreDefault')}</button>
          <div className="settings-color-opacity">
            <input className="settings-slider" type="range" min="5" max="100"
              title={t('settings.sakuraColor')}
              value={Math.round(settings.sakuraOpacity * 100)}
              onChange={e => update({ sakuraOpacity: parseInt(e.target.value) / 100 })} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>
              {Math.round(settings.sakuraOpacity * 100)}%
            </span>
          </div>
          <div className={`toggle ${settings.sakuraEnabled ? 'toggle--on' : ''}`}
            onClick={() => update({ sakuraEnabled: !settings.sakuraEnabled })}
            title={t('settings.themeDesc')} />
        </div>
      </div>

      {/* 其他选项 */}
      <div className="settings-section">
        <div className="settings-section__title">{t('settings.other')}</div>
        <div className="settings-segmented-row">
          <span className="settings-toggle-row__label">{t('settings.startupPage')}</span>
          <div className="settings-segmented">
            {([
              ['alarm', t('settings.startupAlarm')],
              ['timer', t('settings.startupTimer')],
              ['settings', t('settings.startupSettings')],
              ['clock', t('settings.startupClock')],
            ] as [typeof settings.startupPage, string][]).map(([value, label]) => (
              <button
                key={value}
                className={`settings-segmented__btn ${settings.startupPage === value ? 'settings-segmented__btn--active' : ''}`}
                onClick={() => update({ startupPage: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="settings-toggle-row">
          <span className="settings-toggle-row__label">{t('settings.clockHelp')}</span>
          <span className="settings-hint settings-hint--arrow" onClick={() => setShowSettingsHelp(true)} style={{ cursor: 'pointer' }}>
            <span className="settings-hint__text">{t('settings.viewClockHelp')}</span>
          </span>
          <div className={`toggle ${settings.showClockHelp ? 'toggle--on' : ''}`}
            onClick={() => update({ showClockHelp: !settings.showClockHelp })} />
        </label>
        <label className="settings-toggle-row">
          <span>{t('settings.showSeconds')}</span>
          <div className={`toggle ${settings.showSeconds ? 'toggle--on' : ''}`}
            onClick={() => update({ showSeconds: !settings.showSeconds })} />
        </label>
        <label className="settings-toggle-row">
          <span>{t('settings.autoLaunch')}</span>
          <div className={`toggle ${settings.autoLaunch ? 'toggle--on' : ''}`}
            onClick={() => {
              const next = !settings.autoLaunch
              update({ autoLaunch: next })
              window.electronAPI.setAutoLaunch(next)
            }} />
        </label>
        <label className="settings-toggle-row">
          <span>{t('settings.minimizeToTray')}</span>
          <div className={`toggle ${settings.minimizeToTray ? 'toggle--on' : ''}`}
            onClick={() => update({ minimizeToTray: !settings.minimizeToTray })} />
        </label>
        <label className="settings-toggle-row">
          <span>{t('settings.closeToTray')}</span>
          <div className={`toggle ${settings.closeToTray ? 'toggle--on' : ''}`}
            onClick={() => update({ closeToTray: !settings.closeToTray })} />
        </label>
      </div>

      {/* 语言选择弹窗 */}
      {showLanguage && createPortal(
        <div className="sound-modal-overlay" onClick={() => setShowLanguage(false)}>
          <div className="sound-modal" onClick={e => e.stopPropagation()} style={{ width: 320 }}>
            <div className="sound-modal__header">
              <span className="sound-modal__title">{t('settings.languagePicker.title')}</span>
              <button className="sound-modal__close" onClick={() => setShowLanguage(false)}>✕</button>
            </div>
            <div className="sound-modal__body">
              <div className="sound-picker">
                {LANGUAGES.map(lang => (
                  <div
                    key={lang.code}
                    className={`sound-option ${settings.language === lang.code ? 'sound-option--selected' : ''}`}
                    onClick={() => {
                      update({ language: lang.code })
                      setShowLanguage(false)
                    }}
                  >
                    <div className="sound-option__radio" />
                    <span className="sound-option__name">{lang.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 提示音选择弹窗 */}
      {showSound && createPortal(
        <div className="sound-modal-overlay" onClick={() => setShowSound(false)}>
          <div className="sound-modal" onClick={e => e.stopPropagation()} style={{ width: 410 }}>
            <div className="sound-modal__header">
              <span className="sound-modal__title">{t('settings.soundPicker.title')}</span>
              <button className="sound-modal__close" onClick={() => setShowSound(false)}>✕</button>
            </div>
            <div className="sound-modal__body">
              <SoundPicker
                selected={settings.sound}
                customSounds={customSounds}
                onSelect={id => { update({ sound: id }); setShowSound(false) }}
                onImport={onImportSound}
                onRemove={id => {
                  if (settings.sound === id) update({ sound: 'chime' })
                  onRemoveSound(id)
                }}
                onPreviewStart={onPreviewStart}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 操作说明弹窗 */}
      {showSettingsHelp && createPortal(
        <div className="sound-modal-overlay" onClick={() => setShowSettingsHelp(false)}>
          <div className="sound-modal" onClick={e => e.stopPropagation()} style={{ width: 500 }}>
            <div className="sound-modal__header">
              <span className="sound-modal__title">时钟模式操作说明</span>
              <button className="sound-modal__close" onClick={() => setShowSettingsHelp(false)}>✕</button>
            </div>
            <div className="sound-modal__body" style={{ fontSize: 13, lineHeight: 2, color: 'var(--text-secondary)' }}>
              {(i18n.t('clock.help', { returnObjects: true }) as string[]).map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 关于 */}
      <div className="settings-section settings-about">
        <div className="settings-about__title-row">
          <span className="settings-about__icon">✦</span>
          <span className="settings-about__title">Minagi Alarm</span>
          <span className="settings-about__version">V1.4</span>
        </div>
        <div className="settings-about__line">Developed by <a href="https://space.bilibili.com/14816" className="settings-about__link" target="_blank" rel="noreferrer">Tohno Seika</a></div>
        <div className="settings-about__line">im minagi , im everywhere</div>
        <div className="settings-about__line">{t('settings.about.freeware')}</div>
        <div className="settings-about__line">{t('settings.about.iconCredit')}</div>
        <div className="settings-about__line">{t('settings.about.fontCredit')}</div>
      </div>
    </div>
  )
}
