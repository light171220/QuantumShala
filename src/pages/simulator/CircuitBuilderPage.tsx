import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Plus,
  Minus,
  Trash2,
  Undo,
  Redo,
  Download,
  Share2,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  Cpu,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useSimulatorStore } from '@/stores/simulatorStore'
import { GATE_PALETTE, GATE_DEFINITIONS } from '@/lib/quantum/gates'
import { simulateCircuit } from '@/lib/quantum/simulator'
import type { GateType } from '@/types/simulator'

export default function CircuitBuilderPage() {
  const {
    circuit,
    simulationResult,
    isSimulating,
    setNumQubits,
    addGate,
    removeGate,
    clearCircuit,
    setSimulationResult,
    setSimulating,
    setError,
    undo,
    redo,
  } = useSimulatorStore()

  const [selectedGateType, setSelectedGateType] = useState<GateType | null>(null)
  const [shots, setShots] = useState(1024)
  const [showGatePalette, setShowGatePalette] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [activeCategory, setActiveCategory] = useState('Single Qubit')

  const handleRunSimulation = useCallback(() => {
    setSimulating(true)
    try {
      const result = simulateCircuit(circuit, shots)
      setSimulationResult(result)
      setShowResults(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed')
    }
  }, [circuit, shots, setSimulating, setSimulationResult, setError])

  const handleAddGate = (qubit: number, position: number) => {
    if (!selectedGateType) return

    const gateDef = GATE_DEFINITIONS[selectedGateType]
    const qubits = [qubit]

    if (gateDef.numQubits === 2 && qubit < circuit.numQubits - 1) {
      qubits.push(qubit + 1)
    } else if (gateDef.numQubits === 3 && qubit < circuit.numQubits - 2) {
      qubits.push(qubit + 1, qubit + 2)
    }

    addGate({
      type: selectedGateType,
      qubits,
      position,
      parameters: gateDef.parameters.map((p) => p.default),
      controlQubits: gateDef.numControls > 0 ? [qubits[0]] : undefined,
    })
  }

  const getMaxPosition = () => {
    if (circuit.gates.length === 0) return 0
    return Math.max(...circuit.gates.map((g) => g.position)) + 1
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={undo} className="p-2">
            <Undo className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={redo} className="p-2">
            <Redo className="w-4 h-4" />
          </Button>
          <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNumQubits(Math.min(circuit.numQubits + 1, 15))}
            className="p-2 sm:px-3"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Qubit</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNumQubits(Math.max(circuit.numQubits - 1, 1))}
            className="p-2 sm:px-3"
          >
            <Minus className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Qubit</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCircuit}
            className="p-2 sm:px-3"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Clear</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGatePalette(!showGatePalette)}
            className="lg:hidden px-3 py-2 bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg text-sm text-slate-300 flex items-center gap-2"
          >
            <Menu className="w-4 h-4" />
            Gates
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg">
            <span className="text-sm text-slate-400">Shots:</span>
            <input
              type="number"
              value={shots}
              onChange={(e) => setShots(Math.max(1, Math.min(10000, parseInt(e.target.value) || 1024)))}
              className="w-16 sm:w-20 bg-transparent text-white text-sm focus:outline-none"
            />
          </div>
          <Button
            onClick={handleRunSimulation}
            isLoading={isSimulating}
            leftIcon={<Play className="w-4 h-4" />}
            className="px-3 sm:px-4"
          >
            <span className="hidden sm:inline">Run</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="hidden lg:block w-56 xl:w-64 flex-shrink-0">
          <Card variant="neumorph" className="h-full overflow-y-auto">
            <h3 className="font-semibold text-white mb-4 text-sm">Gate Palette</h3>
            <p className="text-xs text-slate-400 mb-4">
              {selectedGateType
                ? `Selected: ${GATE_DEFINITIONS[selectedGateType].name}`
                : 'Click a gate, then click on the circuit'}
            </p>
            <Tabs value={activeCategory} onChange={setActiveCategory}>
              <TabsList className="flex-wrap mb-4 gap-1">
                {Object.keys(GATE_PALETTE).map((category) => (
                  <TabsTrigger key={category} value={category} className="text-xs px-2 py-1">
                    {category.replace(' Qubit', '')}
                  </TabsTrigger>
                ))}
              </TabsList>
              {Object.entries(GATE_PALETTE).map(([category, gates]) => (
                <TabsContent key={category} value={category} className="space-y-2">
                  {gates.map((gateType) => {
                    const gate = GATE_DEFINITIONS[gateType as GateType]
                    const isSelected = selectedGateType === gateType
                    return (
                      <button
                        key={gateType}
                        onClick={() => setSelectedGateType(gateType as GateType)}
                        className={`w-full p-2 rounded-lg text-left transition-all ${
                          isSelected
                            ? 'bg-quantum-500/20 border border-quantum-500'
                            : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded flex items-center justify-center text-white font-mono font-bold text-sm"
                            style={{ backgroundColor: gate.color }}
                          >
                            {gate.symbol}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-white text-xs truncate">{gate.name}</div>
                            <div className="text-xs text-slate-400">{gate.numQubits}Q</div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </TabsContent>
              ))}
            </Tabs>
          </Card>
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Card variant="neumorph" className="flex-1 overflow-hidden">
            <div className="h-full overflow-auto p-2 sm:p-4">
              {circuit.gates.length === 0 && !selectedGateType ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <Cpu className="w-12 h-12 text-slate-600 mb-4" />
                  <p className="text-slate-400 mb-2">Your circuit is empty</p>
                  <p className="text-xs text-slate-500">
                    Select a gate from the palette, then click on a qubit row to add it
                  </p>
                </div>
              ) : (
                <svg
                  width="100%"
                  height={circuit.numQubits * 60 + 40}
                  className="min-w-[600px] sm:min-w-[800px]"
                >
                  {Array.from({ length: circuit.numQubits }).map((_, qubit) => (
                    <g key={qubit}>
                      <text
                        x={20}
                        y={qubit * 60 + 35}
                        className="fill-slate-400 text-xs sm:text-sm font-mono"
                      >
                        q[{qubit}]
                      </text>
                      <line
                        x1={60}
                        y1={qubit * 60 + 30}
                        x2={800}
                        y2={qubit * 60 + 30}
                        className="stroke-slate-600"
                        strokeWidth={2}
                      />
                      {Array.from({ length: 12 }).map((_, pos) => (
                        <rect
                          key={pos}
                          x={80 + pos * 60}
                          y={qubit * 60 + 10}
                          width={40}
                          height={40}
                          className={`fill-transparent stroke-dashed cursor-pointer transition-colors ${
                            selectedGateType
                              ? 'stroke-quantum-500/50 hover:fill-quantum-500/20'
                              : 'stroke-slate-700 hover:fill-slate-800/50'
                          }`}
                          strokeWidth={1}
                          rx={4}
                          onClick={() => handleAddGate(qubit, pos)}
                        />
                      ))}
                    </g>
                  ))}

                  {circuit.gates.map((gate) => {
                    const gateDef = GATE_DEFINITIONS[gate.type]
                    const x = 80 + gate.position * 60
                    const y = gate.qubits[0] * 60 + 10

                    return (
                      <g key={gate.id} className="cursor-pointer" onClick={() => removeGate(gate.id)}>
                        <rect
                          x={x}
                          y={y}
                          width={40}
                          height={40}
                          fill={gateDef.color}
                          rx={4}
                          className="hover:opacity-80 transition-opacity"
                        />
                        <text
                          x={x + 20}
                          y={y + 25}
                          textAnchor="middle"
                          className="fill-white text-xs font-mono font-bold pointer-events-none"
                        >
                          {gateDef.symbol}
                        </text>

                        {gate.qubits.length > 1 && (
                          <>
                            <line
                              x1={x + 20}
                              y1={y + 40}
                              x2={x + 20}
                              y2={gate.qubits[1] * 60 + 30}
                              stroke={gateDef.color}
                              strokeWidth={2}
                            />
                            <circle
                              cx={x + 20}
                              cy={gate.qubits[1] * 60 + 30}
                              r={gate.type === 'CNOT' ? 10 : 6}
                              fill={gate.type === 'CNOT' ? 'none' : gateDef.color}
                              stroke={gateDef.color}
                              strokeWidth={2}
                            />
                            {gate.type === 'CNOT' && (
                              <>
                                <line
                                  x1={x + 10}
                                  y1={gate.qubits[1] * 60 + 30}
                                  x2={x + 30}
                                  y2={gate.qubits[1] * 60 + 30}
                                  stroke={gateDef.color}
                                  strokeWidth={2}
                                />
                                <line
                                  x1={x + 20}
                                  y1={gate.qubits[1] * 60 + 20}
                                  x2={x + 20}
                                  y2={gate.qubits[1] * 60 + 40}
                                  stroke={gateDef.color}
                                  strokeWidth={2}
                                />
                              </>
                            )}
                          </>
                        )}
                      </g>
                    )
                  })}
                </svg>
              )}
            </div>
          </Card>

          <button
            onClick={() => setShowResults(!showResults)}
            className="lg:hidden flex items-center justify-between w-full mt-4 px-4 py-3 bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg text-slate-300"
          >
            <span className="text-sm font-medium">
              Results {simulationResult && `(${Object.keys(simulationResult.counts).length} states)`}
            </span>
            {showResults ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <AnimatePresence>
            {showResults && simulationResult && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="lg:hidden overflow-hidden"
              >
                <Card variant="neumorph" className="mt-2">
                  <div className="space-y-2">
                    {Object.entries(simulationResult.counts)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 6)
                      .map(([state, count]) => {
                        const prob = count / shots
                        return (
                          <div key={state} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-mono text-quantum-400">|{state}⟩</span>
                              <span className="text-white">{(prob * 100).toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-neumorph-base rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${prob * 100}%` }}
                                className="h-full bg-gradient-to-r from-quantum-500 to-quantum-400"
                              />
                            </div>
                          </div>
                        )
                      })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-slate-400">
                    Time: {simulationResult.executionTime.toFixed(2)}ms
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="hidden lg:block w-72 xl:w-80 flex-shrink-0 space-y-4">
          <Card variant="neumorph">
            <h3 className="font-semibold text-white mb-4 text-sm">Circuit Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Qubits</span>
                <span className="text-white">{circuit.numQubits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gates</span>
                <span className="text-white">{circuit.gates.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Depth</span>
                <span className="text-white">{getMaxPosition()}</span>
              </div>
            </div>
          </Card>

          {simulationResult ? (
            <Card variant="neumorph">
              <h3 className="font-semibold text-white mb-4 text-sm">Results</h3>
              <div className="space-y-2">
                {Object.entries(simulationResult.counts)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 8)
                  .map(([state, count]) => {
                    const prob = count / shots
                    return (
                      <div key={state} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-mono text-quantum-400">|{state}⟩</span>
                          <span className="text-white">{(prob * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-neumorph-base rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${prob * 100}%` }}
                            className="h-full bg-gradient-to-r from-quantum-500 to-quantum-400"
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 text-xs text-slate-400">
                Execution time: {simulationResult.executionTime.toFixed(2)}ms
              </div>
            </Card>
          ) : (
            <Card variant="neumorph">
              <h3 className="font-semibold text-white mb-4 text-sm">Results</h3>
              <div className="text-center py-6 text-slate-400">
                <Play className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Run simulation to see results</p>
              </div>
            </Card>
          )}

          <Card variant="neumorph">
            <h3 className="font-semibold text-white mb-4 text-sm">Export</h3>
            <div className="space-y-2">
              <Button variant="secondary" className="w-full" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export QASM
              </Button>
              <Button variant="secondary" className="w-full" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Qiskit
              </Button>
              <Button variant="secondary" className="w-full" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                Share Circuit
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {showGatePalette && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setShowGatePalette(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-screen w-[280px] bg-neumorph-base backdrop-blur-xl shadow-neumorph-lg border-r border-white/[0.02] z-50 p-4 overflow-y-auto lg:hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">Gate Palette</h2>
                <button
                  onClick={() => setShowGatePalette(false)}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedGateType && (
                <div className="mb-4 p-2 bg-quantum-500/20 rounded-lg text-xs text-quantum-400">
                  Selected: {GATE_DEFINITIONS[selectedGateType].name}
                </div>
              )}

              <Tabs value={activeCategory} onChange={setActiveCategory}>
                <TabsList className="flex-wrap mb-4 gap-1">
                  {Object.keys(GATE_PALETTE).map((category) => (
                    <TabsTrigger key={category} value={category} className="text-xs px-2 py-1">
                      {category.replace(' Qubit', '')}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {Object.entries(GATE_PALETTE).map(([category, gates]) => (
                  <TabsContent key={category} value={category} className="space-y-2">
                    {gates.map((gateType) => {
                      const gate = GATE_DEFINITIONS[gateType as GateType]
                      const isSelected = selectedGateType === gateType
                      return (
                        <button
                          key={gateType}
                          onClick={() => {
                            setSelectedGateType(gateType as GateType)
                            setShowGatePalette(false)
                          }}
                          className={`w-full p-3 rounded-lg text-left transition-all ${
                            isSelected
                              ? 'bg-quantum-500/20 border border-quantum-500'
                              : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded flex items-center justify-center text-white font-mono font-bold"
                              style={{ backgroundColor: gate.color }}
                            >
                              {gate.symbol}
                            </div>
                            <div>
                              <div className="font-medium text-white text-sm">{gate.name}</div>
                              <div className="text-xs text-slate-400">{gate.numQubits}Q</div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </TabsContent>
                ))}
              </Tabs>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
