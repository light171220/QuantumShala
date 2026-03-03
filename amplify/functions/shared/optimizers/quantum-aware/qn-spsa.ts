import type { Optimizer, CostFunction, OptimizationResult } from '../../types'

export interface QNSPSAConfig {
  maxIterations: number
  tolerance: number
  learningRate?: number
  perturbation?: number
  regularization?: number
  resamplingFrequency?: number
  hessianDelay?: number
}

export class QNSPSAOptimizer implements Optimizer {
  name = 'qn_spsa'
  private config: Required<QNSPSAConfig>

  constructor(config: QNSPSAConfig) {
    this.config = {
      maxIterations: config.maxIterations,
      tolerance: config.tolerance,
      learningRate: config.learningRate ?? 0.1,
      perturbation: config.perturbation ?? 0.1,
      regularization: config.regularization ?? 0.01,
      resamplingFrequency: config.resamplingFrequency ?? 1,
      hessianDelay: config.hessianDelay ?? 0,
    }
  }

  optimize(
    initialParams: number[],
    costFn: CostFunction,
    _gradientFn?: undefined,
    callback?: (iteration: number, value: number, params: number[]) => void
  ): OptimizationResult {
    const n = initialParams.length
    const {
      maxIterations,
      tolerance,
      learningRate,
      perturbation,
      regularization,
      resamplingFrequency,
      hessianDelay,
    } = this.config

    let params = [...initialParams]
    let value = costFn(params)
    let bestValue = value
    let bestParams = [...params]

    let hessianEstimate = this.identityMatrix(n)

    const history: { iteration: number; value: number; params?: number[] }[] = []
    history.push({ iteration: 0, value, params: [...params] })
    callback?.(0, value, params)

    let converged = false

    for (let k = 1; k <= maxIterations; k++) {
      const ck = perturbation / Math.pow(k, 0.101)

      const delta1 = params.map(() => Math.random() < 0.5 ? -1 : 1)
      const delta2 = params.map(() => Math.random() < 0.5 ? -1 : 1)

      const paramsPlus = params.map((p, i) => p + ck * delta1[i])
      const paramsMinus = params.map((p, i) => p - ck * delta1[i])

      const fPlus = costFn(paramsPlus)
      const fMinus = costFn(paramsMinus)

      const gradient = delta1.map(d => (fPlus - fMinus) / (2 * ck * d))

      if (k > hessianDelay && k % resamplingFrequency === 0) {
        const paramsPlusPlus = params.map((p, i) => p + ck * delta1[i] + ck * delta2[i])
        const paramsPlusMinus = params.map((p, i) => p + ck * delta1[i] - ck * delta2[i])
        const paramsMinusPlus = params.map((p, i) => p - ck * delta1[i] + ck * delta2[i])
        const paramsMinusMinus = params.map((p, i) => p - ck * delta1[i] - ck * delta2[i])

        const fPlusPlus = costFn(paramsPlusPlus)
        const fPlusMinus = costFn(paramsPlusMinus)
        const fMinusPlus = costFn(paramsMinusPlus)
        const fMinusMinus = costFn(paramsMinusMinus)

        const hessianUpdate: number[][] = []
        for (let i = 0; i < n; i++) {
          hessianUpdate[i] = []
          for (let j = 0; j < n; j++) {
            const deltaF = fPlusPlus - fPlusMinus - fMinusPlus + fMinusMinus
            hessianUpdate[i][j] = deltaF / (4 * ck * ck * delta1[i] * delta2[j])
          }
        }

        const beta = 1 / k
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            hessianEstimate[i][j] = (1 - beta) * hessianEstimate[i][j] + beta * hessianUpdate[i][j]
          }
        }

        for (let i = 0; i < n; i++) {
          hessianEstimate[i][i] += regularization
        }
      }

      const hessianInverse = this.invertMatrix(hessianEstimate)

      const naturalGradient = this.matrixVectorMultiply(hessianInverse, gradient)

      const ak = learningRate / Math.pow(k, 0.602)

      const prevParams = [...params]
      params = params.map((p, i) => p - ak * naturalGradient[i])

      const prevValue = value
      value = costFn(params)

      if (value < bestValue) {
        bestValue = value
        bestParams = [...params]
      }

      const valueChange = Math.abs(value - prevValue)
      const paramChange = Math.sqrt(
        params.reduce((s, p, i) => s + (p - prevParams[i]) ** 2, 0)
      )

      if (valueChange < tolerance && paramChange < tolerance) {
        converged = true
      }

      history.push({ iteration: k, value })
      callback?.(k, value, params)

      if (converged) break
    }

    return {
      parameters: bestParams,
      value: bestValue,
      iterations: history.length - 1,
      converged,
      history,
    }
  }

  private identityMatrix(n: number): number[][] {
    const I: number[][] = []
    for (let i = 0; i < n; i++) {
      I[i] = new Array(n).fill(0)
      I[i][i] = 1
    }
    return I
  }

  private matrixVectorMultiply(A: number[][], v: number[]): number[] {
    return A.map(row => row.reduce((s, a, i) => s + a * v[i], 0))
  }

  private invertMatrix(A: number[][]): number[][] {
    const n = A.length
    const augmented: number[][] = []

    for (let i = 0; i < n; i++) {
      augmented[i] = [...A[i]]
      for (let j = 0; j < n; j++) {
        augmented[i].push(i === j ? 1 : 0)
      }
    }

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
        augmented[i][i] = 1e-10
      }

      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot || 1e-10
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

    const inverse: number[][] = []
    for (let i = 0; i < n; i++) {
      inverse[i] = augmented[i].slice(n)
    }

    return inverse
  }
}
