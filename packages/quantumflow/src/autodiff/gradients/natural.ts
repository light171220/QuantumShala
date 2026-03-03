import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../tape'

export interface NaturalGradientConfig {
  regularization: number
  blockDiagonal: boolean
  approximation: 'block_diag' | 'full' | 'diagonal'
}

const DEFAULT_CONFIG: NaturalGradientConfig = {
  regularization: 1e-4,
  blockDiagonal: true,
  approximation: 'block_diag'
}

export function computeQuantumFisherInformation(
  tape: QuantumTape,
  executeGradient: (t: QuantumTape, paramIdx: number) => number[],
  numShots: number = 1000
): QTensor {
  const numParams = tape.numParameters
  const fisherMatrix = QTensor.zeros([numParams, numParams])

  for (let i = 0; i < numParams; i++) {
    const gradI = executeGradient(tape, i)

    for (let j = i; j < numParams; j++) {
      const gradJ = executeGradient(tape, j)

      let fisherElement = 0
      for (let k = 0; k < gradI.length; k++) {
        fisherElement += gradI[k] * gradJ[k]
      }
      fisherElement *= 4

      fisherMatrix.data[i * numParams + j] = fisherElement
      fisherMatrix.data[j * numParams + i] = fisherElement
    }
  }

  return fisherMatrix
}

export function computeClassicalFisherInformation(
  probabilities: number[],
  probabilityGradients: number[][]
): QTensor {
  const numParams = probabilityGradients.length
  const numOutcomes = probabilities.length
  const fisherMatrix = QTensor.zeros([numParams, numParams])

  for (let i = 0; i < numParams; i++) {
    for (let j = i; j < numParams; j++) {
      let fisherElement = 0

      for (let k = 0; k < numOutcomes; k++) {
        if (probabilities[k] > 1e-10) {
          fisherElement += (probabilityGradients[i][k] * probabilityGradients[j][k]) / probabilities[k]
        }
      }

      fisherMatrix.data[i * numParams + j] = fisherElement
      fisherMatrix.data[j * numParams + i] = fisherElement
    }
  }

  return fisherMatrix
}

export function naturalGradient(
  gradients: QTensor,
  fisherMatrix: QTensor,
  config: Partial<NaturalGradientConfig> = {}
): QTensor {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const n = gradients.shape[0]

  const regularizedFisher = fisherMatrix.clone()
  for (let i = 0; i < n; i++) {
    regularizedFisher.data[i * n + i] += cfg.regularization
  }

  const invFisher = invertMatrix(regularizedFisher)

  return invFisher.matmul(gradients.reshape([n, 1])).reshape([n])
}

export function blockDiagonalNaturalGradient(
  gradients: QTensor,
  fisherMatrix: QTensor,
  blockSizes: number[],
  config: Partial<NaturalGradientConfig> = {}
): QTensor {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const result = QTensor.zeros(gradients.shape)

  let offset = 0
  for (const blockSize of blockSizes) {
    const blockGrad = gradients.slice([offset], [offset + blockSize])
    const blockFisher = extractBlock(fisherMatrix, offset, blockSize)

    for (let i = 0; i < blockSize; i++) {
      blockFisher.data[i * blockSize + i] += cfg.regularization
    }

    const invBlockFisher = invertMatrix(blockFisher)
    const naturalBlockGrad = invBlockFisher.matmul(blockGrad.reshape([blockSize, 1]))

    for (let i = 0; i < blockSize; i++) {
      result.data[offset + i] = naturalBlockGrad.data[i]
    }

    offset += blockSize
  }

  return result
}

function extractBlock(matrix: QTensor, offset: number, size: number): QTensor {
  const n = matrix.shape[0]
  const block = QTensor.zeros([size, size])

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      block.data[i * size + j] = matrix.data[(offset + i) * n + (offset + j)]
    }
  }

  return block
}

function invertMatrix(matrix: QTensor): QTensor {
  const n = matrix.shape[0]
  const augmented = QTensor.zeros([n, 2 * n])

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      augmented.data[i * 2 * n + j] = matrix.data[i * n + j]
    }
    augmented.data[i * 2 * n + n + i] = 1
  }

  for (let col = 0; col < n; col++) {
    let maxRow = col
    let maxVal = Math.abs(augmented.data[col * 2 * n + col])

    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(augmented.data[row * 2 * n + col])
      if (val > maxVal) {
        maxVal = val
        maxRow = row
      }
    }

    if (maxRow !== col) {
      for (let j = 0; j < 2 * n; j++) {
        const temp = augmented.data[col * 2 * n + j]
        augmented.data[col * 2 * n + j] = augmented.data[maxRow * 2 * n + j]
        augmented.data[maxRow * 2 * n + j] = temp
      }
    }

    const pivot = augmented.data[col * 2 * n + col]
    if (Math.abs(pivot) < 1e-10) {
      throw new Error('Matrix is singular or nearly singular')
    }

    for (let j = 0; j < 2 * n; j++) {
      augmented.data[col * 2 * n + j] /= pivot
    }

    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = augmented.data[row * 2 * n + col]
        for (let j = 0; j < 2 * n; j++) {
          augmented.data[row * 2 * n + j] -= factor * augmented.data[col * 2 * n + j]
        }
      }
    }
  }

  const inverse = QTensor.zeros([n, n])
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      inverse.data[i * n + j] = augmented.data[i * 2 * n + n + j]
    }
  }

  return inverse
}

export function diagonalNaturalGradient(
  gradients: QTensor,
  fisherDiagonal: QTensor,
  regularization: number = 1e-4
): QTensor {
  const n = gradients.shape[0]
  const result = QTensor.zeros([n])

  for (let i = 0; i < n; i++) {
    result.data[i] = gradients.data[i] / (fisherDiagonal.data[i] + regularization)
  }

  return result
}

export function estimateFisherDiagonal(
  tape: QuantumTape,
  executeFunc: (t: QuantumTape) => number,
  executeGradient: (t: QuantumTape) => number[],
  numSamples: number = 100
): QTensor {
  const numParams = tape.numParameters
  const diagonal = QTensor.zeros([numParams])
  const sumSquaredGrads = new Float64Array(numParams)

  for (let s = 0; s < numSamples; s++) {
    const grads = executeGradient(tape)

    for (let i = 0; i < numParams; i++) {
      sumSquaredGrads[i] += grads[i] * grads[i]
    }
  }

  for (let i = 0; i < numParams; i++) {
    diagonal.data[i] = sumSquaredGrads[i] / numSamples
  }

  return diagonal
}

export function adamNaturalGradient(
  gradients: QTensor,
  fisherMatrix: QTensor,
  m: QTensor,
  v: QTensor,
  step: number,
  beta1: number = 0.9,
  beta2: number = 0.999,
  epsilon: number = 1e-8,
  regularization: number = 1e-4
): { naturalGrad: QTensor; m: QTensor; v: QTensor } {
  const n = gradients.shape[0]

  const newM = m.mul(beta1).add(gradients.mul(1 - beta1))
  const newV = v.mul(beta2).add(gradients.mul(gradients).mul(1 - beta2))

  const mHat = newM.div(1 - Math.pow(beta1, step))
  const vHat = newV.div(1 - Math.pow(beta2, step))

  const regularizedFisher = fisherMatrix.clone()
  for (let i = 0; i < n; i++) {
    regularizedFisher.data[i * n + i] += regularization + Math.sqrt(vHat.data[i]) + epsilon
  }

  const invFisher = invertMatrix(regularizedFisher)
  const naturalGrad = invFisher.matmul(mHat.reshape([n, 1])).reshape([n])

  return { naturalGrad, m: newM, v: newV }
}

export class QuantumNaturalGradientOptimizer {
  private m: QTensor | null
  private v: QTensor | null
  private step: number
  private config: NaturalGradientConfig & {
    learningRate: number
    beta1: number
    beta2: number
    epsilon: number
  }

  constructor(
    config: Partial<NaturalGradientConfig & {
      learningRate: number
      beta1: number
      beta2: number
      epsilon: number
    }> = {}
  ) {
    this.m = null
    this.v = null
    this.step = 0
    this.config = {
      ...DEFAULT_CONFIG,
      learningRate: 0.01,
      beta1: 0.9,
      beta2: 0.999,
      epsilon: 1e-8,
      ...config
    }
  }

  computeUpdate(
    gradients: QTensor,
    fisherMatrix: QTensor
  ): QTensor {
    this.step++
    const n = gradients.shape[0]

    if (!this.m || !this.v) {
      this.m = QTensor.zeros([n])
      this.v = QTensor.zeros([n])
    }

    const { naturalGrad, m, v } = adamNaturalGradient(
      gradients,
      fisherMatrix,
      this.m,
      this.v,
      this.step,
      this.config.beta1,
      this.config.beta2,
      this.config.epsilon,
      this.config.regularization
    )

    this.m = m
    this.v = v

    return naturalGrad.mul(this.config.learningRate)
  }

  reset(): void {
    this.m = null
    this.v = null
    this.step = 0
  }
}

export function computeFubiniStudyMetric(
  tape: QuantumTape,
  executeOverlap: (t1: QuantumTape, t2: QuantumTape) => number,
  delta: number = 1e-4
): QTensor {
  const numParams = tape.numParameters
  const metric = QTensor.zeros([numParams, numParams])

  const createShiftedTape = (tape: QuantumTape, paramIdx: number, shift: number): QuantumTape => {
    const newTape = tape.copy()
    const ops = newTape.operations

    let currentIdx = 0
    for (const op of ops) {
      for (let i = 0; i < op.operation.params.length; i++) {
        if (currentIdx === paramIdx) {
          op.operation.params[i] += shift
        }
        currentIdx++
      }
    }

    return newTape
  }

  for (let i = 0; i < numParams; i++) {
    for (let j = i; j < numParams; j++) {
      const tapePlusI = createShiftedTape(tape, i, delta)
      const tapeMinusI = createShiftedTape(tape, i, -delta)
      const tapePlusJ = createShiftedTape(tape, j, delta)
      const tapeMinusJ = createShiftedTape(tape, j, -delta)
      const tapePlusIJ = createShiftedTape(createShiftedTape(tape, i, delta), j, delta)
      const tapeMinusIJ = createShiftedTape(createShiftedTape(tape, i, -delta), j, -delta)
      const tapePlusMinus = createShiftedTape(createShiftedTape(tape, i, delta), j, -delta)
      const tapeMinusPlus = createShiftedTape(createShiftedTape(tape, i, -delta), j, delta)

      const overlap = executeOverlap(tape, tape)
      const overlapPP = executeOverlap(tapePlusI, tapePlusJ)
      const overlapMM = executeOverlap(tapeMinusI, tapeMinusJ)
      const overlapPM = executeOverlap(tapePlusI, tapeMinusJ)
      const overlapMP = executeOverlap(tapeMinusI, tapePlusJ)

      const d2Overlap = (overlapPP + overlapMM - overlapPM - overlapMP) / (4 * delta * delta)

      const overlapP_i = executeOverlap(tapePlusI, tape)
      const overlapM_i = executeOverlap(tapeMinusI, tape)
      const overlapP_j = executeOverlap(tapePlusJ, tape)
      const overlapM_j = executeOverlap(tapeMinusJ, tape)

      const dOverlap_i = (overlapP_i - overlapM_i) / (2 * delta)
      const dOverlap_j = (overlapP_j - overlapM_j) / (2 * delta)

      const metricElement = -d2Overlap + dOverlap_i * dOverlap_j

      metric.data[i * numParams + j] = metricElement
      metric.data[j * numParams + i] = metricElement
    }
  }

  return metric
}
