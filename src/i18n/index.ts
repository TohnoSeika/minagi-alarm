/**
 * Minagi Alarm — i18n 配置
 * 桃华帮 Minagi 做的国际化——四种语言 ✨
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from './zh-CN.json'
import zhTW from './zh-TW.json'
import en from './en.json'
import ja from './ja.json'

export const LANGUAGES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en',    label: 'English' },
  { code: 'ja',    label: '日本語' },
]

export const DEFAULT_LANGUAGE = 'zh-CN'

/** 根据浏览器/系统语言自动匹配支持的语言 */
export function detectSystemLanguage(): string {
  const lang = (navigator.language || '').toLowerCase().replace('-', '-')

  // 简体中文
  if (lang.startsWith('zh-cn') || lang.startsWith('zh-hans') || lang === 'zh') return 'zh-CN'
  // 繁体中文
  if (lang.startsWith('zh-tw') || lang.startsWith('zh-hk') || lang.startsWith('zh-mo') || lang.startsWith('zh-hant')) return 'zh-TW'
  // 日语
  if (lang.startsWith('ja')) return 'ja'
  // 英语（含所有英文变体）
  if (lang.startsWith('en')) return 'en'
  // 其他语言——默认英语
  return 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'zh-TW': { translation: zhTW },
    'en':    { translation: en },
    'ja':    { translation: ja },
  },
  lng: detectSystemLanguage(),
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
  returnObjects: true,
})

export default i18n
