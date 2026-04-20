import type { Optimizer, CostFunction, GradientFunction, OptimizationResult } from '../../types'

export interface SGDConfig {
  maxIterations: number
  tolerance: number
  learningRate?: number
  momentum?: number
  decay?: number
  nesterov?: boolean
}

export class SGDOptimizer implements Optimizer {
  name = 'sgd'
  private config: Required<SGDConfig>

  constructor(config: SGDConfig) {
    this.config = {
      maxIterations: config.maxIterations,
      tolerance: config.tolerance,
      learningRate: config.learningRate ?? 0.01,
      momentum: config.momentum ?? 0.9,
      decay: config.decay ?? 0,
      nesterov: config.nesterov ?? false,
    }
  }

  optimize(
    initialParams: number[],
    costFn: CostFunction,
    gradientFn?: GradientFunction,
    callback?: (iteration: number, value: number, params: number[]) => void
  ): OptimizationResult {
    const n = initialParams.length
    const { maxIterations, tolerance, learningRate, momentum, decay, nesterov } = this.config

    if (!gradientFn) {
      gradientFn = (params: number[]) => this.numericalGradient(costFn, params)
    }

    let params = [...initialParams]
    let value = costFn(params)
    const velocity = new Array(n).fill(0)

    const history: { iteration: number; value: number; params?: number[] }[] = []
    history.push({ iteration: 0, value, params: [...params] })
    callback?.(0, value, params)

    let converged = false

    for (let t = 1; t <= maxIterations; t++) {
      const lr = learningRate / (1 + decay * t)

      let evalParams = params
      if (nesterov) {
        evalParams = params.map((p, i) => p - momentum * velocity[i])
      }

      const gradient = gradientFn(evalParams)

      const prevParams = [...params]
      for (let i = 0; i < n; i++) {
        velocity[i] = momentum * velocity[i] + lr * gradient[i]
        params[i] -= velocity[i]
      }

      const prevValue = value
      value = costFn(params)

      const paramChange = Math.sqrt(
        params.reduce((s, p, i) => s + (p - prevParams[i]) ** 2, 0)
      )
      const valueChange = Math.abs(value - prevValue)

      if (valueChange < tolerance && paramChange < tolerance) {
        converged = true
      }

      history.push({ iteration: t, value })
      callback?.(t, value, params)

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
}
