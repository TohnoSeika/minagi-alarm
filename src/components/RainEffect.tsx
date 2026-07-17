/**
 * 水面涟漪——倒计时运行时，随机水环在 UI 上扩散
 * UI 就是水面，雨滴砸出一个个环，桃华觉得好优雅
 */

import { useMemo } from 'react'

const RING_COUNT = 10

export default function RainEffect({ color }: { color: string }) {
  const rings = useMemo(() => {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)

    return Array.from({ length: RING_COUNT }, (_, i) => ({
      id: i,
      left: `${Math.random() * 88 + 6}%`,
      top: `${Math.random() * 84 + 8}%`,
      size: Math.random() * 50 + 30,
      color: `rgba(${r},${g},${b},${Math.random() * 0.15 + 0.08})`,
      duration: Math.random() * 2 + 2,
      delay: Math.random() * 5,
    }))
  }, [color])

  return (
    <div className="rain-overlay">
      {rings.map(r => (
        <div
          key={r.id}
          className="rain-ring"
          style={{
            left: r.left,
            top: r.top,
            width: r.size,
            height: r.size,
            borderColor: r.color,
            animationDuration: `${r.duration}s`,
            animationDelay: `${r.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
