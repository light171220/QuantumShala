import { QMLCircuit } from '../core/QMLCircuit'
import { DataEncoder, type EncodingType } from '../core/DataEncoder'

export interface QSVMConfig {
  numQubits: number
  encodingType: EncodingType
  kernelType: 'fidelity' | 'projected'
  gamma: number
  C: number
}

export interface QSVMTrainingResult {
  supportVectors: number[][]
  supportVectorIndices: number[]
  alphas: number[]
  bias: number
  accuracy: number
}

export interface KernelMatrix {
  matrix: number[][]
  size: number
}

export class QSVM {
  private config: QSVMConfig
  private encoder: DataEncoder
  private supportVectors: number[][] = []
  private supportVectorLabels: number[] = []
  private alphas: number[] = []
  private bias: number = 0

  constructor(config: Partial<QSVMConfig> = {}) {
    this.config = {
      numQubits: config.numQubits || 4,
      encodingType: config.encodingType || 'iqp',
      kernelType: config.kernelType || 'fidelity',
      gamma: config.gamma || 1.0,
      C: config.C || 1.0
    }

    this.encoder = new DataEncoder({
      type: this.config.encodingType,
      numQubits: this.config.numQubits,
      numFeatures: this.config.numQubits,
      repetitions: 2
    })
  }

  computeKernel(x: number[], y: number[]): number {
    if (this.config.kernelType === 'fidelity') {
      return this.fidelityKernel(x, y)
    } else {
      return this.projectedKernel(x, y)
    }
  }

  private fidelityKernel(x: number[], y: number[]): number {
    const circuitX = this.encoder.encode(x)
    const stateX = circuitX.execute()

    const circuitY = this.encoder.encode(y)
    const stateY = circuitY.execute()

    let innerProduct = { re: 0, im: 0 }
    for (let i = 0; i < stateX.length; i++) {
      innerProduct.re += stateX[i].re * stateY[i].re + stateX[i].im * stateY[i].im
      innerProduct.im += stateX[i].re * stateY[i].im - stateX[i].im * stateY[i].re
    }

    return innerProduct.re * innerProduct.re + innerProduct.im * innerProduct.im
  }

  private projectedKernel(x: number[], y: number[]): number {
    const circuitX = this.encoder.encode(x)
    const circuitY = this.encoder.encode(y)

    const probsX = this.getMeasurementProbabilities(circuitX)
    const probsY = this.getMeasurementProbabilities(circuitY)

    let distance = 0
    for (let i = 0; i < probsX.length; i++) {
      distance += (probsX[i] - probsY[i]) ** 2
    }

    return Math.exp(-this.config.gamma * distance)
  }

  private getMeasurementProbabilities(circuit: QMLCircuit): number[] {
    const stateVector = circuit.execute()
    return stateVector.map(amp => amp.re * amp.re + amp.im * amp.im)
  }

  computeKernelMatrix(data: number[][]): KernelMatrix {
    const n = data.length
    const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const k = this.computeKernel(data[i], data[j])
        matrix[i][j] = k
        matrix[j][i] = k
      }
    }

    return { matrix, size: n }
  }

  train(trainData: number[][], trainLabels: number[]): QSVMTrainingResult {
    const n = trainData.length

    const labels = trainLabels.map(l => l === 0 ? -1 : 1)

    const { matrix: K } = this.computeKernelMatrix(trainData)

    const alphas = new Array(n).fill(0)
    let bias = 0

    const maxIter = 100
    const tol = 1e-3
    const C = this.config.C

    for (let iter = 0; iter < maxIter; iter++) {
      let numChanged = 0

      for (let i = 0; i < n; i++) {
        let fi = bias
        for (let j = 0; j < n; j++) {
          fi += alphas[j] * labels[j] * K[i][j]
        }
        const Ei = fi - labels[i]

        if ((labels[i] * Ei < -tol && alphas[i] < C) ||
            (labels[i] * Ei > tol && alphas[i] > 0)) {

          let j = Math.floor(Math.random() * n)
          while (j === i) j = Math.floor(Math.random() * n)

          let fj = bias
          for (let k = 0; k < n; k++) {
            fj += alphas[k] * labels[k] * K[j][k]
          }
          const Ej = fj - labels[j]

          const alphaIOld = alphas[i]
          const alphaJOld = alphas[j]

          let L, H
          if (labels[i] !== labels[j]) {
            L = Math.max(0, alphas[j] - alphas[i])
            H = Math.min(C, C + alphas[j] - alphas[i])
          } else {
            L = Math.max(0, alphas[i] + alphas[j] - C)
            H = Math.min(C, alphas[i] + alphas[j])
          }

          if (L >= H) continue

          const eta = 2 * K[i][j] - K[i][i] - K[j][j]
          if (eta >= 0) continue

          alphas[j] = alphas[j] - (labels[j] * (Ei - Ej)) / eta
          alphas[j] = Math.max(L, Math.min(H, alphas[j]))

          if (Math.abs(alphas[j] - alphaJOld) < 1e-5) continue

          alphas[i] = alphas[i] + labels[i] * labels[j] * (alphaJOld - alphas[j])

          const b1 = bias - Ei - labels[i] * (alphas[i] - alphaIOld) * K[i][i] -
                     labels[j] * (alphas[j] - alphaJOld) * K[i][j]
          const b2 = bias - Ej - labels[i] * (alphas[i] - alphaIOld) * K[i][j] -
                     labels[j] * (alphas[j] - alphaJOld) * K[j][j]

          if (0 < alphas[i] && alphas[i] < C) {
            bias = b1
          } else if (0 < alphas[j] && alphas[j] < C) {
            bias = b2
          } else {
            bias = (b1 + b2) / 2
          }

          numChanged++
        }
      }

      if (numChanged === 0) break
    }

    const svIndices: number[] = []
    this.supportVectors = []
    this.supportVectorLabels = []
    this.alphas = []

    for (let i = 0; i < n; i++) {
      if (alphas[i] > 1e-5) {
        svIndices.push(i)
        this.supportVectors.push(trainData[i])
        this.supportVectorLabels.push(labels[i])
        this.alphas.push(alphas[i])
      }
    }

    this.bias = bias

    let correct = 0
    for (let i = 0; i < n; i++) {
      const pred = this.predictOne(trainData[i])
      if (pred === trainLabels[i]) correct++
    }

    return {
      supportVectors: this.supportVectors,
      supportVectorIndices: svIndices,
      alphas: this.alphas,
      bias: this.bias,
      accuracy: correct / n
    }
  }

  predictOne(x: number[]): number {
    let sum = this.bias

    for (let i = 0; i < this.supportVectors.length; i++) {
      const k = this.computeKernel(x, this.supportVectors[i])
      sum += this.alphas[i] * this.supportVectorLabels[i] * k
    }

    return sum >= 0 ? 1 : 0
  }

  predict(data: number[][]): number[] {
    return data.map(x => this.predictOne(x))
  }

  decisionFunction(data: number[][]): number[] {
    return data.map(x => {
      let sum = this.bias
      for (let i = 0; i < this.supportVectors.length; i++) {
        const k = this.computeKernel(x, this.supportVectors[i])
        sum += this.alphas[i] * this.supportVectorLabels[i] * k
      }
      return sum
    })
  }

  score(testData: number[][], testLabels: number[]): number {
    const predictions = this.predict(testData)
    let correct = 0
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === testLabels[i]) correct++
    }
    return correct / predictions.length
  }

  computeDecisionBoundary(
    xRange: [number, number],
    yRange: [number, number],
    resolution: number = 20
  ): { x: number; y: number; prediction: number; decision: number }[] {
    const points: { x: number; y: number; prediction: number; decision: number }[] = []
    const xStep = (xRange[1] - xRange[0]) / resolution
    const yStep = (yRange[1] - yRange[0]) / resolution

    for (let x = xRange[0]; x <= xRange[1]; x += xStep) {
      for (let y = yRange[0]; y <= yRange[1]; y += yStep) {
        const decisions = this.decisionFunction([[x, y]])
        const prediction = decisions[0] >= 0 ? 1 : 0
        points.push({
          x,
          y,
          prediction,
          decision: decisions[0]
        })
      }
    }

    return points
  }

  getNumSupportVectors(): number {
    return this.supportVectors.length
  }

  exportModel(): {
    config: QSVMConfig
    supportVectors: number[][]
    supportVectorLabels: number[]
    alphas: number[]
    bias: number
  } {
    return {
      config: { ...this.config },
      supportVectors: this.supportVectors.map(sv => [...sv]),
      supportVectorLabels: [...this.supportVectorLabels],
      alphas: [...this.alphas],
      bias: this.bias
    }
  }

  static loadModel(exported: ReturnType<QSVM['exportModel']>): QSVM {
    const qsvm = new QSVM(exported.config)
    qsvm.supportVectors = exported.supportVectors
    qsvm.supportVectorLabels = exported.supportVectorLabels
    qsvm.alphas = exported.alphas
    qsvm.bias = exported.bias
    return qsvm
  }
}

export function createQSVM(
  numFeatures: number,
  kernelType: 'fidelity' | 'projected' = 'fidelity'
): QSVM {
  return new QSVM({
    numQubits: Math.max(2, numFeatures),
    encodingType: 'iqp',
    kernelType,
    gamma: 1.0,
    C: 1.0
  })
}

export function visualizeKernelMatrix(qsvm: QSVM, data: number[][]): {
  matrix: number[][]
  labels: string[]
} {
  const { matrix } = qsvm.computeKernelMatrix(data)
  const labels = data.map((_, i) => `x${i}`)
  return { matrix, labels }
}
