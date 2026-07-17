/**
 * 滚轮时间选择器
 * 鼠标滚轮调整时/分，24小时制
 */

import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  hour: number
  minute: number
  onChange: (hour: number, minute: number) => void
}

function pad(n: number) { return String(n).padStart(2, '0') }

export default function TimeWheel({ hour, minute, onChange }: Props) {
  const { t } = useTranslation()
  const hRef = useRef<HTMLDivElement>(null)
  const mRef = useRef<HTMLDivElement>(null)

  const onWheel = (field: 'h' | 'm', delta: number) => {
    const dir = delta > 0 ? -1 : 1
    if (field === 'h') {
      onChange((hour + dir + 24) % 24, minute)
    } else {
      onChange(hour, (minute + dir + 60) % 60)
    }
  }

  return (
    <div className="timewheel">
      <div className="timewheel__col"
        ref={hRef}
        onWheel={e => { e.preventDefault(); onWheel('h', e.deltaY) }}
      >
        <button className="timewheel__arrow" onClick={() => onChange((hour - 1 + 24) % 24, minute)}>▲</button>
        <div className="timewheel__val">{pad(hour)}</div>
        <div className="timewheel__label">{t('timeWheel.hour')}</div>
        <button className="timewheel__arrow" onClick={() => onChange((hour + 1) % 24, minute)}>▼</button>
      </div>

      <div className="timewheel__sep">:</div>

      <div className="timewheel__col"
        ref={mRef}
        onWheel={e => { e.preventDefault(); onWheel('m', e.deltaY) }}
      >
        <button className="timewheel__arrow" onClick={() => onChange(hour, (minute - 1 + 60) % 60)}>▲</button>
        <div className="timewheel__val">{pad(minute)}</div>
        <div className="timewheel__label">{t('timeWheel.minute')}</div>
        <button className="timewheel__arrow" onClick={() => onChange(hour, (minute + 1) % 60)}>▼</button>
      </div>
    </div>
  )
}
