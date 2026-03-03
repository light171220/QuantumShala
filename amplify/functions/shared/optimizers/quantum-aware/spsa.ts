import type { Optimizer, CostFunction, OptimizationResult } from '../../types'

export interface SPSAConfig {
  maxIterations: number
  tolerance: number
  a?: number
  c?: number
  A?: number
  alpha?: number
  gamma?: number
}

export class SPSAOptimizer implements Optimizer {
  name = 'spsa'
  private config: Required<SPSAConfig>

  constructor(config: SPSAConfig) {
    this.config = {
      maxIterations: config.maxIterations,
      tolerance: config.tolerance,
      a: config.a ?? 0.1,
      c: config.c ?? 0.1,
      A: config.A ?? Math.floor(config.maxIterations * 0.1),
      alpha: config.alpha ?? 0.602,
      gamma: config.gamma ?? 0.101,
    }
  }

  optimize(
    initialParams: number[],
    costFn: CostFunction,
    _gradientFn?: undefined,
    callback?: (iteration: number, value: number, params: number[]) => void
  ): OptimizationResult {
    const n = initialParams.length
    const { maxIterations, tolerance, a, c, A, alpha, gamma } = this.config

    let params = [...initialParams]
    let value = costFn(params)
    let bestValue = value
    let bestParams = [...params]

    const history: { iteration: number; value: number; params?: number[] }[] = []
    history.push({ iteration: 0, value, params: [...params] })
    callback?.(0, value, params)

    let converged = false

    for (let k = 1; k <= maxIterations; k++) {
      const ak = a / Math.pow(k + A, alpha)
      const ck = c / Math.pow(k, gamma)

      const delta = params.map(() => Math.random() < 0.5 ? -1 : 1)

      const paramsPlus = params.map((p, i) => p + ck * delta[i])
      const paramsMinus = params.map((p, i) => p - ck * delta[i])

      const fPlus = costFn(paramsPlus)
      const fMinus = costFn(paramsMinus)

      const gradient = delta.map(d => (fPlus - fMinus) / (2 * ck * d))

      const prevParams = [...params]
      params = params.map((p, i) => p - ak * gradient[i])

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
}

export class SPSAWithAveraging extends SPSAOptimizer {
  name = 'spsa_averaging'
  private numAverages: number

  constructor(config: SPSAConfig & { numAverages?: number }) {
    super(config)
    this.numAverages = config.numAverages ?? 1
  }

  optimize(
    initialParams: number[],
    costFn: CostFunction,
    _gradientFn?: undefined,
    callback?: (iteration: number, value: number, params: number[]) => void
  ): OptimizationResult {
    const averagedCostFn = (params: number[]): number => {
      let sum = 0
      for (let i = 0; i < this.numAverages; i++) {
        sum += costFn(params)
      }
      return sum / this.numAverages
    }

    return super.optimize(initialParams, averagedCostFn, undefined, callback)
  }
}
