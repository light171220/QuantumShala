import type { Optimizer, CostFunction, GradientFunction, OptimizationResult } from '../../types'

export interface QNGConfig {
  maxIterations: number
  tolerance: number
  learningRate?: number
  regularization?: number
  metricTensorFn?: (params: number[]) => number[][]
}

export class QNGOptimizer implements Optimizer {
  name = 'qng'
  private config: Required<Omit<QNGConfig, 'metricTensorFn'>> & { metricTensorFn?: QNGConfig['metricTensorFn'] }

  constructor(config: QNGConfig) {
    this.config = {
      maxIterations: config.maxIterations,
      tolerance: config.tolerance,
      learningRate: config.learningRate ?? 0.1,
      regularization: config.regularization ?? 0.01,
      metricTensorFn: config.metricTensorFn,
    }
  }

  optimize(
    initialParams: number[],
    costFn: CostFunction,
    gradientFn?: GradientFunction,
    callback?: (iteration: number, value: number, params: number[]) => void
  ): OptimizationResult {
    const n = initialParams.length
    const { maxIterations, tolerance, learningRate, regularization, metricTensorFn } = this.config

    if (!gradientFn) {
      gradientFn = (params: number[]) => this.numericalGradient(costFn, params)
    }

    let params = [...initialParams]
    let value = costFn(params)

    const history: { iteration: number; value: number; params?: number[] }[] = []
    history.push({ iteration: 0, value, params: [...params] })
    callback?.(0, value, params)

    let converged = false

    for (let k = 1; k <= maxIterations; k++) {
      const gradient = gradientFn(params)

      let metricTensor: number[][]
      if (metricTensorFn) {
        metricTensor = metricTensorFn(params)
      } else {
        metricTensor = this.estimateMetricTensor(costFn, params)
      }

      for (let i = 0; i < n; i++) {
        metricTensor[i][i] += regularization
      }

      const metricInverse = this.invertMatrix(metricTensor)
      const naturalGradient = this.matrixVectorMultiply(metricInverse, gradient)

      const prevParams = [...params]
      params = params.map((p, i) => p - learningRate * naturalGradient[i])

      const prevValue = value
      value = costFn(params)

      const valueChange = Math.abs(value - prevValue)
      const gradNorm = Math.sqrt(gradient.reduce((s, g) => s + g * g, 0))

      if (valueChange < tolerance && gradNorm < tolerance) {
        converged = true
      }

      history.push({ iteration: k, value })
      callback?.(k, value, params)

      if (converged) break
    }

    return {
      parameters: params,
      value,
      iterations: history.length - 1,
      converged,
      history,
    }
  }

  private estimateMetricTensor(costFn: CostFunction, params: number[], epsilon: number = 0.01): number[][] {
    const n = params.length
    const metric: number[][] = []

    for (let i = 0; i < n; i++) {
      metric[i] = []
      for (let j = 0; j < n; j++) {
        if (i === j) {
          const paramsPlus = [...params]
          paramsPlus[i] += epsilon
          const paramsMinus = [...params]
          paramsMinus[i] -= epsilon

          const fPlus = costFn(paramsPlus)
          const fMinus = costFn(paramsMinus)
          const f0 = costFn(params)

          metric[i][j] = (fPlus - 2 * f0 + fMinus) / (epsilon * epsilon)
          metric[i][j] = Math.max(Math.abs(metric[i][j]), 0.01)
        } else if (j > i) {
          const paramsPP = [...params]
          paramsPP[i] += epsilon
          paramsPP[j] += epsilon

          const paramsPM = [...params]
          paramsPM[i] += epsilon
          paramsPM[j] -= epsilon

          const paramsMP = [...params]
          paramsMP[i] -= epsilon
          paramsMP[j] += epsilon

          const paramsMM = [...params]
          paramsMM[i] -= epsilon
          paramsMM[j] -= epsilon

          const fPP = costFn(paramsPP)
          const fPM = costFn(paramsPM)
          const fMP = costFn(paramsMP)
          const fMM = costFn(paramsMM)

          metric[i][j] = (fPP - fPM - fMP + fMM) / (4 * epsilon * epsilon)
        } else {
          metric[i][j] = metric[j][i]
        }
      }
    }

    return metric
  }

  private numericalGradient(costFn: CostFunction, params: number[], epsilon: number = 1e-7): number[] {
    const gradient: number[] = []
    for (let i = 0; i < params.length; i++) {
      const paramsPlus = [...params]
      paramsPlus[i] += epsilon
      const paramsMinus = [...params]
      paramsMinus[i] -= epsilon
      gradient.push((costFn(paramsPlus) - costFn(paramsMinus)) / (2 * epsilon))
    }
    return gradient
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
