export interface NormalizationParams {
  mean: number[]
  std: number[]
  min: number[]
  max: number[]
}

export function normalizeData(
  X: number[][],
  method: 'standard' | 'minmax' | 'none' = 'standard',
  params?: NormalizationParams
): { X: number[][]; params: NormalizationParams } {
  if (X.length === 0) {
    return { X: [], params: { mean: [], std: [], min: [], max: [] } }
  }

  const numFeatures = X[0].length
  const computedParams: NormalizationParams = params ?? {
    mean: new Array(numFeatures).fill(0),
    std: new Array(numFeatures).fill(1),
    min: new Array(numFeatures).fill(0),
    max: new Array(numFeatures).fill(1),
  }

  if (!params) {
    for (let f = 0; f < numFeatures; f++) {
      const values = X.map(row => row[f])
      computedParams.mean[f] = values.reduce((a, b) => a + b, 0) / values.length
      computedParams.std[f] = Math.sqrt(
        values.reduce((sum, v) => sum + Math.pow(v - computedParams.mean[f], 2), 0) / values.length
      )
      if (computedParams.std[f] < 1e-10) computedParams.std[f] = 1
      computedParams.min[f] = Math.min(...values)
      computedParams.max[f] = Math.max(...values)
      if (Math.abs(computedParams.max[f] - computedParams.min[f]) < 1e-10) {
        computedParams.max[f] = computedParams.min[f] + 1
      }
    }
  }

  const normalizedX: number[][] = []

  for (const row of X) {
    const normalizedRow: number[] = []
    for (let f = 0; f < numFeatures; f++) {
      let value: number
      switch (method) {
        case 'standard':
          value = (row[f] - computedParams.mean[f]) / computedParams.std[f]
          break
        case 'minmax':
          value = (row[f] - computedParams.min[f]) / (computedParams.max[f] - computedParams.min[f])
          break
        case 'none':
        default:
          value = row[f]
      }
      normalizedRow.push(value)
    }
    normalizedX.push(normalizedRow)
  }

  return { X: normalizedX, params: computedParams }
}

export function splitData(
  X: number[][],
  y: number[],
  trainRatio: number = 0.8,
  shuffle: boolean = true,
  seed?: number
): {
  XTrain: number[][]
  yTrain: number[]
  XTest: number[][]
  yTest: number[]
} {
  const indices = Array.from({ length: X.length }, (_, i) => i)

  if (shuffle) {
    const rng = seed !== undefined ? seededRandom(seed) : Math.random
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
  }

  const splitIndex = Math.floor(X.length * trainRatio)

  const XTrain: number[][] = []
  const yTrain: number[] = []
  const XTest: number[][] = []
  const yTest: number[] = []

  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i]
    if (i < splitIndex) {
      XTrain.push(X[idx])
      yTrain.push(y[idx])
    } else {
      XTest.push(X[idx])
      yTest.push(y[idx])
    }
  }

  return { XTrain, yTrain, XTest, yTest }
}

export function batchData(
  X: number[][],
  y: number[],
  batchSize: number,
  shuffle: boolean = true,
  seed?: number
): { X: number[][]; y: number[] }[] {
  const indices = Array.from({ length: X.length }, (_, i) => i)

  if (shuffle) {
    const rng = seed !== undefined ? seededRandom(seed) : Math.random
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
  }

  const batches: { X: number[][]; y: number[] }[] = []

  for (let i = 0; i < indices.length; i += batchSize) {
    const batchIndices = indices.slice(i, Math.min(i + batchSize, indices.length))
    batches.push({
      X: batchIndices.map(idx => X[idx]),
      y: batchIndices.map(idx => y[idx]),
    })
  }

  return batches
}

export function preprocessForQML(
  X: number[][],
  y: number[],
  options: {
    normalization?: 'standard' | 'minmax' | 'none'
    trainRatio?: number
    batchSize?: number
    shuffle?: boolean
    seed?: number
    scaleToRange?: [number, number]
  } = {}
): {
  XTrain: number[][]
  yTrain: number[]
  XTest: number[][]
  yTest: number[]
  normParams: NormalizationParams
} {
  const {
    normalization = 'minmax',
    trainRatio = 0.8,
    shuffle = true,
    seed,
    scaleToRange,
  } = options

  let { X: normalizedX, params: normParams } = normalizeData(X, normalization)

  if (scaleToRange) {
    const [minVal, maxVal] = scaleToRange
    normalizedX = normalizedX.map(row =>
      row.map(v => minVal + v * (maxVal - minVal))
    )
  }

  const { XTrain, yTrain, XTest, yTest } = splitData(normalizedX, y, trainRatio, shuffle, seed)

  return { XTrain, yTrain, XTest, yTest, normParams }
}

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}
