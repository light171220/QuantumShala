import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { Complex } from '@/types/simulator'
import { formatAmplitude, getSignificantStates } from '@/lib/quantum/debugger'

interface StateVectorDisplayProps {
  stateVector: Complex[]
  previousStateVector?: Complex[]
  numQubits: number
  maxStates?: number
  showPhase?: boolean
  highlightChanges?: boolean
}

export function StateVectorDisplay({
  stateVector,
  previousStateVector,
  numQubits,
  maxStates = 16,
  showPhase = true,
  highlightChanges = true,
}: StateVectorDisplayProps) {
  const significantStates = useMemo(() => {
    return getSignificantStates(stateVector, 1e-8).slice(0, maxStates)
  }, [stateVector, maxStates])

  const previousStates = useMemo(() => {
    if (!previousStateVector) return new Map<number, Complex>()
    const map = new Map<number, Complex>()
    getSignificantStates(previousStateVector, 1e-8).forEach((s) => {
      map.set(s.index, s.amplitude)
    })
    return map
  }, [previousStateVector])

  const hasChanged = (index: number, current: Complex): boolean => {
    if (!highlightChanges || !previousStateVector) return false
    const prev = previousStates.get(index)
    if (!prev) return current.re !== 0 || current.im !== 0
    return Math.abs(prev.re - current.re) > 1e-6 || Math.abs(prev.im - current.im) > 1e-6
  }

  const getPhaseAngle = (c: Complex): number => {
    return Math.atan2(c.im, c.re) * (180 / Math.PI)
  }

  const getPhaseColor = (angle: number): string => {
    const hue = ((angle + 180) / 360) * 360
    return `hsl(${hue}, 70%, 50%)`
  }

  if (significantStates.length === 0) {
    return (
      <div className="text-center py-4 text-slate-400 text-sm">
        No significant amplitudes
      </div>
    )
  }

  return (
    <div className="space-y-1 max-h-64 overflow-y-auto">
      <div className="grid grid-cols-12 gap-1 text-[10px] text-slate-500 px-2 sticky top-0 bg-neumorph-base">
        <div className="col-span-3">State</div>
        <div className="col-span-5">Amplitude</div>
        <div className="col-span-3">Prob</div>
        {showPhase && <div className="col-span-1">Phase</div>}
      </div>

      {significantStates.map((state) => {
        const changed = hasChanged(state.index, state.amplitude)
        const phaseAngle = getPhaseAngle(state.amplitude)

        return (
          <motion.div
            key={state.index}
            initial={changed ? { backgroundColor: 'rgba(59, 130, 246, 0.3)' } : {}}
            animate={{ backgroundColor: 'transparent' }}
            transition={{ duration: 0.5 }}
            className={`grid grid-cols-12 gap-1 text-xs px-2 py-1 rounded ${
              changed ? 'bg-quantum-500/10' : ''
            }`}
          >
            <div className="col-span-3 font-mono text-quantum-400">
              |{state.bitString}⟩
            </div>

            <div className="col-span-5 font-mono text-white text-[11px]">
              {formatAmplitude(state.amplitude, 3)}
            </div>

            <div className="col-span-3 flex items-center gap-1">
              <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${state.probability * 100}%` }}
                  className="h-full bg-gradient-to-r from-quantum-500 to-quantum-400"
                />
              </div>
              <span className="text-[10px] text-slate-400 w-10 text-right">
                {(state.probability * 100).toFixed(1)}%
              </span>
            </div>

            {showPhase && (
              <div className="col-span-1 flex items-center justify-center">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: getPhaseColor(phaseAngle),
                    boxShadow: `0 0 4px ${getPhaseColor(phaseAngle)}`,
                  }}
                  title={`Phase: ${phaseAngle.toFixed(1)}°`}
                />
              </div>
            )}
          </motion.div>
        )
      })}

      {stateVector.length > maxStates && (
        <div className="text-center text-xs text-slate-500 py-2">
          Showing top {maxStates} of {stateVector.length} states
        </div>
      )}
    </div>
  )
}

interface CompactStateDisplayProps {
  stateVector: Complex[]
  numQubits: number
}

export function CompactStateDisplay({ stateVector, numQubits }: CompactStateDisplayProps) {
  const significantStates = useMemo(() => {
    return getSignificantStates(stateVector, 0.01).slice(0, 4)
  }, [stateVector])

  return (
    <div className="flex flex-wrap gap-2">
      {significantStates.map((state) => (
        <div
          key={state.index}
          className="px-2 py-1 bg-slate-800 rounded text-xs"
        >
          <span className="font-mono text-quantum-400">|{state.bitString}⟩</span>
          <span className="text-slate-400 ml-1">
            {(state.probability * 100).toFixed(0)}%
          </span>
        </div>
      ))}
      {stateVector.length > 4 && (
        <div className="px-2 py-1 text-slate-500 text-xs">
          +{getSignificantStates(stateVector, 0.01).length - 4} more
        </div>
      )}
    </div>
  )
}
