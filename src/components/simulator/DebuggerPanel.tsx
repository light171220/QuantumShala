import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bug, X, Eye, Activity } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useSimulatorStore } from '@/stores/simulatorStore'
import { CircuitDebugger, createDebugger, type DebuggerSnapshot } from '@/lib/quantum/debugger'
import { DebuggerControls } from './DebuggerControls'
import { StateVectorDisplay } from './StateVectorDisplay'
import { MultiBlochViewer } from './BlochSphereViewer'

export function DebuggerPanel() {
  const {
    circuit,
    debuggerState,
    setDebuggerState,
    toggleDebuggerPanel,
    showDebuggerPanel,
  } = useSimulatorStore()

  const [debuggerInstance, setDebuggerInstance] = useState<CircuitDebugger | null>(null)
  const [currentSnapshot, setCurrentSnapshot] = useState<DebuggerSnapshot | null>(null)
  const [previousSnapshot, setPreviousSnapshot] = useState<DebuggerSnapshot | null>(null)
  const [activeView, setActiveView] = useState('state')

  useEffect(() => {
    if (showDebuggerPanel && circuit.gates.length > 0) {
      const dbg = createDebugger(circuit)
      setDebuggerInstance(dbg)
      setDebuggerState(dbg.getState())
      setCurrentSnapshot(dbg.getCurrentSnapshot())
      setPreviousSnapshot(null)
    } else {
      setDebuggerInstance(null)
      setCurrentSnapshot(null)
      setPreviousSnapshot(null)
    }
  }, [showDebuggerPanel, circuit, setDebuggerState])

  const handleStepChange = (snapshot: DebuggerSnapshot) => {
    setPreviousSnapshot(currentSnapshot)
    setCurrentSnapshot(snapshot)
  }

  const currentGate = debuggerInstance?.getCurrentGate()
  const nextGate = debuggerInstance?.getNextGate()

  if (!showDebuggerPanel) return null

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="border-t border-white/10"
    >
      <Card variant="neumorph" className="mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-quantum-400" />
            <h3 className="font-semibold text-white text-sm">Step-by-Step Debugger</h3>
            {debuggerState && (
              <span className="text-xs text-slate-400">
                Step {debuggerState.currentStep + 1} of {debuggerState.totalSteps}
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={toggleDebuggerPanel}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {circuit.gates.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Bug className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Add gates to your circuit to start debugging</p>
          </div>
        ) : (
          <div className="space-y-4">
            <DebuggerControls
              debugger={debuggerInstance}
              onStepChange={handleStepChange}
            />

            {currentGate && (
              <div className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg">
                <div>
                  <div className="text-xs text-slate-400">Current Gate</div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-quantum-500/20 text-quantum-400 text-sm font-mono rounded">
                      {currentGate.type}
                    </span>
                    <span className="text-sm text-slate-300">
                      on qubit{currentGate.qubits.length > 1 ? 's' : ''}{' '}
                      {currentGate.qubits.join(', ')}
                    </span>
                  </div>
                </div>
                {nextGate && (
                  <div className="border-l border-white/10 pl-4">
                    <div className="text-xs text-slate-500">Next</div>
                    <span className="text-sm text-slate-400 font-mono">
                      {nextGate.type}({nextGate.qubits.join(',')})
                    </span>
                  </div>
                )}
              </div>
            )}

            <Tabs value={activeView} onChange={setActiveView}>
              <TabsList className="mb-3">
                <TabsTrigger value="state" className="text-xs">
                  <Eye className="w-3 h-3 mr-1" />
                  State Vector
                </TabsTrigger>
                <TabsTrigger value="bloch" className="text-xs">
                  <Activity className="w-3 h-3 mr-1" />
                  Bloch Sphere
                </TabsTrigger>
                <TabsTrigger value="probs" className="text-xs">
                  Probabilities
                </TabsTrigger>
              </TabsList>

              <TabsContent value="state">
                {currentSnapshot ? (
                  <StateVectorDisplay
                    stateVector={currentSnapshot.stateVector}
                    previousStateVector={previousSnapshot?.stateVector}
                    numQubits={circuit.numQubits}
                    highlightChanges
                    maxStates={16}
                  />
                ) : (
                  <div className="text-center py-4 text-slate-400 text-sm">
                    Step forward to see state evolution
                  </div>
                )}
              </TabsContent>

              <TabsContent value="bloch">
                {currentSnapshot ? (
                  <MultiBlochViewer blochVectors={currentSnapshot.blochVectors} />
                ) : (
                  <div className="text-center py-4 text-slate-400 text-sm">
                    Step forward to see Bloch vectors
                  </div>
                )}
              </TabsContent>

              <TabsContent value="probs">
                {currentSnapshot ? (
                  <ProbabilityHistogram
                    probabilities={currentSnapshot.probabilities}
                    previousProbabilities={previousSnapshot?.probabilities}
                  />
                ) : (
                  <div className="text-center py-4 text-slate-400 text-sm">
                    Step forward to see probabilities
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </Card>
    </motion.div>
  )
}

interface ProbabilityHistogramProps {
  probabilities: Record<string, number>
  previousProbabilities?: Record<string, number>
}

function ProbabilityHistogram({
  probabilities,
  previousProbabilities,
}: ProbabilityHistogramProps) {
  const sortedEntries = useMemo(() => {
    return Object.entries(probabilities)
      .filter(([, prob]) => prob > 0.001)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
  }, [probabilities])

  if (sortedEntries.length === 0) {
    return (
      <div className="text-center py-4 text-slate-400 text-sm">
        No significant probabilities
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sortedEntries.map(([state, prob]) => {
        const prevProb = previousProbabilities?.[state] ?? 0
        const change = prob - prevProb
        const hasChanged = Math.abs(change) > 0.01

        return (
          <div key={state} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-mono text-quantum-400">|{state}⟩</span>
              <div className="flex items-center gap-2">
                <span className="text-white">{(prob * 100).toFixed(1)}%</span>
                {hasChanged && (
                  <span
                    className={`text-xs ${
                      change > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {change > 0 ? '+' : ''}
                    {(change * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden relative">
              {previousProbabilities && (
                <div
                  className="absolute h-full bg-slate-600"
                  style={{ width: `${(prevProb || 0) * 100}%` }}
                />
              )}
              <motion.div
                initial={{ width: previousProbabilities ? `${(prevProb || 0) * 100}%` : 0 }}
                animate={{ width: `${prob * 100}%` }}
                transition={{ duration: 0.3 }}
                className="h-full bg-gradient-to-r from-quantum-500 to-quantum-400 relative z-10"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
