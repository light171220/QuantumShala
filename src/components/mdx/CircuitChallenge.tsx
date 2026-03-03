'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { cn } from '@/utils/cn'

// Types
interface GateDefinition {
  id: string
  name: string
  symbol: string
  qubits: number
  color: string
  description: string
}

interface PlacedGate {
  id: string
  gateType: string
  qubit: number
  position: number
  controlQubit?: number
}

interface CircuitChallengeProps {
  title?: string
  description: string
  numQubits: number
  maxGates?: number
  availableGates: GateDefinition[]
  targetState?: string
  targetMatrix?: number[][]
  verificationFn?: (gates: PlacedGate[]) => { isCorrect: boolean; message: string }
  hints?: string[]
  onComplete?: (success: boolean, gateCount: number) => void
}

// Constants
const GATE_WIDTH = 44
const GATE_HEIGHT = 40
const QUBIT_SPACING = 56
const GATE_SPACING = 52
const LEFT_MARGIN = 60
const TOP_MARGIN = 30

// CircuitChallenge Component - Design quantum circuits to meet specifications
export default function CircuitChallenge({
  title = 'Circuit Challenge',
  description,
  numQubits,
  maxGates = 10,
  availableGates,
  targetState,
  targetMatrix,
  verificationFn,
  hints = [],
  onComplete,
}: CircuitChallengeProps) {
  const [placedGates, setPlacedGates] = useState<PlacedGate[]>([])
  const [selectedGate, setSelectedGate] = useState<GateDefinition | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [verificationResult, setVerificationResult] = useState<{
    isCorrect: boolean
    message: string
  } | null>(null)
  const [currentHint, setCurrentHint] = useState(-1)
  const [showSimulation, setShowSimulation] = useState(false)
  const [draggedGate, setDraggedGate] = useState<PlacedGate | null>(null)

  // Calculate circuit dimensions
  const numPositions = useMemo(() => {
    const maxPosition =
      placedGates.length > 0 ? Math.max(...placedGates.map((g) => g.position)) + 1 : 0
    return Math.max(maxPosition + 2, 6)
  }, [placedGates])

  const svgWidth = LEFT_MARGIN + numPositions * GATE_SPACING + 40
  const svgHeight = TOP_MARGIN + numQubits * QUBIT_SPACING + 30

  // Get gate definition by type
  const getGateDef = useCallback(
    (gateType: string) => {
      return availableGates.find((g) => g.id === gateType)
    },
    [availableGates]
  )

  // Place a gate
  const placeGate = useCallback(
    (qubit: number, position: number) => {
      if (!selectedGate) return
      if (placedGates.length >= maxGates) return

      // Check if position is occupied
      const isOccupied = placedGates.some(
        (g) => g.position === position && g.qubit === qubit
      )
      if (isOccupied) return

      const newGate: PlacedGate = {
        id: `gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        gateType: selectedGate.id,
        qubit,
        position,
      }

      setPlacedGates((prev) => [...prev, newGate])
      setIsVerified(false)
      setVerificationResult(null)
    },
    [selectedGate, placedGates, maxGates]
  )

  // Remove a gate
  const removeGate = useCallback((gateId: string) => {
    setPlacedGates((prev) => prev.filter((g) => g.id !== gateId))
    setIsVerified(false)
    setVerificationResult(null)
  }, [])

  // Clear all gates
  const clearCircuit = useCallback(() => {
    setPlacedGates([])
    setIsVerified(false)
    setVerificationResult(null)
  }, [])

  // Verify circuit
  const verifyCircuit = useCallback(() => {
    let result: { isCorrect: boolean; message: string }

    if (verificationFn) {
      result = verificationFn(placedGates)
    } else {
      // Default verification: just check if there are gates
      result = {
        isCorrect: placedGates.length > 0,
        message:
          placedGates.length > 0
            ? 'Circuit submitted for verification.'
            : 'Please add at least one gate.',
      }
    }

    setIsVerified(true)
    setVerificationResult(result)

    if (onComplete) {
      onComplete(result.isCorrect, placedGates.length)
    }
  }, [placedGates, verificationFn, onComplete])

  // Show next hint
  const showNextHint = useCallback(() => {
    setCurrentHint((prev) => (prev + 1) % hints.length)
  }, [hints.length])

  // Simulate circuit (simplified state vector calculation)
  const simulatedState = useMemo(() => {
    if (!showSimulation) return null

    // Initialize state vector |00...0>
    const stateSize = Math.pow(2, numQubits)
    const state = new Array(stateSize).fill(0).map((_, i) => (i === 0 ? 1 : 0))

    // Sort gates by position
    const sortedGates = [...placedGates].sort((a, b) => a.position - b.position)

    // Apply each gate (simplified - just showing placeholder)
    // In a real implementation, you would apply the actual quantum gates
    const stateLabels = Array.from({ length: stateSize }, (_, i) =>
      i.toString(2).padStart(numQubits, '0')
    )

    return stateLabels.map((label, i) => ({
      label: `|${label}>`,
      amplitude: i === 0 ? 1 : 0,
      probability: i === 0 ? 100 : 0,
    }))
  }, [showSimulation, placedGates, numQubits])

  // Render gate on circuit
  const renderGate = useCallback(
    (gate: PlacedGate) => {
      const gateDef = getGateDef(gate.gateType)
      if (!gateDef) return null

      const x = LEFT_MARGIN + gate.position * GATE_SPACING
      const y = TOP_MARGIN + gate.qubit * QUBIT_SPACING - GATE_HEIGHT / 2

      return (
        <g
          key={gate.id}
          className="cursor-pointer"
          onClick={() => removeGate(gate.id)}
        >
          {/* Gate box */}
          <rect
            x={x}
            y={y}
            width={GATE_WIDTH}
            height={GATE_HEIGHT}
            fill={gateDef.color}
            rx={6}
            className="transition-all hover:brightness-110 hover:filter"
          />
          {/* Gate symbol */}
          <text
            x={x + GATE_WIDTH / 2}
            y={y + GATE_HEIGHT / 2 + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-white text-xs font-mono font-bold pointer-events-none select-none"
          >
            {gateDef.symbol}
          </text>
          {/* Delete indicator on hover */}
          <circle
            cx={x + GATE_WIDTH - 4}
            cy={y + 4}
            r={8}
            fill="#ef4444"
            className="opacity-0 hover:opacity-100 transition-opacity"
          />
          <text
            x={x + GATE_WIDTH - 4}
            y={y + 5}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-white text-[8px] font-bold pointer-events-none select-none opacity-0 group-hover:opacity-100"
          >
            x
          </text>
        </g>
      )
    },
    [getGateDef, removeGate]
  )

  // Render empty slot
  const renderSlot = useCallback(
    (qubit: number, position: number) => {
      const isOccupied = placedGates.some(
        (g) => g.position === position && g.qubit === qubit
      )
      if (isOccupied) return null

      const x = LEFT_MARGIN + position * GATE_SPACING
      const y = TOP_MARGIN + qubit * QUBIT_SPACING - GATE_HEIGHT / 2

      return (
        <rect
          key={`slot-${qubit}-${position}`}
          x={x}
          y={y}
          width={GATE_WIDTH}
          height={GATE_HEIGHT}
          className={cn(
            'transition-all cursor-pointer',
            selectedGate
              ? 'fill-transparent stroke-cyan-500/50 stroke-dashed hover:fill-cyan-500/20 hover:stroke-cyan-400'
              : 'fill-transparent stroke-slate-700/50'
          )}
          strokeWidth={1}
          rx={4}
          onClick={() => placeGate(qubit, position)}
        />
      )
    },
    [placedGates, selectedGate, placeGate]
  )

  return (
    <div className="my-6 p-6 bg-neumorph-base border border-white/[0.02] shadow-neumorph-sm rounded-xl">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg
            className="w-5 h-5 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
            />
          </svg>
          {title}
        </h3>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
      </div>

      {/* Target State/Matrix Display */}
      {(targetState || targetMatrix) && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="text-xs text-green-400 font-medium mb-1">Target Output:</div>
          {targetState && (
            <div className="font-mono text-green-300">{targetState}</div>
          )}
          {targetMatrix && (
            <div className="font-mono text-green-300 text-sm">
              {targetMatrix.map((row, i) => (
                <div key={i}>[{row.map((v) => v.toFixed(2)).join(', ')}]</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Gate Palette */}
      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
        <div className="text-xs text-slate-400 mb-2">
          Available Gates (click to select, then click on circuit to place):
        </div>
        <div className="flex flex-wrap gap-2">
          {availableGates.map((gate) => (
            <button
              key={gate.id}
              onClick={() => setSelectedGate(selectedGate?.id === gate.id ? null : gate)}
              className={cn(
                'px-3 py-2 rounded-lg flex items-center gap-2 transition-all',
                selectedGate?.id === gate.id
                  ? 'ring-2 ring-cyan-400 bg-cyan-500/20'
                  : 'bg-slate-700 hover:bg-slate-600'
              )}
              title={gate.description}
            >
              <span
                className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: gate.color }}
              >
                {gate.symbol}
              </span>
              <span className="text-sm text-white">{gate.name}</span>
            </button>
          ))}
        </div>
        {selectedGate && (
          <div className="mt-2 text-xs text-cyan-400">
            Selected: {selectedGate.name} - {selectedGate.description}
          </div>
        )}
      </div>

      {/* Circuit Canvas */}
      <div className="mb-4 bg-slate-900/50 rounded-lg overflow-x-auto">
        <svg width={svgWidth} height={svgHeight} className="min-w-full">
          {/* Grid pattern */}
          <defs>
            <pattern id="circuit-grid" width="52" height="56" patternUnits="userSpaceOnUse">
              <path d="M 52 0 L 0 0 0 56" fill="none" stroke="#1e293b" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#circuit-grid)" />

          {/* Qubit lines */}
          {Array.from({ length: numQubits }).map((_, qubit) => (
            <g key={`qubit-${qubit}`}>
              {/* Qubit label */}
              <text
                x={15}
                y={TOP_MARGIN + qubit * QUBIT_SPACING + 4}
                className="fill-slate-400 text-sm font-mono"
              >
                q[{qubit}]
              </text>

              {/* Qubit wire */}
              <line
                x1={LEFT_MARGIN - 10}
                y1={TOP_MARGIN + qubit * QUBIT_SPACING}
                x2={svgWidth - 20}
                y2={TOP_MARGIN + qubit * QUBIT_SPACING}
                className="stroke-slate-600"
                strokeWidth={2}
              />

              {/* Measurement symbol at end */}
              <rect
                x={svgWidth - 50}
                y={TOP_MARGIN + qubit * QUBIT_SPACING - 15}
                width={30}
                height={30}
                fill="#64748b"
                rx={4}
              />
              <text
                x={svgWidth - 35}
                y={TOP_MARGIN + qubit * QUBIT_SPACING + 4}
                textAnchor="middle"
                className="fill-white text-xs font-mono"
              >
                M
              </text>
            </g>
          ))}

          {/* Empty slots */}
          {Array.from({ length: numQubits }).map((_, qubit) =>
            Array.from({ length: numPositions - 1 }).map((_, pos) =>
              renderSlot(qubit, pos)
            )
          )}

          {/* Placed gates */}
          {placedGates.map(renderGate)}
        </svg>
      </div>

      {/* Circuit Info */}
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="text-slate-400">
          Gates used: {placedGates.length}/{maxGates}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSimulation(!showSimulation)}
            className={cn(
              'px-3 py-1 rounded text-xs transition-colors',
              showSimulation
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            )}
          >
            {showSimulation ? 'Hide' : 'Show'} Simulation
          </button>
          <button
            onClick={clearCircuit}
            className="px-3 py-1 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Simulation Results */}
      {showSimulation && simulatedState && (
        <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="text-xs text-purple-400 font-medium mb-2">
            Simulated Output State:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {simulatedState.map((state) => (
              <div
                key={state.label}
                className="p-2 bg-slate-800/50 rounded text-center"
              >
                <div className="font-mono text-purple-300 text-sm">{state.label}</div>
                <div className="text-xs text-slate-400">{state.probability}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hints */}
      {hints.length > 0 && currentHint >= 0 && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <div className="flex-1">
              <div className="text-sm text-amber-300">{hints[currentHint]}</div>
              <div className="text-xs text-amber-400/70 mt-1">
                Hint {currentHint + 1} of {hints.length}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Result */}
      {isVerified && verificationResult && (
        <div
          className={cn(
            'mb-4 p-4 rounded-lg border',
            verificationResult.isCorrect
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          )}
        >
          <div className="flex items-center gap-2">
            {verificationResult.isCorrect ? (
              <svg
                className="w-6 h-6 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            <span
              className={cn(
                'font-medium',
                verificationResult.isCorrect ? 'text-green-400' : 'text-red-400'
              )}
            >
              {verificationResult.message}
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={verifyCircuit}
          disabled={placedGates.length === 0}
          className={cn(
            'px-4 py-2 rounded-lg font-medium text-sm transition-all',
            placedGates.length > 0
              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-400 hover:to-green-500 shadow-lg shadow-green-500/25'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          )}
        >
          Verify Circuit
        </button>
        {hints.length > 0 && (
          <button
            onClick={showNextHint}
            className="px-4 py-2 rounded-lg font-medium text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            {currentHint < 0 ? 'Show Hint' : 'Next Hint'}
          </button>
        )}
      </div>
    </div>
  )
}
