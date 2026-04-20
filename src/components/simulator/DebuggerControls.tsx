import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  Square,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useSimulatorStore } from '@/stores/simulatorStore'
import { CircuitDebugger, type DebuggerSnapshot } from '@/lib/quantum/debugger'

interface DebuggerControlsProps {
  debugger: CircuitDebugger | null
  onStepChange?: (snapshot: DebuggerSnapshot) => void
}

export function DebuggerControls({ debugger: dbg, onStepChange }: DebuggerControlsProps) {
  const { debuggerState, setDebuggerState, setDebuggerPlaying, toggleBreakpoint } =
    useSimulatorStore()

  const [speed, setSpeed] = useState(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const progress = dbg?.getProgress() || { current: 0, total: 0, percent: 0 }

  const handleStepForward = useCallback(() => {
    if (!dbg) return
    const snapshot = dbg.stepForward()
    if (snapshot) {
      setDebuggerState(dbg.getState())
      onStepChange?.(snapshot)
    }
  }, [dbg, setDebuggerState, onStepChange])

  const handleStepBackward = useCallback(() => {
    if (!dbg) return
    const snapshot = dbg.stepBackward()
    if (snapshot) {
      setDebuggerState(dbg.getState())
      onStepChange?.(snapshot)
    }
  }, [dbg, setDebuggerState, onStepChange])

  const handleJumpToStart = useCallback(() => {
    if (!dbg) return
    const snapshot = dbg.jumpToStart()
    setDebuggerState(dbg.getState())
    onStepChange?.(snapshot)
  }, [dbg, setDebuggerState, onStepChange])

  const handleJumpToEnd = useCallback(() => {
    if (!dbg) return
    const snapshot = dbg.jumpToEnd()
    if (snapshot) {
      setDebuggerState(dbg.getState())
      onStepChange?.(snapshot)
    }
  }, [dbg, setDebuggerState, onStepChange])

  const handleTogglePlayback = useCallback(() => {
    if (!dbg) return

    if (debuggerState?.isPlaying) {
      dbg.stopPlayback()
      setDebuggerPlaying(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    } else {
      setDebuggerPlaying(true)
      intervalRef.current = setInterval(() => {
        const snapshot = dbg.stepForward()
        if (snapshot) {
          setDebuggerState(dbg.getState())
          onStepChange?.(snapshot)

          if (dbg.hasBreakpoint(snapshot.stepIndex)) {
            dbg.stopPlayback()
            setDebuggerPlaying(false)
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
          }
        } else {
          setDebuggerPlaying(false)
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      }, 1000 / speed)
    }
  }, [dbg, debuggerState?.isPlaying, speed, setDebuggerPlaying, setDebuggerState, onStepChange])

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed)
    dbg?.setPlaybackSpeed(newSpeed)

    if (debuggerState?.isPlaying && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        const snapshot = dbg?.stepForward()
        if (snapshot) {
          setDebuggerState(dbg!.getState())
          onStepChange?.(snapshot)
        } else {
          setDebuggerPlaying(false)
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      }, 1000 / newSpeed)
    }
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!dbg) return
    const step = parseInt(e.target.value) - 1
    const snapshot = dbg.jumpToStep(step)
    if (snapshot) {
      setDebuggerState(dbg.getState())
      onStepChange?.(snapshot)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleJumpToStart}
          disabled={progress.current === 0}
          className="p-2"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleStepBackward}
          disabled={progress.current === 0}
          className="p-2"
        >
          <SkipBack className="w-4 h-4" />
        </Button>

        <Button
          variant={debuggerState?.isPlaying ? 'primary' : 'secondary'}
          onClick={handleTogglePlayback}
          disabled={progress.current >= progress.total}
          className="px-4"
        >
          {debuggerState?.isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleStepForward}
          disabled={progress.current >= progress.total}
          className="p-2"
        >
          <SkipForward className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleJumpToEnd}
          disabled={progress.current >= progress.total}
          className="p-2"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400 w-16">
          Step {progress.current}/{progress.total}
        </span>

        <div className="flex-1 relative">
          <input
            type="range"
            min="0"
            max={progress.total}
            value={progress.current}
            onChange={handleSliderChange}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-quantum-500"
          />

          <div className="absolute top-4 left-0 right-0 flex justify-between pointer-events-none">
            {Array.from({ length: Math.min(progress.total + 1, 13) }).map((_, i) => {
              const step = Math.floor((i / 12) * progress.total)
              const isBreakpoint = debuggerState?.breakpoints.has(step)
              const isCurrent = step === progress.current

              return (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full cursor-pointer pointer-events-auto ${
                    isBreakpoint
                      ? 'bg-red-500'
                      : isCurrent
                      ? 'bg-quantum-500'
                      : 'bg-slate-600'
                  }`}
                  onClick={() => dbg && toggleBreakpoint(step)}
                />
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400">Speed:</span>
          <select
            value={speed}
            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
            className="bg-slate-800 text-white text-xs rounded px-2 py-1 border border-white/10"
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>
      </div>

      {debuggerState && debuggerState.breakpoints.size > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Circle className="w-3 h-3 text-red-500 fill-red-500" />
          <span>Breakpoints: {Array.from(debuggerState.breakpoints).sort((a, b) => a - b).join(', ')}</span>
        </div>
      )}
    </div>
  )
}
