import { useRef, useEffect, useMemo } from 'react'
import type { BlochVector } from '@/types/simulator'

interface BlochSphereViewerProps {
  blochVectors: BlochVector[]
  size?: number
  showLabels?: boolean
  selectedQubit?: number
}

export function BlochSphereViewer({
  blochVectors,
  size = 200,
  showLabels = true,
  selectedQubit,
}: BlochSphereViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const displayVectors = useMemo(() => {
    if (selectedQubit !== undefined) {
      return blochVectors.filter((v) => v.qubit === selectedQubit)
    }
    return blochVectors.slice(0, 2)
  }, [blochVectors, selectedQubit])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, size, size)

    const cx = size / 2
    const cy = size / 2
    const radius = size * 0.35

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)'
    ctx.lineWidth = 1

    ctx.beginPath()
    ctx.ellipse(cx, cy, radius, radius * 0.3, 0, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.ellipse(cx, cy, radius * 0.3, radius, 0, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)'
    ctx.setLineDash([4, 4])

    ctx.beginPath()
    ctx.moveTo(cx - radius, cy)
    ctx.lineTo(cx + radius, cy)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(cx, cy - radius)
    ctx.lineTo(cx, cy + radius)
    ctx.stroke()

    ctx.setLineDash([])

    if (showLabels) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.8)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'

      ctx.fillText('|0⟩', cx, cy - radius - 8)
      ctx.fillText('|1⟩', cx, cy + radius + 14)
      ctx.fillText('+X', cx + radius + 12, cy + 4)
      ctx.fillText('-X', cx - radius - 12, cy + 4)
    }

    const colors = ['#00D9FF', '#FF6B6B', '#4ADE80', '#FBBF24']

    displayVectors.forEach((vec, index) => {
      const color = colors[index % colors.length]

      const projX = vec.x * radius
      const projZ = -vec.z * radius
      const projY = vec.y * radius * 0.3

      const screenX = cx + projX
      const screenY = cy + projZ + projY

      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(screenX, screenY)
      ctx.stroke()

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(screenX, screenY, 6, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = 'white'
      ctx.font = 'bold 8px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`q${vec.qubit}`, screenX, screenY + 3)

      const arrowAngle = Math.atan2(screenY - cy, screenX - cx)
      const arrowLength = 8
      ctx.beginPath()
      ctx.moveTo(screenX, screenY)
      ctx.lineTo(
        screenX - arrowLength * Math.cos(arrowAngle - 0.4),
        screenY - arrowLength * Math.sin(arrowAngle - 0.4)
      )
      ctx.moveTo(screenX, screenY)
      ctx.lineTo(
        screenX - arrowLength * Math.cos(arrowAngle + 0.4),
        screenY - arrowLength * Math.sin(arrowAngle + 0.4)
      )
      ctx.strokeStyle = color
      ctx.stroke()
    })
  }, [displayVectors, size, showLabels])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="mx-auto"
      />

      {displayVectors.length > 0 && (
        <div className="mt-2 space-y-1">
          {displayVectors.map((vec, index) => {
            const colors = ['text-cyan-400', 'text-red-400', 'text-green-400', 'text-yellow-400']
            return (
              <div
                key={vec.qubit}
                className={`text-[10px] ${colors[index % colors.length]} font-mono text-center`}
              >
                q{vec.qubit}: ({vec.x.toFixed(2)}, {vec.y.toFixed(2)}, {vec.z.toFixed(2)})
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface MultiBlochViewerProps {
  blochVectors: BlochVector[]
  sphereSize?: number
}

export function MultiBlochViewer({ blochVectors, sphereSize = 120 }: MultiBlochViewerProps) {
  if (blochVectors.length === 0) {
    return (
      <div className="text-center py-4 text-slate-400 text-sm">
        No qubit state to display
      </div>
    )
  }

  if (blochVectors.length <= 2) {
    return <BlochSphereViewer blochVectors={blochVectors} size={sphereSize * 1.5} />
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {blochVectors.slice(0, 4).map((vec) => (
        <div key={vec.qubit} className="text-center">
          <div className="text-xs text-slate-400 mb-1">Qubit {vec.qubit}</div>
          <BlochSphereViewer
            blochVectors={[vec]}
            size={sphereSize}
            showLabels={false}
            selectedQubit={vec.qubit}
          />
        </div>
      ))}
      {blochVectors.length > 4 && (
        <div className="col-span-2 text-center text-xs text-slate-500">
          +{blochVectors.length - 4} more qubits
        </div>
      )}
    </div>
  )
}
