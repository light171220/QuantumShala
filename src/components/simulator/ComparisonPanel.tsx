import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { GitCompare, Plus, X, Trash2, Play, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useSimulatorStore } from '@/stores/simulatorStore'
import { runComparison, getAvailableBackends } from '@/lib/quantum/comparison'
import type { ComparisonBackend } from '@/types/simulator'

export function ComparisonPanel() {
  const {
    circuit,
    comparisonConfig,
    comparisonResult,
    setComparisonConfig,
    setComparisonResult,
    addComparisonBackend,
    removeComparisonBackend,
    toggleComparisonPanel,
  } = useSimulatorStore()

  const [isRunning, setIsRunning] = useState(false)
  const [showBackendSelector, setShowBackendSelector] = useState(false)

  const availableBackends = useMemo(() => {
    return getAvailableBackends(circuit)
  }, [circuit])

  const unselectedBackends = useMemo(() => {
    const selectedIds = new Set(comparisonConfig.backends.map((b) => b.id))
    return availableBackends.filter((b) => !selectedIds.has(b.id))
  }, [availableBackends, comparisonConfig.backends])

  const handleRunComparison = async () => {
    if (comparisonConfig.backends.length < 2) return

    setIsRunning(true)
    try {
      const result = await runComparison(circuit, comparisonConfig)
      setComparisonResult(result)
    } catch (error) {
      console.error('Comparison failed:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const handleAddBackend = (backend: ComparisonBackend) => {
    addComparisonBackend(backend)
    setShowBackendSelector(false)
  }

  return (
    <Card variant="neumorph" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-quantum-400" />
          <h3 className="font-semibold text-white text-sm">Backend Comparison</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={toggleComparisonPanel}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-slate-400">Selected Backends:</div>
        <div className="space-y-2">
          {comparisonConfig.backends.map((backend) => (
            <div
              key={backend.id}
              className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg"
            >
              <div>
                <div className="text-sm text-white">{backend.name}</div>
                <div className="text-xs text-slate-400">
                  {backend.type === 'browser_noisy'
                    ? `Noisy (${backend.noiseConfig?.model.type})`
                    : backend.type}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeComparisonBackend(backend.id)}
                disabled={comparisonConfig.backends.length <= 2}
                className="p-1"
              >
                <Trash2 className="w-4 h-4 text-slate-400" />
              </Button>
            </div>
          ))}
        </div>

        {unselectedBackends.length > 0 && (
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowBackendSelector(!showBackendSelector)}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Backend
            </Button>

            {showBackendSelector && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto"
              >
                {unselectedBackends.map((backend) => (
                  <button
                    key={backend.id}
                    onClick={() => handleAddBackend(backend)}
                    className="w-full p-2 text-left hover:bg-slate-700 text-sm"
                  >
                    <div className="text-white">{backend.name}</div>
                    <div className="text-xs text-slate-400">{backend.type}</div>
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Shots:</span>
          <input
            type="number"
            value={comparisonConfig.shots}
            onChange={(e) =>
              setComparisonConfig({ shots: Math.max(100, parseInt(e.target.value) || 1024) })
            }
            className="w-20 bg-slate-800 text-white text-sm rounded px-2 py-1 border border-white/10"
          />
        </div>
      </div>

      <Button
        variant="primary"
        onClick={handleRunComparison}
        disabled={isRunning || comparisonConfig.backends.length < 2 || circuit.gates.length === 0}
        className="w-full"
      >
        {isRunning ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Running Comparison...
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            Compare ({comparisonConfig.backends.length} backends)
          </>
        )}
      </Button>

      {comparisonConfig.backends.length < 2 && (
        <p className="text-xs text-amber-400 text-center">
          Select at least 2 backends to compare
        </p>
      )}
    </Card>
  )
}
