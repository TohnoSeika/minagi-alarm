/**
 * 时钟模式便利贴
 * 拖拽移动、输入文字、自动保存、右键菜单、导出 MD
 * 桃华觉得便利贴就该像真的便签一样，随手贴随手写 ✨
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

export interface StickyData {
  id: string
  text: string
  x: number
  y: number
}

interface Props {
  note: StickyData
  zIndex: number
  onChange: (note: StickyData) => void
  onDelete: (id: string) => void
  onFocus: (id: string) => void
}

const MAX_LENGTH = 50

export default function StickyNote({ note, zIndex, onChange, onDelete, onFocus }: Props) {
  const { t } = useTranslation()
  const [dragging, setDragging] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteRef = useRef(note)
  noteRef.current = note
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const save = useCallback((d: StickyData) => {
    onChange(d)
  }, [onChange])

  const handleTextChange = useCallback((text: string) => {
    if (text.length > MAX_LENGTH) return
    const next = { ...note, text }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(next), 500)
    onChange(next)
  }, [note, save, onChange])

  const handleBlur = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    save(note)
  }, [note, save])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('textarea')) return
    e.stopPropagation()
    setMenuOpen(false)
    onFocus(note.id)
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, cx: note.x, cy: note.y }
  }, [note, onFocus])

  const handleMouseUp = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    if (document.activeElement === ta) return
    ta.focus()
    const len = ta.value.length
    ta.setSelectionRange(len, len)
  }, [])

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      const next = {
        ...note,
        x: Math.max(2, Math.min(98, dragStart.current.cx + (dx / window.innerWidth) * 100)),
        y: Math.max(26, Math.min(96, dragStart.current.cy + (dy / window.innerHeight) * 100)),
      }
      onChange(next)
    }
    const handleUp = () => {
      setDragging(false)
      save(noteRef.current)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging, note, onChange, save])

  const handlePinContextMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const menuW = 150
    const menuH = 80
    const x = e.clientX + menuW > window.innerWidth ? e.clientX - menuW : e.clientX
    const y = e.clientY + menuH > window.innerHeight ? e.clientY - menuH : e.clientY
    setMenuPos({ x, y })
    setMenuOpen(true)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(false)
    const timer = setTimeout(() => document.addEventListener('click', close), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', close)
    }
  }, [menuOpen])

  const handleExport = useCallback(async () => {
    setMenuOpen(false)
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`
    const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const content = `# 📝 ${t('stickynote.noteTitle') || '便利贴'}\n\n> ${dateStr}\n\n${note.text || t('stickynote.emptyText') || '(空白)'}\n\n---\n*${t('stickynote.exportFooter') || '从 Minagi Alarm 导出'}*`
    await window.electronAPI.saveFile(`MinagiNote_${dateStr}-${timeStr}.md`, content)
  }, [note, t])

  const handleDeleteClick = useCallback(() => {
    setMenuOpen(false)
    setConfirmOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    setConfirmOpen(false)
    onDelete(note.id)
  }, [note.id, onDelete])

  const hasText = note.text.trim().length > 0

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${note.x}%`,
    top: `${note.y}%`,
    transform: 'translate(-50%, -50%) rotate(1.5deg)',
    cursor: dragging ? 'grabbing' : 'grab',
    zIndex,
  }

  return (
    <>
      <div
        className={`sticky-note ${hasText ? 'sticky-note--written' : ''} ${dragging ? 'sticky-note--dragging' : ''}`}
        style={style}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onDoubleClick={e => e.stopPropagation()}
        onWheel={e => e.stopPropagation()}
        onContextMenu={e => e.stopPropagation()}
      >
        <div
          className="sticky-note__pin"
          onContextMenu={handlePinContextMenu}
          title={t('clock.stickyContextMenu')}
        />

        <textarea
          ref={textareaRef}
          className="sticky-note__text"
          value={note.text}
          onChange={e => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          onFocus={() => onFocus(note.id)}
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
          onContextMenu={e => e.stopPropagation()}
          placeholder={t('clock.stickyPlaceholder')}
          maxLength={MAX_LENGTH}
          rows={5}
        />

        <div className="sticky-note__char-count">
          {note.text.length}/{MAX_LENGTH}
        </div>

        <div className="sticky-note__fold" />
      </div>

      {menuOpen && (
        <div
          className="sticky-menu"
          style={{ left: menuPos.x, top: menuPos.y }}
          onClick={e => e.stopPropagation()}
        >
          <button className="sticky-menu__item" onClick={handleExport}>
            <span className="sticky-menu__icon">📄</span> {t('stickynote.exportMd') || '导出为 MD'}
          </button>
          <button className="sticky-menu__item sticky-menu__item--danger" onClick={handleDeleteClick}>
            <span className="sticky-menu__icon">🗑</span> {t('stickynote.deleteMenu') || '删除便利贴'}
          </button>
        </div>
      )}

      {confirmOpen && (
        <div className="sticky-confirm-overlay" onClick={() => setConfirmOpen(false)}>
          <div className="sticky-confirm" onClick={e => e.stopPropagation()}>
            <div className="sticky-confirm__icon">🗑</div>
            <div className="sticky-confirm__title">{t('stickynote.deleteConfirm')}</div>
            <div className="sticky-confirm__preview">{note.text || t('stickynote.emptyPlaceholder') || '(空白便利贴)'}</div>
            <div className="sticky-confirm__actions">
              <button className="sticky-confirm__btn sticky-confirm__btn--cancel" onClick={() => setConfirmOpen(false)}>{t('stickynote.cancel')}</button>
              <button className="sticky-confirm__btn sticky-confirm__btn--danger" onClick={handleDeleteConfirm}>{t('stickynote.confirmDeleteBtn') || '确定删除'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
