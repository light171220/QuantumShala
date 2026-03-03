import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
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
  Volume2,
  VolumeX,
  Bug,
  Zap,
  GitCompare,
  Copy,
  Clipboard,
  FileCode,
  Sparkles,
  Keyboard,
  Info,
  Settings,
  Save,
  Cloud,
  Monitor,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useSimulatorStore } from '@/stores/simulatorStore'
import { useSimulator } from '@/hooks/useSimulator'
import { GATE_PALETTE, GATE_DEFINITIONS } from '@/lib/quantum/gates'
import { simulateNoisyCircuit } from '@/lib/quantum/noise-simulator'
import { CIRCUIT_TEMPLATES, createCircuitFromTemplate, type CircuitTemplate } from '@/lib/quantum/circuit-templates'
import {
  DraggableGate,
  DragOverlayGate,
  CircuitCanvas,
  GateParameterModal,
  TemplatesPanel,
} from '@/components/circuit-builder'
import {
  NoiseConfigPanel,
  OptimizationPanel,
  DebuggerPanel,
  ComparisonPanel,
  ComparisonResults,
  ResizablePanel,
} from '@/components/simulator'
import type { GateType, CircuitGate } from '@/types/simulator'

export default function CircuitBuilderPage() {
  const {
    circuit,
    simulationResult,
    isSimulating,
    noiseConfig,
    debuggerState,
    showOptimizationPanel,
    showComparisonPanel,
    showDebuggerPanel,
    showNoisePanel,
    comparisonResult,
    setCircuit,
    setNumQubits,
    addGate,
    removeGate,
    updateGate,
    clearCircuit,
    setSimulationResult,
    setSimulating,
    setError,
    undo,
    redo,
    toggleNoise,
    toggleNoisePanel,
    toggleOptimizationPanel,
    toggleDebuggerPanel,
    toggleComparisonPanel,
    exportToQASM,
    exportToQiskit,
  } = useSimulatorStore()

  const [selectedGateType, setSelectedGateType] = useState<GateType | null>(null)
  const [selectedGateIds, setSelectedGateIds] = useState<Set<string>>(new Set())
  const [shots, setShots] = useState(1024)
  const [showGatePalette, setShowGatePalette] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [activeCategory, setActiveCategory] = useState('Single Qubit')
  const [showTemplates, setShowTemplates] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [editingGate, setEditingGate] = useState<CircuitGate | null>(null)
  const [clipboard, setClipboard] = useState<CircuitGate[]>([])
  const [draggedGateType, setDraggedGateType] = useState<GateType | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  const {
    runSimulation,
    getSimulationBackend,
    maxBrowserQubits,
  } = useSimulator()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const currentBackend = getSimulationBackend()
  const isLambdaBackend = currentBackend.startsWith('lambda')

  const handleRunSimulation = useCallback(async () => {
    setSimulating(true)
    try {
      if (noiseConfig.enabled) {
        const result = simulateNoisyCircuit(circuit, shots, noiseConfig)
        setSimulationResult(result)
        setShowResults(true)
      } else {
        const result = await runSimulation({ shots })
        if (result) {
          setShowResults(true)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed')
    } finally {
      setSimulating(false)
    }
  }, [circuit, shots, noiseConfig, setSimulating, setSimulationResult, setError, runSimulation])

  const handleCopy = useCallback(() => {
    const gates = circuit.gates.filter((g) => selectedGateIds.has(g.id))
    if (gates.length > 0) {
      setClipboard(gates)
    }
  }, [circuit.gates, selectedGateIds])

  const handlePaste = useCallback(() => {
    if (clipboard.length === 0) return
    const positions = circuit.gates.map((g) => g.position)
    const maxPos = positions.length > 0 ? Math.max(...positions) + 1 : 0
    clipboard.forEach((gate, idx) => {
      addGate({
        type: gate.type,
        qubits: gate.qubits,
        position: maxPos + idx,
        parameters: gate.parameters,
        controlQubits: gate.controlQubits,
      })
    })
  }, [clipboard, circuit.gates, addGate])

  const handleSelectAll = useCallback(() => {
    setSelectedGateIds(new Set(circuit.gates.map((g) => g.id)))
  }, [circuit.gates])

  const handleDeleteSelected = useCallback(() => {
    selectedGateIds.forEach((id) => removeGate(id))
    setSelectedGateIds(new Set())
  }, [selectedGateIds, removeGate])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const isMeta = e.metaKey || e.ctrlKey

      if (isMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (isMeta && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if (isMeta && e.key === 'c') {
        e.preventDefault()
        handleCopy()
      } else if (isMeta && e.key === 'v') {
        e.preventDefault()
        handlePaste()
      } else if (isMeta && e.key === 'a') {
        e.preventDefault()
        handleSelectAll()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedGateIds.size > 0) {
          e.preventDefault()
          handleDeleteSelected()
        }
      } else if (e.key === 'Escape') {
        setSelectedGateType(null)
        setSelectedGateIds(new Set())
      } else if (e.key === 'r' && !isMeta) {
        e.preventDefault()
        handleRunSimulation()
      } else if (e.key === 't' && !isMeta) {
        e.preventDefault()
        setShowTemplates(true)
      } else if (e.key === '?') {
        setShowKeyboardHelp(true)
      }

      const gateShortcuts: Record<string, GateType> = {
        h: 'H', x: 'X', y: 'Y', z: 'Z',
        s: 'S', t: 'T', c: 'CNOT',
      }
      if (gateShortcuts[e.key.toLowerCase()] && !isMeta) {
        setSelectedGateType(gateShortcuts[e.key.toLowerCase()])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, handleCopy, handlePaste, handleSelectAll, handleDeleteSelected, handleRunSimulation, selectedGateIds])

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    if (active.data.current?.type === 'palette-gate') {
      setDraggedGateType(active.data.current.gateType)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setDraggedGateType(null)

    if (!over || !active.data.current) return

    if (active.data.current.type === 'palette-gate' && over.data.current) {
      const { qubit, position } = over.data.current
      const gateType = active.data.current.gateType as GateType
      handleAddGate(gateType, qubit, position)
    }
  }

  const handleAddGate = (gateType: GateType, qubit: number, position: number) => {
    const gateDef = GATE_DEFINITIONS[gateType]
    const qubits = [qubit]

    if (gateDef.numQubits === 2 && qubit < circuit.numQubits - 1) {
      qubits.push(qubit + 1)
    } else if (gateDef.numQubits === 3 && qubit < circuit.numQubits - 2) {
      qubits.push(qubit + 1, qubit + 2)
    }

    addGate({
      type: gateType,
      qubits,
      position,
      parameters: gateDef.parameters.map((p) => p.default),
      controlQubits: gateDef.numControls > 0 ? [qubits[0]] : undefined,
    })
  }

  const handleEmptySlotClick = (qubit: number, position: number) => {
    if (selectedGateType) {
      handleAddGate(selectedGateType, qubit, position)
    }
  }

  const handleGateClick = (gate: CircuitGate, event: React.MouseEvent) => {
    if (event.shiftKey) {
      setSelectedGateIds((prev) => {
        const newSet = new Set(prev)
        if (newSet.has(gate.id)) {
          newSet.delete(gate.id)
        } else {
          newSet.add(gate.id)
        }
        return newSet
      })
    } else if (event.metaKey || event.ctrlKey) {
      setSelectedGateIds((prev) => new Set([...prev, gate.id]))
    } else {
      setSelectedGateIds(new Set([gate.id]))
    }
  }

  const handleGateDoubleClick = (gate: CircuitGate) => {
    setEditingGate(gate)
  }

  const handleExportQASM = () => {
    const qasm = exportToQASM()
    downloadFile(qasm, `circuit-${Date.now()}.qasm`, 'text/plain')
  }

  const handleExportQiskit = () => {
    const code = exportToQiskit()
    downloadFile(code, `circuit-${Date.now()}.py`, 'text/x-python')
  }

  const handleExportJSON = () => {
    const json = JSON.stringify(circuit, null, 2)
    downloadFile(json, `circuit-${Date.now()}.json`, 'application/json')
  }

  const handleShareCircuit = () => {
    const circuitData = JSON.stringify(circuit)
    const encoded = btoa(circuitData)
    const url = `${window.location.origin}/simulator/circuit-builder?circuit=${encoded}`
    navigator.clipboard.writeText(url)
    alert('Circuit URL copied to clipboard!')
  }

  const handleLoadTemplate = (template: CircuitTemplate) => {
    const newCircuit = createCircuitFromTemplate(template)
    setCircuit(newCircuit)
  }

  const handleSaveParameters = (gateId: string, parameters: number[]) => {
    updateGate(gateId, { parameters })
  }

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const getMaxPosition = () => {
    if (circuit.gates.length === 0) return 0
    return Math.max(...circuit.gates.map((g) => g.position)) + 1
  }

  const isGateHighlighted = (gateId: string) => {
    return debuggerState?.highlightedGateId === gateId
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div ref={containerRef} className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" onClick={undo} className="p-2" title="Undo (Ctrl+Z)">
              <Undo className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={redo} className="p-2" title="Redo (Ctrl+Y)">
              <Redo className="w-4 h-4" />
            </Button>
            <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNumQubits(Math.min(circuit.numQubits + 1, 15))}
              className="p-2 sm:px-3"
              title="Add qubit"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Qubit</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNumQubits(Math.max(circuit.numQubits - 1, 1))}
              className="p-2 sm:px-3"
              title="Remove qubit"
            >
              <Minus className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Qubit</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={clearCircuit} className="p-2 sm:px-3" title="Clear circuit">
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Clear</span>
            </Button>
            <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowTemplates(true)}
              className="px-3"
              title="Load template (T)"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Templates</span>
            </Button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant={noiseConfig.enabled ? 'primary' : 'ghost'}
              size="sm"
              onClick={toggleNoisePanel}
              className="p-2"
              title="Noise Simulation"
            >
              {noiseConfig.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button
              variant={showOptimizationPanel ? 'primary' : 'ghost'}
              size="sm"
              onClick={toggleOptimizationPanel}
              className="p-2"
              title="Optimize Circuit"
            >
              <Zap className="w-4 h-4" />
            </Button>
            <Button
              variant={showDebuggerPanel ? 'primary' : 'ghost'}
              size="sm"
              onClick={toggleDebuggerPanel}
              className="p-2"
              title="Step-by-Step Debugger"
            >
              <Bug className="w-4 h-4" />
            </Button>
            <Button
              variant={showComparisonPanel ? 'primary' : 'ghost'}
              size="sm"
              onClick={toggleComparisonPanel}
              className="p-2"
              title="Compare Backends"
            >
              <GitCompare className="w-4 h-4" />
            </Button>
            <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKeyboardHelp(true)}
              className="p-2"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGatePalette(!showGatePalette)}
              className="lg:hidden px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-300 flex items-center gap-2"
            >
              <Menu className="w-4 h-4" />
              Gates
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-white/10 rounded-lg">
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
          <ResizablePanel
            direction="horizontal"
            defaultSize={240}
            minSize={180}
            maxSize={400}
            side="left"
            className="hidden lg:block space-y-4 overflow-y-auto"
          >
            <Card variant="neumorph" className="overflow-hidden">
              <h3 className="font-semibold text-white mb-2 text-sm px-1">Gate Palette</h3>
              <p className="text-xs text-slate-400 mb-3 px-1">
                {selectedGateType ? (
                  <>
                    Selected: <span className="text-quantum-400">{GATE_DEFINITIONS[selectedGateType].name}</span>
                  </>
                ) : (
                  'Drag gates to circuit or click to select'
                )}
              </p>
              <Tabs value={activeCategory} onChange={setActiveCategory}>
                <TabsList className="flex-wrap mb-3 gap-1">
                  {Object.keys(GATE_PALETTE).map((category) => (
                    <TabsTrigger key={category} value={category} className="text-xs px-2 py-1">
                      {category.replace(' Qubit', '')}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {Object.entries(GATE_PALETTE).map(([category, gates]) => (
                  <TabsContent key={category} value={category} className="space-y-1.5">
                    {gates.map((gateType) => (
                      <DraggableGate
                        key={gateType}
                        gateType={gateType as GateType}
                        isSelected={selectedGateType === gateType}
                        onClick={() => setSelectedGateType(gateType as GateType)}
                      />
                    ))}
                  </TabsContent>
                ))}
              </Tabs>
            </Card>

            <AnimatePresence>
              {showNoisePanel && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <NoiseConfigPanel />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showOptimizationPanel && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <OptimizationPanel />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showComparisonPanel && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <ComparisonPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </ResizablePanel>

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Card variant="neumorph" className="flex-1 overflow-hidden p-0">
              {circuit.gates.length === 0 && !selectedGateType ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <Cpu className="w-16 h-16 text-slate-600 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Your circuit is empty</h3>
                  <p className="text-sm text-slate-400 mb-4 max-w-md">
                    Drag gates from the palette to the circuit, or click a gate then click on a qubit row.
                    Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">T</kbd> to load a template.
                  </p>
                  <Button variant="secondary" onClick={() => setShowTemplates(true)}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Load Template
                  </Button>
                </div>
              ) : (
                <CircuitCanvas
                  circuit={circuit}
                  selectedGateIds={selectedGateIds}
                  highlightedGateId={debuggerState?.highlightedGateId}
                  onGateClick={handleGateClick}
                  onGateDoubleClick={handleGateDoubleClick}
                  onEmptySlotClick={handleEmptySlotClick}
                  selectedGateType={selectedGateType}
                />
              )}
            </Card>

            <DebuggerPanel />

            <AnimatePresence>
              {comparisonResult && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4"
                >
                  <ComparisonResults />
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setShowResults(!showResults)}
              className="lg:hidden flex items-center justify-between w-full mt-4 px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-slate-300"
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
                              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
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
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <ResizablePanel
            direction="horizontal"
            defaultSize={300}
            minSize={250}
            maxSize={500}
            side="right"
            className="hidden lg:block space-y-4 overflow-y-auto"
          >
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
                {selectedGateIds.size > 0 && (
                  <div className="flex justify-between text-quantum-400">
                    <span>Selected</span>
                    <span>{selectedGateIds.size} gates</span>
                  </div>
                )}
                {noiseConfig.enabled && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Noise</span>
                    <span className="text-amber-400">
                      {noiseConfig.preset === 'custom'
                        ? `${noiseConfig.model.type} (${(noiseConfig.model.errorRate * 100).toFixed(2)}%)`
                        : noiseConfig.preset.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              {selectedGateIds.size > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10 flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCopy} className="flex-1">
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteSelected}
                    className="flex-1 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
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
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
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
                  {noiseConfig.enabled && <span className="ml-2 text-amber-400">(noisy)</span>}
                </div>
              </Card>
            ) : (
              <Card variant="neumorph">
                <h3 className="font-semibold text-white mb-4 text-sm">Results</h3>
                <div className="text-center py-6 text-slate-400">
                  <Play className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Run simulation to see results</p>
                  <p className="text-xs text-slate-500 mt-1">Press R or click Run</p>
                </div>
              </Card>
            )}

            <Card variant="neumorph">
              <h3 className="font-semibold text-white mb-4 text-sm">Export</h3>
              <div className="space-y-2">
                <Button variant="secondary" className="w-full" size="sm" onClick={handleExportQASM}>
                  <Download className="w-4 h-4 mr-2" />
                  Export QASM
                </Button>
                <Button variant="secondary" className="w-full" size="sm" onClick={handleExportQiskit}>
                  <FileCode className="w-4 h-4 mr-2" />
                  Export Qiskit
                </Button>
                <Button variant="secondary" className="w-full" size="sm" onClick={handleExportJSON}>
                  <Save className="w-4 h-4 mr-2" />
                  Export JSON
                </Button>
                <Button variant="secondary" className="w-full" size="sm" onClick={handleShareCircuit}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Circuit
                </Button>
              </div>
            </Card>
          </ResizablePanel>
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
                className="fixed left-0 top-0 h-screen w-[300px] bg-slate-900 border-r border-white/10 shadow-2xl z-50 p-4 overflow-y-auto lg:hidden"
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
                      {gates.map((gateType) => (
                        <DraggableGate
                          key={gateType}
                          gateType={gateType as GateType}
                          isSelected={selectedGateType === gateType}
                          onClick={() => {
                            setSelectedGateType(gateType as GateType)
                            setShowGatePalette(false)
                          }}
                          showTooltip={false}
                        />
                      ))}
                    </TabsContent>
                  ))}
                </Tabs>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <TemplatesPanel isOpen={showTemplates} onClose={() => setShowTemplates(false)} onSelectTemplate={handleLoadTemplate} />

        <GateParameterModal
          isOpen={!!editingGate}
          gate={editingGate}
          onClose={() => setEditingGate(null)}
          onSave={handleSaveParameters}
          onDelete={(gateId) => {
            removeGate(gateId)
            setEditingGate(null)
          }}
        />

        <AnimatePresence>
          {showKeyboardHelp && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                onClick={() => setShowKeyboardHelp(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                    <Keyboard className="w-5 h-5 text-quantum-400" />
                    Keyboard Shortcuts
                  </h3>
                  <button
                    onClick={() => setShowKeyboardHelp(false)}
                    className="p-2 rounded-lg hover:bg-white/10 text-slate-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <h4 className="font-medium text-white mb-2">General</h4>
                    <Shortcut keys={['Ctrl', 'Z']} action="Undo" />
                    <Shortcut keys={['Ctrl', 'Y']} action="Redo" />
                    <Shortcut keys={['Ctrl', 'C']} action="Copy gates" />
                    <Shortcut keys={['Ctrl', 'V']} action="Paste gates" />
                    <Shortcut keys={['Ctrl', 'A']} action="Select all" />
                    <Shortcut keys={['Delete']} action="Delete selected" />
                    <Shortcut keys={['Esc']} action="Deselect" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium text-white mb-2">Actions</h4>
                    <Shortcut keys={['R']} action="Run simulation" />
                    <Shortcut keys={['T']} action="Templates" />
                    <Shortcut keys={['?']} action="Show help" />
                    <h4 className="font-medium text-white mt-4 mb-2">Gates</h4>
                    <Shortcut keys={['H']} action="Hadamard" />
                    <Shortcut keys={['X']} action="Pauli-X" />
                    <Shortcut keys={['Y']} action="Pauli-Y" />
                    <Shortcut keys={['Z']} action="Pauli-Z" />
                    <Shortcut keys={['C']} action="CNOT" />
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <DragOverlay>
          {draggedGateType && <DragOverlayGate gateType={draggedGateType} />}
        </DragOverlay>
      </div>
    </DndContext>
  )
}

function Shortcut({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{action}</span>
      <div className="flex gap-1">
        {keys.map((key, i) => (
          <span key={i}>
            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-white/10 rounded text-xs text-white">
              {key}
            </kbd>
            {i < keys.length - 1 && <span className="text-slate-600 mx-0.5">+</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
