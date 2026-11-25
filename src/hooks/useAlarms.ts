/**
 * Minagi Alarm — 闹钟 Hook
 * 管理所有闹钟状态、存储持久化、每秒检查
 * 「这里的逻辑桃华花了不少心思呢——要处理好重复、跨天和睡眠错过的情况」
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import i18n from '../i18n'

export interface Alarm {
  id: string
  time: string          // "HH:mm"
  label: string
  enabled: boolean
  repeat: RepeatMode
  repeatDays: number[]  // [0-6], 0=周日
  sound: string
  createdAt: number
  /** 最近一次修改时间——补响时用来区分「新设的闹钟」和「真的错过了」 */
  updatedAt?: number
}

export type RepeatMode = 'once' | 'daily' | 'weekdays' | 'weekends' | 'custom'

const STORAGE_KEY = 'minagi-alarm-alarms'
/** 已经响过的闹钟记录，按「哪天哪一场」存，重启后不会补响第二遍 */
const FIRED_KEY = 'minagi-alarm-fired'
/** 贪睡状态也存一份——重启后还能接着数 */
const SNOOZE_KEY = 'minagi-alarm-snooze'
const SNOOZE_MS = 5 * 60 * 1000
/** 补响窗口：睡眠 / 休眠醒来后，错过的闹钟在这个时间内还会响一下 */
const CATCH_UP_MS = 10 * 60 * 1000

interface SnoozeRecord {
  until: number
  alarmId: string
  label: string
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/** 本地日期 → "YYYY-MM-DD" */
function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 这一天是不是该轮到它响——要按「到点的那一天」判断，不能按「现在」 */
function appliesOn(alarm: Alarm, day: Date): boolean {
  if (alarm.repeat === 'once' || alarm.repeat === 'daily') return true

  const weekday = day.getDay()
  switch (alarm.repeat) {
    case 'weekdays': return weekday >= 1 && weekday <= 5
    case 'weekends': return weekday === 0 || weekday === 6
    case 'custom': return alarm.repeatDays.includes(weekday)
  }
  return false
}

// 解析 "HH:mm" 为 [h, m]
function parseTime(time: string): [number, number] {
  const [h, m] = time.split(':').map(Number)
  return [h || 0, m || 0]
}

export function useAlarms() {
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [alertActive, setAlertActive] = useState(false)
  const [alertLabel, setAlertLabel] = useState<string>('')
  const [triggeredAlarmId, setTriggeredAlarmId] = useState<string | null>(null)

  const firedKeys = useRef<Set<string>>(new Set())
  const checkTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const snoozeAlarmIdRef = useRef<string | null>(null)
  const [snoozeUntil, setSnoozeUntil] = useState(0)
  const snoozeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const alertLabelRef = useRef('')

  // 加载「已经响过」的记录——不然重启后十分钟内会重复补响
  useEffect(() => {
    window.electronAPI.storeGet(FIRED_KEY)
      .then(data => {
        if (!Array.isArray(data)) return
        for (const key of data) {
          if (typeof key === 'string') firedKeys.current.add(key)
        }
      })
      .catch(() => {})
  }, [])

  /** 写回记录时顺便扔掉前天的，别让这个列表越攒越长 */
  const persistFired = useCallback(() => {
    const today = new Date()
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
    const keep = new Set([dateKey(today), dateKey(yesterday)])
    for (const key of firedKeys.current) {
      const [, date] = key.split('|')
      if (!keep.has(date)) firedKeys.current.delete(key)
    }
    window.electronAPI.storeSet(FIRED_KEY, [...firedKeys.current]).catch(() => {})
  }, [])

  // 加载闹钟
  const loadedRef = useRef(false)
  useEffect(() => {
    const load = async () => {
      try {
        const data = await window.electronAPI.storeGet(STORAGE_KEY)
        if (Array.isArray(data)) {
          setAlarms(data as Alarm[])
        }
      } catch {
        // 首次使用，还没有存储数据
      } finally {
        // 读完才允许回写——不然启动时那一次空数组会把存储里的闹钟洗掉
        loadedRef.current = true
      }
    }
    load()
  }, [])

  // 保存闹钟（空列表也要存——删掉最后一个闹钟不该在重启后原地复活）
  useEffect(() => {
    if (!loadedRef.current) return
    window.electronAPI.storeSet(STORAGE_KEY, alarms).catch(() => {})
  }, [alarms])

  // 每秒检查闹钟
  useEffect(() => {
    const check = () => {
      const now = new Date()
      const nowMs = now.getTime()

      alarms.forEach(alarm => {
        if (!alarm.enabled) return

        const [hour, minute] = parseTime(alarm.time)
        const effectiveFrom = alarm.updatedAt ?? alarm.createdAt

        // 「仅一次」今天这一场错过了就安静地关掉——拖到明天再响反而吓人一跳
        if (alarm.repeat === 'once') {
          const todayAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0)
          const missed = nowMs - todayAt.getTime()
          if (todayAt.getTime() >= effectiveFrom && missed >= CATCH_UP_MS) {
            setAlarms(prev => prev.map(a =>
              a.id === alarm.id ? { ...a, enabled: false } : a
            ))
            return
          }
        }

        // 找「最近一次已经到点」的那一场：今天正常，刚过午夜时也回头看昨天的
        let occurrence: Date | null = null
        for (const dayOffset of [0, -1]) {
          const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset)
          if (!appliesOn(alarm, day)) continue

          const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0)
          const passed = nowMs - at.getTime()
          if (passed < 0 || passed >= CATCH_UP_MS) continue

          occurrence = at
          break
        }
        if (!occurrence) return

        // 刚设好、时间就已经过去了——这是「给下一场准备的」，不是「错过了」
        if (occurrence.getTime() < effectiveFrom) return

        // 同一场闹钟只响一次，记录按日期存，重启后也认得
        const key = `${alarm.id}|${dateKey(occurrence)}|${alarm.time}`
        if (firedKeys.current.has(key)) return
        firedKeys.current.add(key)
        persistFired()

        setTriggeredAlarmId(alarm.id)
        snoozeAlarmIdRef.current = alarm.id
        // 文案走 i18n——闹钟响的那一刻才取，切了语言就是新的那条
        setAlertLabel(alarm.label || i18n.t('alarm.alert.title'))
        setAlertActive(true)
        // 发送系统通知——窗口隐藏到托盘时用户也能收到
        window.electronAPI.showNotification(
          `⏰ ${alarm.time}`,
          alarm.label || i18n.t('alarm.notification'),
        )

        // 「仅一次」响过就关掉，等下一场到点再开
        if (alarm.repeat === 'once') {
          setAlarms(prev => prev.map(a =>
            a.id === alarm.id ? { ...a, enabled: false } : a
          ))
        }
      })
    }

    // 首次检查 + 每秒检查（睡眠醒来也能马上补上）
    check()
    checkTimer.current = setInterval(check, 1000)

    return () => {
      if (checkTimer.current) clearInterval(checkTimer.current)
    }
  }, [alarms, persistFired])

  const addAlarm = useCallback((alarm: Omit<Alarm, 'id' | 'createdAt'>) => {
    const newAlarm: Alarm = {
      ...alarm,
      id: generateId(),
      createdAt: Date.now(),
    }
    setAlarms(prev => [...prev, newAlarm].sort((a, b) => {
      const [ah, am] = parseTime(a.time)
      const [bh, bm] = parseTime(b.time)
      return ah * 60 + am - (bh * 60 + bm)
    }))
  }, [])

  const updateAlarm = useCallback((id: string, updates: Partial<Alarm>) => {
    const now = Date.now()
    setAlarms(prev => prev.map(a =>
      a.id === id ? { ...a, ...updates, updatedAt: now } : a
    ).sort((a, b) => {
      const [ah, am] = parseTime(a.time)
      const [bh, bm] = parseTime(b.time)
      return ah * 60 + am - (bh * 60 + bm)
    }))
  }, [])

  const deleteAlarm = useCallback((id: string) => {
    setAlarms(prev => prev.filter(a => a.id !== id))
  }, [])

  const toggleAlarm = useCallback((id: string) => {
    const now = Date.now()
    setAlarms(prev => prev.map(a =>
      a.id === id ? { ...a, enabled: !a.enabled, updatedAt: now } : a
    ))
  }, [])

  const clearSnoozeRecord = useCallback(() => {
    window.electronAPI.storeSet(SNOOZE_KEY, null).catch(() => {})
  }, [])

  const dismissAlert = useCallback(() => {
    setAlertActive(false)
    setTriggeredAlarmId(null)
    setSnoozeUntil(0)
    snoozeAlarmIdRef.current = null
    clearSnoozeRecord()
    if (snoozeTimerRef.current) { clearTimeout(snoozeTimerRef.current); snoozeTimerRef.current = null }
  }, [clearSnoozeRecord])

  // 同步 alertLabel 到 ref，确保 setTimeout 闭包里拿到最新值
  useEffect(() => {
    alertLabelRef.current = alertLabel
  }, [alertLabel])

  /** 贪睡到点——把弹窗和音效重新叫起来 */
  const ringSnoozedAlarm = useCallback((alarmId: string | null, label: string) => {
    setSnoozeUntil(0)
    setAlertLabel(label || i18n.t('alarm.alert.title'))
    setTriggeredAlarmId(alarmId)  // 恢复闹钟 ID，这样 App.tsx 的 alertSoundRef 能拿到正确的音效
    setAlertActive(true)
    snoozeTimerRef.current = null
  }, [])

  const snoozeAlert = useCallback(() => {
    const label = alertLabelRef.current
    const alarmId = snoozeAlarmIdRef.current  // 记住是哪个闹钟被贪睡
    const until = Date.now() + SNOOZE_MS
    setSnoozeUntil(until)
    setAlertActive(false)
    setTriggeredAlarmId(null)
    // 记到存储里——应用重启后还能接上这次贪睡
    window.electronAPI.storeSet(SNOOZE_KEY, { until, alarmId, label }).catch(() => {})
    // 5分钟后用独立定时器再次触发
    if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current)
    snoozeTimerRef.current = setTimeout(() => {
      clearSnoozeRecord()
      ringSnoozedAlarm(alarmId, label)
    }, SNOOZE_MS)
  }, [clearSnoozeRecord, ringSnoozedAlarm])

  // 启动时接上没走完的贪睡
  useEffect(() => {
    let cancelled = false
    window.electronAPI.storeGet(SNOOZE_KEY).then(data => {
      if (cancelled || !data || typeof data !== 'object') return
      const record = data as Partial<SnoozeRecord>
      if (typeof record.until !== 'number' || typeof record.alarmId !== 'string') return

      const label = record.label || i18n.t('alarm.alert.title')
      const left = record.until - Date.now()

      if (left > 0) {
        setSnoozeUntil(record.until)
        setAlertLabel(label)
        snoozeAlarmIdRef.current = record.alarmId
        snoozeTimerRef.current = setTimeout(() => {
          clearSnoozeRecord()
          ringSnoozedAlarm(record.alarmId!, label)
        }, left)
        return
      }

      // 已经到点了——十分钟内就当刚响过，补上；太久就算了
      clearSnoozeRecord()
      if (left > -CATCH_UP_MS) ringSnoozedAlarm(record.alarmId, label)
    }).catch(() => {})

    return () => {
      cancelled = true
      if (snoozeTimerRef.current) {
        clearTimeout(snoozeTimerRef.current)
        snoozeTimerRef.current = null
      }
    }
  }, [clearSnoozeRecord, ringSnoozedAlarm])

  return {
    alarms,
    addAlarm,
    updateAlarm,
    deleteAlarm,
    toggleAlarm,
    alertActive,
    alertLabel,
    triggeredAlarmId,
    snoozeUntil,
    dismissAlert,
    snoozeAlert,
  }
}
