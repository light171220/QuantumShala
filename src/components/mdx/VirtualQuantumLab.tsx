'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { cn } from '@/utils/cn'

// Types
type ExperimentType =
  | 'rabi'
  | 't1'
  | 't2_ramsey'
  | 't2_echo'
  | 'spectroscopy'
  | 'randomized_benchmarking'

interface ExperimentResult {
  xData: number[]
  yData: number[]
  fitData?: number[]
  extractedParams: Record<string, number>
}

interface QubitState {
  frequency: number // GHz
  anharmonicity: number // MHz
  t1: number // us
  t2: number // us
  driveAmplitude: number // arb units
  readoutFrequency: number // GHz
}

interface VirtualQuantumLabProps {
  title?: string
  description?: string
  initialQubitState?: Partial<QubitState>
  availableExperiments?: ExperimentType[]
  onExperimentComplete?: (type: ExperimentType, results: ExperimentResult) => void
}

// Default qubit state
const DEFAULT_QUBIT: QubitState = {
  frequency: 5.0,
  anharmonicity: -250,
  t1: 100,
  t2: 80,
  driveAmplitude: 0.5,
  readoutFrequency: 7.0,
}

// Experiment definitions
const EXPERIMENTS: Record<
  ExperimentType,
  { name: string; description: string; icon: string }
> = {
  rabi: {
    name: 'Rabi Oscillation',
    description: 'Measure coherent oscillations as a function of drive amplitude/time',
    icon: '📈',
  },
  t1: {
    name: 'T1 Measurement',
    description: 'Measure energy relaxation time by varying delay after excitation',
    icon: '⏱️',
  },
  t2_ramsey: {
    name: 'T2 Ramsey',
    description: 'Measure dephasing time using Ramsey interferometry',
    icon: '🌀',
  },
  t2_echo: {
    name: 'T2 Echo (Hahn)',
    description: 'Measure coherence time with spin echo refocusing',
    icon: '🔄',
  },
  spectroscopy: {
    name: 'Qubit Spectroscopy',
    description: 'Find qubit transition frequency by sweeping drive frequency',
    icon: '📊',
  },
  randomized_benchmarking: {
    name: 'Randomized Benchmarking',
    description: 'Characterize average gate fidelity using random Clifford sequences',
    icon: '🎲',
  },
}

// VirtualQuantumLab Component - Simulated hardware characterization lab
export default function VirtualQuantumLab({
  title = 'Virtual Quantum Lab',
  description = 'Perform hardware characterization experiments on a simulated qubit.',
  initialQubitState = {},
  availableExperiments = ['rabi', 't1', 't2_ramsey', 'spectroscopy', 'randomized_benchmarking'],
  onExperimentComplete,
}: VirtualQuantumLabProps) {
  const [qubitState, setQubitState] = useState<QubitState>({
    ...DEFAULT_QUBIT,
    ...initialQubitState,
  })
  const [selectedExperiment, setSelectedExperiment] = useState<ExperimentType>('rabi')
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<ExperimentResult | null>(null)
  const [experimentHistory, setExperimentHistory] = useState<
    Array<{ type: ExperimentType; params: Record<string, number>; timestamp: Date }>
  >([])
  const [showQubitConfig, setShowQubitConfig] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Experiment parameters
  const [experimentParams, setExperimentParams] = useState({
    numPoints: 50,
    numAverages: 100,
    sweepStart: 0,
    sweepEnd: 1,
  })

  // Simulate experiment data
  const runExperiment = useCallback(async () => {
    setIsRunning(true)
    setProgress(0)
    setResults(null)

    const numPoints = experimentParams.numPoints

    // Simulate data acquisition with progress
    for (let i = 0; i < numPoints; i++) {
      await new Promise((resolve) => setTimeout(resolve, 30))
      setProgress(((i + 1) / numPoints) * 100)
    }

    // Generate simulated data based on experiment type
    let xData: number[] = []
    let yData: number[] = []
    let fitData: number[] = []
    let extractedParams: Record<string, number> = {}

    switch (selectedExperiment) {
      case 'rabi': {
        const rabiFreq = qubitState.driveAmplitude * 10 // MHz
        for (let i = 0; i < numPoints; i++) {
          const t = (i / (numPoints - 1)) * 2 // us
          xData.push(t)
          const decay = Math.exp(-t / qubitState.t2)
          const signal = 0.5 * (1 - Math.cos(2 * Math.PI * rabiFreq * t) * decay)
          yData.push(signal + (Math.random() - 0.5) * 0.05)
          fitData.push(0.5 * (1 - Math.cos(2 * Math.PI * rabiFreq * t) * decay))
        }
        extractedParams = {
          rabiFrequency: rabiFreq,
          piPulseTime: 0.5 / rabiFreq,
        }
        break
      }

      case 't1': {
        for (let i = 0; i < numPoints; i++) {
          const t = (i / (numPoints - 1)) * qubitState.t1 * 3 // us
          xData.push(t)
          const signal = Math.exp(-t / qubitState.t1)
          yData.push(signal + (Math.random() - 0.5) * 0.03)
          fitData.push(signal)
        }
        extractedParams = {
          T1: qubitState.t1,
        }
        break
      }

      case 't2_ramsey': {
        const detuning = 0.5 // MHz
        for (let i = 0; i < numPoints; i++) {
          const t = (i / (numPoints - 1)) * qubitState.t2 * 2 // us
          xData.push(t)
          const decay = Math.exp(-t / qubitState.t2)
          const signal = 0.5 * (1 + Math.cos(2 * Math.PI * detuning * t) * decay)
          yData.push(signal + (Math.random() - 0.5) * 0.04)
          fitData.push(0.5 * (1 + Math.cos(2 * Math.PI * detuning * t) * decay))
        }
        extractedParams = {
          T2_star: qubitState.t2 * 0.8,
          detuning,
        }
        break
      }

      case 't2_echo': {
        for (let i = 0; i < numPoints; i++) {
          const t = (i / (numPoints - 1)) * qubitState.t2 * 3 // us
          xData.push(t)
          const t2Echo = qubitState.t2 * 1.5 // Echo extends coherence
          const decay = Math.exp(-t / t2Echo)
          const signal = 0.5 * (1 + decay)
          yData.push(signal + (Math.random() - 0.5) * 0.03)
          fitData.push(0.5 * (1 + decay))
        }
        extractedParams = {
          T2_echo: qubitState.t2 * 1.5,
        }
        break
      }

      case 'spectroscopy': {
        const center = qubitState.frequency
        const width = 0.05 // GHz
        for (let i = 0; i < numPoints; i++) {
          const f = center - 0.2 + (i / (numPoints - 1)) * 0.4 // GHz
          xData.push(f)
          const lorentzian = 1 / (1 + Math.pow((f - center) / width, 2))
          yData.push(lorentzian + (Math.random() - 0.5) * 0.05)
          fitData.push(lorentzian)
        }
        extractedParams = {
          qubitFrequency: center,
          linewidth: width * 1000, // MHz
        }
        break
      }

      case 'randomized_benchmarking': {
        const errorPerGate = 0.001
        const lengths = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]
        for (const len of lengths) {
          xData.push(len)
          const fidelity = Math.pow(1 - 2 * errorPerGate, len)
          yData.push(0.5 * (1 + fidelity) + (Math.random() - 0.5) * 0.02)
          fitData.push(0.5 * (1 + fidelity))
        }
        extractedParams = {
          errorPerClifford: errorPerGate * 1.875, // Convert to Clifford error
          fidelity: (1 - errorPerGate) * 100,
        }
        break
      }
    }

    const result: ExperimentResult = { xData, yData, fitData, extractedParams }
    setResults(result)
    setIsRunning(false)

    // Add to history
    setExperimentHistory((prev) => [
      ...prev.slice(-9),
      {
        type: selectedExperiment,
        params: extractedParams,
        timestamp: new Date(),
      },
    ])

    onExperimentComplete?.(selectedExperiment, result)
  }, [selectedExperiment, qubitState, experimentParams, onExperimentComplete])

  // Draw results on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !results) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.offsetWidth
    const height = canvas.offsetHeight

    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Clear
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, height)

    // Margins
    const margin = { top: 20, right: 20, bottom: 40, left: 50 }
    const plotWidth = width - margin.left - margin.right
    const plotHeight = height - margin.top - margin.bottom

    // Calculate scales
    const xMin = Math.min(...results.xData)
    const xMax = Math.max(...results.xData)
    const yMin = Math.min(...results.yData) * 0.9
    const yMax = Math.max(...results.yData) * 1.1

    const scaleX = (x: number) => margin.left + ((x - xMin) / (xMax - xMin)) * plotWidth
    const scaleY = (y: number) =>
      margin.top + plotHeight - ((y - yMin) / (yMax - yMin)) * plotHeight

    // Draw grid
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (plotHeight / 5) * i
      ctx.beginPath()
      ctx.moveTo(margin.left, y)
      ctx.lineTo(width - margin.right, y)
      ctx.stroke()
    }

    // Draw axes
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(margin.left, margin.top)
    ctx.lineTo(margin.left, height - margin.bottom)
    ctx.lineTo(width - margin.right, height - margin.bottom)
    ctx.stroke()

    // Draw fit line
    if (results.fitData && results.fitData.length > 0) {
      ctx.strokeStyle = '#22d3ee'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < results.xData.length; i++) {
        const x = scaleX(results.xData[i])
        const y = scaleY(results.fitData[i])
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // Draw data points
    ctx.fillStyle = '#f97316'
    results.xData.forEach((xVal, i) => {
      const x = scaleX(xVal)
      const y = scaleY(results.yData[i])
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    })

    // Axis labels
    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'

    // X-axis label
    const xLabel =
      selectedExperiment === 'spectroscopy'
        ? 'Frequency (GHz)'
        : selectedExperiment === 'randomized_benchmarking'
        ? 'Sequence Length'
        : 'Time (us)'
    ctx.fillText(xLabel, width / 2, height - 8)

    // Y-axis label (rotated)
    ctx.save()
    ctx.translate(12, height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Signal (arb.)', 0, 0)
    ctx.restore()

    // Title
    ctx.font = 'bold 14px sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(EXPERIMENTS[selectedExperiment].name, width / 2, 15)
  }, [results, selectedExperiment])

  // Update qubit parameter
  const updateQubitParam = useCallback(
    (key: keyof QubitState, value: number) => {
      setQubitState((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  return (
    <div className="my-6 p-6 bg-neumorph-base border border-white/[0.02] shadow-neumorph-sm rounded-xl">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg
            className="w-5 h-5 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            />
          </svg>
          {title}
        </h3>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Panel - Experiment Selection & Qubit Config */}
        <div className="space-y-4">
          {/* Experiment Selection */}
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <div className="text-xs text-slate-400 mb-2">Select Experiment:</div>
            <div className="space-y-2">
              {availableExperiments.map((exp) => (
                <button
                  key={exp}
                  onClick={() => {
                    setSelectedExperiment(exp)
                    setResults(null)
                  }}
                  disabled={isRunning}
                  className={cn(
                    'w-full p-2 rounded-lg text-left transition-all',
                    selectedExperiment === exp
                      ? 'bg-emerald-500/20 border border-emerald-500'
                      : 'bg-slate-700/50 border border-transparent hover:border-slate-600',
                    isRunning && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{EXPERIMENTS[exp].icon}</span>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {EXPERIMENTS[exp].name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {EXPERIMENTS[exp].description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Qubit Configuration Toggle */}
          <button
            onClick={() => setShowQubitConfig(!showQubitConfig)}
            className="w-full px-3 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors text-sm flex items-center justify-between"
          >
            <span>Qubit Configuration</span>
            <svg
              className={cn(
                'w-4 h-4 transition-transform',
                showQubitConfig && 'rotate-180'
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showQubitConfig && (
            <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
              {/* Frequency */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Qubit Frequency (GHz)</span>
                  <span className="text-white font-mono">
                    {qubitState.frequency.toFixed(3)}
                  </span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="6"
                  step="0.01"
                  value={qubitState.frequency}
                  onChange={(e) => updateQubitParam('frequency', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* T1 */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">T1 (us)</span>
                  <span className="text-white font-mono">{qubitState.t1.toFixed(0)}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="10"
                  value={qubitState.t1}
                  onChange={(e) => updateQubitParam('t1', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
              </div>

              {/* T2 */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">T2 (us)</span>
                  <span className="text-white font-mono">{qubitState.t2.toFixed(0)}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="400"
                  step="5"
                  value={qubitState.t2}
                  onChange={(e) => updateQubitParam('t2', parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Drive Amplitude */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Drive Amplitude</span>
                  <span className="text-white font-mono">
                    {qubitState.driveAmplitude.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={qubitState.driveAmplitude}
                  onChange={(e) =>
                    updateQubitParam('driveAmplitude', parseFloat(e.target.value))
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>
          )}

          {/* Experiment Parameters */}
          <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
            <div className="text-xs text-slate-400">Experiment Settings:</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500">Points</label>
                <input
                  type="number"
                  value={experimentParams.numPoints}
                  onChange={(e) =>
                    setExperimentParams((p) => ({
                      ...p,
                      numPoints: parseInt(e.target.value) || 50,
                    }))
                  }
                  className="w-full px-2 py-1 rounded bg-slate-700 text-white text-sm border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Averages</label>
                <input
                  type="number"
                  value={experimentParams.numAverages}
                  onChange={(e) =>
                    setExperimentParams((p) => ({
                      ...p,
                      numAverages: parseInt(e.target.value) || 100,
                    }))
                  }
                  className="w-full px-2 py-1 rounded bg-slate-700 text-white text-sm border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Center - Results Display */}
        <div className="lg:col-span-2 space-y-4">
          {/* Run Button & Progress */}
          <div className="flex items-center gap-4">
            <button
              onClick={runExperiment}
              disabled={isRunning}
              className={cn(
                'px-6 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2',
                isRunning
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 shadow-lg shadow-emerald-500/25'
              )}
            >
              {isRunning ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Running...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Run Experiment
                </>
              )}
            </button>

            {isRunning && (
              <div className="flex-1">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Acquiring data... {progress.toFixed(0)}%
                </div>
              </div>
            )}
          </div>

          {/* Results Canvas */}
          <div className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-64"
              style={{ imageRendering: 'crisp-edges' }}
            />
            {!results && !isRunning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-slate-500 text-sm">
                  Run an experiment to see results
                </div>
              </div>
            )}
          </div>

          {/* Extracted Parameters */}
          {results && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <div className="text-sm font-medium text-emerald-400 mb-2">
                Extracted Parameters:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(results.extractedParams).map(([key, value]) => (
                  <div key={key} className="p-2 bg-slate-800/50 rounded">
                    <div className="text-[10px] text-slate-500 uppercase">{key}</div>
                    <div className="text-sm font-mono text-emerald-300">
                      {typeof value === 'number' ? value.toFixed(3) : value}
                      {key.includes('T1') || key.includes('T2')
                        ? ' us'
                        : key.includes('Frequency') || key.includes('frequency')
                        ? ' GHz'
                        : key.includes('fidelity')
                        ? '%'
                        : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Experiment History */}
          {experimentHistory.length > 0 && (
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xs text-slate-400 mb-2">Recent Experiments:</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {[...experimentHistory].reverse().map((exp, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs p-2 bg-slate-700/50 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span>{EXPERIMENTS[exp.type].icon}</span>
                      <span className="text-white">{EXPERIMENTS[exp.type].name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-slate-400">
                      <span>
                        {Object.entries(exp.params)
                          .slice(0, 2)
                          .map(([k, v]) => `${k}: ${v.toFixed(2)}`)
                          .join(', ')}
                      </span>
                      <span className="text-[10px]">
                        {exp.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Tips */}
      <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
        <div className="text-xs text-cyan-400">
          <strong>Lab Guide:</strong> Start with spectroscopy to find the qubit frequency,
          then characterize T1 and T2. Use Rabi oscillations to calibrate your pi-pulse.
          Finally, run randomized benchmarking to assess overall gate quality.
        </div>
      </div>
    </div>
  )
}
