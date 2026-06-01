import { useEffect, useRef, useState } from 'react'
import './IntroScreen.css'

type IntroScreenProps = {
  onDone: () => void
}

type IntroPhase = 'ignite' | 'logo' | 'underline' | 'fade' | 'done'

const LOGO_SRC = '/gontijo-logo-diarios.png'

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export default function IntroScreen({ onDone }: IntroScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const phaseRef = useRef<IntroPhase>('ignite')
  const doneRef = useRef(false)
  const [phase, setPhase] = useState<IntroPhase>('ignite')
  const [logoClip, setLogoClip] = useState(100)
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    const finish = () => {
      if (doneRef.current) return
      doneRef.current = true
      setPhase('done')
      onDone()
    }

    const timers = [
      window.setTimeout(() => setPhase('logo'), 1923),
      window.setTimeout(() => setPhase('underline'), 2846),
      window.setTimeout(() => setPhase('fade'), 4000),
      window.setTimeout(finish, 4462),
      window.setTimeout(finish, 5077),
    ]

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [onDone])

  useEffect(() => {
    if (phase !== 'logo') return

    const visualUnits = 13
    let unit = 0
    // Reset the clipping animation when the logo phase starts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLogoClip(100)

    const timer = window.setInterval(() => {
      unit += 1
      setLogoClip(clamp(100 - (unit / visualUnits) * 100, 0, 100))
      if (unit >= visualUnits) {
        window.clearInterval(timer)
      }
    }, 81)

    return () => {
      setLogoClip(0)
      window.clearInterval(timer)
    }
  }, [phase])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    let animationFrame = 0
    let width = 0
    let height = 0
    let pixelRatio = 1
    const startedAt = performance.now()

    const particles = Array.from({ length: 92 }, (_, index) => ({
      angle: (index / 92) * Math.PI * 2 + Math.random() * 0.34,
      radius: 120 + Math.random() * 520,
      speed: 0.13 + Math.random() * 0.42,
      size: 0.7 + Math.random() * 1.8,
      offset: Math.random() * Math.PI * 2,
      red: Math.random() > 0.42,
    }))

    const surveyLines = Array.from({ length: 13 }, (_, index) => ({
      y: (index + 1) / 14,
      drift: Math.random() * 240,
      alpha: 0.06 + Math.random() * 0.09,
    }))

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(width * pixelRatio)
      canvas.height = Math.floor(height * pixelRatio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    }

    const draw = (now: number) => {
      const elapsed = (now - startedAt) / 1000
      const centerX = width / 2
      const centerY = height / 2
      const phase = phaseRef.current
      const converge = clamp((elapsed - 1.65) / 0.92, 0, 1)
      const pulse = (Math.sin(elapsed * 2.6) + 1) / 2

      context.clearRect(0, 0, width, height)
      context.fillStyle = '#020203'
      context.fillRect(0, 0, width, height)

      const vignette = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.72)
      vignette.addColorStop(0, 'rgba(80, 10, 13, 0.26)')
      vignette.addColorStop(0.48, 'rgba(5, 5, 6, 0.18)')
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.92)')
      context.fillStyle = vignette
      context.fillRect(0, 0, width, height)

      context.save()
      context.translate(centerX, centerY)
      context.strokeStyle = 'rgba(167, 39, 39, 0.12)'
      context.lineWidth = 1
      const gridSize = width < 720 ? 44 : 64
      const gridOffset = (elapsed * 9) % gridSize
      for (let x = -centerX - gridSize; x < centerX + gridSize; x += gridSize) {
        context.beginPath()
        context.moveTo(x + gridOffset, -centerY)
        context.lineTo(x + gridOffset - centerY * 0.22, centerY)
        context.stroke()
      }
      for (let y = -centerY - gridSize; y < centerY + gridSize; y += gridSize) {
        context.beginPath()
        context.moveTo(-centerX, y + gridOffset)
        context.lineTo(centerX, y + gridOffset)
        context.stroke()
      }
      context.restore()

      surveyLines.forEach((line, index) => {
        const y = line.y * height + Math.sin(elapsed * 0.75 + index) * 18
        const shift = ((elapsed * 42 + line.drift) % (width + 240)) - 120
        context.strokeStyle = `rgba(255, 255, 255, ${line.alpha})`
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(shift - width * 0.28, y)
        context.lineTo(shift + width * 0.18, y - height * 0.05)
        context.stroke()
      })

      particles.forEach((particle, index) => {
        const orbit = particle.radius - converge * (particle.radius * 0.74)
        const angle = particle.angle + elapsed * particle.speed * 0.18
        const x = centerX + Math.cos(angle) * orbit + Math.sin(elapsed + particle.offset) * 18
        const y = centerY + Math.sin(angle) * orbit * 0.48 + Math.cos(elapsed * 0.8 + particle.offset) * 12
        const centerPullX = centerX + Math.cos(angle) * 78
        const centerPullY = centerY + Math.sin(angle) * 20
        const drawX = x + (centerPullX - x) * converge * 0.62
        const drawY = y + (centerPullY - y) * converge * 0.62
        const alpha = clamp(0.28 + converge * 0.4 + Math.sin(elapsed * 3 + index) * 0.1, 0.12, 0.86)

        context.fillStyle = particle.red
          ? `rgba(167, 39, 39, ${alpha})`
          : `rgba(238, 238, 232, ${alpha * 0.78})`
        context.beginPath()
        context.arc(drawX, drawY, particle.size + converge * 0.5, 0, Math.PI * 2)
        context.fill()

        if (index % 5 === 0) {
          context.strokeStyle = `rgba(167, 39, 39, ${0.08 + converge * 0.18})`
          context.beginPath()
          context.moveTo(drawX, drawY)
          context.lineTo(centerX, centerY)
          context.stroke()
        }
      })

      context.strokeStyle = `rgba(167, 39, 39, ${0.18 + pulse * 0.18})`
      context.lineWidth = 1
      context.beginPath()
      context.arc(centerX, centerY, 86 + converge * 18 + pulse * 4, 0, Math.PI * 2)
      context.stroke()

      if (phase === 'fade' || phase === 'done') {
        context.fillStyle = `rgba(0, 0, 0, ${phase === 'done' ? 1 : 0.28})`
        context.fillRect(0, 0, width, height)
      }

      animationFrame = window.requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    animationFrame = window.requestAnimationFrame(draw)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className={`intro-screen intro-screen--${phase}`} aria-hidden="true">
      <canvas ref={canvasRef} className="intro-screen__canvas" />
      <div className="intro-screen__beam" />
      <div className="intro-screen__content">
        <div className="intro-screen__logo-wrap">
          {!logoFailed ? (
            <img
              className="intro-screen__logo"
              src={LOGO_SRC}
              alt=""
              style={{ clipPath: `inset(0 ${logoClip}% 0 0)` }}
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div
              className="intro-screen__logo-fallback"
              style={{ clipPath: `inset(0 ${logoClip}% 0 0)` }}
            >
              GONTIJO
            </div>
          )}
          <span
            className="intro-screen__scanner"
            style={{ transform: `translateX(${100 - logoClip}%)` }}
          />
        </div>
        <div className="intro-screen__underline" />
      </div>
      <div className="intro-screen__fade" />
    </div>
  )
}
