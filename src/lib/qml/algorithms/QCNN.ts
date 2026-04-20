import { QMLCircuit } from '../core/QMLCircuit'
import { DataEncoder } from '../core/DataEncoder'
import { createOptimizer, type Optimizer, type OptimizerType } from '../core/Optimizer'

export interface QCNNConfig {
  numQubits: number
  numConvLayers: number
  numPoolingLayers: number
  filterSize: number
  optimizerType: OptimizerType
  learningRate: number
  maxIterations: number
}

export interface QCNNLayer {
  type: 'conv' | 'pool' | 'fc'
  qubits: number[]
  parameters: number[]
}

export class QCNN {
  private config: QCNNConfig
  private circuit: QMLCircuit
  private encoder: DataEncoder
  private optimizer: Optimizer
  private layers: QCNNLayer[] = []
  private numClasses: number = 2

  constructor(config: Partial<QCNNConfig> = {}) {
    this.config = {
      numQubits: config.numQubits || 8,
      numConvLayers: config.numConvLayers || 2,
      numPoolingLayers: config.numPoolingLayers || 2,
      filterSize: config.filterSize || 2,
      optimizerType: config.optimizerType || 'adam',
      learningRate: config.learningRate || 0.1,
      maxIterations: config.maxIterations || 50
    }

    this.circuit = new QMLCircuit(this.config.numQubits)
    this.encoder = new DataEncoder({
      type: 'angle',
      numQubits: this.config.numQubits,
      numFeatures: this.config.numQubits,
      rotationGates: ['Ry']
    })

    this.optimizer = createOptimizer({
      type: this.config.optimizerType,
      learningRate: this.config.learningRate,
      maxIterations: this.config.maxIterations
    })

    this.buildArchitecture()
  }

  private buildArchitecture(): void {
    let activeQubits = this.config.numQubits

    for (let layer = 0; layer < this.config.numConvLayers; layer++) {
      this.addConvolutionalLayer(activeQubits)

      if (layer < this.config.numPoolingLayers && activeQubits > 2) {
        this.addPoolingLayer(activeQubits)
        activeQubits = Math.ceil(activeQubits / 2)
      }
    }

    this.addFullyConnectedLayer(activeQubits)
  }

  private addConvolutionalLayer(numQubits: number): void {
    const qubits: number[] = []
    for (let i = 0; i < numQubits; i++) {
      qubits.push(i)
    }

    for (let i = 0; i < numQubits; i++) {
      this.circuit.addParameterizedGate('Ry', i)
      this.circuit.addParameterizedGate('Rz', i)
    }

    for (let i = 0; i < numQubits - 1; i += this.config.filterSize) {
      for (let j = i; j < Math.min(i + this.config.filterSize, numQubits) - 1; j++) {
        this.circuit.addGate('CNOT', [j, j + 1])
        this.circuit.addParameterizedGate('Ry', j + 1)
        this.circuit.addGate('CNOT', [j, j + 1])
      }
    }

    this.layers.push({
      type: 'conv',
      qubits,
      parameters: []
    })
  }

  private addPoolingLayer(numQubits: number): void {
    const pooledQubits: number[] = []

    for (let i = 0; i < numQubits - 1; i += 2) {
      this.circuit.addGate('CNOT', [i, i + 1])
      this.circuit.addParameterizedGate('Ry', i)
      pooledQubits.push(i)
    }

    if (numQubits % 2 === 1) {
      pooledQubits.push(numQubits - 1)
    }

    this.layers.push({
      type: 'pool',
      qubits: pooledQubits,
      parameters: []
    })
  }

  private addFullyConnectedLayer(numQubits: number): void {
    for (let i = 0; i < numQubits; i++) {
      this.circuit.addParameterizedGate('Ry', i)
      this.circuit.addParameterizedGate('Rz', i)
    }

    for (let i = 0; i < numQubits; i++) {
      for (let j = i + 1; j < numQubits; j++) {
        this.circuit.addGate('CNOT', [i, j])
      }
    }

    for (let i = 0; i < numQubits; i++) {
      this.circuit.addParameterizedGate('Ry', i)
    }

    this.layers.push({
      type: 'fc',
      qubits: Array.from({ length: numQubits }, (_, i) => i),
      parameters: []
    })
  }

  setNumClasses(numClasses: number): void {
    this.numClasses = numClasses
  }

  private buildFullCircuit(data: number[]): QMLCircuit {
    const fullCircuit = this.encoder.encode(data)

    const ansatzGates = this.circuit.toSimulatorGates()
    for (const gate of ansatzGates) {
      if (gate.parameters && gate.parameters.length > 0) {
        fullCircuit.addGate(gate.type, gate.qubits, gate.parameters, gate.controlQubits)
      } else {
        fullCircuit.addGate(gate.type, gate.qubits, undefined, gate.controlQubits)
      }
    }

    return fullCircuit
  }

  forward(data: number[]): number[] {
    const circuit = this.buildFullCircuit(data)
    const stateVector = circuit.execute()

    const probs: number[] = []

    if (this.numClasses === 2) {
      const expectZ = circuit.expectationZ([0]).value
      const prob1 = (1 - expectZ) / 2
      probs.push(1 - prob1, prob1)
    } else {
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

  predictBatch(dataBatch: number[][]): { predictions: number[]; probabilities: number[][] } {
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
      if (this.predict(dataBatch[i]) === labels[i]) correct++
    }
    return correct / dataBatch.length
  }

  train(
    trainData: number[][],
    trainLabels: number[],
    valData?: number[][],
    valLabels?: number[],
    callback?: (epoch: number, trainLoss: number, trainAcc: number, valLoss?: number, valAcc?: number) => void
  ): { trainLoss: number[]; trainAccuracy: number[]; finalParameters: number[] } {
    this.numClasses = Math.max(...trainLabels) + 1

    const result = {
      trainLoss: [] as number[],
      trainAccuracy: [] as number[],
      finalParameters: [] as number[]
    }

    const batchSize = 16
    let params = this.circuit.getParameterVector()

    const costFunction = (): number => {
      const batchStart = Math.floor(Math.random() * Math.max(1, trainData.length - batchSize))
      const batchEnd = Math.min(batchStart + batchSize, trainData.length)
      return this.computeLoss(trainData.slice(batchStart, batchEnd), trainLabels.slice(batchStart, batchEnd))
    }

    const gradientFunction = (): number[] => {
      return this.circuit.computeGradient(() => costFunction())
    }

    for (let epoch = 0; epoch < this.config.maxIterations; epoch++) {
      const gradients = gradientFunction()
      params = this.optimizer.step(params, gradients)
      this.circuit.setParameterVector(params)

      const trainLoss = this.computeLoss(trainData, trainLabels)
      const trainAcc = this.computeAccuracy(trainData, trainLabels)

      result.trainLoss.push(trainLoss)
      result.trainAccuracy.push(trainAcc)

      if (callback) {
        const valLoss = valData ? this.computeLoss(valData, valLabels!) : undefined
        const valAcc = valData ? this.computeAccuracy(valData, valLabels!) : undefined
        callback(epoch, trainLoss, trainAcc, valLoss, valAcc)
      }
    }

    result.finalParameters = this.circuit.getParameterVector()
    return result
  }

  getParameters(): number[] {
    return this.circuit.getParameterVector()
  }

  setParameters(params: number[]): void {
    this.circuit.setParameterVector(params)
  }

  getLayers(): QCNNLayer[] {
    return [...this.layers]
  }
}

export function createQCNN(numQubits: number = 8, numLayers: number = 2): QCNN {
  return new QCNN({
    numQubits,
    numConvLayers: numLayers,
    numPoolingLayers: numLayers - 1
  })
}
