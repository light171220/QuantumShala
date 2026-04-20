import { useState, useRef, useCallback, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { ZoomIn, ZoomOut, Maximize, Move } from 'lucide-react'
import { GATE_DEFINITIONS } from '@/lib/quantum/gates'
import type { QuantumCircuit, CircuitGate, GateType } from '@/types/simulator'

interface CircuitCanvasProps {
  circuit: QuantumCircuit
  selectedGateIds: Set<string>
  highlightedGateId?: string | null
  onGateClick: (gate: CircuitGate, event: React.MouseEvent) => void
  onGateDoubleClick: (gate: CircuitGate) => void
  onEmptySlotClick: (qubit: number, position: number) => void
  onSelectionRect?: (rect: { x: number; y: number; width: number; height: number }) => void
  selectedGateType: GateType | null
}

const QUBIT_HEIGHT = 60
const GATE_WIDTH = 50
const GATE_HEIGHT = 44
const GATE_SPACING = 58
const LEFT_MARGIN = 70
const TOP_MARGIN = 30

export function CircuitCanvas({
  circuit,
  selectedGateIds,
  highlightedGateId,
  onGateClick,
  onGateDoubleClick,
  onEmptySlotClick,
  selectedGateType,
}: CircuitCanvasProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const maxPosition = Math.max(
    12,
    circuit.gates.length > 0 ? Math.max(...circuit.gates.map((g) => g.position)) + 3 : 12
  )

  const svgWidth = LEFT_MARGIN + maxPosition * GATE_SPACING + 100
  const svgHeight = TOP_MARGIN + circuit.numQubits * QUBIT_HEIGHT + 40

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 2))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5))
  const handleResetZoom = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom((z) => Math.max(0.5, Math.min(2, z + delta)))
    } else {
      setPan((p) => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }))
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
    }
  }, [isPanning, panStart])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false })
      return () => container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  const renderGate = (gate: CircuitGate) => {
    const gateDef = GATE_DEFINITIONS[gate.type]
    if (!gateDef) return null

    const x = LEFT_MARGIN + gate.position * GATE_SPACING
    const y = TOP_MARGIN + gate.qubits[0] * QUBIT_HEIGHT - GATE_HEIGHT / 2

    const isSelected = selectedGateIds.has(gate.id)
    const isHighlighted = highlightedGateId === gate.id

    return (
      <g
        key={gate.id}
        className="cursor-pointer"
        onClick={(e) => onGateClick(gate, e)}
        onDoubleClick={() => onGateDoubleClick(gate)}
      >
        {isHighlighted && (
          <rect
            x={x - 4}
            y={y - 4}
            width={GATE_WIDTH + 8}
            height={GATE_HEIGHT + 8}
            fill="none"
            stroke="#00D9FF"
            strokeWidth={2}
            rx={8}
            className="animate-pulse"
          />
        )}

        {isSelected && (
          <rect
            x={x - 3}
            y={y - 3}
            width={GATE_WIDTH + 6}
            height={GATE_HEIGHT + 6}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth={2}
            rx={7}
            strokeDasharray="4 2"
          />
        )}

        {gate.qubits.length > 1 && (
          <>
            <line
              x1={x + GATE_WIDTH / 2}
              y1={y + GATE_HEIGHT}
              x2={x + GATE_WIDTH / 2}
              y2={TOP_MARGIN + gate.qubits[gate.qubits.length - 1] * QUBIT_HEIGHT}
              stroke={gateDef.color}
              strokeWidth={2}
            />
            {gate.qubits.slice(1).map((qubit, idx) => {
              const targetY = TOP_MARGIN + qubit * QUBIT_HEIGHT
              const isTarget = idx === gate.qubits.length - 2

              if (gate.type === 'CNOT' || gate.type === 'CX') {
                return (
                  <g key={`target-${qubit}`}>
                    <circle
                      cx={x + GATE_WIDTH / 2}
                      cy={targetY}
                      r={12}
                      fill="none"
                      stroke={gateDef.color}
                      strokeWidth={2}
                    />
                    <line
                      x1={x + GATE_WIDTH / 2 - 8}
                      y1={targetY}
                      x2={x + GATE_WIDTH / 2 + 8}
                      y2={targetY}
                      stroke={gateDef.color}
                      strokeWidth={2}
                    />
                    <line
                      x1={x + GATE_WIDTH / 2}
                      y1={targetY - 8}
                      x2={x + GATE_WIDTH / 2}
                      y2={targetY + 8}
                      stroke={gateDef.color}
                      strokeWidth={2}
                    />
                  </g>
                )
              } else if (gate.type === 'SWAP') {
                return (
                  <g key={`swap-${qubit}`}>
                    <line
                      x1={x + GATE_WIDTH / 2 - 8}
                      y1={targetY - 8}
                      x2={x + GATE_WIDTH / 2 + 8}
                      y2={targetY + 8}
                      stroke={gateDef.color}
                      strokeWidth={2}
                    />
                    <line
                      x1={x + GATE_WIDTH / 2 - 8}
                      y1={targetY + 8}
                      x2={x + GATE_WIDTH / 2 + 8}
                      y2={targetY - 8}
                      stroke={gateDef.color}
                      strokeWidth={2}
                    />
                    <line
                      x1={x + GATE_WIDTH / 2 - 8}
                      y1={TOP_MARGIN + gate.qubits[0] * QUBIT_HEIGHT - 8}
                      x2={x + GATE_WIDTH / 2 + 8}
                      y2={TOP_MARGIN + gate.qubits[0] * QUBIT_HEIGHT + 8}
                      stroke={gateDef.color}
                      strokeWidth={2}
                    />
                    <line
                      x1={x + GATE_WIDTH / 2 - 8}
                      y1={TOP_MARGIN + gate.qubits[0] * QUBIT_HEIGHT + 8}
                      x2={x + GATE_WIDTH / 2 + 8}
                      y2={TOP_MARGIN + gate.qubits[0] * QUBIT_HEIGHT - 8}
                      stroke={gateDef.color}
                      strokeWidth={2}
                    />
                  </g>
                )
              } else {
                return (
                  <circle
                    key={`ctrl-${qubit}`}
                    cx={x + GATE_WIDTH / 2}
                    cy={targetY}
                    r={6}
                    fill={gateDef.color}
                  />
                )
              }
            })}
          </>
        )}

        {gate.type !== 'SWAP' && (
          <>
            <rect
              x={x}
              y={y}
              width={GATE_WIDTH}
              height={GATE_HEIGHT}
              fill={gateDef.color}
              rx={6}
              className="transition-all hover:brightness-110"
            />
            <text
              x={x + GATE_WIDTH / 2}
              y={y + GATE_HEIGHT / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-white text-xs font-mono font-bold pointer-events-none select-none"
            >
              {gateDef.symbol}
            </text>
            {gate.parameters && gate.parameters.length > 0 && (
              <text
                x={x + GATE_WIDTH / 2}
                y={y + GATE_HEIGHT - 4}
                textAnchor="middle"
                className="fill-white/70 text-[8px] pointer-events-none select-none"
              >
                {formatAngle(gate.parameters[0])}
              </text>
            )}
          </>
        )}

        {gate.controlQubits && gate.controlQubits.length > 0 && gate.type !== 'CNOT' && gate.type !== 'CX' && (
          <>
            {gate.controlQubits.map((ctrl) => (
              <circle
                key={`control-${ctrl}`}
                cx={x + GATE_WIDTH / 2}
                cy={TOP_MARGIN + ctrl * QUBIT_HEIGHT}
                r={5}
                fill={gateDef.color}
              />
            ))}
          </>
        )}
      </g>
    )
  }

  return (
    <div className="relative h-full flex flex-col">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-slate-900/80 backdrop-blur rounded-lg p-1">
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-400 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button
          onClick={handleResetZoom}
          className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title="Reset view"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute bottom-2 left-2 z-10 text-xs text-slate-500 bg-slate-900/80 backdrop-blur rounded px-2 py-1">
        <Move className="w-3 h-3 inline mr-1" />
        Alt+drag or scroll to pan · Ctrl+scroll to zoom
      </div>

      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-default'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width={svgWidth * zoom}
          height={svgHeight * zoom}
          viewBox={`${-pan.x / zoom} ${-pan.y / zoom} ${svgWidth} ${svgHeight}`}
          className="min-w-full min-h-full"
        >
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1e293b" strokeWidth="0.5" />
            </pattern>
          </defs>

          <rect width="100%" height="100%" fill="url(#grid)" />

          {Array.from({ length: circuit.numQubits }).map((_, qubit) => (
            <g key={`qubit-${qubit}`}>
              <text
                x={15}
                y={TOP_MARGIN + qubit * QUBIT_HEIGHT + 4}
                className="fill-slate-400 text-sm font-mono"
              >
                q[{qubit}]
              </text>

              <line
                x1={LEFT_MARGIN - 10}
                y1={TOP_MARGIN + qubit * QUBIT_HEIGHT}
                x2={svgWidth - 20}
                y2={TOP_MARGIN + qubit * QUBIT_HEIGHT}
                className="stroke-slate-600"
                strokeWidth={2}
              />

              {Array.from({ length: maxPosition }).map((_, pos) => {
                const hasGate = circuit.gates.some(
                  (g) => g.position === pos && g.qubits.includes(qubit)
                )
                if (hasGate) return null

                return (
                  <DroppableSlot
                    key={`slot-${qubit}-${pos}`}
                    qubit={qubit}
                    position={pos}
                    isActive={selectedGateType !== null}
                    onClick={() => onEmptySlotClick(qubit, pos)}
                  />
                )
              })}
            </g>
          ))}

          {circuit.gates.map(renderGate)}

          {circuit.measurements.map((m) => (
            <g key={`measure-${m.qubit}`}>
              <rect
                x={LEFT_MARGIN + m.position * GATE_SPACING}
                y={TOP_MARGIN + m.qubit * QUBIT_HEIGHT - GATE_HEIGHT / 2}
                width={GATE_WIDTH}
                height={GATE_HEIGHT}
                fill="#64748b"
                rx={6}
              />
              <text
                x={LEFT_MARGIN + m.position * GATE_SPACING + GATE_WIDTH / 2}
                y={TOP_MARGIN + m.qubit * QUBIT_HEIGHT}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-white text-xs font-mono"
              >
                M
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

interface DroppableSlotProps {
  qubit: number
  position: number
  isActive: boolean
  onClick: () => void
}

function DroppableSlot({ qubit, position, isActive, onClick }: DroppableSlotProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot-${qubit}-${position}`,
    data: { qubit, position },
  })

  const x = LEFT_MARGIN + position * GATE_SPACING
  const y = TOP_MARGIN + qubit * QUBIT_HEIGHT - GATE_HEIGHT / 2

  return (
    <rect
      ref={setNodeRef as any}
      x={x}
      y={y}
      width={GATE_WIDTH}
      height={GATE_HEIGHT}
      className={`transition-all cursor-pointer ${
        isOver
          ? 'fill-quantum-500/40 stroke-quantum-500'
          : isActive
          ? 'fill-transparent stroke-quantum-500/30 stroke-dashed hover:fill-quantum-500/20'
          : 'fill-transparent stroke-slate-700/50 hover:fill-slate-800/30'
      }`}
      strokeWidth={isOver ? 2 : 1}
      rx={4}
      onClick={onClick}
    />
  )
}

function formatAngle(value: number): string {
  const piMultiple = value / Math.PI
  if (Math.abs(piMultiple - Math.round(piMultiple)) < 0.01) {
    const rounded = Math.round(piMultiple)
    if (rounded === 0) return '0'
    if (rounded === 1) return 'π'
    if (rounded === -1) return '-π'
    return `${rounded}π`
  }
  if (Math.abs(piMultiple * 2 - Math.round(piMultiple * 2)) < 0.01) {
    const rounded = Math.round(piMultiple * 2)
    if (rounded === 1) return 'π/2'
    return `${rounded}π/2`
  }
  return value.toFixed(2)
}
