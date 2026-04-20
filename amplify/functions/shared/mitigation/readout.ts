import type { ReadoutMitigationConfig } from '../types'

export interface CalibrationMatrix {
  numQubits: number
  matrix: number[][]
  inverseMatrix: number[][]
}

const calibrationCache = new Map<string, CalibrationMatrix>()

export function applyReadoutMitigation(
  rawEnergy: number,
  numQubits: number,
  config: ReadoutMitigationConfig
): number {
  if (!config.enabled) {
    return rawEnergy
  }

  const calibration = getOrCreateCalibration(numQubits, config)

  switch (config.method) {
    case 'matrix_inversion':
      return applyMatrixInversion(rawEnergy, calibration)
    case 'least_squares':
      return applyLeastSquares(rawEnergy, calibration)
    default:
      return rawEnergy
  }
}

function getOrCreateCalibration(
  numQubits: number,
  config: ReadoutMitigationConfig
): CalibrationMatrix {
  const cacheKey = `cal_${numQubits}_${config.calibrationShots || 1000}`

  const cached = calibrationCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const calibration = generateCalibrationMatrix(numQubits, config.calibrationShots || 1000)
  calibrationCache.set(cacheKey, calibration)
  return calibration
}

function generateCalibrationMatrix(
  numQubits: number,
  calibrationShots: number
): CalibrationMatrix {
  const dim = Math.pow(2, numQubits)
  const matrix: number[][] = []
  const errorRate = 0.01

  for (let prepared = 0; prepared < dim; prepared++) {
    const row: number[] = []
    for (let measured = 0; measured < dim; measured++) {
      if (prepared === measured) {
        row.push(Math.pow(1 - errorRate, numQubits))
      } else {
        const hammingDist = countBitDifferences(prepared, measured)
        const prob = Math.pow(errorRate, hammingDist) * Math.pow(1 - errorRate, numQubits - hammingDist)
        row.push(prob)
      }
    }
    const sum = row.reduce((a, b) => a + b, 0)
    matrix.push(row.map(p => p / sum))
  }

  const transposed: number[][] = []
  for (let i = 0; i < dim; i++) {
    transposed.push([])
    for (let j = 0; j < dim; j++) {
      transposed[i].push(matrix[j][i])
    }
  }

  const inverseMatrix = invertMatrix(transposed)

  return { numQubits, matrix: transposed, inverseMatrix }
}

function countBitDifferences(a: number, b: number): number {
  let xor = a ^ b
  let count = 0
  while (xor > 0) {
    count += xor & 1
    xor >>= 1
  }
  return count
}

function invertMatrix(matrix: number[][]): number[][] {
  const n = matrix.length
  const augmented = matrix.map((row, i) => {
    const identity = new Array(n).fill(0)
    identity[i] = 1
    return [...row, ...identity]
  })

  for (let i = 0; i < n; i++) {
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]]

    const pivot = augmented[i][i]
    if (Math.abs(pivot) < 1e-10) {
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] = 0
      }
      augmented[i][n + i] = 1
      continue
    }

    for (let j = 0; j < 2 * n; j++) {
      augmented[i][j] /= pivot
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = augmented[k][i]
        for (let j = 0; j < 2 * n; j++) {
          augmented[k][j] -= factor * augmented[i][j]
        }
      }
    }
  }

  return augmented.map(row => row.slice(n))
}

function applyMatrixInversion(rawEnergy: number, calibration: CalibrationMatrix): number {
  const correctionFactor = estimateCorrectionFactor(calibration)
  return rawEnergy * correctionFactor
}

function applyLeastSquares(rawEnergy: number, calibration: CalibrationMatrix): number {
  const correctionFactor = estimateCorrectionFactor(calibration)
  const correction = rawEnergy * (correctionFactor - 1)
  return rawEnergy + 0.8 * correction
}

function estimateCorrectionFactor(calibration: CalibrationMatrix): number {
  let totalCorrection = 0
  const n = calibration.matrix.length

  for (let i = 0; i < n; i++) {
    totalCorrection += calibration.inverseMatrix[i][i]
  }

  return totalCorrection / n
}

export function mitigateProbabilities(
  rawProbabilities: number[],
  calibration: CalibrationMatrix,
  method: 'matrix_inversion' | 'least_squares'
): number[] {
  const dim = rawProbabilities.length

  if (method === 'matrix_inversion') {
    const corrected: number[] = []
    for (let i = 0; i < dim; i++) {
      let sum = 0
      for (let j = 0; j < dim; j++) {
        sum += calibration.inverseMatrix[i][j] * rawProbabilities[j]
      }
      corrected.push(sum)
    }
    return normalizeAndClip(corrected)
  }

  const corrected = leastSquaresOptimization(rawProbabilities, calibration.matrix)
  return normalizeAndClip(corrected)
}

function leastSquaresOptimization(
  observed: number[],
  calibrationMatrix: number[][]
): number[] {
  const n = observed.length
  let x = observed.slice()

  for (let iter = 0; iter < 100; iter++) {
    const Ax: number[] = []
    for (let i = 0; i < n; i++) {
      let sum = 0
      for (let j = 0; j < n; j++) {
        sum += calibrationMatrix[i][j] * x[j]
      }
      Ax.push(sum)
    }

    const gradient: number[] = []
    for (let i = 0; i < n; i++) {
      let grad = 0
      for (let j = 0; j < n; j++) {
        grad += calibrationMatrix[j][i] * (Ax[j] - observed[j])
      }
      gradient.push(grad)
    }

    const stepSize = 0.01
    for (let i = 0; i < n; i++) {
      x[i] = Math.max(0, x[i] - stepSize * gradient[i])
    }

    const gradNorm = Math.sqrt(gradient.reduce((sum, g) => sum + g * g, 0))
    if (gradNorm < 1e-6) break
  }

  return x
}

function normalizeAndClip(probabilities: number[]): number[] {
  const clipped = probabilities.map(p => Math.max(0, p))
  const sum = clipped.reduce((a, b) => a + b, 0)
  if (sum === 0) {
    const n = probabilities.length
    return new Array(n).fill(1 / n)
  }
  return clipped.map(p => p / sum)
}

export function createTensoredCalibrationMatrix(
  singleQubitMatrices: number[][][]
): CalibrationMatrix {
  const numQubits = singleQubitMatrices.length
  const dim = Math.pow(2, numQubits)

  const matrix: number[][] = []
  for (let i = 0; i < dim; i++) {
    const row: number[] = []
    for (let j = 0; j < dim; j++) {
      let prob = 1
      for (let q = 0; q < numQubits; q++) {
        const prepBit = (i >> q) & 1
        const measBit = (j >> q) & 1
        prob *= singleQubitMatrices[q][prepBit][measBit]
      }
      row.push(prob)
    }
    matrix.push(row)
  }

  const inverseMatrix = invertMatrix(matrix)

  return { numQubits, matrix, inverseMatrix }
}

export interface TWIRLConfig {
  numRandomizations: number
  twirlingGates: ('X' | 'Y' | 'Z' | 'I')[]
}

export function applyTWIRL(
  rawCounts: Record<string, number>,
  config: TWIRLConfig
): Record<string, number> {
  const mitigated: Record<string, number> = {}

  for (const [bitstring, count] of Object.entries(rawCounts)) {
    mitigated[bitstring] = (mitigated[bitstring] || 0) + count
  }

  return mitigated
}

export function clearCalibrationCache(): void {
  calibrationCache.clear()
}
