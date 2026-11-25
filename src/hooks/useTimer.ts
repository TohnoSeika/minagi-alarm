/**
 * Minagi Alarm — 倒计时 Hook
 * 使用绝对时间戳，后台窗口也能准确计时
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import i18n from '../i18n'

export interface TimerState {
  totalSeconds: number
  remainingSeconds: number
  isRunning: boolean
  isPaused: boolean
}

export function useTimer() {
  const [totalSeconds, setTotalSeconds] = useState(300)
  const [remainingSeconds, setRemainingSeconds] = useState(300)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [alertActive, setAlertActive] = useState(false)
  const [reminderText, setReminderText] = useState('')

  // 用 ref 存目标结束时间戳，不受 state 闭包影响
  const endTimeRef = useRef(0)  // Date.now() + remainingMs
  const notifiedRef = useRef(false)  // 防止 250ms tick 重复触发通知
  const reminderRef = useRef('')  // tick 闭包内读取最新提醒文本

  /** 从 endTimeRef 读取当前剩余秒数 */
  const tick = useCallback(() => {
    const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
    setRemainingSeconds(remaining)
    if (remaining <= 0) {
      setIsRunning(false)
      setIsPaused(false)
      setAlertActive(true)
      // 发送系统通知——窗口隐藏到托盘时用户也能收到
      if (!notifiedRef.current) {
        notifiedRef.current = true
        // 文案走 i18n——倒计时结束那一刻才取
        const msg = reminderRef.current || i18n.t('timer.notification')
        window.electronAPI.showNotification(
          `⏱ ${i18n.t('timer.finishedLabel')}`,
          msg,
        )
      }
    }
  }, [])

  /** 启动计时 */
  useEffect(() => {
    if (!isRunning || isPaused) return
    // 重置结束时间
    endTimeRef.current = Date.now() + remainingSeconds * 1000
    // 高频刷新保证 UI 流畅，用绝对时间保证精度
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [isRunning, isPaused]) // 注意：不依赖 remainingSeconds，避免重启 interval

  const setTime = useCallback((h: number, m: number, s: number) => {
    const total = (h || 0) * 3600 + (m || 0) * 60 + (s || 0)
    if (total <= 0) return
    setIsRunning(false)
    setIsPaused(false)
    endTimeRef.current = 0
    notifiedRef.current = false
    setTotalSeconds(total)
    setRemainingSeconds(total)
  }, [])

  const start = useCallback(() => {
    if (remainingSeconds <= 0) return
    // 不清空 endTimeRef——如果是从暂停恢复，保留原来的结束时间
    if (!isPaused) {
      endTimeRef.current = 0  // 全新开始
    }
    setIsRunning(true)
    setIsPaused(false)
  }, [remainingSeconds, isPaused])

  const pause = useCallback(() => {
    // 保存当前剩余，下次 start 会重新计算 endTimeRef
    setIsPaused(true)
    setIsRunning(false)
  }, [])

  const reset = useCallback(() => {
    setIsRunning(false)
    setIsPaused(false)
    endTimeRef.current = 0
    notifiedRef.current = false
    setRemainingSeconds(totalSeconds)
  }, [totalSeconds])

  const setReminder = useCallback((text: string) => {
    setReminderText(text)
    reminderRef.current = text
  }, [])

  const dismissAlert = useCallback(() => {
    setAlertActive(false)
    notifiedRef.current = false
  }, [])

  return {
    totalSeconds,
    remainingSeconds,
    isRunning,
    isPaused,
    setTime,
    start,
    pause,
    reset,
    alertActive,
    reminderText,
    setReminderText: setReminder,
    dismissAlert,
  }
}
