import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Zap, ArrowRight, Check, X, TrendingDown, Layers } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useSimulatorStore } from '@/stores/simulatorStore'
import { optimizeCircuit } from '@/lib/quantum/optimizer'
import type { OptimizationResult } from '@/types/optimizer'

export function OptimizationPanel() {
  const {
    circuit,
    optimizationResult,
    setOptimizationResult,
    applyOptimizedCircuit,
    toggleOptimizationPanel,
  } = useSimulatorStore()

  const handleOptimize = () => {
    const result = optimizeCircuit(circuit)
    setOptimizationResult(result)
  }

  const stats = optimizationResult?.stats

  return (
    <Card variant="neumorph" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-quantum-400" />
          <h3 className="font-semibold text-white text-sm">Circuit Optimization</h3>
        </div>
        <Button variant="secondary" size="sm" onClick={toggleOptimizationPanel}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {!optimizationResult ? (
        <div className="text-center py-4">
          <Layers className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <p className="text-sm text-slate-400 mb-3">
            Optimize your circuit to reduce gate count and depth
          </p>
          <Button onClick={handleOptimize} disabled={circuit.gates.length === 0}>
            <Zap className="w-4 h-4 mr-2" />
            Analyze & Optimize
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xs text-slate-400 mb-1">Original</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">{stats?.originalGateCount}</span>
                <span className="text-xs text-slate-400">gates</span>
              </div>
              <div className="text-xs text-slate-500">Depth: {stats?.originalDepth}</div>
            </div>

            <div className="p-3 bg-quantum-500/10 border border-quantum-500/30 rounded-lg">
              <div className="text-xs text-quantum-400 mb-1">Optimized</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-quantum-400">
                  {stats?.optimizedGateCount}
                </span>
                <span className="text-xs text-slate-400">gates</span>
              </div>
              <div className="text-xs text-quantum-500">Depth: {stats?.optimizedDepth}</div>
            </div>
          </div>

          {stats && stats.gatesRemoved > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg"
            >
              <TrendingDown className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400">
                {stats.reductionPercent.toFixed(1)}% reduction ({stats.gatesRemoved} gates removed)
              </span>
            </motion.div>
          )}

          {optimizationResult.actions.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Optimizations Applied:</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {optimizationResult.actions.map((action, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 bg-slate-800/30 rounded text-xs"
                  >
                    <Check className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">
                      {action.type === 'remove'
                        ? action.details.reason
                        : (action.details as { reason: string }).reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {optimizationResult.suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Suggestions:</div>
              <div className="space-y-1">
                {optimizationResult.suggestions.slice(0, 3).map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs"
                  >
                    <Zap className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="text-amber-300">{suggestion.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              onClick={applyOptimizedCircuit}
              disabled={stats?.gatesRemoved === 0}
            >
              <Check className="w-4 h-4 mr-2" />
              Apply Changes
            </Button>
            <Button variant="secondary" onClick={() => setOptimizationResult(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="text-xs text-slate-500 text-center">
            Optimized in {optimizationResult.executionTimeMs.toFixed(2)}ms
          </div>
        </>
      )}
    </Card>
  )
}

export function OptimizationSuggestions() {
  const { circuit } = useSimulatorStore()

  const suggestions = useMemo(() => {
    if (circuit.gates.length < 2) return []

    const result = optimizeCircuit(circuit)
    return result.suggestions.slice(0, 5)
  }, [circuit])

  if (suggestions.length === 0) return null

  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-400 flex items-center gap-1">
        <Zap className="w-3 h-3" />
        Optimization suggestions:
      </div>
      {suggestions.map((s) => (
        <div
          key={s.id}
          className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded"
        >
          {s.description}
        </div>
      ))}
    </div>
  )
}
