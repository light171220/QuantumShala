import { Optimizer, type OptimizerConfig, type OptimizerState } from '../Optimizer'

export interface SLSQPConfig extends Partial<OptimizerConfig> {
  ftol?: number
  maxiter?: number
  eps?: number
}

export class SLSQPOptimizer extends Optimizer {
  private ftol: number
  private eps: number
  private prevParams: number[] | null = null
  private prevGradient: number[] | null = null
  private hessianApprox: number[][] | null = null

  constructor(config: SLSQPConfig = {}) {
    super({
      type: 'slsqp',
      learningRate: config.learningRate ?? 1.0,
      maxIterations: config.maxiter ?? config.maxIterations ?? 100,
      tolerance: config.ftol ?? config.tolerance ?? 1e-6,
      ...config
    })
    this.ftol = config.ftol ?? config.tolerance ?? 1e-6
    this.eps = config.eps ?? 1e-8
  }

  step(parameters: number[], costFunction: (params: number[]) => number): number[] {
    const n = parameters.length
    this.state.step++

    const gradient = this.computeGradient(parameters, costFunction)

    if (this.hessianApprox === null) {
      this.hessianApprox = this.initializeHessian(n)
    }

    if (this.prevParams !== null && this.prevGradient !== null) {
      this.updateHessian(parameters, gradient)
    }

    const direction = this.solveQuadratic(gradient)

    const alpha = this.lineSearch(parameters, direction, costFunction)

    const newParams = parameters.map((p, i) => p + alpha * direction[i])

    this.prevParams = [...parameters]
    this.prevGradient = [...gradient]

    return newParams
  }

  private computeGradient(params: number[], costFunction: (p: number[]) => number): number[] {
    const gradient: number[] = []
    const f0 = costFunction(params)

    for (let i = 0; i < params.length; i++) {
      const h = this.eps * Math.max(1.0, Math.abs(params[i]))
      const paramsPlus = [...params]
      paramsPlus[i] += h

      const fPlus = costFunction(paramsPlus)
      gradient.push((fPlus - f0) / h)
    }

    return gradient
  }

  private initializeHessian(n: number): number[][] {
    const H: number[][] = []
    for (let i = 0; i < n; i++) {
      H.push(new Array(n).fill(0))
      H[i][i] = 1.0
    }
    return H
  }

  private updateHessian(newParams: number[], newGradient: number[]): void {
    if (!this.prevParams || !this.prevGradient || !this.hessianApprox) return

    const n = newParams.length
    const s = newParams.map((p, i) => p - this.prevParams![i])
    const y = newGradient.map((g, i) => g - this.prevGradient![i])

    const sy = s.reduce((sum, si, i) => sum + si * y[i], 0)

    if (Math.abs(sy) < 1e-12) return

    const Hy: number[] = new Array(n).fill(0)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        Hy[i] += this.hessianApprox[i][j] * y[j]
      }
    }

    const yHy = y.reduce((sum, yi, i) => sum + yi * Hy[i], 0)

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        this.hessianApprox[i][j] +=
          (s[i] * s[j]) / sy -
          (Hy[i] * Hy[j]) / yHy
      }
    }
  }

  private solveQuadratic(gradient: number[]): number[] {
    if (!this.hessianApprox) {
      return gradient.map(g => -g)
    }

    const n = gradient.length
    const direction = this.conjugateGradientSolve(this.hessianApprox, gradient.map(g => -g))

    return direction
  }

  private conjugateGradientSolve(A: number[][], b: number[]): number[] {
    const n = b.length
    const x = new Array(n).fill(0)
    let r = [...b]
    let p = [...r]
    let rsOld = r.reduce((sum, ri) => sum + ri * ri, 0)

    for (let iter = 0; iter < n; iter++) {
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

  private lineSearch(
    params: number[],
    direction: number[],
    costFunction: (p: number[]) => number
  ): number {
    const c1 = 1e-4
    const c2 = 0.9
    let alpha = 1.0
    const maxIter = 20

    const f0 = costFunction(params)
    const g0 = this.computeGradient(params, costFunction)
    const dg0 = direction.reduce((sum, d, i) => sum + d * g0[i], 0)

    for (let iter = 0; iter < maxIter; iter++) {
      const newParams = params.map((p, i) => p + alpha * direction[i])
      const f1 = costFunction(newParams)

      if (f1 <= f0 + c1 * alpha * dg0) {
        const g1 = this.computeGradient(newParams, costFunction)
        const dg1 = direction.reduce((sum, d, i) => sum + d * g1[i], 0)

        if (Math.abs(dg1) <= c2 * Math.abs(dg0)) {
          return alpha
        }
      }

      alpha *= 0.5
    }

    return alpha
  }

  reset(): void {
    super.reset()
    this.prevParams = null
    this.prevGradient = null
    this.hessianApprox = null
  }
}

export function createSLSQPOptimizer(config: SLSQPConfig = {}): SLSQPOptimizer {
  return new SLSQPOptimizer(config)
}
