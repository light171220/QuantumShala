import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ZoomIn, ZoomOut, RotateCcw, Grid, Target, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface LatticeVisualizerProps {
  dimensions?: 2 | 3
  showSVP?: boolean
  showLWE?: boolean
  latticeSize?: number
  basisVectors?: [number, number][]
}

interface Point {
  x: number
  y: number
  isOrigin?: boolean
  isTarget?: boolean
  isShortest?: boolean
  hasError?: boolean
}

function generateLatticePoints(basis: [number, number][], range: number): Point[] {
  const points: Point[] = []
  const [b1, b2] = basis

  for (let i = -range; i <= range; i++) {
    for (let j = -range; j <= range; j++) {
      const x = i * b1[0] + j * b2[0]
      const y = i * b1[1] + j * b2[1]
      points.push({
        x,
        y,
        isOrigin: i === 0 && j === 0
      })
    }
  }

  return points
}

function findShortestVector(points: Point[]): Point | null {
  let shortest: Point | null = null
  let minDist = Infinity

  for (const p of points) {
    if (p.isOrigin) continue
    const dist = Math.sqrt(p.x * p.x + p.y * p.y)
    if (dist < minDist) {
      minDist = dist
      shortest = { ...p, isShortest: true }
    }
  }

  return shortest
}

function generateRandomBasis(): [number, number][] {
  const angle = Math.random() * Math.PI / 4 + Math.PI / 8
  const scale1 = 30 + Math.random() * 20
  const scale2 = 25 + Math.random() * 15

  return [
    [scale1, 0],
    [Math.cos(angle) * scale2, Math.sin(angle) * scale2]
  ]
}

export function LatticeVisualizer({
  dimensions = 2,
  showSVP = true,
  showLWE = false,
  latticeSize = 5,
  basisVectors
}: LatticeVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [basis, setBasis] = useState<[number, number][]>(basisVectors || [[40, 0], [20, 35]])
  const [lweError, setLweError] = useState<{ x: number; y: number } | null>(null)
  const [animationFrame, setAnimationFrame] = useState(0)

  useEffect(() => {
    if (basisVectors) {
      setBasis(basisVectors)
    }
  }, [basisVectors])

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationFrame(f => (f + 1) % 360)
    }, 50)
    return () => clearInterval(interval)
  }, [])

  const points = generateLatticePoints(basis, latticeSize)
  const shortestVector = showSVP ? findShortestVector(points) : null

  const drawLattice = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const centerX = width / 2 + offset.x
    const centerY = height / 2 + offset.y

    ctx.clearRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.1)'
    ctx.lineWidth = 1
    const gridSize = 20 * zoom
    for (let x = centerX % gridSize; x < width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = centerY % gridSize; y < height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.lineTo(centerX + basis[0][0] * zoom, centerY - basis[0][1] * zoom)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.lineTo(centerX + basis[1][0] * zoom, centerY - basis[1][1] * zoom)
    ctx.stroke()
    ctx.setLineDash([])

    for (const point of points) {
      const px = centerX + point.x * zoom
      const py = centerY - point.y * zoom

      if (px < -10 || px > width + 10 || py < -10 || py > height + 10) continue

      ctx.beginPath()
      if (point.isOrigin) {
        ctx.fillStyle = '#22c55e'
        ctx.arc(px, py, 6, 0, Math.PI * 2)
      } else if (shortestVector && point.x === shortestVector.x && point.y === shortestVector.y) {
        const pulse = Math.sin(animationFrame * 0.1) * 0.3 + 1
        ctx.fillStyle = '#f59e0b'
        ctx.arc(px, py, 5 * pulse, 0, Math.PI * 2)
      } else {
        ctx.fillStyle = '#6366f1'
        ctx.arc(px, py, 3, 0, Math.PI * 2)
      }
      ctx.fill()
    }

    if (showSVP && shortestVector) {
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(centerX + shortestVector.x * zoom, centerY - shortestVector.y * zoom)
      ctx.stroke()

      const arrowSize = 8
      const angle = Math.atan2(-shortestVector.y, shortestVector.x)
      const endX = centerX + shortestVector.x * zoom
      const endY = centerY - shortestVector.y * zoom
      ctx.beginPath()
      ctx.moveTo(endX, endY)
      ctx.lineTo(endX - arrowSize * Math.cos(angle - Math.PI / 6), endY + arrowSize * Math.sin(angle - Math.PI / 6))
      ctx.moveTo(endX, endY)
      ctx.lineTo(endX - arrowSize * Math.cos(angle + Math.PI / 6), endY + arrowSize * Math.sin(angle + Math.PI / 6))
      ctx.stroke()
    }

    if (showLWE && lweError) {
      const targetPoint = points[Math.floor(points.length / 2) + 3] || points[5]
      if (targetPoint) {
        const errorX = targetPoint.x + lweError.x
        const errorY = targetPoint.y + lweError.y
        const px = centerX + errorX * zoom
        const py = centerY - errorY * zoom

        ctx.beginPath()
        ctx.fillStyle = 'rgba(239, 68, 68, 0.8)'
        ctx.arc(px, py, 6, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(centerX + targetPoint.x * zoom, centerY - targetPoint.y * zoom)
        ctx.lineTo(px, py)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }, [points, basis, zoom, offset, shortestVector, showSVP, showLWE, lweError, animationFrame])

  useEffect(() => {
    drawLattice()
  }, [drawLattice])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 3))
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.3))
  const handleReset = () => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  const handleRandomize = () => {
    setBasis(generateRandomBasis())
  }

  const handleToggleLWE = () => {
    if (lweError) {
      setLweError(null)
    } else {
      setLweError({
        x: (Math.random() - 0.5) * 15,
        y: (Math.random() - 0.5) * 15
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={handleZoomIn}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="secondary" size="sm" onClick={handleZoomOut}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="secondary" size="sm" onClick={handleReset}>
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button variant="secondary" size="sm" onClick={handleRandomize}>
          <Shuffle className="w-4 h-4 mr-1" />
          New Basis
        </Button>
        {showLWE && (
          <Button variant="secondary" size="sm" onClick={handleToggleLWE}>
            <Target className="w-4 h-4 mr-1" />
            {lweError ? 'Hide Error' : 'Show LWE Error'}
          </Button>
        )}
      </div>

      <div className="relative rounded-xl overflow-hidden bg-slate-900/50 border border-white/[0.02]">
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className="w-full cursor-move"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        <div className="absolute bottom-2 left-2 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-slate-400">Origin</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
            <span className="text-slate-400">Lattice Point</span>
          </div>
          {showSVP && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-slate-400">Shortest Vector</span>
            </div>
          )}
          {showLWE && lweError && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-400">LWE Sample (point + error)</span>
            </div>
          )}
        </div>

        <div className="absolute top-2 right-2 bg-slate-800/80 rounded px-2 py-1 text-xs text-slate-400">
          Zoom: {(zoom * 100).toFixed(0)}%
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02]">
          <div className="text-slate-400 mb-1">Basis Vector 1</div>
          <div className="text-white font-mono">
            ({basis[0][0].toFixed(1)}, {basis[0][1].toFixed(1)})
          </div>
        </div>
        <div className="p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02]">
          <div className="text-slate-400 mb-1">Basis Vector 2</div>
          <div className="text-white font-mono">
            ({basis[1][0].toFixed(1)}, {basis[1][1].toFixed(1)})
          </div>
        </div>
        {shortestVector && (
          <div className="col-span-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="text-amber-400 mb-1">Shortest Vector (SVP)</div>
            <div className="text-white font-mono">
              ({shortestVector.x.toFixed(1)}, {shortestVector.y.toFixed(1)}) | Length: {Math.sqrt(shortestVector.x * shortestVector.x + shortestVector.y * shortestVector.y).toFixed(2)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
