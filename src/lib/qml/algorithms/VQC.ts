import { QMLCircuit } from '../core/QMLCircuit'
import { DataEncoder, createAngleEncoder, createIQPEncoder, type EncodingType } from '../core/DataEncoder'
import { createOptimizer, optimize, type Optimizer, type OptimizerType, type OptimizationResult } from '../core/Optimizer'

export interface VQCConfig {
  numQubits: number
  numLayers: number
  encodingType: EncodingType
  optimizerType: OptimizerType
  learningRate: number
  maxIterations: number
  batchSize: number
  entanglement: 'linear' | 'circular' | 'full'
}

export interface VQCTrainingResult {
  trainLoss: number[]
  trainAccuracy: number[]
  valLoss?: number[]
  valAccuracy?: number[]
  finalParameters: number[]
  epochs: number
  converged: boolean
}

export interface ClassificationResult {
  predictions: number[]
  probabilities: number[][]
  accuracy?: number
}

export class VQC {
  private config: VQCConfig
  private encoder: DataEncoder
  private ansatz: QMLCircuit
  private optimizer: Optimizer
  private numClasses: number = 2

  constructor(config: Partial<VQCConfig> = {}) {
    this.config = {
      numQubits: config.numQubits || 4,
      numLayers: config.numLayers || 2,
      encodingType: config.encodingType || 'angle',
      optimizerType: config.optimizerType || 'adam',
      learningRate: config.learningRate || 0.1,
      maxIterations: config.maxIterations || 100,
      batchSize: config.batchSize || 16,
      entanglement: config.entanglement || 'linear'
    }

    this.encoder = new DataEncoder({
      type: this.config.encodingType,
      numQubits: this.config.numQubits,
      numFeatures: this.config.numQubits,
      rotationGates: ['Ry']
    })

    this.ansatz = new QMLCircuit(this.config.numQubits)
    this.ansatz.buildHEA(this.config.numLayers, this.config.entanglement)
    this.ansatz.initializeRandom()

    this.optimizer = createOptimizer({
      type: this.config.optimizerType,
      learningRate: this.config.learningRate,
      maxIterations: this.config.maxIterations
    })
  }

  setNumClasses(numClasses: number): void {
    this.numClasses = numClasses
  }

  private buildCircuit(data: number[]): QMLCircuit {
    const circuit = this.encoder.encode(data)

    const ansatzGates = this.ansatz.toSimulatorGates()
    for (const gate of ansatzGates) {
      if (gate.parameters && gate.parameters.length > 0) {
        circuit.addGate(gate.type, gate.qubits, gate.parameters, gate.controlQubits)
      } else {
        circuit.addGate(gate.type, gate.qubits, undefined, gate.controlQubits)
      }
    }

    return circuit
  }

  forward(data: number[]): number[] {
    const circuit = this.buildCircuit(data)
    const stateVector = circuit.execute()

    const probs: number[] = []

    if (this.numClasses === 2) {
      const expectZ = circuit.expectationZ([0]).value
      const prob1 = (1 - expectZ) / 2
      probs.push(1 - prob1, prob1)
    } else {
      const numMeasureQubits = Math.ceil(Math.log2(this.numClasses))
      for (let c = 0; c < this.numClasses; c++) {
        let prob = 0
        for (let i = 0; i < stateVector.length; i++) {
          if ((i % this.numClasses) === c) {
            const amp = stateVector[i]
            prob += amp.re * amp.re + amp.im * amp.im
          }
        }
        probs.push(prob)
      }

      const sum = probs.reduce((a, b) => a + b, 0)
      for (let i = 0; i < probs.length; i++) {
        probs[i] /= sum || 1
      }
    }

    return probs
  }

  predict(data: number[]): number {
    const probs = this.forward(data)
    return probs.indexOf(Math.max(...probs))
  }

  predictBatch(dataBatch: number[][]): ClassificationResult {
    const predictions: number[] = []
    const probabilities: number[][] = []

    for (const data of dataBatch) {
      const probs = this.forward(data)
      probabilities.push(probs)
      predictions.push(probs.indexOf(Math.max(...probs)))
    }

    return { predictions, probabilities }
  }

  private computeLoss(dataBatch: number[][], labels: number[]): number {
    let totalLoss = 0

    for (let i = 0; i < dataBatch.length; i++) {
      const probs = this.forward(dataBatch[i])
      const label = labels[i]

      const eps = 1e-10
      totalLoss -= Math.log(probs[label] + eps)
    }

    return totalLoss / dataBatch.length
  }

  private computeAccuracy(dataBatch: number[][], labels: number[]): number {
    let correct = 0

    for (let i = 0; i < dataBatch.length; i++) {
      const pred = this.predict(dataBatch[i])
      if (pred === labels[i]) {
        correct++
      }
    }

    return correct / dataBatch.length
  }

  train(
    trainData: number[][],
    trainLabels: number[],
    valData?: number[][],
    valLabels?: number[],
    callback?: (epoch: number, trainLoss: number, trainAcc: number, valLoss?: number, valAcc?: number) => void
  ): VQCTrainingResult {
    const result: VQCTrainingResult = {
      trainLoss: [],
      trainAccuracy: [],
      valLoss: valData ? [] : undefined,
      valAccuracy: valData ? [] : undefined,
      finalParameters: [],
      epochs: 0,
      converged: false
    }

    this.numClasses = Math.max(...trainLabels) + 1

    const numSamples = trainData.length
    const numBatches = Math.ceil(numSamples / this.config.batchSize)

    const costFunction = (): number => {
      const batchStart = Math.floor(Math.random() * Math.max(1, numSamples - this.config.batchSize))
      const batchEnd = Math.min(batchStart + this.config.batchSize, numSamples)
      const batchData = trainData.slice(batchStart, batchEnd)
      const batchLabels = trainLabels.slice(batchStart, batchEnd)

      return this.computeLoss(batchData, batchLabels)
    }

    const gradientFunction = (): number[] => {
      return this.ansatz.computeGradient(() => costFunction())
    }

    let params = this.ansatz.getParameterVector()
    let bestLoss = Infinity
    let patienceCounter = 0
    const patience = 10

    for (let epoch = 0; epoch < this.config.maxIterations; epoch++) {
      const indices = Array.from({ length: numSamples }, (_, i) => i)
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[indices[i], indices[j]] = [indices[j], indices[i]]
      }

      let epochLoss = 0
      for (let b = 0; b < numBatches; b++) {
        const batchIndices = indices.slice(b * this.config.batchSize, (b + 1) * this.config.batchSize)
        const batchData = batchIndices.map(i => trainData[i])
        const batchLabels = batchIndices.map(i => trainLabels[i])

        const gradients = gradientFunction()
        params = this.optimizer.step(params, gradients)
        this.ansatz.setParameterVector(params)

        epochLoss += this.computeLoss(batchData, batchLabels)
      }

      epochLoss /= numBatches

      const trainAcc = this.computeAccuracy(trainData, trainLabels)
      result.trainLoss.push(epochLoss)
      result.trainAccuracy.push(trainAcc)

      let valLoss: number | undefined
      let valAcc: number | undefined

      if (valData && valLabels) {
        valLoss = this.computeLoss(valData, valLabels)
        valAcc = this.computeAccuracy(valData, valLabels)
        result.valLoss!.push(valLoss)
        result.valAccuracy!.push(valAcc)
      }

      if (callback) {
        callback(epoch, epochLoss, trainAcc, valLoss, valAcc)
      }

      if (epochLoss < bestLoss - 1e-4) {
        bestLoss = epochLoss
        patienceCounter = 0
      } else {
        patienceCounter++
        if (patienceCounter >= patience) {
          result.converged = true
          break
        }
      }

      result.epochs = epoch + 1
    }

    result.finalParameters = this.ansatz.getParameterVector()
    return result
  }

  getParameters(): number[] {
    return this.ansatz.getParameterVector()
  }

  setParameters(params: number[]): void {
    this.ansatz.setParameterVector(params)
  }

  getCircuit(): QMLCircuit {
    return this.ansatz
  }

  computeDecisionBoundary(
    xRange: [number, number],
    yRange: [number, number],
    resolution: number = 20
  ): { x: number; y: number; prediction: number; probability: number }[] {
    const points: { x: number; y: number; prediction: number; probability: number }[] = []
    const xStep = (xRange[1] - xRange[0]) / resolution
    const yStep = (yRange[1] - yRange[0]) / resolution

    for (let x = xRange[0]; x <= xRange[1]; x += xStep) {
      for (let y = yRange[0]; y <= yRange[1]; y += yStep) {
        const probs = this.forward([x, y])
        const prediction = probs.indexOf(Math.max(...probs))
        points.push({
          x,
          y,
          prediction,
          probability: probs[prediction]
        })
      }
    }

    return points
  }

  computeConfusionMatrix(data: number[][], labels: number[]): number[][] {
    const matrix: number[][] = Array.from({ length: this.numClasses }, () =>
      new Array(this.numClasses).fill(0)
    )

    for (let i = 0; i < data.length; i++) {
      const pred = this.predict(data[i])
      const actual = labels[i]
      matrix[actual][pred]++
    }

    return matrix
  }

  exportModel(): {
    config: VQCConfig
    parameters: number[]
    numClasses: number
  } {
    return {
      config: { ...this.config },
      parameters: this.ansatz.getParameterVector(),
      numClasses: this.numClasses
    }
  }

  static loadModel(exported: {
    config: VQCConfig
    parameters: number[]
    numClasses: number
  }): VQC {
    const vqc = new VQC(exported.config)
    vqc.setParameters(exported.parameters)
    vqc.setNumClasses(exported.numClasses)
    return vqc
  }
}

export function createVQC(
  numFeatures: number,
  numClasses: number = 2,
  numLayers: number = 2
): VQC {
  const numQubits = Math.max(2, numFeatures)
  const vqc = new VQC({
    numQubits,
    numLayers,
    encodingType: 'angle',
    optimizerType: 'adam',
    learningRate: 0.1,
    maxIterations: 50,
    batchSize: 16,
    entanglement: 'linear'
  })
  vqc.setNumClasses(numClasses)
  return vqc
}
