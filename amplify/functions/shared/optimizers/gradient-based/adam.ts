import type { Optimizer, CostFunction, GradientFunction, OptimizationResult } from '../../types'

export interface AdamConfig {
  maxIterations: number
  tolerance: number
  learningRate?: number
  beta1?: number
  beta2?: number
  epsilon?: number
}

export class AdamOptimizer implements Optimizer {
  name = 'adam'
  private config: Required<AdamConfig>

  constructor(config: AdamConfig) {
    this.config = {
      maxIterations: config.maxIterations,
      tolerance: config.tolerance,
      learningRate: config.learningRate ?? 0.01,
      beta1: config.beta1 ?? 0.9,
      beta2: config.beta2 ?? 0.999,
      epsilon: config.epsilon ?? 1e-8,
    }
  }

  optimize(
    initialParams: number[],
    costFn: CostFunction,
    gradientFn?: GradientFunction,
    callback?: (iteration: number, value: number, params: number[]) => void
  ): OptimizationResult {
    const n = initialParams.length
    const { maxIterations, tolerance, learningRate, beta1, beta2, epsilon } = this.config

    if (!gradientFn) {
      gradientFn = (params: number[]) => this.numericalGradient(costFn, params)
    }

    let params = [...initialParams]
    let value = costFn(params)

    const m = new Array(n).fill(0)
    const v = new Array(n).fill(0)

    const history: { iteration: number; value: number; params?: number[] }[] = []
    history.push({ iteration: 0, value, params: [...params] })
    callback?.(0, value, params)

    let converged = false

    for (let t = 1; t <= maxIterations; t++) {
      const gradient = gradientFn(params)

      for (let i = 0; i < n; i++) {
        m[i] = beta1 * m[i] + (1 - beta1) * gradient[i]
        v[i] = beta2 * v[i] + (1 - beta2) * gradient[i] * gradient[i]
      }

      const mHat = m.map(mi => mi / (1 - Math.pow(beta1, t)))
      const vHat = v.map(vi => vi / (1 - Math.pow(beta2, t)))

      const prevParams = [...params]
      for (let i = 0; i < n; i++) {
        params[i] -= learningRate * mHat[i] / (Math.sqrt(vHat[i]) + epsilon)
      }

      const prevValue = value
      value = costFn(params)

      const paramChange = Math.sqrt(
        params.reduce((s, p, i) => s + (p - prevParams[i]) ** 2, 0)
      )
      const valueChange = Math.abs(value - prevValue)
      const gradNorm = Math.sqrt(gradient.reduce((s, g) => s + g * g, 0))

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
