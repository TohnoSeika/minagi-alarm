/**
 * 快速预设按钮
 * 一键设置常用倒计时时间
 */

import { useTranslation } from 'react-i18next'

interface Props {
  activeSeconds: number
  onSelect: (seconds: number) => void
}

const PRESETS = [
  { key: '1min', seconds: 60 },
  { key: '3min', seconds: 180 },
  { key: '5min', seconds: 300 },
  { key: '10min', seconds: 600 },
  { key: '15min', seconds: 900 },
  { key: '30min', seconds: 1800 },
  { key: '1hour', seconds: 3600 },
]

export default function TimerPresets({ activeSeconds, onSelect }: Props) {
  const { t } = useTranslation()
  return (
    <div className="timer-presets">
      {PRESETS.map(preset => (
        <button
          key={preset.seconds}
          className={`preset-btn ${activeSeconds === preset.seconds ? 'preset-btn--active' : ''}`}
          onClick={() => onSelect(preset.seconds)}
        >
          {t(`timer.presets.${preset.key}`)}
        </button>
      ))}
    </div>
  )
}
