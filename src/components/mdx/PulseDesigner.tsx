'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { cn } from '@/utils/cn'

// Types
type WaveformType = 'gaussian' | 'square' | 'drag' | 'cosine' | 'custom'

interface PulseSegment {
  id: string
  type: WaveformType
  amplitude: number
  duration: number
  frequency: number
  phase: number
  sigma?: number // For Gaussian
  beta?: number // For DRAG
}

interface PulseDesignerProps {
  title?: string
  description?: string
  initialPulse?: PulseSegment[]
  maxDuration?: number
  sampleRate?: number
  targetGate?: string
  onPulseChange?: (pulse: PulseSegment[]) => void
  showFidelityEstimate?: boolean
}

// Constants
const WAVEFORM_TYPES: { value: WaveformType; label: string; color: string }[] = [
  { value: 'gaussian', label: 'Gaussian', color: '#3b82f6' },
  { value: 'square', label: 'Square', color: '#22c55e' },
  { value: 'drag', label: 'DRAG', color: '#a855f7' },
  { value: 'cosine', label: 'Cosine', color: '#f59e0b' },
  { value: 'custom', label: 'Custom', color: '#ec4899' },
]

// PulseDesigner Component - Design control pulse sequences with waveform visualization
export default function PulseDesigner({
  title = 'Pulse Designer',
  description = 'Design quantum control pulses by adding and configuring waveform segments.',
  initialPulse = [],
  maxDuration = 1000,
  sampleRate = 1000,
  targetGate = 'X',
  onPulseChange,
  showFidelityEstimate = true,
}: PulseDesignerProps) {
  const [segments, setSegments] = useState<PulseSegment[]>(initialPulse)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [showIQ, setShowIQ] = useState(true)
  const [showEnvelope, setShowEnvelope] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(1)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Calculate total duration
  const totalDuration = useMemo(() => {
    return segments.reduce((sum, seg) => sum + seg.duration, 0)
  }, [segments])

  // Generate waveform samples
  const waveformSamples = useMemo(() => {
    const totalSamples = Math.ceil((totalDuration / 1000) * sampleRate)
    const iChannel: number[] = []
    const qChannel: number[] = []
    const envelope: number[] = []
    const times: number[] = []

    let currentTime = 0

    segments.forEach((segment) => {
      const segmentSamples = Math.ceil((segment.duration / 1000) * sampleRate)

      for (let i = 0; i < segmentSamples; i++) {
        const t = i / segmentSamples
        const absoluteTime = currentTime + (i / sampleRate) * 1000
        times.push(absoluteTime)

        let envValue = 0
        let phaseOffset = 0

        switch (segment.type) {
          case 'gaussian': {
            const sigma = segment.sigma || 0.25
            const center = 0.5
            envValue =
              segment.amplitude * Math.exp(-Math.pow(t - center, 2) / (2 * sigma * sigma))
            break
          }
          case 'square': {
            envValue = segment.amplitude
            break
          }
          case 'drag': {
            const sigma = segment.sigma || 0.25
            const center = 0.5
            const beta = segment.beta || 0.1
            const gaussEnv = Math.exp(-Math.pow(t - center, 2) / (2 * sigma * sigma))
            const dragCorrection = (-beta * (t - center)) / (sigma * sigma)
            envValue = segment.amplitude * gaussEnv
            phaseOffset = dragCorrection
            break
          }
          case 'cosine': {
            envValue = segment.amplitude * (1 - Math.cos(2 * Math.PI * t)) / 2
            break
          }
          case 'custom': {
            // Simple sine envelope for custom
            envValue = segment.amplitude * Math.sin(Math.PI * t)
            break
          }
        }

        envelope.push(envValue)

        // Apply frequency and phase modulation
        const omega = 2 * Math.PI * segment.frequency * (absoluteTime / 1000)
        const phase = segment.phase * (Math.PI / 180) + phaseOffset
        iChannel.push(envValue * Math.cos(omega + phase))
        qChannel.push(envValue * Math.sin(omega + phase))
      }

      currentTime += segment.duration
    })

    return { times, iChannel, qChannel, envelope }
  }, [segments, sampleRate, totalDuration])

  // Draw waveform on canvas
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

    // Clear canvas
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, height)

    // Draw grid
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1

    // Horizontal lines
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Vertical lines (time divisions)
    const timeDiv = 100 / zoomLevel
    for (let t = 0; t <= totalDuration; t += timeDiv) {
      const x = (t / totalDuration) * width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // Center line
    ctx.strokeStyle = '#475569'
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()

    const { times, iChannel, qChannel, envelope } = waveformSamples

    if (times.length === 0) return

    const scaleY = (val: number) => height / 2 - (val * height) / 2.5
    const scaleX = (t: number) => (t / totalDuration) * width

    // Draw envelope
    if (showEnvelope) {
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      for (let i = 0; i < times.length; i++) {
        const x = scaleX(times[i])
        const y = scaleY(envelope[i])
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Negative envelope
      ctx.beginPath()
      for (let i = 0; i < times.length; i++) {
        const x = scaleX(times[i])
        const y = scaleY(-envelope[i])
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Draw I channel
    if (showIQ) {
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < times.length; i++) {
        const x = scaleX(times[i])
        const y = scaleY(iChannel[i])
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Draw Q channel
      ctx.strokeStyle = '#f97316'
      ctx.beginPath()
      for (let i = 0; i < times.length; i++) {
        const x = scaleX(times[i])
        const y = scaleY(qChannel[i])
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // Draw segment boundaries
    let accumulatedTime = 0
    segments.forEach((segment, index) => {
      accumulatedTime += segment.duration
      const x = scaleX(accumulatedTime)

      ctx.strokeStyle = segment.id === selectedSegmentId ? '#22d3ee' : '#64748b'
      ctx.lineWidth = segment.id === selectedSegmentId ? 2 : 1
      ctx.setLineDash([4, 2])
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
      ctx.setLineDash([])
    })
  }, [waveformSamples, showIQ, showEnvelope, zoomLevel, segments, selectedSegmentId, totalDuration])

  // Add new segment
  const addSegment = useCallback(
    (type: WaveformType) => {
      const newSegment: PulseSegment = {
        id: `seg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        amplitude: 1.0,
        duration: 100,
        frequency: 5.0,
        phase: 0,
        sigma: 0.25,
        beta: 0.1,
      }

      setSegments((prev) => [...prev, newSegment])
      setSelectedSegmentId(newSegment.id)
      onPulseChange?.([...segments, newSegment])
    },
    [segments, onPulseChange]
  )

  // Update segment
  const updateSegment = useCallback(
    (id: string, updates: Partial<PulseSegment>) => {
      setSegments((prev) => {
        const newSegments = prev.map((seg) =>
          seg.id === id ? { ...seg, ...updates } : seg
        )
        onPulseChange?.(newSegments)
        return newSegments
      })
    },
    [onPulseChange]
  )

  // Remove segment
  const removeSegment = useCallback(
    (id: string) => {
      setSegments((prev) => {
        const newSegments = prev.filter((seg) => seg.id !== id)
        onPulseChange?.(newSegments)
        return newSegments
      })
      if (selectedSegmentId === id) {
        setSelectedSegmentId(null)
      }
    },
    [selectedSegmentId, onPulseChange]
  )

  // Get selected segment
  const selectedSegment = useMemo(() => {
    return segments.find((seg) => seg.id === selectedSegmentId) || null
  }, [segments, selectedSegmentId])

  // Estimate fidelity (simplified placeholder)
  const estimatedFidelity = useMemo(() => {
    if (segments.length === 0) return 0
    // Simple heuristic based on pulse parameters
    const avgAmplitude =
      segments.reduce((sum, seg) => sum + seg.amplitude, 0) / segments.length
    const durationFactor = Math.min(1, totalDuration / 200)
    return Math.min(0.99, 0.7 + avgAmplitude * 0.2 * durationFactor)
  }, [segments, totalDuration])

  return (
    <div className="my-6 p-6 bg-neumorph-base border border-white/[0.02] shadow-neumorph-sm rounded-xl">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg
            className="w-5 h-5 text-orange-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          {title}
        </h3>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
      </div>

      {/* Target Gate Info */}
      <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-orange-400 font-medium">Target Gate: </span>
            <span className="text-orange-300 font-mono font-bold">{targetGate}</span>
          </div>
          {showFidelityEstimate && (
            <div>
              <span className="text-xs text-slate-400">Est. Fidelity: </span>
              <span
                className={cn(
                  'font-mono font-bold',
                  estimatedFidelity >= 0.99
                    ? 'text-green-400'
                    : estimatedFidelity >= 0.9
                    ? 'text-yellow-400'
                    : 'text-red-400'
                )}
              >
                {(estimatedFidelity * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Add Segment Buttons */}
      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg">
        <div className="text-xs text-slate-400 mb-2">Add Pulse Segment:</div>
        <div className="flex flex-wrap gap-2">
          {WAVEFORM_TYPES.map((waveform) => (
            <button
              key={waveform.value}
              onClick={() => addSegment(waveform.value)}
              disabled={totalDuration >= maxDuration}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                totalDuration >= maxDuration
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
              )}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: waveform.color }}
              />
              {waveform.label}
            </button>
          ))}
        </div>
      </div>

      {/* Waveform Canvas */}
      <div className="mb-4 relative">
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
          <button
            onClick={() => setShowIQ(!showIQ)}
            className={cn(
              'px-2 py-1 rounded text-xs transition-colors',
              showIQ ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'
            )}
          >
            I/Q
          </button>
          <button
            onClick={() => setShowEnvelope(!showEnvelope)}
            className={cn(
              'px-2 py-1 rounded text-xs transition-colors',
              showEnvelope ? 'bg-slate-500/20 text-slate-300' : 'bg-slate-700 text-slate-400'
            )}
          >
            Envelope
          </button>
          <div className="flex items-center gap-1 bg-slate-800 rounded px-2">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
              className="text-slate-400 hover:text-white px-1"
            >
              -
            </button>
            <span className="text-xs text-slate-400 w-10 text-center">
              {(zoomLevel * 100).toFixed(0)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(4, z + 0.25))}
              className="text-slate-400 hover:text-white px-1"
            >
              +
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          className="w-full h-48 rounded-lg border border-slate-700"
          style={{ imageRendering: 'crisp-edges' }}
        />

        {/* Legend */}
        <div className="absolute bottom-2 left-2 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-blue-500" />
            <span className="text-blue-400">I</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-orange-500" />
            <span className="text-orange-400">Q</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-slate-400 border-dashed border-b" />
            <span className="text-slate-400">Envelope</span>
          </div>
        </div>

        {/* Time axis label */}
        <div className="text-xs text-slate-500 text-center mt-1">
          Time (ns) - Total: {totalDuration.toFixed(0)} ns / {maxDuration} ns max
        </div>
      </div>

      {/* Segment List & Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Segment List */}
        <div className="p-3 bg-slate-800/50 rounded-lg">
          <div className="text-xs text-slate-400 mb-2">Pulse Segments:</div>
          {segments.length === 0 ? (
            <div className="text-sm text-slate-500 italic text-center py-4">
              No segments. Click a waveform type above to add one.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {segments.map((segment, index) => {
                const waveformDef = WAVEFORM_TYPES.find((w) => w.value === segment.type)
                return (
                  <div
                    key={segment.id}
                    onClick={() => setSelectedSegmentId(segment.id)}
                    className={cn(
                      'p-2 rounded-lg cursor-pointer transition-all flex items-center justify-between',
                      segment.id === selectedSegmentId
                        ? 'bg-cyan-500/20 border border-cyan-500'
                        : 'bg-slate-700/50 border border-transparent hover:border-slate-600'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-4">{index + 1}.</span>
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: waveformDef?.color }}
                      />
                      <span className="text-sm text-white">{waveformDef?.label}</span>
                      <span className="text-xs text-slate-400">
                        {segment.duration.toFixed(0)}ns
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeSegment(segment.id)
                      }}
                      className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Segment Editor */}
        <div className="p-3 bg-slate-800/50 rounded-lg">
          <div className="text-xs text-slate-400 mb-2">Segment Parameters:</div>
          {selectedSegment ? (
            <div className="space-y-3">
              {/* Amplitude */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Amplitude</span>
                  <span className="text-white font-mono">
                    {selectedSegment.amplitude.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={selectedSegment.amplitude}
                  onChange={(e) =>
                    updateSegment(selectedSegment.id, {
                      amplitude: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Duration */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Duration (ns)</span>
                  <span className="text-white font-mono">
                    {selectedSegment.duration.toFixed(0)}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="10"
                  value={selectedSegment.duration}
                  onChange={(e) =>
                    updateSegment(selectedSegment.id, {
                      duration: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Frequency */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Frequency (GHz)</span>
                  <span className="text-white font-mono">
                    {selectedSegment.frequency.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={selectedSegment.frequency}
                  onChange={(e) =>
                    updateSegment(selectedSegment.id, {
                      frequency: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Phase */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Phase (deg)</span>
                  <span className="text-white font-mono">
                    {selectedSegment.phase.toFixed(0)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={selectedSegment.phase}
                  onChange={(e) =>
                    updateSegment(selectedSegment.id, {
                      phase: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Gaussian/DRAG specific: Sigma */}
              {(selectedSegment.type === 'gaussian' || selectedSegment.type === 'drag') && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Sigma</span>
                    <span className="text-white font-mono">
                      {(selectedSegment.sigma || 0.25).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.01"
                    value={selectedSegment.sigma || 0.25}
                    onChange={(e) =>
                      updateSegment(selectedSegment.id, {
                        sigma: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              )}

              {/* DRAG specific: Beta */}
              {selectedSegment.type === 'drag' && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">DRAG Beta</span>
                    <span className="text-white font-mono">
                      {(selectedSegment.beta || 0.1).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-0.5"
                    max="0.5"
                    step="0.01"
                    value={selectedSegment.beta || 0.1}
                    onChange={(e) =>
                      updateSegment(selectedSegment.id, {
                        beta: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-slate-500 italic text-center py-8">
              Select a segment to edit its parameters
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            setSegments([])
            setSelectedSegmentId(null)
            onPulseChange?.([])
          }}
          className="px-4 py-2 rounded-lg font-medium text-sm bg-slate-700 text-white hover:bg-slate-600 transition-colors"
        >
          Clear All
        </button>
        <button
          onClick={() => {
            console.log('Pulse sequence:', segments)
            alert('Pulse sequence logged to console')
          }}
          className="px-4 py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-400 hover:to-orange-500 shadow-lg shadow-orange-500/25 transition-all"
        >
          Export Pulse
        </button>
      </div>
    </div>
  )
}
