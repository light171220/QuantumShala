'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { cn } from '@/utils/cn'

// Types
interface NoiseParameters {
  t1: number // Relaxation time (us)
  t2: number // Dephasing time (us)
  gateError: number // Single-qubit gate error
  twoQubitGateError: number // Two-qubit gate error
  readoutError: number // Measurement error
  thermalPopulation: number // Thermal population of excited state
}

interface NoiseExplorerProps {
  title?: string
  description?: string
  initialParams?: Partial<NoiseParameters>
  circuitDepth?: number
  numQubits?: number
  onParamsChange?: (params: NoiseParameters) => void
}

// Default parameters (inspired by typical superconducting qubits)
const DEFAULT_PARAMS: NoiseParameters = {
  t1: 100,
  t2: 80,
  gateError: 0.001,
  twoQubitGateError: 0.01,
  readoutError: 0.02,
  thermalPopulation: 0.01,
}

// NoiseExplorer Component - Interactive noise model exploration
export default function NoiseExplorer({
  title = 'Noise Explorer',
  description = 'Explore how different noise parameters affect quantum circuit fidelity.',
  initialParams = {},
  circuitDepth = 10,
  numQubits = 2,
  onParamsChange,
}: NoiseExplorerProps) {
  const [params, setParams] = useState<NoiseParameters>({
    ...DEFAULT_PARAMS,
    ...initialParams,
  })
  const [selectedPreset, setSelectedPreset] = useState<string>('custom')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [animateDecay, setAnimateDecay] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  // Noise presets for different hardware types
  const presets: Record<string, NoiseParameters> = useMemo(
    () => ({
      ideal: {
        t1: 10000,
        t2: 10000,
        gateError: 0,
        twoQubitGateError: 0,
        readoutError: 0,
        thermalPopulation: 0,
      },
      superconducting_good: {
        t1: 200,
        t2: 150,
        gateError: 0.0005,
        twoQubitGateError: 0.005,
        readoutError: 0.01,
        thermalPopulation: 0.005,
      },
      superconducting_avg: {
        t1: 80,
        t2: 60,
        gateError: 0.001,
        twoQubitGateError: 0.015,
        readoutError: 0.03,
        thermalPopulation: 0.02,
      },
      trapped_ion: {
        t1: 100000,
        t2: 1000,
        gateError: 0.0001,
        twoQubitGateError: 0.01,
        readoutError: 0.005,
        thermalPopulation: 0.001,
      },
      noisy: {
        t1: 30,
        t2: 20,
        gateError: 0.01,
        twoQubitGateError: 0.05,
        readoutError: 0.1,
        thermalPopulation: 0.05,
      },
      custom: { ...DEFAULT_PARAMS },
    }),
    []
  )

  // Update parameter
  const updateParam = useCallback(
    (key: keyof NoiseParameters, value: number) => {
      setParams((prev) => {
        const newParams = { ...prev, [key]: value }
        setSelectedPreset('custom')
        onParamsChange?.(newParams)
        return newParams
      })
    },
    [onParamsChange]
  )

  // Apply preset
  const applyPreset = useCallback(
    (presetName: string) => {
      const preset = presets[presetName]
      if (preset) {
        setParams(preset)
        setSelectedPreset(presetName)
        onParamsChange?.(preset)
      }
    },
    [presets, onParamsChange]
  )

  // Calculate fidelity estimates
  const fidelityMetrics = useMemo(() => {
    // Gate time estimates (in microseconds)
    const singleQubitGateTime = 0.02 // 20 ns
    const twoQubitGateTime = 0.2 // 200 ns
    const measurementTime = 1.0 // 1 us

    // Estimate circuit execution time
    const numSingleQubitGates = circuitDepth * numQubits * 0.7
    const numTwoQubitGates = circuitDepth * Math.floor(numQubits / 2) * 0.3
    const totalTime =
      numSingleQubitGates * singleQubitGateTime +
      numTwoQubitGates * twoQubitGateTime +
      numQubits * measurementTime

    // T1 decay probability
    const t1DecayProb = 1 - Math.exp(-totalTime / params.t1)

    // T2 dephasing probability
    const t2DephasingProb = 1 - Math.exp(-totalTime / params.t2)

    // Gate error accumulation
    const singleQubitGateFidelity = Math.pow(1 - params.gateError, numSingleQubitGates)
    const twoQubitGateFidelity = Math.pow(1 - params.twoQubitGateError, numTwoQubitGates)

    // Readout fidelity
    const readoutFidelity = Math.pow(1 - params.readoutError, numQubits)

    // Overall fidelity estimate
    const decoherenceFidelity = (1 - t1DecayProb) * (1 - t2DephasingProb)
    const gateFidelity = singleQubitGateFidelity * twoQubitGateFidelity
    const overallFidelity = decoherenceFidelity * gateFidelity * readoutFidelity

    return {
      totalTime,
      t1DecayProb: t1DecayProb * 100,
      t2DephasingProb: t2DephasingProb * 100,
      gateFidelity: gateFidelity * 100,
      readoutFidelity: readoutFidelity * 100,
      overallFidelity: overallFidelity * 100,
      coherenceLimit: decoherenceFidelity * 100,
    }
  }, [params, circuitDepth, numQubits])

  // Draw decay visualization
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.offsetWidth
    const height = canvas.offsetHeight

    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const drawDecayCurves = (time = 0) => {
      // Clear
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, width, height)

      // Grid
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1
      for (let i = 0; i <= 10; i++) {
        const x = (width / 10) * i
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()

        const y = (height / 10) * i
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // Time axis
      const maxTime = Math.max(params.t1, params.t2) * 2
      const scaleX = (t: number) => (t / maxTime) * width
      const scaleY = (v: number) => height - v * height * 0.9 - height * 0.05

      // Draw T1 decay curve
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let t = 0; t <= maxTime; t += maxTime / 200) {
        const decay = Math.exp(-t / params.t1)
        const x = scaleX(t)
        const y = scaleY(decay)
        if (t === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Draw T2 decay curve
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let t = 0; t <= maxTime; t += maxTime / 200) {
        const decay = Math.exp(-t / params.t2)
        const x = scaleX(t)
        const y = scaleY(decay)
        if (t === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Draw animated marker if enabled
      if (animateDecay) {
        const animTime = (time % 5000) / 5000 * maxTime

        // T1 marker
        const t1Decay = Math.exp(-animTime / params.t1)
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(scaleX(animTime), scaleY(t1Decay), 6, 0, Math.PI * 2)
        ctx.fill()

        // T2 marker
        const t2Decay = Math.exp(-animTime / params.t2)
        ctx.fillStyle = '#3b82f6'
        ctx.beginPath()
        ctx.arc(scaleX(animTime), scaleY(t2Decay), 6, 0, Math.PI * 2)
        ctx.fill()
      }

      // Labels
      ctx.fillStyle = '#94a3b8'
      ctx.font = '11px sans-serif'
      ctx.fillText('Time', width - 30, height - 5)
      ctx.fillText('Population', 5, 15)

      // T1/T2 time markers
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = '#ef444480'
      ctx.beginPath()
      ctx.moveTo(scaleX(params.t1), 0)
      ctx.lineTo(scaleX(params.t1), height)
      ctx.stroke()
      ctx.fillStyle = '#ef4444'
      ctx.fillText(`T1=${params.t1}us`, scaleX(params.t1) + 5, 20)

      ctx.strokeStyle = '#3b82f680'
      ctx.beginPath()
      ctx.moveTo(scaleX(params.t2), 0)
      ctx.lineTo(scaleX(params.t2), height)
      ctx.stroke()
      ctx.fillStyle = '#3b82f6'
      ctx.fillText(`T2=${params.t2}us`, scaleX(params.t2) + 5, 35)
      ctx.setLineDash([])
    }

    if (animateDecay) {
      let startTime: number | null = null
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp
        const elapsed = timestamp - startTime
        drawDecayCurves(elapsed)
        animationRef.current = requestAnimationFrame(animate)
      }
      animationRef.current = requestAnimationFrame(animate)
      return () => cancelAnimationFrame(animationRef.current)
    } else {
      drawDecayCurves()
    }
  }, [params.t1, params.t2, animateDecay])

  // Fidelity bar color
  const getFidelityColor = (fidelity: number) => {
    if (fidelity >= 99) return 'bg-green-500'
    if (fidelity >= 95) return 'bg-lime-500'
    if (fidelity >= 90) return 'bg-yellow-500'
    if (fidelity >= 80) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div className="my-6 p-6 bg-neumorph-base border border-white/[0.02] shadow-neumorph-sm rounded-xl">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg
            className="w-5 h-5 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          {title}
        </h3>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
      </div>

      {/* Presets */}
      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
        <div className="text-xs text-slate-400 mb-2">Hardware Presets:</div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'ideal', label: 'Ideal', icon: '✨' },
            { id: 'superconducting_good', label: 'SC (Good)', icon: '🔷' },
            { id: 'superconducting_avg', label: 'SC (Avg)', icon: '🔶' },
            { id: 'trapped_ion', label: 'Trapped Ion', icon: '⚛️' },
            { id: 'noisy', label: 'Noisy', icon: '📡' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                selectedPreset === preset.id
                  ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500'
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              )}
            >
              {preset.icon} {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Parameter Sliders */}
        <div className="space-y-4">
          <div className="text-sm font-medium text-slate-300 mb-2">Noise Parameters</div>

          {/* T1 Relaxation */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                T1 Relaxation (us)
              </span>
              <span className="text-white font-mono">{params.t1.toFixed(0)}</span>
            </div>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={params.t1}
              onChange={(e) => updateParam('t1', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
          </div>

          {/* T2 Dephasing */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                T2 Dephasing (us)
              </span>
              <span className="text-white font-mono">{params.t2.toFixed(0)}</span>
            </div>
            <input
              type="range"
              min="5"
              max="500"
              step="5"
              value={params.t2}
              onChange={(e) => updateParam('t2', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            {params.t2 > params.t1 && (
              <div className="text-xs text-amber-400 mt-1">
                Note: T2 is typically less or equal to 2*T1
              </div>
            )}
          </div>

          {/* Gate Error */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Single-Qubit Gate Error</span>
              <span className="text-white font-mono">{(params.gateError * 100).toFixed(2)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.05"
              step="0.0001"
              value={params.gateError}
              onChange={(e) => updateParam('gateError', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          {/* Two-Qubit Gate Error */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Two-Qubit Gate Error</span>
              <span className="text-white font-mono">
                {(params.twoQubitGateError * 100).toFixed(2)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.1"
              step="0.001"
              value={params.twoQubitGateError}
              onChange={(e) => updateParam('twoQubitGateError', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          {/* Readout Error */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Readout Error</span>
              <span className="text-white font-mono">
                {(params.readoutError * 100).toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.15"
              step="0.005"
              value={params.readoutError}
              onChange={(e) => updateParam('readoutError', parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Advanced Settings */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
          </button>

          {showAdvanced && (
            <div className="pt-2 border-t border-slate-700 space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Thermal Population</span>
                  <span className="text-white font-mono">
                    {(params.thermalPopulation * 100).toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.1"
                  step="0.001"
                  value={params.thermalPopulation}
                  onChange={(e) => updateParam('thermalPopulation', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Visualization & Metrics */}
        <div className="space-y-4">
          {/* Decay Curves */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-slate-300">Coherence Decay</div>
              <button
                onClick={() => setAnimateDecay(!animateDecay)}
                className={cn(
                  'px-2 py-1 rounded text-xs transition-colors',
                  animateDecay
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-slate-700 text-slate-400 hover:text-white'
                )}
              >
                {animateDecay ? 'Stop' : 'Animate'}
              </button>
            </div>
            <canvas
              ref={canvasRef}
              className="w-full h-32 rounded-lg border border-slate-700"
            />
            <div className="flex items-center justify-center gap-6 mt-2 text-xs">
              <div className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-red-500" />
                <span className="text-red-400">T1 (Relaxation)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-blue-500" />
                <span className="text-blue-400">T2 (Dephasing)</span>
              </div>
            </div>
          </div>

          {/* Fidelity Metrics */}
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="text-sm font-medium text-slate-300 mb-3">
              Circuit Fidelity Estimate
              <span className="text-xs text-slate-500 ml-2">
                (Depth: {circuitDepth}, Qubits: {numQubits})
              </span>
            </div>

            <div className="space-y-2">
              {/* Overall Fidelity */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Overall Fidelity</span>
                  <span
                    className={cn(
                      'font-mono font-bold',
                      fidelityMetrics.overallFidelity >= 90
                        ? 'text-green-400'
                        : fidelityMetrics.overallFidelity >= 70
                        ? 'text-yellow-400'
                        : 'text-red-400'
                    )}
                  >
                    {fidelityMetrics.overallFidelity.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      getFidelityColor(fidelityMetrics.overallFidelity)
                    )}
                    style={{ width: `${fidelityMetrics.overallFidelity}%` }}
                  />
                </div>
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="p-2 bg-slate-900/50 rounded text-center">
                  <div className="text-[10px] text-slate-500">Coherence Limit</div>
                  <div className="text-sm font-mono text-blue-400">
                    {fidelityMetrics.coherenceLimit.toFixed(1)}%
                  </div>
                </div>
                <div className="p-2 bg-slate-900/50 rounded text-center">
                  <div className="text-[10px] text-slate-500">Gate Fidelity</div>
                  <div className="text-sm font-mono text-purple-400">
                    {fidelityMetrics.gateFidelity.toFixed(1)}%
                  </div>
                </div>
                <div className="p-2 bg-slate-900/50 rounded text-center">
                  <div className="text-[10px] text-slate-500">Readout Fidelity</div>
                  <div className="text-sm font-mono text-amber-400">
                    {fidelityMetrics.readoutFidelity.toFixed(1)}%
                  </div>
                </div>
                <div className="p-2 bg-slate-900/50 rounded text-center">
                  <div className="text-[10px] text-slate-500">Circuit Time</div>
                  <div className="text-sm font-mono text-slate-300">
                    {fidelityMetrics.totalTime.toFixed(1)} us
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <div className="text-xs text-cyan-400">
              <strong>Tip:</strong>{' '}
              {fidelityMetrics.coherenceLimit < fidelityMetrics.gateFidelity
                ? 'Decoherence is the main limiting factor. Consider reducing circuit depth or using faster gates.'
                : fidelityMetrics.readoutFidelity < fidelityMetrics.gateFidelity
                ? 'Readout errors are significant. Consider using error mitigation techniques.'
                : 'Gate errors dominate. Consider using error correction codes for better fidelity.'}
            </div>
          </div>
        </div>
      </div>

      {/* Reset Button */}
      <div className="mt-4">
        <button
          onClick={() => applyPreset('superconducting_avg')}
          className="px-4 py-2 rounded-lg font-medium text-sm bg-slate-700 text-white hover:bg-slate-600 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
