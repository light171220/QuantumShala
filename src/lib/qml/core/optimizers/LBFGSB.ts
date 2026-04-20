import { Optimizer, type OptimizerConfig } from '../Optimizer'

export interface LBFGSBConfig extends Partial<OptimizerConfig> {
  memorySize?: number
  lowerBounds?: number[]
  upperBounds?: number[]
  ftol?: number
  gtol?: number
  maxls?: number
}

interface HistoryEntry {
  s: number[]
  y: number[]
  rho: number
}

export class LBFGSBOptimizer extends Optimizer {
  private memorySize: number
  private history: HistoryEntry[] = []
  private prevParams: number[] | null = null
  private prevGradient: number[] | null = null
  private lowerBounds: number[] | null
  private upperBounds: number[] | null
  private ftol: number
  private gtol: number
  private maxls: number

  constructor(config: LBFGSBConfig = {}) {
    super({
      type: 'lbfgsb',
      learningRate: config.learningRate ?? 1.0,
      maxIterations: config.maxIterations ?? 100,
      tolerance: config.tolerance ?? 1e-5,
      ...config
    })
    this.memorySize = config.memorySize ?? 10
    this.lowerBounds = config.lowerBounds ?? null
    this.upperBounds = config.upperBounds ?? null
    this.ftol = config.ftol ?? 1e-5
    this.gtol = config.gtol ?? 1e-5
    this.maxls = config.maxls ?? 20
  }

  step(parameters: number[], costFunction: (params: number[]) => number): number[] {
    const n = parameters.length
    this.state.step++

    const gradient = this.computeGradient(parameters, costFunction)

    if (this.prevParams !== null && this.prevGradient !== null) {
      this.updateHistory(parameters, gradient)
    }

    const direction = this.computeDirection(gradient)

    const projectedDirection = this.projectDirection(parameters, direction)

    const alpha = this.lineSearchWithBounds(parameters, projectedDirection, costFunction)

    let newParams = parameters.map((p, i) => p + alpha * projectedDirection[i])

    newParams = this.projectToBounds(newParams)

    this.prevParams = [...parameters]
    this.prevGradient = [...gradient]

    return newParams
  }

  private computeGradient(params: number[], costFunction: (p: number[]) => number): number[] {
    const gradient: number[] = []
    const eps = 1e-8
    const f0 = costFunction(params)

    for (let i = 0; i < params.length; i++) {
      const h = eps * Math.max(1.0, Math.abs(params[i]))
      const paramsPlus = [...params]
      const paramsMinus = [...params]
      paramsPlus[i] += h
      paramsMinus[i] -= h

      const fPlus = costFunction(paramsPlus)
      const fMinus = costFunction(paramsMinus)
      gradient.push((fPlus - fMinus) / (2 * h))
    }

    return gradient
  }

  private updateHistory(newParams: number[], newGradient: number[]): void {
    if (!this.prevParams || !this.prevGradient) return

    const s = newParams.map((p, i) => p - this.prevParams![i])
    const y = newGradient.map((g, i) => g - this.prevGradient![i])

    const sy = s.reduce((sum, si, i) => sum + si * y[i], 0)

    if (sy > 1e-10) {
      const rho = 1.0 / sy
      this.history.push({ s, y, rho })

      if (this.history.length > this.memorySize) {
        this.history.shift()
      }
    }
  }

  private computeDirection(gradient: number[]): number[] {
    const n = gradient.length

    if (this.history.length === 0) {
      return gradient.map(g => -g)
    }

    let q = [...gradient]
    const alphas: number[] = []

    for (let i = this.history.length - 1; i >= 0; i--) {
      const { s, rho } = this.history[i]
      const alpha = rho * s.reduce((sum, si, j) => sum + si * q[j], 0)
      alphas.unshift(alpha)
      q = q.map((qi, j) => qi - alpha * this.history[i].y[j])
    }

    const lastEntry = this.history[this.history.length - 1]
    const yy = lastEntry.y.reduce((sum, yi) => sum + yi * yi, 0)
    const sy = lastEntry.s.reduce((sum, si, i) => sum + si * lastEntry.y[i], 0)
    const gamma = sy / yy

    let r = q.map(qi => qi * gamma)

    for (let i = 0; i < this.history.length; i++) {
      const { s, y, rho } = this.history[i]
      const beta = rho * y.reduce((sum, yi, j) => sum + yi * r[j], 0)
      r = r.map((ri, j) => ri + s[j] * (alphas[i] - beta))
    }

    return r.map(ri => -ri)
  }

  private projectDirection(params: number[], direction: number[]): number[] {
    if (!this.lowerBounds && !this.upperBounds) {
      return direction
    }

    const projected = [...direction]

    for (let i = 0; i < params.length; i++) {
      if (this.lowerBounds && params[i] <= this.lowerBounds[i] && direction[i] < 0) {
        projected[i] = 0
      }
      if (this.upperBounds && params[i] >= this.upperBounds[i] && direction[i] > 0) {
        projected[i] = 0
      }
    }

    return projected
  }

  private projectToBounds(params: number[]): number[] {
    if (!this.lowerBounds && !this.upperBounds) {
      return params
    }

    return params.map((p, i) => {
      let bounded = p
      if (this.lowerBounds) {
        bounded = Math.max(bounded, this.lowerBounds[i])
      }
      if (this.upperBounds) {
        bounded = Math.min(bounded, this.upperBounds[i])
      }
      return bounded
    })
  }

  private lineSearchWithBounds(
    params: number[],
    direction: number[],
    costFunction: (p: number[]) => number
  ): number {
    const c1 = 1e-4
    let alpha = 1.0
    const f0 = costFunction(params)
    const g0 = this.computeGradient(params, costFunction)
    const dg0 = direction.reduce((sum, d, i) => sum + d * g0[i], 0)

    if (dg0 >= 0) {
      return 0
    }

    if (this.lowerBounds || this.upperBounds) {
      let maxAlpha = Infinity
      for (let i = 0; i < params.length; i++) {
        if (direction[i] > 0 && this.upperBounds) {
          const alphaMax = (this.upperBounds[i] - params[i]) / direction[i]
          maxAlpha = Math.min(maxAlpha, alphaMax)
        }
        if (direction[i] < 0 && this.lowerBounds) {
          const alphaMax = (this.lowerBounds[i] - params[i]) / direction[i]
          maxAlpha = Math.min(maxAlpha, alphaMax)
        }
      }
      alpha = Math.min(alpha, maxAlpha * 0.99)
    }

    for (let iter = 0; iter < this.maxls; iter++) {
      const newParams = this.projectToBounds(
        params.map((p, i) => p + alpha * direction[i])
      )
      const f1 = costFunction(newParams)

      if (f1 <= f0 + c1 * alpha * dg0) {
        return alpha
      }

      alpha *= 0.5
    }

    return alpha
  }

  reset(): void {
    super.reset()
    this.history = []
    this.prevParams = null
    this.prevGradient = null
  }

  setBounds(lower: number[] | null, upper: number[] | null): void {
    this.lowerBounds = lower
    this.upperBounds = upper
  }
}

export function createLBFGSBOptimizer(config: LBFGSBConfig = {}): LBFGSBOptimizer {
  return new LBFGSBOptimizer(config)
}
