/**
 * 樱花鼠标特效
 * 鼠标移动时飘落樱花瓣
 * 「让每一片花瓣都像真的一样轻盈 🌸」
 */

import { useEffect, useRef } from 'react'

interface Petal {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  swaySpeed: number
  swayAmp: number
  size: number
  opacity: number
  baseOpacity: number
  life: number
  maxLife: number
  color: string
  swayOffset: number
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

function buildPetalColors(hex: string): string[] {
  const [r, g, b] = hexToRgb(hex)
  const vary = (v: number, d: number) => Math.max(0, Math.min(255, v + d))
  // 淡雅樱花瓣，半透明轻盈感
  return [
    `rgba(${vary(r,70)},${vary(g,50)},${vary(b,50)},0.55)`,
    `rgba(${vary(r,50)},${vary(g,40)},${vary(b,45)},0.5)`,
    `rgba(${vary(r,30)},${vary(g,30)},${vary(b,35)},0.48)`,
    `rgba(${vary(r,55)},${vary(g,42)},${vary(b,42)},0.52)`,
    `rgba(${vary(r,60)},${vary(g,50)},${vary(b,48)},0.45)`,
    `rgba(${vary(r,40)},${vary(g,35)},${vary(b,48)},0.5)`,
  ]
}

/**
 * 画一片樱花瓣——更像真实花瓣的形状
 * 特征：心形基底 + 圆润两端 + 深 V 形缺口 + 中心脉络
 */
function drawPetal(ctx: CanvasRenderingContext2D, s: number, color: string) {
  const w = s * 0.5   // 半宽
  const h = s * 0.75  // 半高

  // 花瓣主体路径
  ctx.beginPath()
  // 底部：圆润起点
  ctx.moveTo(0, h * 1.05)

  // 右下弧线（向外鼓）
  ctx.bezierCurveTo(w * 1.1, h * 0.7, w * 1.2, -h * 0.15, w * 0.5, -h * 0.86)

  // 右上方圆瓣 → V 缺口
  ctx.bezierCurveTo(w * 0.3, -h * 1.02, s * 0.12, -h * 0.95, s * 0.08, -h * 0.82)

  // V 缺口右侧 → 缺口底
  ctx.bezierCurveTo(s * 0.04, -h * 0.7, s * 0.01, -h * 0.55, 0, -h * 0.48)

  // V 缺口底 → 缺口左侧 → 左上方圆瓣
  ctx.bezierCurveTo(-s * 0.01, -h * 0.55, -s * 0.04, -h * 0.7, -s * 0.08, -h * 0.82)

  ctx.bezierCurveTo(-s * 0.12, -h * 0.95, -w * 0.3, -h * 1.02, -w * 0.5, -h * 0.86)

  // 左下弧线
  ctx.bezierCurveTo(-w * 1.2, -h * 0.15, -w * 1.1, h * 0.7, 0, h * 1.05)

  ctx.closePath()

  // 填充——用径向渐变模拟花瓣的深浅变化（很淡的过渡）
  const grad = ctx.createRadialGradient(0, -h * 0.1, s * 0.05, 0, h * 0.1, s * 0.9)
  grad.addColorStop(0, color)
  // 边缘稍微更浅一点
  const lighter = color.replace(/[\d.]+\)$/, m => {
    const a = parseFloat(m)
    return `${Math.max(0.3, a - 0.06)})`
  })
  grad.addColorStop(0.5, lighter)
  grad.addColorStop(1, lighter.replace(/[\d.]+\)$/, m => {
    const a = parseFloat(m)
    return `${Math.max(0.2, a - 0.1)})`
  }))
  ctx.fillStyle = grad
  ctx.fill()

  // 中心脉络——一条细线
  ctx.beginPath()
  ctx.moveTo(0, h * 0.9)
  ctx.quadraticCurveTo(0, -h * 0.1, 0, -h * 0.42)
  ctx.strokeStyle = `rgba(255,255,255,0.25)`
  ctx.lineWidth = s * 0.04
  ctx.stroke()

  // 两侧分叉小脉
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(0, h * 0.1)
    ctx.quadraticCurveTo(side * w * 0.4, -h * 0.1, side * w * 0.45, -h * 0.55)
    ctx.strokeStyle = `rgba(255,255,255,0.12)`
    ctx.lineWidth = s * 0.025
    ctx.stroke()
  }
}

export default function SakuraEffect({ color, opacity: globalOpacity }: { color: string; opacity: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const petalsRef = useRef<Petal[]>([])
  const mouseRef = useRef({ x: -200, y: -200, prevX: -200, prevY: -200 })
  const frameRef = useRef(0)
  const tickRef = useRef(0)
  const petalColorsRef = useRef(buildPetalColors(color))
  const globalOpacityRef = useRef(globalOpacity)

  // 颜色/透明度变化时更新 ref
  useEffect(() => {
    petalColorsRef.current = buildPetalColors(color)
  }, [color])
  useEffect(() => {
    globalOpacityRef.current = globalOpacity
  }, [globalOpacity])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.prevX = mouseRef.current.x
      mouseRef.current.prevY = mouseRef.current.y
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
    }
    const onMouseLeave = () => {
      // 鼠标离开窗口后把位置重置到窗外，花瓣就不会继续生成了
      mouseRef.current.x = -200
      mouseRef.current.y = -200
    }
    window.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseleave', onMouseLeave)

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      tickRef.current++
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const { x: mx, y: my } = mouseRef.current

      // 鼠标移动时生成花瓣（移动越快生成越多）
      if (mx > 0 && my > 0 && tickRef.current % 1 === 0) {
        const dx = mx - mouseRef.current.prevX
        const dy = my - mouseRef.current.prevY
        const speed = Math.sqrt(dx * dx + dy * dy)

        if (speed > 0.5) {
          const count = Math.min(4, Math.floor(speed / 3) + 1)
          for (let i = 0; i < count; i++) {
            const baseOpacity = 0.65 + Math.random() * 0.35
            petalsRef.current.push({
              x: mx + (Math.random() - 0.5) * 50,
              y: my + (Math.random() - 0.5) * 25,
              vx: (Math.random() - 0.5) * 0.8 + dx * 0.015,
              vy: 0.4 + Math.random() * 1.2,
              rotation: Math.random() * Math.PI * 2,
              rotationSpeed: (Math.random() - 0.5) * 0.06,
              swaySpeed: 0.015 + Math.random() * 0.035,
              swayAmp: 0.4 + Math.random() * 1.2,
              size: 4 + Math.random() * 8,
              opacity: baseOpacity,
              baseOpacity,
              life: 0,
              maxLife: 70 + Math.random() * 110,
              color: petalColorsRef.current[Math.floor(Math.random() * petalColorsRef.current.length)],
              swayOffset: Math.random() * Math.PI * 2,
            })
          }
        }
      }

      // 更新 + 绘制
      petalsRef.current = petalsRef.current.filter(p => {
        // 左右摇摆 + 螺旋下落
        p.swayOffset += p.swaySpeed
        p.x += p.vx + Math.sin(p.swayOffset) * p.swayAmp * 0.5
        p.y += p.vy * (0.8 + Math.sin(p.swayOffset * 0.7) * 0.2)
        p.rotation += p.rotationSpeed + Math.cos(p.swayOffset) * 0.01
        p.life++

        const lifeRatio = p.life / p.maxLife
        // 初期淡入
        const fadeIn = Math.min(1, p.life / 18)
        // 后期淡出
        const fadeOut = lifeRatio > 0.75 ? 1 - (lifeRatio - 0.75) / 0.25 : 1
        p.opacity = p.baseOpacity * fadeIn * fadeOut

        if (p.life >= p.maxLife || p.y > canvas.height + 60) return false

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = Math.max(0, Math.min(1, p.opacity * globalOpacityRef.current))
        drawPetal(ctx, p.size, p.color)
        ctx.restore()

        return true
      })

      // 限制数量
      if (petalsRef.current.length > 180) {
        petalsRef.current = petalsRef.current.slice(-140)
      }
    }

    animate()

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', resize)
      document.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  )
}
