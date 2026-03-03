export interface Complex {
  re: number
  im: number
}

export interface PauliTerm {
  coefficient: number
  operators: { qubit: number; pauli: 'I' | 'X' | 'Y' | 'Z' }[]
}

export interface Hamiltonian {
  numQubits: number
  terms: PauliTerm[]
  constantTerm: number
}

export interface MoleculeGeometry {
  atoms: { element: string; x: number; y: number; z: number }[]
}

export interface MoleculeInfo {
  id: string
  name: string
  formula: string
  numElectrons: number
  numOrbitals: number
  geometry: MoleculeGeometry
  bondLength?: number
  exactEnergy?: number
}

export type BasisSet = 'sto-3g' | '6-31g' | 'cc-pvdz'
export type QubitMapping = 'jordan_wigner' | 'bravyi_kitaev' | 'parity'

export type AnsatzType =
  | 'hea'
  | 'uccsd'
  | 'k_upccgsd'
  | 'adapt'
  | 'qubit_adapt'
  | 'symmetry_preserved'

export type EntanglementType = 'linear' | 'circular' | 'full' | 'pairwise' | 'sca'

export interface AnsatzConfig {
  type: AnsatzType
  layers?: number
  trotterOrder?: 1 | 2
  kFactor?: number
  gradientThreshold?: number
  maxOperators?: number
  entanglement?: EntanglementType
  includeTriples?: boolean
  spinAdapted?: boolean
}

export type OptimizerType =
  | 'cobyla'
  | 'nelder_mead'
  | 'powell'
  | 'adam'
  | 'sgd'
  | 'lbfgsb'
  | 'slsqp'
  | 'spsa'
  | 'qn_spsa'
  | 'qng'
  | 'rotosolve'

export interface OptimizerConfig {
  type: OptimizerType
  maxIterations: number
  tolerance: number
  learningRate?: number
  beta1?: number
  beta2?: number
  epsilon?: number
  perturbation?: number
  momentum?: number
  decay?: number
}

export interface ZNEConfig {
  enabled: boolean
  scaleFactors: number[]
  foldingMethod: 'global' | 'local' | 'random'
  extrapolation: 'linear' | 'polynomial' | 'exponential' | 'richardson'
}

export interface ReadoutMitigationConfig {
  enabled: boolean
  method: 'matrix_inversion' | 'least_squares'
  calibrationShots?: number
}

export interface SymmetryConfig {
  enabled: boolean
  symmetries: ('particle_number' | 'spin_z' | 'point_group')[]
  postSelect?: boolean
}

export interface MitigationConfig {
  zne?: ZNEConfig
  readout?: ReadoutMitigationConfig
  symmetry?: SymmetryConfig
}

export interface ExecutionConfig {
  shots?: number
  seed?: number
  useCache?: boolean
  saveResult?: boolean
}

export interface VQERequest {
  molecule: {
    id: string
    name: string
    geometry?: MoleculeGeometry
    bondLength?: number
  }
  quantum: {
    numQubits: number
    numElectrons: number
    basisSet?: BasisSet
    qubitMapping?: QubitMapping
  }
  hamiltonian?: Hamiltonian
  ansatz: AnsatzConfig
  optimizer: OptimizerConfig
  mitigation?: MitigationConfig
  execution?: ExecutionConfig
}

export interface VQEHistoryEntry {
  iteration: number
  energy: number
  gradientNorm?: number
  parametersNorm?: number
  timestamp?: number
}

export interface VQEResult {
  finalEnergy: number
  exactEnergy: number
  errorHartree: number
  errorKcalMol: number
  chemicalAccuracy: boolean
  parameters: number[]
  converged: boolean
  iterations: number
  history: VQEHistoryEntry[]
}

export interface VQEMetrics {
  executionTimeMs: number
  memoryUsedMB: number
  circuitDepth: number
  cnotCount: number
  parameterCount: number
  operatorsAdded?: number
  finalGradientNorm?: number
}

export interface CacheInfo {
  hamiltonianCached: boolean
  resultCached: boolean
  cacheKey?: string
}

export interface VQEResponse {
  success: boolean
  result?: VQEResult
  metrics?: VQEMetrics
  cache?: CacheInfo
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

export interface QuantumGate {
  name: string
  qubits: number[]
  params?: number[]
  matrix?: Complex[][]
}

export interface QuantumCircuit {
  numQubits: number
  gates: QuantumGate[]
}

export interface SimulatorRequest {
  circuit: QuantumCircuit
  shots?: number
  seed?: number
  measureQubits?: number[]
}

export interface SimulatorResponse {
  success: boolean
  statevector?: Complex[]
  probabilities?: number[]
  counts?: Record<string, number>
  expectationValues?: Record<string, number>
  executionTimeMs: number
  error?: string
}

export interface OptimizationResult {
  parameters: number[]
  value: number
  iterations: number
  converged: boolean
  history: { iteration: number; value: number; params?: number[] }[]
}

export type CostFunction = (params: number[]) => number
export type GradientFunction = (params: number[]) => number[]

export interface Optimizer {
  name: string
  optimize(
    initialParams: number[],
    costFn: CostFunction,
    gradientFn?: GradientFunction,
    callback?: (iteration: number, value: number, params: number[]) => void
  ): OptimizationResult
}

export const HARTREE_TO_KCAL_MOL = 627.5094740631
export const CHEMICAL_ACCURACY_HARTREE = 0.0016
export const CHEMICAL_ACCURACY_KCAL_MOL = 1.0
