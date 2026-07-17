import { useTranslation } from 'react-i18next'

type Page = 'alarm' | 'timer' | 'settings'

interface Props {
  current: Page
  onChange: (page: Page) => void
}

export default function TabBar({ current, onChange }: Props) {
  const { t } = useTranslation()
  const tabs: [Page, string, string][] = [
    ['alarm', '⏰', t('tab.alarm')],
    ['timer', '⏱', t('tab.timer')],
    ['settings', '⚙', t('tab.settings')],
  ]
  return (
    <div className="tabbar">
      {tabs.map(([key, icon, label]) => (
        <button
          key={key}
          className={`tabbar__btn ${current === key ? 'tabbar__btn--active' : ''}`}
          onClick={() => onChange(key)}
        >
          <span className="tabbar__icon">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
