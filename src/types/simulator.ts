export interface QuantumCircuit {
  id: string
  name: string
  description?: string
  numQubits: number
  gates: CircuitGate[]
  measurements: Measurement[]
  createdAt: string
  updatedAt: string
  userId?: string
  isPublic: boolean
  likes: number
  tags: string[]
}

export type Circuit = QuantumCircuit
export type Gate = CircuitGate

export interface CircuitGate {
  id: string
  type: GateType
  qubits: number[]
  parameters?: number[]
  controlQubits?: number[]
  position: number
  label?: string
}

export type GateType =
  | 'H' | 'X' | 'Y' | 'Z'
  | 'S' | 'T' | 'Sdg' | 'Tdg'
  | 'Rx' | 'Ry' | 'Rz'
  | 'U' | 'U1' | 'U2' | 'U3'
  | 'CNOT' | 'CX' | 'CZ' | 'CY'
  | 'SWAP' | 'iSWAP'
  | 'CRx' | 'CRy' | 'CRz'
  | 'Toffoli' | 'Fredkin'
  | 'Phase' | 'CPhase'
  | 'Reset' | 'Barrier'
  | 'Custom'

export const CLIFFORD_GATES: GateType[] = ['H', 'S', 'Sdg', 'X', 'Y', 'Z', 'CNOT', 'CX', 'CZ', 'CY', 'SWAP']

export interface GateDefinition {
  type: GateType
  name: string
  description: string
  numQubits: number
  numControls: number
  parameters: ParameterDef[]
  matrix?: Complex[][]
  color: string
  symbol: string
  category: GateCategory
}

export type GateCategory =
  | 'single-qubit'
  | 'multi-qubit'
  | 'rotation'
  | 'phase'
  | 'controlled'
  | 'special'

export interface ParameterDef {
  name: string
  min: number
  max: number
  default: number
  step: number
}

export interface Measurement {
  qubit: number
  classicalBit: number
  position: number
}

export type SimulationBackend =
  | 'browser'
  | 'lambda_small'
  | 'lambda_medium'
  | 'lambda_large'
  | 'clifford'
  | 'tensor_network'
  | 'circuit_cutting'
  | 'unsupported'

export type SimulationTier =
  | 'browser'
  | 'lambda_small'
  | 'lambda_medium'
  | 'lambda_large'
  | 'special'

export interface SimulationTierConfig {
  tier: SimulationTier
  minQubits: number
  maxQubits: number
  memoryMB: number
  timeoutSeconds: number
  costPerRun: number
  description: string
}

export const SIMULATION_TIERS: SimulationTierConfig[] = [
  {
    tier: 'browser',
    minQubits: 1,
    maxQubits: 20,
    memoryMB: 16,
    timeoutSeconds: 30,
    costPerRun: 0,
    description: 'Instant, free, works offline'
  },
  {
    tier: 'lambda_small',
    minQubits: 21,
    maxQubits: 24,
    memoryMB: 512,
    timeoutSeconds: 120,
    costPerRun: 0.00001,
    description: 'Fast cloud execution'
  },
  {
    tier: 'lambda_medium',
    minQubits: 25,
    maxQubits: 26,
    memoryMB: 1536,
    timeoutSeconds: 300,
    costPerRun: 0.00005,
    description: 'Moderate cloud execution'
  },
  {
    tier: 'lambda_large',
    minQubits: 27,
    maxQubits: 27,
    memoryMB: 3008,
    timeoutSeconds: 600,
    costPerRun: 0.0001,
    description: 'Heavy cloud execution'
  },
  {
    tier: 'special',
    minQubits: 28,
    maxQubits: 10000,
    memoryMB: 0,
    timeoutSeconds: 0,
    costPerRun: 0,
    description: 'Advanced methods: Clifford, Tensor, Circuit Cutting'
  }
]

export interface SimulationResult {
  circuitId: string
  backend: SimulationBackend
  method?: 'state-vector' | 'clifford' | 'tensor_network' | 'circuit_cutting' | 'shot-parallel'
  executionTime: number
  shots: number
  counts: Record<string, number>
  probabilities: Record<string, number>
  stateVector?: Complex[]
  densityMatrix?: Complex[][]
  blochVectors?: BlochVector[]
  unitaryMatrix?: Complex[][]
  metadata?: SimulationMetadata
}

export interface SimulationMetadata {
  tier: SimulationTier
  numWorkers?: number
  numCuts?: number
  bondDimension?: number
  memoryUsedMB?: number
}

export interface Complex {
  re: number
  im: number
}

export interface BlochVector {
  qubit: number
  x: number
  y: number
  z: number
  theta: number
  phi: number
}

export interface SimulationConfig {
  shots: number
  seed?: number
  noiseModel?: NoiseModel
  optimization?: OptimizationLevel
  preferredMethod?: 'auto' | 'state-vector' | 'clifford' | 'tensor_network' | 'circuit_cutting'
}

export type NoiseType = 'depolarizing' | 'amplitude_damping' | 'phase_damping' | 'bit_flip' | 'phase_flip' | 'custom'

export interface NoiseModel {
  type: NoiseType
  errorRate: number
  gates?: Record<GateType, number>
}

export type HardwarePreset = 'ideal' | 'ibmq' | 'ionq' | 'custom'

export interface NoiseConfig {
  enabled: boolean
  model: NoiseModel
  preset: HardwarePreset
  perQubitRates?: Record<number, number>
  gateErrors?: Record<GateType, number>
  t1?: number
  t2?: number
  readoutError?: number
}

export interface DebuggerSnapshot {
  stepIndex: number
  gateApplied: CircuitGate | null
  stateVector: Complex[]
  probabilities: Record<string, number>
  blochVectors: BlochVector[]
  timestamp: number
}

export interface DebuggerState {
  isActive: boolean
  currentStep: number
  totalSteps: number
  isPlaying: boolean
  playbackSpeed: number
  breakpoints: Set<number>
  snapshots: DebuggerSnapshot[]
  highlightedGateId: string | null
}

export type OptimizationLevel = 0 | 1 | 2 | 3

export interface CircuitAnalysis {
  numQubits: number
  numGates: number
  depth: number
  gateTypes: Set<GateType>
  isCliffordOnly: boolean
  entanglementScore: number
  recommendedTier: SimulationTier
  recommendedMethod: 'state-vector' | 'clifford' | 'tensor_network' | 'circuit_cutting'
  estimatedTime: string
  estimatedCost: number
  cutPoints?: number[]
}

export interface CodeExecution {
  id: string
  language: CodeLanguage
  code: string
  result?: CodeResult
  error?: string
  executionTime?: number
}

export type CodeLanguage = 'qiskit' | 'cirq' | 'pennylane' | 'openqasm' | 'quil'

export interface CodeResult {
  output: string
  circuit?: QuantumCircuit
  simulation?: SimulationResult
  visualizations?: Visualization[]
}

export interface Visualization {
  type: 'histogram' | 'statevector' | 'bloch' | 'density' | 'circuit'
  data: unknown
  title?: string
}

export interface ComparisonBackend {
  id: string
  name: string
  type: 'browser' | 'browser_noisy' | 'lambda' | 'clifford' | 'tensor_network'
  noiseConfig?: NoiseConfig
}

export interface ComparisonConfig {
  backends: ComparisonBackend[]
  shots: number
  includeStatistics: boolean
}

export interface BackendResult {
  backendId: string
  backendName: string
  result: SimulationResult
  executionTime: number
}

export interface ComparisonMetrics {
  fidelityMatrix: Record<string, Record<string, number>>
  tvdMatrix: Record<string, Record<string, number>>
  klDivergenceMatrix: Record<string, Record<string, number>>
  referenceBackend: string
}

export interface ComparisonResult {
  results: BackendResult[]
  metrics: ComparisonMetrics
  timestamp: number
}

export interface ParseError {
  code: string
  message: string
  line: number
  column?: number
  severity: 'error'
  suggestion?: string
}

export interface ParseWarning {
  code: string
  message: string
  line: number
  column?: number
  severity: 'warning'
  suggestion?: string
}

export interface ParsedGate {
  id: string
  type: GateType
  name: string
  qubits: number[]
  controlQubits: number[]
  parameters: number[]
  line: number
  column?: number
}

export interface ParsedMeasurement {
  qubit: number
  classicalBit: number
  line: number
}

export interface ParsedCircuit {
  numQubits: number
  numClassicalBits: number
  gates: ParsedGate[]
  measurements: ParsedMeasurement[]
  barriers: number[][]
  metadata: {
    circuitDepth: number
    gateCount: number
    twoQubitGateCount: number
  }
}

export interface ParseResult {
  success: boolean
  circuit: ParsedCircuit | null
  errors: ParseError[]
  warnings: ParseWarning[]
  parseTimeMs: number
}
