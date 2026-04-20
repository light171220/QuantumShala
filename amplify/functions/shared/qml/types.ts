import type { Complex, Optimizer, OptimizerConfig } from '../types'

export type QMLAlgorithm =
  | 'vqc'
  | 'qsvm'
  | 'qcnn'
  | 'qgan'
  | 'qaoa'
  | 'qrl'
  | 'qtransformer'
  | 'qgnn'
  | 'qreservoir'
  | 'qautoencoder'
  | 'qvae'
  | 'analyze'

export type EncoderType =
  | 'angle'
  | 'amplitude'
  | 'iqp'
  | 'dense_angle'
  | 'basis'
  | 'zz_feature'
  | 'pauli_feature'
  | 'displacement'
  | 'data_reuploading'
  | 'trainable'
  | 'qaoa_embedding'

export type AnsatzType =
  | 'real_amplitudes'
  | 'efficient_su2'
  | 'two_local'
  | 'tree_tensor'
  | 'hea'
  | 'qcnn_ansatz'
  | 'expressible'

export type EntanglementPattern =
  | 'linear'
  | 'circular'
  | 'full'
  | 'pairwise'
  | 'sca'

export type KernelType =
  | 'fidelity'
  | 'projected'
  | 'trainable'

export type QAOAProblemType =
  | 'maxcut'
  | 'tsp'
  | 'portfolio'
  | 'custom'

export type QRLAlgorithmType =
  | 'quantum_dqn'
  | 'quantum_policy_gradient'
  | 'quantum_actor_critic'

export type EnvironmentType =
  | 'cartpole'
  | 'gridworld'
  | 'frozen_lake'
  | 'custom'

export interface DataPoint {
  features: number[]
  label?: number
}

export interface Dataset {
  id: string
  name: string
  description: string
  numFeatures: number
  numClasses: number
  numSamples: number
  X: number[][]
  y: number[]
}

export interface EncoderConfig {
  type: EncoderType
  numQubits?: number
  reps?: number
  rotation?: 'X' | 'Y' | 'Z'
  entanglement?: EntanglementPattern
  trainable?: boolean
  pauliStrings?: string[]
}

export interface AnsatzConfig {
  type: AnsatzType
  numQubits: number
  layers: number
  entanglement?: EntanglementPattern
  rotationBlocks?: ('rx' | 'ry' | 'rz')[]
  entanglementBlocks?: ('cx' | 'cz' | 'crx' | 'cry' | 'crz')[]
  skipFinalRotation?: boolean
  insertBarriers?: boolean
}

export interface TrainingConfig {
  optimizer: OptimizerConfig
  batchSize?: number
  epochs?: number
  shuffle?: boolean
  validationSplit?: number
  earlyStoppingPatience?: number
  learningRateSchedule?: 'constant' | 'exponential' | 'cosine'
}

export interface AnalysisOptions {
  computeExpressibility?: boolean
  computeTrainability?: boolean
  computeEntanglement?: boolean
  checkSimulability?: boolean
  detectBarrenPlateau?: boolean
  numSamples?: number
}

export interface KernelConfig {
  type: KernelType
  featureMap: EncoderConfig
  trainable?: boolean
  projectionDim?: number
}

export interface QAOAConfig {
  problemType: QAOAProblemType
  problemData: {
    graph?: { nodes: number; edges: [number, number, number][] }
    cities?: { x: number; y: number }[]
    assets?: { returns: number[]; covariance: number[][] }
    customHamiltonian?: { terms: { coeff: number; paulis: string }[] }
  }
  numLayers: number
  mixerType?: 'x' | 'xy' | 'grover' | 'custom'
  warmStart?: boolean
  recursive?: boolean
}

export interface QRLConfig {
  algorithmType: QRLAlgorithmType
  environmentId: EnvironmentType
  environmentConfig?: {
    gridSize?: number
    maxSteps?: number
    slippery?: boolean
  }
  numEpisodes: number
  maxStepsPerEpisode: number
  discountFactor: number
  explorationRate: number
  explorationDecay: number
  replayBufferSize?: number
  targetUpdateFrequency?: number
}

export interface QGNNConfig {
  numMessagePassingLayers: number
  aggregationType: 'sum' | 'mean' | 'max'
  readoutType: 'sum' | 'mean' | 'attention'
  nodeFeatureDim: number
  edgeFeatureDim?: number
}

export interface QTransformerConfig {
  numHeads: number
  sequenceLength: number
  embeddingDim: number
  numEncoderLayers: number
  usePositionalEncoding: boolean
}

export interface QReservoirConfig {
  reservoirSize: number
  inputScaling: number
  spectralRadius: number
  leakingRate: number
  readoutRegularization: number
}

export interface QAutoencoderConfig {
  latentDim: number
  encoderLayers: number
  decoderLayers: number
  reconstructionLoss: 'mse' | 'fidelity'
}

export interface QVAEConfig {
  latentDim: number
  encoderLayers: number
  decoderLayers: number
  klWeight: number
  numSamples: number
}

export interface QGANConfig {
  generatorLayers: number
  discriminatorLayers: number
  latentDim: number
  generatorLearningRate: number
  discriminatorLearningRate: number
  discriminatorSteps: number
}

export interface MitigationOptions {
  zne?: {
    enabled: boolean
    scaleFactors: number[]
    extrapolation: 'linear' | 'polynomial' | 'richardson'
  }
  readout?: {
    enabled: boolean
    calibrationShots?: number
  }
}

export interface QMLRequest {
  algorithm: QMLAlgorithm
  numQubits: number
  shots?: number
  seed?: number

  datasetId?: string
  customData?: { X: number[][]; y: number[] }
  trainTestSplit?: number

  encoderType?: EncoderType
  encoderConfig?: Partial<EncoderConfig>

  ansatzType?: AnsatzType
  ansatzConfig?: Partial<AnsatzConfig>

  optimizerType?: string
  optimizerConfig?: Partial<OptimizerConfig>

  trainingConfig?: Partial<TrainingConfig>
  analysisOptions?: AnalysisOptions
  mitigationConfig?: MitigationOptions

  kernelConfig?: KernelConfig
  qaoaConfig?: QAOAConfig
  qrlConfig?: QRLConfig
  qgnnConfig?: QGNNConfig
  qtransformerConfig?: QTransformerConfig
  qreservoirConfig?: QReservoirConfig
  qautoencoderConfig?: QAutoencoderConfig
  qvaeConfig?: QVAEConfig
  qganConfig?: QGANConfig

  algorithmConfig?: Record<string, unknown>
}

export interface TrainingHistory {
  iteration: number
  loss: number
  accuracy?: number
  gradientNorm?: number
  learningRate?: number
}

export interface ClassificationResult {
  accuracy: number
  trainAccuracy: number
  loss: number
  parameters: number[]
  predictions: number[]
  probabilities?: number[][]
  confusionMatrix?: number[][]
  history: TrainingHistory[]
}

export interface QAOAResult {
  optimalSolution: number[]
  optimalValue: number
  approximationRatio?: number
  solutionDistribution: Record<string, number>
  gammas: number[]
  betas: number[]
  history: TrainingHistory[]
}

export interface QRLResult {
  totalReward: number
  averageReward: number
  episodeRewards: number[]
  successRate: number
  averageSteps: number
  policyParameters: number[]
  qValues?: number[][]
}

export interface GenerativeResult {
  generatedSamples: number[][]
  fidelity?: number
  kldivergence?: number
  parameters: number[]
  history: TrainingHistory[]
}

export interface AutoencoderResult {
  reconstructionLoss: number
  latentRepresentations: number[][]
  reconstructedData: number[][]
  parameters: number[]
  history: TrainingHistory[]
}

export interface AnalysisResult {
  expressibility?: number
  trainability?: number
  entanglement?: number
  meyerWallach?: number
  simulable?: boolean
  simulabilityReason?: string
  barrenPlateauWarning?: boolean
  barrenPlateauSeverity?: 'none' | 'mild' | 'moderate' | 'severe'
  gradientVariance?: number
  effectiveDimension?: number
}

export interface CircuitMetrics {
  depth: number
  gateCount: number
  cnotCount: number
  parameterCount: number
  numQubits: number
  tGateCount?: number
}

export interface ExportCode {
  pennylane?: string
  qiskit?: string
  cirq?: string
  openqasm?: string
}

export interface QMLResponse {
  success: boolean

  result?: ClassificationResult | QAOAResult | QRLResult | GenerativeResult | AutoencoderResult

  analysis?: AnalysisResult

  metrics?: CircuitMetrics & {
    executionTimeMs: number
    memoryUsedMB?: number
  }

  export?: ExportCode

  error?: {
    code: string
    message: string
    details?: unknown
  }
}

export interface EnvironmentState {
  observation: number[]
  reward: number
  done: boolean
  info?: Record<string, unknown>
}

export interface EnvironmentSpec {
  observationDim: number
  actionDim: number
  discreteActions: boolean
  maxSteps: number
}

export interface GraphData {
  numNodes: number
  numEdges: number
  edges: [number, number][]
  edgeWeights?: number[]
  nodeFeatures?: number[][]
  edgeFeatures?: number[][]
  labels?: number[]
}

export interface TimeSeriesData {
  values: number[]
  timestamps?: number[]
  windowSize: number
  horizonSize: number
}
