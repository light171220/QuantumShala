import type { Optimizer, CostFunction, OptimizationResult } from '../../types'

export interface RotosolveConfig {
  maxIterations: number
  tolerance: number
  sweepOrder?: 'sequential' | 'random'
}

export class RotosolveOptimizer implements Optimizer {
  name = 'rotosolve'
  private config: Required<RotosolveConfig>

  constructor(config: RotosolveConfig) {
    this.config = {
      maxIterations: config.maxIterations,
      tolerance: config.tolerance,
      sweepOrder: config.sweepOrder ?? 'sequential',
    }
  }

  optimize(
    initialParams: number[],
    costFn: CostFunction,
    _gradientFn?: undefined,
    callback?: (iteration: number, value: number, params: number[]) => void
  ): OptimizationResult {
    const n = initialParams.length
    const { maxIterations, tolerance, sweepOrder } = this.config

    let params = [...initialParams]
    let value = costFn(params)

    const history: { iteration: number; value: number; params?: number[] }[] = []
    history.push({ iteration: 0, value, params: [...params] })
    callback?.(0, value, params)

    let converged = false

    for (let iter = 1; iter <= maxIterations; iter++) {
      const prevValue = value
      const prevParams = [...params]

      let indices: number[]
      if (sweepOrder === 'random') {
        indices = this.shuffleArray([...Array(n).keys()])
      } else {
        indices = [...Array(n).keys()]
      }

      for (const i of indices) {
        const optimalTheta = this.solveForParameter(costFn, params, i)
        params[i] = optimalTheta
      }

      value = costFn(params)

      const valueChange = Math.abs(value - prevValue)
      const paramChange = Math.sqrt(
        params.reduce((s, p, i) => s + (p - prevParams[i]) ** 2, 0)
      )

      if (valueChange < tolerance && paramChange < tolerance) {
        converged = true
      }

      history.push({ iteration: iter, value })
      callback?.(iter, value, params)

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

  private solveForParameter(
    costFn: CostFunction,
    params: number[],
    paramIndex: number
  ): number {
    const evalAtTheta = (theta: number): number => {
      const newParams = [...params]
      newParams[paramIndex] = theta
      return costFn(newParams)
    }

    const theta0 = params[paramIndex]
    const M0 = evalAtTheta(theta0)
    const Mp = evalAtTheta(theta0 + Math.PI / 2)
    const Mn = evalAtTheta(theta0 - Math.PI / 2)

    const A = (Mp + Mn) / 2
    const B = (Mp - Mn) / 2
    const C = M0 - A

    const phi = Math.atan2(B, C)

    const thetaOpt = theta0 - phi - Math.PI / 2

    const normalizedTheta = ((thetaOpt % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    return normalizedTheta > Math.PI ? normalizedTheta - 2 * Math.PI : normalizedTheta
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}

export class RotosolveWithFrequencies extends RotosolveOptimizer {
  name = 'rotosolve_freq'
  private frequencies: number[]

  constructor(config: RotosolveConfig & { frequencies?: number[] }) {
    super(config)
    this.frequencies = config.frequencies ?? []
  }

  optimize(
    initialParams: number[],
    costFn: CostFunction,
    _gradientFn?: undefined,
    callback?: (iteration: number, value: number, params: number[]) => void
  ): OptimizationResult {
    const n = initialParams.length
    const { maxIterations, tolerance, sweepOrder } = (this as any).config

    if (this.frequencies.length === 0) {
      this.frequencies = new Array(n).fill(1)
    }

    let params = [...initialParams]
    let value = costFn(params)

    const history: { iteration: number; value: number; params?: number[] }[] = []
    history.push({ iteration: 0, value, params: [...params] })
    callback?.(0, value, params)

    let converged = false

    for (let iter = 1; iter <= maxIterations; iter++) {
      const prevValue = value
      const prevParams = [...params]

      let indices: number[]
      if (sweepOrder === 'random') {
        indices = this.shuffleArrayLocal([...Array(n).keys()])
      } else {
        indices = [...Array(n).keys()]
      }

      for (const i of indices) {
        const freq = this.frequencies[i] || 1
        const optimalTheta = this.solveForParameterWithFrequency(costFn, params, i, freq)
        params[i] = optimalTheta
      }

      value = costFn(params)

      const valueChange = Math.abs(value - prevValue)
      const paramChange = Math.sqrt(
        params.reduce((s, p, i) => s + (p - prevParams[i]) ** 2, 0)
      )

      if (valueChange < tolerance && paramChange < tolerance) {
        converged = true
      }

      history.push({ iteration: iter, value })
      callback?.(iter, value, params)

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

  private solveForParameterWithFrequency(
    costFn: CostFunction,
    params: number[],
    paramIndex: number,
    frequency: number
  ): number {
    const evalAtTheta = (theta: number): number => {
      const newParams = [...params]
      newParams[paramIndex] = theta
      return costFn(newParams)
    }

    const theta0 = params[paramIndex]
    const shift = Math.PI / (2 * frequency)

    const M0 = evalAtTheta(theta0)
    const Mp = evalAtTheta(theta0 + shift)
    const Mn = evalAtTheta(theta0 - shift)

    const A = (Mp + Mn) / 2
    const B = (Mp - Mn) / 2
    const C = M0 - A

    const phi = Math.atan2(B, C)
    const thetaOpt = theta0 - phi / frequency - shift

    const period = 2 * Math.PI / frequency
    const normalizedTheta = ((thetaOpt % period) + period) % period
    return normalizedTheta > period / 2 ? normalizedTheta - period : normalizedTheta
  }

  private shuffleArrayLocal<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}
