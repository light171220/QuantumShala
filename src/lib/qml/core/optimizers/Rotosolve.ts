import { Optimizer, type OptimizerConfig } from '../Optimizer'

export interface RotosolveConfig extends Partial<OptimizerConfig> {
  parameterWise?: boolean
  frequency?: number
}

export class RotosolveOptimizer extends Optimizer {
  private parameterWise: boolean
  private frequency: number
  private parameterOrder: number[] = []

  constructor(config: RotosolveConfig = {}) {
    super({
      type: 'rotosolve',
      maxIterations: config.maxIterations ?? 100,
      tolerance: config.tolerance ?? 1e-8,
      ...config
    })
    this.parameterWise = config.parameterWise ?? true
    this.frequency = config.frequency ?? 1.0
  }

  step(parameters: number[], costFunction: (params: number[]) => number): number[] {
    const n = parameters.length
    this.state.step++

    if (this.parameterOrder.length !== n) {
      this.parameterOrder = Array.from({ length: n }, (_, i) => i)
    }

    if (this.state.step % 5 === 0) {
      this.shuffleOrder()
    }

    let newParams = [...parameters]

    for (const idx of this.parameterOrder) {
      newParams = this.optimizeParameter(newParams, idx, costFunction)
    }

    return newParams
  }

  private optimizeParameter(
    params: number[],
    paramIdx: number,
    costFunction: (p: number[]) => number
  ): number[] {
    const { optimalTheta, minCost } = this.rotosolveStep(params, paramIdx, costFunction)

    const newParams = [...params]
    newParams[paramIdx] = optimalTheta

    return newParams
  }

  private rotosolveStep(
    params: number[],
    paramIdx: number,
    costFunction: (p: number[]) => number
  ): { optimalTheta: number; minCost: number } {
    const theta0 = params[paramIdx]

    const params0 = [...params]
    params0[paramIdx] = 0
    const E0 = costFunction(params0)

    const paramsPlus = [...params]
    paramsPlus[paramIdx] = Math.PI / (2 * this.frequency)
    const EPlus = costFunction(paramsPlus)

    const paramsMinus = [...params]
    paramsMinus[paramIdx] = -Math.PI / (2 * this.frequency)
    const EMinus = costFunction(paramsMinus)

    const A = (EPlus + EMinus) / 2
    const B = (EPlus - EMinus) / 2
    const C = E0 - A

    const optimalTheta = Math.atan2(-B, C) / this.frequency

    const minCost = A - Math.sqrt(B * B + C * C)

    return { optimalTheta, minCost }
  }

  private shuffleOrder(): void {
    for (let i = this.parameterOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = this.parameterOrder[i]
      this.parameterOrder[i] = this.parameterOrder[j]
      this.parameterOrder[j] = temp
    }
  }

  reset(): void {
    super.reset()
    this.parameterOrder = []
  }
}

export class FresnelOptimizer extends Optimizer {
  private history: Map<number, { costs: number[]; params: number[] }> = new Map()

  constructor(config: Partial<OptimizerConfig> = {}) {
    super({
      type: 'rotosolve',
      maxIterations: config.maxIterations ?? 100,
      tolerance: config.tolerance ?? 1e-8,
      ...config
    })
  }

  step(parameters: number[], costFunction: (params: number[]) => number): number[] {
    const n = parameters.length
    this.state.step++

    let newParams = [...parameters]

    for (let idx = 0; idx < n; idx++) {
      newParams = this.fresnelStep(newParams, idx, costFunction)
    }

    return newParams
  }

  private fresnelStep(
    params: number[],
    paramIdx: number,
    costFunction: (p: number[]) => number
  ): number[] {
    const nPoints = 5

    const thetas = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI]
    const costs: number[] = []

    for (const theta of thetas) {
      const testParams = [...params]
      testParams[paramIdx] = theta
      costs.push(costFunction(testParams))
    }

    const { coeffs } = this.fitFourierSeries(thetas, costs)

    const { optimalTheta } = this.findMinimum(coeffs)

    const newParams = [...params]
    newParams[paramIdx] = optimalTheta

    return newParams
  }

  private fitFourierSeries(
    thetas: number[],
    costs: number[]
  ): { coeffs: { a0: number; a1: number; b1: number } } {
    const n = thetas.length

    let a0 = 0
    let a1 = 0
    let b1 = 0

    for (let i = 0; i < n; i++) {
      a0 += costs[i]
      a1 += costs[i] * Math.cos(thetas[i])
      b1 += costs[i] * Math.sin(thetas[i])
    }

    a0 /= n
    a1 = (2 * a1) / n
    b1 = (2 * b1) / n

    return { coeffs: { a0, a1, b1 } }
  }

  private findMinimum(coeffs: { a0: number; a1: number; b1: number }): { optimalTheta: number } {
    const { a1, b1 } = coeffs
    const optimalTheta = Math.atan2(-b1, -a1)

    return { optimalTheta: optimalTheta < 0 ? optimalTheta + 2 * Math.PI : optimalTheta }
  }

  reset(): void {
    super.reset()
    this.history.clear()
  }
}

export class QuantumNaturalGradient extends Optimizer {
  private epsilon: number

  constructor(config: Partial<OptimizerConfig> & { epsilon?: number } = {}) {
    super({
      type: 'qng',
      learningRate: config.learningRate ?? 0.01,
      maxIterations: config.maxIterations ?? 100,
      tolerance: config.tolerance ?? 1e-6,
      ...config
    })
    this.epsilon = config.epsilon ?? 1e-4
  }

  step(parameters: number[], costFunction: (params: number[]) => number): number[] {
    const n = parameters.length
    this.state.step++
    const lr = this.getCurrentLearningRate()

    const gradient = this.computeGradient(parameters, costFunction)

    const qfi = this.estimateQuantumFisherInformation(parameters, costFunction)

    const qfiRegularized = qfi.map((row, i) =>
      row.map((val, j) => val + (i === j ? this.epsilon : 0))
    )

    const naturalGradient = this.solveLinearSystem(qfiRegularized, gradient)

    const newParams = parameters.map((p, i) => p - lr * naturalGradient[i])

    return newParams
  }

  private computeGradient(params: number[], costFunction: (p: number[]) => number): number[] {
    const gradient: number[] = []
    const eps = 1e-7

    for (let i = 0; i < params.length; i++) {
      const paramsPlus = [...params]
      const paramsMinus = [...params]
      paramsPlus[i] += eps
      paramsMinus[i] -= eps

      const fPlus = costFunction(paramsPlus)
      const fMinus = costFunction(paramsMinus)
      gradient.push((fPlus - fMinus) / (2 * eps))
    }

    return gradient
  }

  private estimateQuantumFisherInformation(
    params: number[],
    costFunction: (p: number[]) => number
  ): number[][] {
    const n = params.length
    const qfi: number[][] = []
    const delta = Math.PI / 2

    for (let i = 0; i < n; i++) {
      qfi.push(new Array(n).fill(0))
    }

    for (let i = 0; i < n; i++) {
      qfi[i][i] = 0.25
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const params00 = [...params]
        const params01 = [...params]
        params01[j] += delta

        const params10 = [...params]
        params10[i] += delta

        const params11 = [...params]
        params11[i] += delta
        params11[j] += delta

        const f00 = costFunction(params00)
        const f01 = costFunction(params01)
        const f10 = costFunction(params10)
        const f11 = costFunction(params11)

        const crossDerivative = (f11 - f10 - f01 + f00) / (delta * delta)

        qfi[i][j] = 0.125 * Math.abs(crossDerivative)
        qfi[j][i] = qfi[i][j]
      }
    }

    return qfi
  }

  private solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = b.length
    const x = new Array(n).fill(0)
    let r = [...b]
    let p = [...r]
    let rsOld = r.reduce((sum, ri) => sum + ri * ri, 0)

    for (let iter = 0; iter < n * 2; iter++) {
      const Ap: number[] = new Array(n).fill(0)
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          Ap[i] += A[i][j] * p[j]
        }
      }

      const pAp = p.reduce((sum, pi, i) => sum + pi * Ap[i], 0)
      if (Math.abs(pAp) < 1e-12) break

      const alpha = rsOld / pAp

      for (let i = 0; i < n; i++) {
        x[i] += alpha * p[i]
        r[i] -= alpha * Ap[i]
      }

      const rsNew = r.reduce((sum, ri) => sum + ri * ri, 0)
      if (Math.sqrt(rsNew) < 1e-10) break

      const beta = rsNew / rsOld
      p = r.map((ri, i) => ri + beta * p[i])
      rsOld = rsNew
    }

    return x
  }
}

export function createRotosolveOptimizer(config: RotosolveConfig = {}): RotosolveOptimizer {
  return new RotosolveOptimizer(config)
}

export function createFresnelOptimizer(config: Partial<OptimizerConfig> = {}): FresnelOptimizer {
  return new FresnelOptimizer(config)
}

export function createQuantumNaturalGradient(
  config: Partial<OptimizerConfig> & { epsilon?: number } = {}
): QuantumNaturalGradient {
  return new QuantumNaturalGradient(config)
}
