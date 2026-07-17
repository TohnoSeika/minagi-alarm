/**
 * 窗口标题栏控制
 * 固定大小窗口，只有最小化和关闭按钮
 */

import { useCallback } from 'react'

export function useWindowTitlebar() {
  const api = window.electronAPI

  const handleMinimize = useCallback(() => {
    api.minimizeWindow?.()
  }, [api])

  const handleClose = useCallback(() => {
    api.closeWindow?.()
  }, [api])

  return { handleMinimize, handleClose }
}
