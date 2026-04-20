import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { QMLCircuit } from '@/lib/qml/core/QMLCircuit'
import type { EncodingType } from '@/lib/qml/core/DataEncoder'
import type { OptimizerType, OptimizationHistory } from '@/lib/qml/core/Optimizer'

export type QMLAlgorithm = 'vqc' | 'qsvm' | 'qgan' | 'qrl' | 'qcnn'

export interface QMLDataset {
  id: string
  name: string
  type: 'builtin' | 'custom'
  features: number[][]
  labels: number[]
  numFeatures: number
  numClasses: number
  trainIndices?: number[]
  testIndices?: number[]
}

export interface TrainingConfig {
  algorithm: QMLAlgorithm
  encodingType: EncodingType
  optimizerType: OptimizerType
  learningRate: number
  numLayers: number
  numQubits: number
  epochs: number
  batchSize: number
  trainTestSplit: number
  entanglement: 'linear' | 'circular' | 'full'
}

export type TrainingStatus = 'idle' | 'training' | 'paused' | 'completed' | 'error'

export interface TrainingMetrics {
  epoch: number
  loss: number
  accuracy: number
  valLoss?: number
  valAccuracy?: number
  timestamp?: number
}

export type ExportFormat = 'pennylane' | 'qiskit' | 'json'

interface QMLState {
  selectedAlgorithm: QMLAlgorithm

  dataset: QMLDataset | null
  availableDatasets: QMLDataset[]

  config: TrainingConfig
  circuit: QMLCircuit | null

  trainingStatus: TrainingStatus
  currentEpoch: number
  trainingHistory: TrainingMetrics[]

  predictions: number[]
  confusionMatrix: number[][] | null
  decisionBoundary: { x: number; y: number; prediction: number }[] | null

  isModelBuilderOpen: boolean
  selectedVisualization: 'loss' | 'accuracy' | 'boundary' | 'confusion' | 'state'
  error: string | null
}

interface QMLActions {
  setAlgorithm: (algorithm: QMLAlgorithm) => void

  setDataset: (dataset: QMLDataset) => void
  loadBuiltinDataset: (name: string) => void
  uploadCustomDataset: (data: { features: number[][]; labels: number[] }) => void
  splitDataset: (trainRatio: number) => void

  setConfig: (config: Partial<TrainingConfig>) => void
  setNumQubits: (numQubits: number) => void
  setNumLayers: (numLayers: number) => void
  setLearningRate: (lr: number) => void
  setEncodingType: (type: EncodingType) => void
  setOptimizerType: (type: OptimizerType) => void

  buildCircuit: () => void
  setCircuit: (circuit: QMLCircuit) => void

  startTraining: () => void
  pauseTraining: () => void
  resumeTraining: () => void
  stopTraining: () => void
  recordMetrics: (metrics: TrainingMetrics) => void
  setTrainingStatus: (status: TrainingStatus) => void

  setPredictions: (predictions: number[]) => void
  setConfusionMatrix: (matrix: number[][]) => void
  setDecisionBoundary: (boundary: { x: number; y: number; prediction: number }[]) => void

  toggleModelBuilder: () => void
  setSelectedVisualization: (viz: QMLState['selectedVisualization']) => void
  setError: (error: string | null) => void
  reset: () => void
}

const BUILTIN_DATASETS: Record<string, Omit<QMLDataset, 'id' | 'trainIndices' | 'testIndices'>> = {
  iris: {
    name: 'Iris (2 classes)',
    type: 'builtin',
    features: [],
    labels: [],
    numFeatures: 4,
    numClasses: 2
  },
  moons: {
    name: 'Two Moons',
    type: 'builtin',
    features: [],
    labels: [],
    numFeatures: 2,
    numClasses: 2
  },
  circles: {
    name: 'Concentric Circles',
    type: 'builtin',
    features: [],
    labels: [],
    numFeatures: 2,
    numClasses: 2
  },
  xor: {
    name: 'XOR',
    type: 'builtin',
    features: [],
    labels: [],
    numFeatures: 2,
    numClasses: 2
  },
  blobs: {
    name: 'Gaussian Blobs',
    type: 'builtin',
    features: [],
    labels: [],
    numFeatures: 2,
    numClasses: 3
  }
}

const defaultConfig: TrainingConfig = {
  algorithm: 'vqc',
  encodingType: 'angle',
  optimizerType: 'adam',
  learningRate: 0.1,
  numLayers: 2,
  numQubits: 4,
  epochs: 50,
  batchSize: 16,
  trainTestSplit: 0.8,
  entanglement: 'linear'
}

const initialState: QMLState = {
  selectedAlgorithm: 'vqc',
  dataset: null,
  availableDatasets: Object.entries(BUILTIN_DATASETS).map(([id, ds]) => ({
    ...ds,
    id,
    trainIndices: [],
    testIndices: []
  })),
  config: defaultConfig,
  circuit: null,
  trainingStatus: 'idle',
  currentEpoch: 0,
  trainingHistory: [],
  predictions: [],
  confusionMatrix: null,
  decisionBoundary: null,
  isModelBuilderOpen: false,
  selectedVisualization: 'loss',
  error: null
}

export const useQMLStore = create<QMLState & QMLActions>()(
  immer((set, get) => ({
    ...initialState,

    setAlgorithm: (algorithm) =>
      set((state) => {
        state.selectedAlgorithm = algorithm
        state.config.algorithm = algorithm
        state.circuit = null
      }),

    setDataset: (dataset) =>
      set((state) => {
        state.dataset = dataset
        if (state.config.encodingType === 'angle') {
          state.config.numQubits = Math.max(2, Math.ceil(dataset.numFeatures))
        }
      }),

    loadBuiltinDataset: (name) =>
      set((state) => {
        const base = BUILTIN_DATASETS[name]
        if (base) {
          const generated = generateBuiltinDataset(name)
          state.dataset = {
            ...base,
            ...generated,
            id: name
          }
        }
      }),

    uploadCustomDataset: (data) =>
      set((state) => {
        const numFeatures = data.features[0]?.length || 0
        const numClasses = new Set(data.labels).size
        state.dataset = {
          id: `custom_${Date.now()}`,
          name: 'Custom Dataset',
          type: 'custom',
          features: data.features,
          labels: data.labels,
          numFeatures,
          numClasses,
          trainIndices: [],
          testIndices: []
        }
      }),

    splitDataset: (trainRatio) =>
      set((state) => {
        if (!state.dataset) return
        const n = state.dataset.features.length
        const indices = Array.from({ length: n }, (_, i) => i)
        shuffleArray(indices)
        const splitIdx = Math.floor(n * trainRatio)
        state.dataset.trainIndices = indices.slice(0, splitIdx)
        state.dataset.testIndices = indices.slice(splitIdx)
      }),

    setConfig: (config) =>
      set((state) => {
        Object.assign(state.config, config)
      }),

    setNumQubits: (numQubits) =>
      set((state) => {
        state.config.numQubits = numQubits
        state.circuit = null
      }),

    setNumLayers: (numLayers) =>
      set((state) => {
        state.config.numLayers = numLayers
        state.circuit = null
      }),

    setLearningRate: (lr) =>
      set((state) => {
        state.config.learningRate = lr
      }),

    setEncodingType: (type) =>
      set((state) => {
        state.config.encodingType = type
        state.circuit = null
      }),

    setOptimizerType: (type) =>
      set((state) => {
        state.config.optimizerType = type
      }),

    buildCircuit: () =>
      set((state) => {
        const { numQubits, numLayers, entanglement } = state.config
        const circuit = new QMLCircuit(numQubits)
        circuit.buildHEA(numLayers, entanglement)
        circuit.initializeRandom()
        state.circuit = circuit
      }),

    setCircuit: (circuit) =>
      set((state) => {
        state.circuit = circuit
      }),

    startTraining: () =>
      set((state) => {
        state.trainingStatus = 'training'
        state.trainingHistory = []
        state.currentEpoch = 0
        state.error = null
      }),

    pauseTraining: () =>
      set((state) => {
        state.trainingStatus = 'paused'
      }),

    resumeTraining: () =>
      set((state) => {
        state.trainingStatus = 'training'
      }),

    stopTraining: () =>
      set((state) => {
        state.trainingStatus = 'idle'
      }),

    recordMetrics: (metrics) =>
      set((state) => {
        state.trainingHistory.push(metrics)
        state.currentEpoch = metrics.epoch
      }),

    setTrainingStatus: (status) =>
      set((state) => {
        state.trainingStatus = status
      }),

    setPredictions: (predictions) =>
      set((state) => {
        state.predictions = predictions
      }),

    setConfusionMatrix: (matrix) =>
      set((state) => {
        state.confusionMatrix = matrix
      }),

    setDecisionBoundary: (boundary) =>
      set((state) => {
        state.decisionBoundary = boundary
      }),

    toggleModelBuilder: () =>
      set((state) => {
        state.isModelBuilderOpen = !state.isModelBuilderOpen
      }),

    setSelectedVisualization: (viz) =>
      set((state) => {
        state.selectedVisualization = viz
      }),

    setError: (error) =>
      set((state) => {
        state.error = error
        if (error) {
          state.trainingStatus = 'error'
        }
      }),

    reset: () =>
      set(initialState)
  }))
)

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

function generateBuiltinDataset(name: string): { features: number[][]; labels: number[]; trainIndices: number[]; testIndices: number[] } {
  const n = 200
  const features: number[][] = []
  const labels: number[] = []

  switch (name) {
    case 'moons':
      for (let i = 0; i < n / 2; i++) {
        const angle = (i / (n / 2)) * Math.PI
        features.push([
          Math.cos(angle) + (Math.random() - 0.5) * 0.3,
          Math.sin(angle) + (Math.random() - 0.5) * 0.3
        ])
        labels.push(0)
        features.push([
          1 - Math.cos(angle) + (Math.random() - 0.5) * 0.3,
          0.5 - Math.sin(angle) + (Math.random() - 0.5) * 0.3
        ])
        labels.push(1)
      }
      break

    case 'circles':
      for (let i = 0; i < n / 2; i++) {
        const angle = (i / (n / 2)) * 2 * Math.PI
        const r1 = 0.3 + (Math.random() - 0.5) * 0.1
        const r2 = 0.8 + (Math.random() - 0.5) * 0.1
        features.push([r1 * Math.cos(angle), r1 * Math.sin(angle)])
        labels.push(0)
        features.push([r2 * Math.cos(angle), r2 * Math.sin(angle)])
        labels.push(1)
      }
      break

    case 'xor':
      for (let i = 0; i < n; i++) {
        const x = Math.random() * 2 - 1
        const y = Math.random() * 2 - 1
        features.push([x + (Math.random() - 0.5) * 0.2, y + (Math.random() - 0.5) * 0.2])
        labels.push((x > 0) !== (y > 0) ? 1 : 0)
      }
      break

    case 'blobs':
      const centers = [[0, 0], [2, 0], [1, 1.7]]
      for (let c = 0; c < 3; c++) {
        for (let i = 0; i < n / 3; i++) {
          features.push([
            centers[c][0] + (Math.random() - 0.5) * 0.8,
            centers[c][1] + (Math.random() - 0.5) * 0.8
          ])
          labels.push(c)
        }
      }
      break

    case 'iris':
      for (let i = 0; i < n / 2; i++) {
        features.push([
          5.0 + Math.random() * 0.5,
          3.4 + Math.random() * 0.4,
          1.4 + Math.random() * 0.2,
          0.2 + Math.random() * 0.1
        ])
        labels.push(0)
        features.push([
          5.9 + Math.random() * 0.8,
          2.8 + Math.random() * 0.3,
          4.2 + Math.random() * 0.5,
          1.3 + Math.random() * 0.3
        ])
        labels.push(1)
      }
      break

    default:
      for (let i = 0; i < n; i++) {
        features.push([Math.random() * 2 - 1, Math.random() * 2 - 1])
        labels.push(Math.random() < 0.5 ? 0 : 1)
      }
  }

  const indices = Array.from({ length: features.length }, (_, i) => i)
  shuffleArray(indices)
  const splitIdx = Math.floor(features.length * 0.8)

  return {
    features,
    labels,
    trainIndices: indices.slice(0, splitIdx),
    testIndices: indices.slice(splitIdx)
  }
}
