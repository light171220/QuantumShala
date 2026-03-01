import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuid } from 'uuid'
import type {
  QuantumCircuit,
  CircuitGate,
  SimulationResult,
  SimulationConfig,
  GateType,
  Measurement,
  NoiseConfig,
  DebuggerState,
  DebuggerSnapshot,
  ComparisonConfig,
  ComparisonResult,
  ComparisonBackend,
} from '@/types/simulator'
import type { OptimizationResult, OptimizationPass } from '@/types/optimizer'
import { DEFAULT_NOISE_CONFIG } from '@/lib/quantum/noise-simulator'
import { DEFAULT_DEBUGGER_STATE } from '@/lib/quantum/debugger'
import { DEFAULT_COMPARISON_CONFIG } from '@/lib/quantum/comparison'

interface SimulatorState {
  circuit: QuantumCircuit
  simulationResult: SimulationResult | null
  isSimulating: boolean
  selectedGate: CircuitGate | null
  history: QuantumCircuit[]
  historyIndex: number
  simulationConfig: SimulationConfig
  error: string | null

  noiseConfig: NoiseConfig
  debuggerState: DebuggerState | null
  optimizationResult: OptimizationResult | null
  showOptimizationPanel: boolean
  comparisonMode: boolean
  comparisonConfig: ComparisonConfig
  comparisonResult: ComparisonResult | null
  showComparisonPanel: boolean
  showDebuggerPanel: boolean
  showNoisePanel: boolean
}

interface SimulatorActions {
  initCircuit: (numQubits?: number, name?: string) => void
  setCircuit: (circuit: QuantumCircuit) => void
  setNumQubits: (numQubits: number) => void
  addGate: (gate: Omit<CircuitGate, 'id'>) => void
  removeGate: (gateId: string) => void
  updateGate: (gateId: string, updates: Partial<CircuitGate>) => void
  moveGate: (gateId: string, newPosition: number, newQubits: number[]) => void
  addMeasurement: (qubit: number, position: number) => void
  removeMeasurement: (qubit: number) => void
  clearCircuit: () => void
  selectGate: (gate: CircuitGate | null) => void
  setSimulationResult: (result: SimulationResult | null) => void
  setSimulating: (simulating: boolean) => void
  setSimulationConfig: (config: Partial<SimulationConfig>) => void
  setError: (error: string | null) => void
  undo: () => void
  redo: () => void
  saveToHistory: () => void
  exportToQASM: () => string
  exportToQiskit: () => string

  setNoiseConfig: (config: Partial<NoiseConfig>) => void
  toggleNoise: () => void
  setNoisePreset: (preset: 'ideal' | 'ibmq' | 'ionq' | 'custom') => void
  toggleNoisePanel: () => void

  setDebuggerState: (state: DebuggerState | null) => void
  updateDebuggerSnapshot: (snapshot: DebuggerSnapshot) => void
  toggleDebuggerPanel: () => void
  setDebuggerPlaying: (playing: boolean) => void
  setDebuggerStep: (step: number) => void
  toggleBreakpoint: (step: number) => void

  setOptimizationResult: (result: OptimizationResult | null) => void
  toggleOptimizationPanel: () => void
  applyOptimizedCircuit: () => void

  setComparisonMode: (enabled: boolean) => void
  setComparisonConfig: (config: Partial<ComparisonConfig>) => void
  setComparisonResult: (result: ComparisonResult | null) => void
  toggleComparisonPanel: () => void
  addComparisonBackend: (backend: ComparisonBackend) => void
  removeComparisonBackend: (backendId: string) => void
}

const createEmptyCircuit = (numQubits = 3, name = 'Untitled Circuit'): QuantumCircuit => ({
  id: uuid(),
  name,
  numQubits,
  gates: [],
  measurements: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isPublic: false,
  likes: 0,
  tags: [],
})

const initialState: SimulatorState = {
  circuit: createEmptyCircuit(),
  simulationResult: null,
  isSimulating: false,
  selectedGate: null,
  history: [],
  historyIndex: -1,
  simulationConfig: {
    shots: 1024,
    optimization: 1,
  },
  error: null,

  noiseConfig: DEFAULT_NOISE_CONFIG,
  debuggerState: null,
  optimizationResult: null,
  showOptimizationPanel: false,
  comparisonMode: false,
  comparisonConfig: DEFAULT_COMPARISON_CONFIG,
  comparisonResult: null,
  showComparisonPanel: false,
  showDebuggerPanel: false,
  showNoisePanel: false,
}

export const useSimulatorStore = create<SimulatorState & SimulatorActions>()(
  immer((set, get) => ({
    ...initialState,

    initCircuit: (numQubits = 3, name = 'Untitled Circuit') =>
      set((state) => {
        state.circuit = createEmptyCircuit(numQubits, name)
        state.simulationResult = null
        state.history = []
        state.historyIndex = -1
        state.error = null
      }),

    setCircuit: (circuit) =>
      set((state) => {
        state.circuit = circuit
        state.simulationResult = null
      }),

    setNumQubits: (numQubits) =>
      set((state) => {
        const validGates = state.circuit.gates.filter((g) =>
          g.qubits.every((q) => q < numQubits) &&
          (!g.controlQubits || g.controlQubits.every((q) => q < numQubits))
        )
        const validMeasurements = state.circuit.measurements.filter(
          (m) => m.qubit < numQubits
        )
        state.circuit.numQubits = numQubits
        state.circuit.gates = validGates
        state.circuit.measurements = validMeasurements
        state.circuit.updatedAt = new Date().toISOString()
      }),

    addGate: (gate) =>
      set((state) => {
        const currentCircuit = JSON.parse(JSON.stringify(state.circuit))
        if (state.history.length === 0 || 
            JSON.stringify(state.history[state.history.length - 1]) !== JSON.stringify(currentCircuit)) {
          state.history.push(currentCircuit)
          state.historyIndex = state.history.length - 1
        }
        
        const newGate: CircuitGate = {
          ...gate,
          id: uuid(),
        }
        state.circuit.gates.push(newGate)
        state.circuit.updatedAt = new Date().toISOString()
      }),

    removeGate: (gateId) =>
      set((state) => {
        const currentCircuit = JSON.parse(JSON.stringify(state.circuit))
        if (state.history.length === 0 || 
            JSON.stringify(state.history[state.history.length - 1]) !== JSON.stringify(currentCircuit)) {
          state.history.push(currentCircuit)
          state.historyIndex = state.history.length - 1
        }
        
        state.circuit.gates = state.circuit.gates.filter((g) => g.id !== gateId)
        state.circuit.updatedAt = new Date().toISOString()
        if (state.selectedGate?.id === gateId) {
          state.selectedGate = null
        }
      }),

    updateGate: (gateId, updates) =>
      set((state) => {
        const gate = state.circuit.gates.find((g) => g.id === gateId)
        if (gate) {
          Object.assign(gate, updates)
          state.circuit.updatedAt = new Date().toISOString()
        }
      }),

    moveGate: (gateId: string, newPosition: number, newQubits: number[]) =>
      set((state: SimulatorState) => {
        const gate = state.circuit.gates.find((g: CircuitGate) => g.id === gateId)
        if (gate) {
          gate.position = newPosition
          gate.qubits = newQubits
          state.circuit.updatedAt = new Date().toISOString()
        }
      }),

    addMeasurement: (qubit: number, position: number) =>
      set((state: SimulatorState) => {
        const existing = state.circuit.measurements.find((m: Measurement) => m.qubit === qubit)
        if (!existing) {
          state.circuit.measurements.push({
            qubit,
            classicalBit: qubit,
            position,
          })
          state.circuit.updatedAt = new Date().toISOString()
        }
      }),

    removeMeasurement: (qubit: number) =>
      set((state: SimulatorState) => {
        state.circuit.measurements = state.circuit.measurements.filter(
          (m: Measurement) => m.qubit !== qubit
        )
        state.circuit.updatedAt = new Date().toISOString()
      }),

    clearCircuit: () =>
      set((state: SimulatorState) => {
        state.circuit.gates = []
        state.circuit.measurements = []
        state.circuit.updatedAt = new Date().toISOString()
        state.simulationResult = null
        state.selectedGate = null
      }),

    selectGate: (gate: CircuitGate | null) =>
      set((state: SimulatorState) => {
        state.selectedGate = gate
      }),

    setSimulationResult: (result: SimulationResult | null) =>
      set((state: SimulatorState) => {
        state.simulationResult = result
        state.isSimulating = false
      }),

    setSimulating: (simulating: boolean) =>
      set((state: SimulatorState) => {
        state.isSimulating = simulating
        if (simulating) {
          state.error = null
        }
      }),

    setSimulationConfig: (config: Partial<SimulationConfig>) =>
      set((state: SimulatorState) => {
        Object.assign(state.simulationConfig, config)
      }),

    setError: (error: string | null) =>
      set((state: SimulatorState) => {
        state.error = error
        state.isSimulating = false
      }),

    saveToHistory: () =>
      set((state: SimulatorState) => {
        const currentCircuit = JSON.parse(JSON.stringify(state.circuit))
        if (state.historyIndex < state.history.length - 1) {
          state.history = state.history.slice(0, state.historyIndex + 1)
        }
        state.history.push(currentCircuit)
        state.historyIndex = state.history.length - 1
        if (state.history.length > 50) {
          state.history.shift()
          state.historyIndex = Math.max(0, state.historyIndex - 1)
        }
      }),

    undo: () =>
      set((state: SimulatorState) => {
        if (state.history.length === 0) {
          state.history.push(JSON.parse(JSON.stringify(state.circuit)))
          state.historyIndex = 0
        }
        
        if (state.historyIndex === state.history.length - 1 && state.historyIndex >= 0) {
          const currentStr = JSON.stringify(state.circuit)
          const lastStr = JSON.stringify(state.history[state.historyIndex])
          if (currentStr !== lastStr) {
            state.history.push(JSON.parse(currentStr))
            state.historyIndex = state.history.length - 1
          }
        }
        
        if (state.historyIndex > 0) {
          state.historyIndex--
          state.circuit = JSON.parse(JSON.stringify(state.history[state.historyIndex]))
          state.simulationResult = null
        }
      }),

    redo: () =>
      set((state: SimulatorState) => {
        if (state.historyIndex < state.history.length - 1) {
          state.historyIndex++
          state.circuit = JSON.parse(JSON.stringify(state.history[state.historyIndex]))
          state.simulationResult = null
        }
      }),

    exportToQASM: () => {
      const { circuit } = get()
      let qasm = `OPENQASM 2.0;\ninclude "qelib1.inc";\n\n`
      qasm += `qreg q[${circuit.numQubits}];\n`
      qasm += `creg c[${circuit.numQubits}];\n\n`

      const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)

      for (const gate of sortedGates) {
        const gateQasm = gateToQASM(gate)
        if (gateQasm) {
          qasm += gateQasm + '\n'
        }
      }

      for (const m of circuit.measurements) {
        qasm += `measure q[${m.qubit}] -> c[${m.classicalBit}];\n`
      }

      return qasm
    },

    exportToQiskit: () => {
      const { circuit } = get()
      let code = `from qiskit import QuantumCircuit, QuantumRegister, ClassicalRegister\n`
      code += `from qiskit_aer import AerSimulator\n`
      code += `from qiskit.visualization import plot_histogram\n\n`
      code += `qr = QuantumRegister(${circuit.numQubits}, 'q')\n`
      code += `cr = ClassicalRegister(${circuit.numQubits}, 'c')\n`
      code += `qc = QuantumCircuit(qr, cr)\n\n`

      const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)

      for (const gate of sortedGates) {
        const gateCode = gateToQiskit(gate)
        if (gateCode) {
          code += gateCode + '\n'
        }
      }

      if (circuit.measurements.length > 0) {
        code += '\n'
        for (const m of circuit.measurements) {
          code += `qc.measure(qr[${m.qubit}], cr[${m.classicalBit}])\n`
        }
      }

      code += `\nsimulator = AerSimulator()\n`
      code += `job = simulator.run(qc, shots=1024)\n`
      code += `result = job.result()\n`
      code += `counts = result.get_counts(qc)\n`
      code += `print(counts)\n`

      return code
    },

    setNoiseConfig: (config: Partial<NoiseConfig>) =>
      set((state) => {
        state.noiseConfig = { ...state.noiseConfig, ...config }
      }),

    toggleNoise: () =>
      set((state) => {
        state.noiseConfig.enabled = !state.noiseConfig.enabled
      }),

    setNoisePreset: (preset: 'ideal' | 'ibmq' | 'ionq' | 'custom') =>
      set((state) => {
        state.noiseConfig.preset = preset
        if (preset === 'ideal') {
          state.noiseConfig.enabled = false
          state.noiseConfig.model = { type: 'depolarizing', errorRate: 0 }
        } else if (preset === 'ibmq') {
          state.noiseConfig.enabled = true
          state.noiseConfig.model = { type: 'depolarizing', errorRate: 0.001 }
          state.noiseConfig.t1 = 100
          state.noiseConfig.t2 = 80
          state.noiseConfig.readoutError = 0.015
        } else if (preset === 'ionq') {
          state.noiseConfig.enabled = true
          state.noiseConfig.model = { type: 'depolarizing', errorRate: 0.0005 }
          state.noiseConfig.t1 = 10000
          state.noiseConfig.t2 = 1000
          state.noiseConfig.readoutError = 0.003
        }
      }),

    toggleNoisePanel: () =>
      set((state) => {
        state.showNoisePanel = !state.showNoisePanel
      }),

    setDebuggerState: (debuggerState: DebuggerState | null) =>
      set((state) => {
        state.debuggerState = debuggerState
      }),

    updateDebuggerSnapshot: (snapshot: DebuggerSnapshot) =>
      set((state) => {
        if (state.debuggerState) {
          state.debuggerState.currentStep = snapshot.stepIndex
          state.debuggerState.snapshots = [...state.debuggerState.snapshots, snapshot]
          state.debuggerState.highlightedGateId = snapshot.gateApplied?.id ?? null
        }
      }),

    toggleDebuggerPanel: () =>
      set((state) => {
        state.showDebuggerPanel = !state.showDebuggerPanel
        if (!state.showDebuggerPanel) {
          state.debuggerState = null
        }
      }),

    setDebuggerPlaying: (playing: boolean) =>
      set((state) => {
        if (state.debuggerState) {
          state.debuggerState.isPlaying = playing
        }
      }),

    setDebuggerStep: (step: number) =>
      set((state) => {
        if (state.debuggerState) {
          state.debuggerState.currentStep = step
        }
      }),

    toggleBreakpoint: (step: number) =>
      set((state) => {
        if (state.debuggerState) {
          const breakpoints = new Set(state.debuggerState.breakpoints)
          if (breakpoints.has(step)) {
            breakpoints.delete(step)
          } else {
            breakpoints.add(step)
          }
          state.debuggerState.breakpoints = breakpoints
        }
      }),

    setOptimizationResult: (result: OptimizationResult | null) =>
      set((state) => {
        state.optimizationResult = result
      }),

    toggleOptimizationPanel: () =>
      set((state) => {
        state.showOptimizationPanel = !state.showOptimizationPanel
      }),

    applyOptimizedCircuit: () =>
      set((state) => {
        if (state.optimizationResult) {
          const currentCircuit = JSON.parse(JSON.stringify(state.circuit))
          state.history.push(currentCircuit)
          state.historyIndex = state.history.length - 1
          state.circuit = state.optimizationResult.optimized
          state.optimizationResult = null
          state.showOptimizationPanel = false
          state.simulationResult = null
        }
      }),

    setComparisonMode: (enabled: boolean) =>
      set((state) => {
        state.comparisonMode = enabled
        if (!enabled) {
          state.comparisonResult = null
        }
      }),

    setComparisonConfig: (config: Partial<ComparisonConfig>) =>
      set((state) => {
        state.comparisonConfig = { ...state.comparisonConfig, ...config }
      }),

    setComparisonResult: (result: ComparisonResult | null) =>
      set((state) => {
        state.comparisonResult = result
      }),

    toggleComparisonPanel: () =>
      set((state) => {
        state.showComparisonPanel = !state.showComparisonPanel
      }),

    addComparisonBackend: (backend: ComparisonBackend) =>
      set((state) => {
        if (!state.comparisonConfig.backends.find(b => b.id === backend.id)) {
          state.comparisonConfig.backends.push(backend)
        }
      }),

    removeComparisonBackend: (backendId: string) =>
      set((state) => {
        state.comparisonConfig.backends = state.comparisonConfig.backends.filter(
          b => b.id !== backendId
        )
      }),
  }))
)

function gateToQASM(gate: CircuitGate): string {
  const q = gate.qubits[0]
  const params = gate.parameters || []

  switch (gate.type) {
    case 'H': return `h q[${q}];`
    case 'X': return `x q[${q}];`
    case 'Y': return `y q[${q}];`
    case 'Z': return `z q[${q}];`
    case 'S': return `s q[${q}];`
    case 'T': return `t q[${q}];`
    case 'Sdg': return `sdg q[${q}];`
    case 'Tdg': return `tdg q[${q}];`
    case 'Rx': return `rx(${params[0]}) q[${q}];`
    case 'Ry': return `ry(${params[0]}) q[${q}];`
    case 'Rz': return `rz(${params[0]}) q[${q}];`
    case 'CNOT': return `cx q[${gate.controlQubits?.[0] || gate.qubits[0]}],q[${gate.qubits[gate.qubits.length - 1]}];`
    case 'CZ': return `cz q[${gate.controlQubits?.[0] || gate.qubits[0]}],q[${gate.qubits[gate.qubits.length - 1]}];`
    case 'SWAP': return `swap q[${gate.qubits[0]}],q[${gate.qubits[1]}];`
    case 'Toffoli': return `ccx q[${gate.qubits[0]}],q[${gate.qubits[1]}],q[${gate.qubits[2]}];`
    case 'Barrier': return `barrier q;`
    case 'Reset': return `reset q[${q}];`
    default: return ''
  }
}

function gateToQiskit(gate: CircuitGate): string {
  const q = gate.qubits[0]
  const params = gate.parameters || []

  switch (gate.type) {
    case 'H': return `qc.h(qr[${q}])`
    case 'X': return `qc.x(qr[${q}])`
    case 'Y': return `qc.y(qr[${q}])`
    case 'Z': return `qc.z(qr[${q}])`
    case 'S': return `qc.s(qr[${q}])`
    case 'T': return `qc.t(qr[${q}])`
    case 'Sdg': return `qc.sdg(qr[${q}])`
    case 'Tdg': return `qc.tdg(qr[${q}])`
    case 'Rx': return `qc.rx(${params[0]}, qr[${q}])`
    case 'Ry': return `qc.ry(${params[0]}, qr[${q}])`
    case 'Rz': return `qc.rz(${params[0]}, qr[${q}])`
    case 'CNOT': return `qc.cx(qr[${gate.controlQubits?.[0] || gate.qubits[0]}], qr[${gate.qubits[gate.qubits.length - 1]}])`
    case 'CZ': return `qc.cz(qr[${gate.controlQubits?.[0] || gate.qubits[0]}], qr[${gate.qubits[gate.qubits.length - 1]}])`
    case 'SWAP': return `qc.swap(qr[${gate.qubits[0]}], qr[${gate.qubits[1]}])`
    case 'Toffoli': return `qc.ccx(qr[${gate.qubits[0]}], qr[${gate.qubits[1]}], qr[${gate.qubits[2]}])`
    case 'Barrier': return `qc.barrier()`
    case 'Reset': return `qc.reset(qr[${q}])`
    default: return ''
  }
}
