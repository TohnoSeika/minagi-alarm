/**
 * Minagi Alarm — 音频 Hook
 * 用 Web Audio API 生成内置提示音 + 播放自定义音频文件
 */

import { useCallback, useRef, useMemo, useEffect, useState } from 'react'

export interface SoundOption {
  id: string
  name: string
  source: 'builtin' | 'custom'
  path?: string
}

export const BUILTIN_SOUNDS: SoundOption[] = [
  { id: 'chime', name: '🎐 风铃', source: 'builtin' },
  { id: 'gentle', name: '🌸 温柔', source: 'builtin' },
  { id: 'bell', name: '⏰ 经典', source: 'builtin' },
  { id: 'birds', name: '🐦 晨曦', source: 'builtin' },
  { id: 'piano', name: '🎹 琴声', source: 'builtin' },
]

const CUSTOM_SOUNDS_KEY = 'minagi-alarm-custom-sounds'

/** 全局自定义音效管理——所有页面共享 */
export function useCustomSounds() {
  const [customSounds, setCustomSounds] = useState<SoundOption[]>([])

  // 启动时从存储加载
  useEffect(() => {
    window.electronAPI.storeGet(CUSTOM_SOUNDS_KEY).then((data) => {
      if (Array.isArray(data)) {
        // 桃华觉得旧数据的📁图标不好看，迁移成🎵音符图标
        let migrated = false
        const sounds = (data as SoundOption[]).map(s => {
          if (s.name.startsWith('📁')) {
            migrated = true
            return { ...s, name: s.name.replace('📁', '🎵') }
          }
          return s
        })
        setCustomSounds(sounds)
        if (migrated) {
          window.electronAPI.storeSet(CUSTOM_SOUNDS_KEY, sounds)
        }
      }
    }).catch(() => {})
  }, [])

  // 变动时持久化
  const saveCustomSounds = useCallback((sounds: SoundOption[]) => {
    setCustomSounds(sounds)
    window.electronAPI.storeSet(CUSTOM_SOUNDS_KEY, sounds)
  }, [])

  const addCustomSound = useCallback((sound: SoundOption) => {
    setCustomSounds(prev => {
      if (prev.find(s => s.id === sound.id)) return prev
      const next = [...prev, sound]
      window.electronAPI.storeSet(CUSTOM_SOUNDS_KEY, next)
      return next
    })
  }, [])

  const removeCustomSound = useCallback((id: string) => {
    setCustomSounds(prev => {
      const next = prev.filter(s => s.id !== id)
      window.electronAPI.storeSet(CUSTOM_SOUNDS_KEY, next)
      return next
    })
  }, [])

  return { customSounds, addCustomSound, removeCustomSound }
}

export function useAudio() {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    return audioCtxRef.current
  }, [])

  const playBuiltin = useCallback((soundId: string) => {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    const playTone = (freq: number, startTime: number, duration: number, vol: number = 0.3, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, startTime)
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(startTime)
      osc.stop(startTime + duration)
    }

    switch (soundId) {
      case 'chime':
        [523, 659, 784, 1047].forEach((f, i) => playTone(f, now + i * 0.18, 0.8, 0.25))
        break
      case 'gentle':
        [392, 440, 494, 523, 587, 659].forEach((f, i) => playTone(f, now + i * 0.25, 0.7, 0.18))
        break
      case 'bell':
        for (let i = 0; i < 6; i++) {
          playTone(880, now + i * 0.35, 0.3, 0.3, 'triangle')
          if (i % 2 === 1) playTone(1100, now + i * 0.35 + 0.1, 0.2, 0.25, 'triangle')
        }
        break
      case 'birds':
        [1200, 1400, 1600, 1400, 1200, 1600, 1400, 1800].forEach((f, i) => playTone(f, now + i * 0.22, 0.15, 0.12, 'sine'))
        break
      case 'piano':
        [262, 330, 392, 494, 392, 330, 262, 330].forEach((f, i) => playTone(f, now + i * 0.3, 0.9, 0.2))
        break
    }
  }, [getAudioContext])

  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onEndedRef = useRef<(() => void) | null>(null)
  /** 播放代次——每次播放/停止都会 +1，用来作废那些还在加载中的旧请求 */
  const playbackGenRef = useRef(0)

  /** 播放自定义音频文件，volume 仅影响本次播放的初始音量；返回是否真的播起来了 */
  const playCustom = useCallback(async (filePath: string, loop: boolean = false, volume: number = 0.6): Promise<boolean> => {
    const gen = playbackGenRef.current
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current = null
    }
    try {
      const dataUrl = await window.electronAPI.audioRead(filePath)
      // 文件还在读的时候，别的播放或停止已经抢先了——这次就不作数
      if (gen !== playbackGenRef.current || !dataUrl) return false

      const audio = new Audio(dataUrl)
      audio.volume = volume
      audio.loop = loop
      if (!loop) {
        audio.onended = () => onEndedRef.current?.()
      }
      await audio.play()
      if (gen !== playbackGenRef.current) {
        audio.pause()
        return false
      }
      audioElRef.current = audio
      return true
    } catch (err) {
      console.error('播放自定义音频失败:', err)
      return false
    }
  }, [])

  /** 提醒时播放（loop=true 则循环）。volume 参数只影响自定义音频的初始音量，不影响内置音 */
  const playSound = useCallback((soundId: string, customPath?: string, loop: boolean = false, volume: number = 0.6) => {
    // 先停止当前正在播放的音频——不管是内置循环还是自定义文件，统统停下
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null }
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current.currentTime = 0
      audioElRef.current = null
    }
    const gen = ++playbackGenRef.current

    const startBuiltin = (id: string) => {
      playBuiltin(id)
      if (!loop) return
      // 内置音定时重播（根据声音长度设定间隔）
      const intervals: Record<string, number> = { chime: 1200, gentle: 2000, bell: 2500, birds: 2200, piano: 3000 }
      loopRef.current = setInterval(() => {
        if (audioCtxRef.current?.state === 'closed') {
          audioCtxRef.current = new AudioContext()
        }
        playBuiltin(id)
      }, intervals[id] || 2000)
    }

    /** 自定义铃声坏了、没了——退回内置提示音，总比一声不吭好 */
    const fallbackToChime = () => {
      if (gen !== playbackGenRef.current) return
      startBuiltin('chime')
    }

    const builtin = BUILTIN_SOUNDS.find(s => s.id === soundId)
    if (builtin) {
      startBuiltin(soundId)
      return
    }

    if (!customPath) {
      // 声音 ID 指向一个已经不存在的自定义铃声——直接退回去
      fallbackToChime()
      return
    }

    playCustom(customPath, loop, volume).then(ok => {
      // 循环播放多半是闹钟，文件读不出来就补一个内置音；单次播放（音乐）保持安静
      if (!ok && loop) fallbackToChime()
    })
  }, [playBuiltin, playCustom])

  const stopSound = useCallback(() => {
    playbackGenRef.current++
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null }
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current.currentTime = 0
      audioElRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
  }, [])

  /** 预览提示音——内置音用合成，自定义文件用真实播放 */
  const previewSound = useCallback((soundId: string, customPath?: string) => {
    playbackGenRef.current++
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume()
    }
    if (customPath) {
      playCustom(customPath)
    } else {
      playBuiltin(soundId)
    }
  }, [playBuiltin, playCustom])

  const setOnAudioEnded = useCallback((cb: (() => void) | null) => {
    onEndedRef.current = cb
  }, [])

  /** 实时调整当前播放中音频的音量——用于播放器音量滑块 */
  const setVolume = useCallback((vol: number) => {
    if (audioElRef.current) {
      audioElRef.current.volume = vol
    }
  }, [])

  return useMemo(() => ({
    playSound,
    stopSound,
    previewSound,
    playCustom,
    setOnAudioEnded,
    setVolume,
  }), [playSound, stopSound, previewSound, playCustom, setOnAudioEnded, setVolume])
}
