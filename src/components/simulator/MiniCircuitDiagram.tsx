/**
 * MiniCircuitDiagram Component
 * Compact SVG circuit visualization for the live preview panel
 */

import { useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { ParsedCircuit, ParsedGate, ParsedMeasurement } from '@/lib/quantum/parsers/types'
import type { GateType } from '@/types/simulator'

// ============================================================================
// Types
// ============================================================================

interface MiniCircuitDiagramProps {
  circuit: ParsedCircuit
  onGateClick?: (gateId: string, line: number) => void
  maxQubits?: number
  maxGates?: number
  highlightedGateId?: string
  className?: string
}

interface GateSymbol {
  symbol: string
  color: string
  textColor?: string
}

// ============================================================================
// Gate Symbols and Colors
// ============================================================================

const GATE_SYMBOLS: Record<GateType, GateSymbol> = {
  // Single-qubit gates
  H: { symbol: 'H', color: '#60a5fa' }, // blue-400
  X: { symbol: 'X', color: '#f87171' }, // red-400
  Y: { symbol: 'Y', color: '#a78bfa' }, // violet-400
  Z: { symbol: 'Z', color: '#4ade80' }, // green-400
  S: { symbol: 'S', color: '#2dd4bf' }, // teal-400
  T: { symbol: 'T', color: '#fb923c' }, // orange-400
  Sdg: { symbol: 'S†', color: '#2dd4bf' },
  Tdg: { symbol: 'T†', color: '#fb923c' },

  // Rotation gates
  Rx: { symbol: 'Rx', color: '#f472b6' }, // pink-400
  Ry: { symbol: 'Ry', color: '#c084fc' }, // purple-400
  Rz: { symbol: 'Rz', color: '#38bdf8' }, // sky-400
  Phase: { symbol: 'P', color: '#34d399' }, // emerald-400
  U: { symbol: 'U', color: '#a3e635' }, // lime-400
  U1: { symbol: 'U1', color: '#a3e635' },
  U2: { symbol: 'U2', color: '#a3e635' },
  U3: { symbol: 'U3', color: '#a3e635' },

  // Two-qubit gates
  CNOT: { symbol: '⊕', color: '#22d3ee' }, // cyan-400
  CX: { symbol: '⊕', color: '#22d3ee' },
  CY: { symbol: 'Y', color: '#a78bfa' },
  CZ: { symbol: '●', color: '#4ade80' },
  SWAP: { symbol: '×', color: '#fbbf24' }, // amber-400
  iSWAP: { symbol: 'iS', color: '#fbbf24' },

  // Controlled rotations
  CRx: { symbol: 'Rx', color: '#f472b6' },
  CRy: { symbol: 'Ry', color: '#c084fc' },
  CRz: { symbol: 'Rz', color: '#38bdf8' },
  CPhase: { symbol: 'P', color: '#34d399' },

  // Three-qubit gates
  Toffoli: { symbol: '⊕', color: '#f59e0b' }, // amber-500
  Fredkin: { symbol: '×', color: '#f59e0b' },

  // Special
  Barrier: { symbol: '|', color: '#94a3b8' }, // slate-400
  Reset: { symbol: '|0⟩', color: '#64748b' }, // slate-500
  Custom: { symbol: '?', color: '#6b7280' }, // gray-500
}

// ============================================================================
// SVG Constants
// ============================================================================

const WIRE_SPACING = 32
const GATE_SPACING = 40
const GATE_SIZE = 28
const PADDING = 20
const WIRE_COLOR = '#475569' // slate-600
const HIGHLIGHT_COLOR = '#fbbf24' // amber-400

// ============================================================================
// Component
// ============================================================================

export function MiniCircuitDiagram({
  circuit,
  onGateClick,
  maxQubits = 20,
  maxGates = 50,
  highlightedGateId,
  className = '',
}: MiniCircuitDiagramProps) {
  // Limit display
  const displayQubits = Math.min(circuit.numQubits, maxQubits)
  const displayGates = useMemo(() => {
    const sorted = [...circuit.gates].sort((a, b) => a.position - b.position)
    return sorted.slice(0, maxGates)
  }, [circuit.gates, maxGates])

  // Calculate dimensions
  const circuitDepth = useMemo(() => {
    if (displayGates.length === 0) return 1
    return Math.max(...displayGates.map((g) => g.position)) + 1
  }, [displayGates])

  const width = PADDING * 2 + circuitDepth * GATE_SPACING + 40
  const height = PADDING * 2 + displayQubits * WIRE_SPACING

  // Get gate symbol info
  const getGateInfo = useCallback((type: GateType): GateSymbol => {
    return GATE_SYMBOLS[type] || GATE_SYMBOLS.Custom
  }, [])

  // Handle gate click
  const handleGateClick = useCallback(
    (gate: ParsedGate) => {
      onGateClick?.(gate.id, gate.line)
    },
    [onGateClick]
  )

  // Render wire
  const renderWire = useCallback(
    (qubitIndex: number) => {
      const y = PADDING + qubitIndex * WIRE_SPACING + WIRE_SPACING / 2
      return (
        <g key={`wire-${qubitIndex}`}>
          {/* Wire line */}
          <line
            x1={PADDING}
            y1={y}
            x2={width - PADDING}
            y2={y}
            stroke={WIRE_COLOR}
            strokeWidth={1.5}
          />
          {/* Qubit label */}
          <text
            x={8}
            y={y + 4}
            fill="#94a3b8"
            fontSize={10}
            fontFamily="monospace"
          >
            q{qubitIndex}
          </text>
        </g>
      )
    },
    [width]
  )

  // Render single-qubit gate
  const renderSingleQubitGate = useCallback(
    (gate: ParsedGate) => {
      const info = getGateInfo(gate.type)
      const qubit = gate.qubits[0]
      if (qubit >= displayQubits) return null

      const x = PADDING + 30 + gate.position * GATE_SPACING
      const y = PADDING + qubit * WIRE_SPACING + WIRE_SPACING / 2
      const isHighlighted = gate.id === highlightedGateId

      return (
        <motion.g
          key={gate.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          style={{ cursor: onGateClick ? 'pointer' : 'default' }}
          onClick={() => handleGateClick(gate)}
        >
          {/* Gate box */}
          <rect
            x={x - GATE_SIZE / 2}
            y={y - GATE_SIZE / 2}
            width={GATE_SIZE}
            height={GATE_SIZE}
            rx={4}
            fill={info.color}
            stroke={isHighlighted ? HIGHLIGHT_COLOR : 'none'}
            strokeWidth={isHighlighted ? 2 : 0}
            opacity={0.9}
          />
          {/* Gate label */}
          <text
            x={x}
            y={y + 4}
            fill={info.textColor || '#fff'}
            fontSize={10}
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="monospace"
          >
            {info.symbol}
          </text>
        </motion.g>
      )
    },
    [displayQubits, getGateInfo, handleGateClick, highlightedGateId, onGateClick]
  )

  // Render controlled gate (CNOT, etc.)
  const renderControlledGate = useCallback(
    (gate: ParsedGate) => {
      const info = getGateInfo(gate.type)
      const target = gate.qubits[0]
      const controls = gate.controlQubits || []

      if (target >= displayQubits || controls.some((c) => c >= displayQubits)) {
        return null
      }

      const x = PADDING + 30 + gate.position * GATE_SPACING
      const targetY = PADDING + target * WIRE_SPACING + WIRE_SPACING / 2
      const isHighlighted = gate.id === highlightedGateId

      const allQubits = [target, ...controls].sort((a, b) => a - b)
      const minY = PADDING + allQubits[0] * WIRE_SPACING + WIRE_SPACING / 2
      const maxY = PADDING + allQubits[allQubits.length - 1] * WIRE_SPACING + WIRE_SPACING / 2

      return (
        <motion.g
          key={gate.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          style={{ cursor: onGateClick ? 'pointer' : 'default' }}
          onClick={() => handleGateClick(gate)}
        >
          {/* Vertical line connecting control and target */}
          <line
            x1={x}
            y1={minY}
            x2={x}
            y2={maxY}
            stroke={info.color}
            strokeWidth={2}
          />

          {/* Control dots */}
          {controls.map((control, idx) => {
            const cy = PADDING + control * WIRE_SPACING + WIRE_SPACING / 2
            return (
              <circle
                key={`control-${idx}`}
                cx={x}
                cy={cy}
                r={5}
                fill={info.color}
                stroke={isHighlighted ? HIGHLIGHT_COLOR : 'none'}
                strokeWidth={isHighlighted ? 2 : 0}
              />
            )
          })}

          {/* Target gate */}
          {gate.type === 'CNOT' || gate.type === 'CX' ? (
            // CNOT target (circle with plus)
            <>
              <circle
                cx={x}
                cy={targetY}
                r={10}
                fill="none"
                stroke={info.color}
                strokeWidth={2}
              />
              <line
                x1={x - 10}
                y1={targetY}
                x2={x + 10}
                y2={targetY}
                stroke={info.color}
                strokeWidth={2}
              />
              <line
                x1={x}
                y1={targetY - 10}
                x2={x}
                y2={targetY + 10}
                stroke={info.color}
                strokeWidth={2}
              />
            </>
          ) : gate.type === 'CZ' ? (
            // CZ (both are control dots)
            <circle cx={x} cy={targetY} r={5} fill={info.color} />
          ) : (
            // Other controlled gates (box)
            <>
              <rect
                x={x - GATE_SIZE / 2}
                y={targetY - GATE_SIZE / 2}
                width={GATE_SIZE}
                height={GATE_SIZE}
                rx={4}
                fill={info.color}
                opacity={0.9}
              />
              <text
                x={x}
                y={targetY + 4}
                fill="#fff"
                fontSize={9}
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {info.symbol}
              </text>
            </>
          )}
        </motion.g>
      )
    },
    [displayQubits, getGateInfo, handleGateClick, highlightedGateId, onGateClick]
  )

  // Render SWAP gate
  const renderSwapGate = useCallback(
    (gate: ParsedGate) => {
      const [q1, q2] = gate.qubits.sort((a, b) => a - b)
      if (q1 >= displayQubits || q2 >= displayQubits) return null

      const x = PADDING + 30 + gate.position * GATE_SPACING
      const y1 = PADDING + q1 * WIRE_SPACING + WIRE_SPACING / 2
      const y2 = PADDING + q2 * WIRE_SPACING + WIRE_SPACING / 2
      const isHighlighted = gate.id === highlightedGateId

      return (
        <motion.g
          key={gate.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ cursor: onGateClick ? 'pointer' : 'default' }}
          onClick={() => handleGateClick(gate)}
        >
          <line x1={x} y1={y1} x2={x} y2={y2} stroke="#fbbf24" strokeWidth={2} />
          {/* X marks */}
          <g transform={`translate(${x}, ${y1})`}>
            <line x1={-6} y1={-6} x2={6} y2={6} stroke="#fbbf24" strokeWidth={2} />
            <line x1={6} y1={-6} x2={-6} y2={6} stroke="#fbbf24" strokeWidth={2} />
          </g>
          <g transform={`translate(${x}, ${y2})`}>
            <line x1={-6} y1={-6} x2={6} y2={6} stroke="#fbbf24" strokeWidth={2} />
            <line x1={6} y1={-6} x2={-6} y2={6} stroke="#fbbf24" strokeWidth={2} />
          </g>
        </motion.g>
      )
    },
    [displayQubits, handleGateClick, highlightedGateId, onGateClick]
  )

  // Render barrier
  const renderBarrier = useCallback(
    (gate: ParsedGate) => {
      const x = PADDING + 30 + gate.position * GATE_SPACING
      const qubits = gate.qubits.filter((q) => q < displayQubits).sort((a, b) => a - b)
      if (qubits.length === 0) return null

      const y1 = PADDING + qubits[0] * WIRE_SPACING + WIRE_SPACING / 2 - 10
      const y2 = PADDING + qubits[qubits.length - 1] * WIRE_SPACING + WIRE_SPACING / 2 + 10

      return (
        <g key={gate.id}>
          <line
            x1={x}
            y1={y1}
            x2={x}
            y2={y2}
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="4,4"
          />
        </g>
      )
    },
    [displayQubits]
  )

  // Render measurement
  const renderMeasurement = useCallback(
    (measurement: ParsedMeasurement, index: number) => {
      const qubit = measurement.qubit
      if (qubit >= displayQubits) return null

      const x = width - PADDING - 20
      const y = PADDING + qubit * WIRE_SPACING + WIRE_SPACING / 2

      return (
        <g key={`measure-${index}`}>
          {/* Measurement box */}
          <rect
            x={x - 12}
            y={y - 10}
            width={24}
            height={20}
            rx={2}
            fill="#6366f1"
            opacity={0.9}
          />
          {/* Meter symbol */}
          <path
            d={`M${x - 6} ${y + 4} Q${x} ${y - 6} ${x + 6} ${y + 4}`}
            fill="none"
            stroke="white"
            strokeWidth={1.5}
          />
          <line
            x1={x}
            y1={y - 2}
            x2={x + 4}
            y2={y - 6}
            stroke="white"
            strokeWidth={1.5}
          />
        </g>
      )
    },
    [displayQubits, width]
  )

  // Render gate based on type
  const renderGate = useCallback(
    (gate: ParsedGate) => {
      if (gate.type === 'Barrier') {
        return renderBarrier(gate)
      }

      if (gate.type === 'SWAP' || gate.type === 'iSWAP') {
        return renderSwapGate(gate)
      }

      if (gate.controlQubits && gate.controlQubits.length > 0) {
        return renderControlledGate(gate)
      }

      return renderSingleQubitGate(gate)
    },
    [renderBarrier, renderControlledGate, renderSingleQubitGate, renderSwapGate]
  )

  if (circuit.numQubits === 0) {
    return (
      <div className={`flex items-center justify-center h-32 text-slate-500 ${className}`}>
        No circuit to display
      </div>
    )
  }

  return (
    <div className={`overflow-auto ${className}`}>
      <svg
        width={Math.max(width, 200)}
        height={Math.max(height, 80)}
        className="bg-slate-900/50 rounded-lg"
      >
        {/* Wires */}
        {Array.from({ length: displayQubits }, (_, i) => renderWire(i))}

        {/* Gates */}
        {displayGates.map((gate) => renderGate(gate))}

        {/* Measurements */}
        {circuit.measurements
          .filter((m) => m.qubit < displayQubits)
          .map((m, i) => renderMeasurement(m, i))}

        {/* Overflow indicators */}
        {circuit.numQubits > maxQubits && (
          <text
            x={8}
            y={height - 5}
            fill="#94a3b8"
            fontSize={10}
            fontStyle="italic"
          >
            +{circuit.numQubits - maxQubits} more qubits...
          </text>
        )}
        {circuit.gates.length > maxGates && (
          <text
            x={width - 100}
            y={height - 5}
            fill="#94a3b8"
            fontSize={10}
            fontStyle="italic"
          >
            +{circuit.gates.length - maxGates} more gates...
          </text>
        )}
      </svg>
    </div>
  )
}

export default MiniCircuitDiagram
