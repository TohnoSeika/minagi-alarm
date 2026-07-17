/**
 * Minagi Alarm — 闹钟 Hook
 * 管理所有闹钟状态、存储持久化、每分钟检查
 * 「这里的逻辑桃华花了不少心思呢——要处理好重复、跨天和各种边界情况」
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export interface Alarm {
  id: string
  time: string          // "HH:mm"
  label: string
  enabled: boolean
  repeat: RepeatMode
  repeatDays: number[]  // [0-6], 0=周日
  sound: string
  createdAt: number
}

export type RepeatMode = 'once' | 'daily' | 'weekdays' | 'weekends' | 'custom'

const STORAGE_KEY = 'minagi-alarm-alarms'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function repeatLabel(alarm: Alarm): string {
  switch (alarm.repeat) {
    case 'once': return '仅一次'
    case 'daily': return '每天'
    case 'weekdays': return '工作日'
    case 'weekends': return '周末'
    case 'custom': {
      const names = ['日', '一', '二', '三', '四', '五', '六']
      return alarm.repeatDays.map(d => names[d]).join(' ')
    }
  }
}

function shouldTriggerToday(alarm: Alarm): boolean {
  if (!alarm.enabled) return false
  if (alarm.repeat === 'once') return true

  const today = new Date().getDay()
  switch (alarm.repeat) {
    case 'daily': return true
    case 'weekdays': return today >= 1 && today <= 5
    case 'weekends': return today === 0 || today === 6
    case 'custom': return alarm.repeatDays.includes(today)
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

  const alertedSet = useRef<Set<string>>(new Set())
  const checkTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const snoozeAlarmIdRef = useRef<string | null>(null)

  // 加载闹钟
  useEffect(() => {
    const load = async () => {
      try {
        const data = await window.electronAPI.storeGet(STORAGE_KEY)
        if (Array.isArray(data) && data.length > 0) {
          setAlarms(data as Alarm[])
        }
      } catch {
        // 首次使用，还没有存储数据
      }
    }
    load()
  }, [])

  // 保存闹钟
  useEffect(() => {
    if (alarms.length > 0) {
      window.electronAPI.storeSet(STORAGE_KEY, alarms)
    }
  }, [alarms])

  // 每分钟检查闹钟
  useEffect(() => {
    const check = () => {
      const now = new Date()
      const h = now.getHours()
      const m = now.getMinutes()

      // 只在分钟变化时检查（避免重复触发）
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

      alarms.forEach(alarm => {
        if (!alarm.enabled) return
        if (alarm.time !== timeStr) return
        if (!shouldTriggerToday(alarm)) return

        // 今天已经响过这个闹钟了吗？
        const key = `${alarm.id}-${timeStr}`
        if (alertedSet.current.has(key)) return

        alertedSet.current.add(key)
        setTriggeredAlarmId(alarm.id)
        snoozeAlarmIdRef.current = alarm.id
        setAlertLabel(alarm.label || '闹钟')
        setAlertActive(true)
        // 发送系统通知——窗口隐藏到托盘时用户也能收到
        window.electronAPI.showNotification(
          `⏰ ${alarm.time}`,
          alarm.label || '闹钟时间到了',
        )
      })

      // 清理过期的 alert 记录（跨天后）
      if (m === 0 && h === 0) {
        alertedSet.current.clear()
      }
    }

    // 首次检查 + 每秒检查（确保准时响铃）
    check()
    checkTimer.current = setInterval(check, 1000)

    return () => {
      if (checkTimer.current) clearInterval(checkTimer.current)
    }
  }, [alarms])

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
    setAlarms(prev => prev.map(a =>
      a.id === id ? { ...a, ...updates } : a
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
    setAlarms(prev => prev.map(a =>
      a.id === id ? { ...a, enabled: !a.enabled } : a
    ))
  }, [])

  const dismissAlert = useCallback(() => {
    setAlertActive(false)
    setTriggeredAlarmId(null)
    setSnoozeUntil(0)
    snoozeAlarmIdRef.current = null
    if (snoozeTimerRef.current) { clearTimeout(snoozeTimerRef.current); snoozeTimerRef.current = null }
  }, [])

  const [snoozeUntil, setSnoozeUntil] = useState(0)
  const snoozeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const alertLabelRef = useRef('')

  // 同步 alertLabel 到 ref，确保 setTimeout 闭包里拿到最新值
  useEffect(() => {
    alertLabelRef.current = alertLabel
  }, [alertLabel])

  const snoozeAlert = useCallback(() => {
    const label = alertLabelRef.current
    const alarmId = snoozeAlarmIdRef.current  // 记住是哪个闹钟被贪睡
    const until = Date.now() + 5 * 60 * 1000
    setSnoozeUntil(until)
    setAlertActive(false)
    setTriggeredAlarmId(null)
    // 5分钟后用独立定时器再次触发
    if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current)
    snoozeTimerRef.current = setTimeout(() => {
      setSnoozeUntil(0)
      setAlertLabel(label)
      setTriggeredAlarmId(alarmId)  // 恢复闹钟 ID，这样 App.tsx 的 alertSoundRef 能拿到正确的音效
      setAlertActive(true)
      snoozeTimerRef.current = null
    }, 5 * 60 * 1000)
  }, [])

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
    repeatLabel,
  }
}
