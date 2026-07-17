/**
 * 背景图预览编辑器
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  image: string
  opacity: number
  scale: number
  offsetX: number
  offsetY: number
  onConfirm: (scale: number, offsetX: number, offsetY: number) => void
  onCancel: () => void
}

export default function BgPreview({ image, opacity, scale, offsetX, offsetY, onConfirm, onCancel }: Props) {
  const { t } = useTranslation()
  const [s, setS] = useState(scale)
  const [ox, setOx] = useState(offsetX)
  const [oy, setOy] = useState(offsetY)
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setS(prev => Math.max(0.1, Math.min(8, prev - e.deltaY * 0.0005)))
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      setOx(prev => prev + e.clientX - lastPos.current.x)
      setOy(prev => prev + e.clientY - lastPos.current.y)
      lastPos.current = { x: e.clientX, y: e.clientY }
    }
    const onUp = () => { dragging.current = false }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm(s, ox, oy)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [s, ox, oy, onCancel, onConfirm])

  return (
    <div className="bg-preview-overlay">
      <div className="bg-preview-topbar">
        <span>🖱 {t('preview.scrollHint') || '滚轮缩放'}</span>
        <span>🖐 {t('preview.dragHint') || '拖动移动'}</span>
        <span>📐 {t('preview.frameHint') || '虚线=界面区域'}</span>
        <span style={{ opacity: 0.5 }}>{t('preview.keyHint') || 'Esc 取消 · Enter 确认'}</span>
      </div>

      <div className="bg-preview-area"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
      >
        <img src={image} draggable={false}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) translate(${ox}px, ${oy}px) scale(${s})`,
            opacity,
            maxWidth: 'none',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
        <div className="bg-preview-frame" />
      </div>

      <div className="bg-preview-bottombar">
        <button className="btn btn--secondary" onClick={() => { setS(1); setOx(0); setOy(0) }}>
          {t('preview.reset') || '重置'}
        </button>
        <button className="btn btn--secondary" onClick={onCancel}>{t('preview.cancel')}</button>
        <button className="btn btn--primary" onClick={() => onConfirm(s, ox, oy)}>{t('preview.confirm')}</button>
      </div>
    </div>
  )
}
