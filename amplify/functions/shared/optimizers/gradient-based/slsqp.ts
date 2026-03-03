import type { Optimizer, CostFunction, GradientFunction, OptimizationResult } from '../../types'

export interface SLSQPConfig {
  maxIterations: number
  tolerance: number
  constraintTolerance?: number
  bounds?: { lower?: number; upper?: number }[]
  equalityConstraints?: ((params: number[]) => number)[]
  inequalityConstraints?: ((params: number[]) => number)[]
}

export class SLSQPOptimizer implements Optimizer {
  name = 'slsqp'
  private config: Required<Omit<SLSQPConfig, 'bounds' | 'equalityConstraints' | 'inequalityConstraints'>> & {
    bounds?: SLSQPConfig['bounds']
    equalityConstraints?: SLSQPConfig['equalityConstraints']
    inequalityConstraints?: SLSQPConfig['inequalityConstraints']
  }

  constructor(config: SLSQPConfig) {
    this.config = {
      maxIterations: config.maxIterations,
      tolerance: config.tolerance,
      constraintTolerance: config.constraintTolerance ?? 1e-6,
      bounds: config.bounds,
      equalityConstraints: config.equalityConstraints,
      inequalityConstraints: config.inequalityConstraints,
    }
  }

  private projectToBounds(params: number[]): number[] {
    if (!this.config.bounds) return params

    return params.map((p, i) => {
      const bound = this.config.bounds![i]
      if (!bound) return p
      let value = p
      if (bound.lower !== undefined) value = Math.max(value, bound.lower)
      if (bound.upper !== undefined) value = Math.min(value, bound.upper)
      return value
    })
  }

  private evaluateConstraints(params: number[]): { eq: number[]; ineq: number[] } {
    const eq: number[] = []
    const ineq: number[] = []

    if (this.config.equalityConstraints) {
      for (const c of this.config.equalityConstraints) {
        eq.push(c(params))
      }
    }

    if (this.config.inequalityConstraints) {
      for (const c of this.config.inequalityConstraints) {
        ineq.push(c(params))
      }
    }

    return { eq, ineq }
  }

  private computeConstraintGradients(
    params: number[],
    epsilon: number = 1e-7
  ): { eqGrad: number[][]; ineqGrad: number[][] } {
    const n = params.length
    const eqGrad: number[][] = []
    const ineqGrad: number[][] = []

    if (this.config.equalityConstraints) {
      for (const c of this.config.equalityConstraints) {
        const grad: number[] = []
        for (let i = 0; i < n; i++) {
          const paramsPlus = [...params]
          paramsPlus[i] += epsilon
          const paramsMinus = [...params]
          paramsMinus[i] -= epsilon
          grad.push((c(paramsPlus) - c(paramsMinus)) / (2 * epsilon))
        }
        eqGrad.push(grad)
      }
    }

    if (this.config.inequalityConstraints) {
      for (const c of this.config.inequalityConstraints) {
        const grad: number[] = []
        for (let i = 0; i < n; i++) {
          const paramsPlus = [...params]
          paramsPlus[i] += epsilon
          const paramsMinus = [...params]
          paramsMinus[i] -= epsilon
          grad.push((c(paramsPlus) - c(paramsMinus)) / (2 * epsilon))
        }
        ineqGrad.push(grad)
      }
    }

    return { eqGrad, ineqGrad }
  }

  private meritFunction(
    params: number[],
    costFn: CostFunction,
    mu: number
  ): number {
    const fx = costFn(params)
    const { eq, ineq } = this.evaluateConstraints(params)

    let penalty = 0
    for (const e of eq) {
      penalty += Math.abs(e)
    }
    for (const g of ineq) {
      penalty += Math.max(0, -g)
    }

    return fx + mu * penalty
  }

  optimize(
    initialParams: number[],
    costFn: CostFunction,
    gradientFn?: GradientFunction,
    callback?: (iteration: number, value: number, params: number[]) => void
  ): OptimizationResult {
    const n = initialParams.length
    const { maxIterations, tolerance, constraintTolerance } = this.config

    if (!gradientFn) {
      gradientFn = (params: number[]) => this.numericalGradient(costFn, params)
    }

    let x = this.projectToBounds([...initialParams])
    let fx = costFn(x)
    let gx = gradientFn(x)

    let H = this.identityMatrix(n)
    let mu = 1.0

    const history: { iteration: number; value: number; params?: number[] }[] = []
    history.push({ iteration: 0, value: fx, params: [...x] })
    callback?.(0, fx, x)

    let converged = false

    for (let iter = 1; iter <= maxIterations; iter++) {
      const { eq, ineq } = this.evaluateConstraints(x)
      const { eqGrad, ineqGrad } = this.computeConstraintGradients(x)

      let direction: number[]

      const hasConstraints =
        (eq.length > 0 || ineq.length > 0)

      if (hasConstraints) {
        const activeIneq: number[] = []
        const activeIneqGrad: number[][] = []
        for (let i = 0; i < ineq.length; i++) {
          if (ineq[i] <= constraintTolerance) {
            activeIneq.push(i)
            activeIneqGrad.push(ineqGrad[i])
          }
        }

        direction = this.solveQPSubproblem(gx, H, eqGrad, activeIneqGrad, eq, activeIneq.map(i => ineq[i]))
      } else {
        direction = this.matrixVectorMultiply(H, gx.map(g => -g))
      }

      let alpha = 1.0
      const merit0 = this.meritFunction(x, costFn, mu)
      const dirDeriv = gx.reduce((s, g, i) => s + g * direction[i], 0)

      for (let ls = 0; ls < 20; ls++) {
        const xNew = this.projectToBounds(x.map((xi, i) => xi + alpha * direction[i]))
        const meritNew = this.meritFunction(xNew, costFn, mu)

        if (meritNew <= merit0 + 1e-4 * alpha * Math.min(dirDeriv, 0)) {
          break
        }
        alpha *= 0.5
      }

      const xNew = this.projectToBounds(x.map((xi, i) => xi + alpha * direction[i]))
      const fxNew = costFn(xNew)
      const gxNew = gradientFn(xNew)

      const s = xNew.map((xi, i) => xi - x[i])
      const y = gxNew.map((gi, i) => gi - gx[i])
      const ys = y.reduce((sum, yi, i) => sum + yi * s[i], 0)

      if (ys > 1e-10) {
        const Hs = this.matrixVectorMultiply(H, s)
        const sHs = s.reduce((sum, si, i) => sum + si * Hs[i], 0)

        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            H[i][j] += (y[i] * y[j]) / ys - (Hs[i] * Hs[j]) / sHs
          }
        }
      }

      const { eq: eqNew, ineq: ineqNew } = this.evaluateConstraints(xNew)
      const maxConstraintViolation = Math.max(
        ...eqNew.map(Math.abs),
        ...ineqNew.map(g => Math.max(0, -g)),
        0
      )

      if (maxConstraintViolation > constraintTolerance) {
        mu *= 10
      }

      const valueChange = Math.abs(fx - fxNew)
      const gradNorm = Math.sqrt(gxNew.reduce((s, g) => s + g * g, 0))

      if (valueChange < tolerance && gradNorm < tolerance && maxConstraintViolation < constraintTolerance) {
        converged = true
      }

      x = xNew
      fx = fxNew
      gx = gxNew

      history.push({ iteration: iter, value: fx })
      callback?.(iter, fx, x)

      if (converged) break
    }

    return {
      parameters: x,
      value: fx,
      iterations: history.length - 1,
      converged,
      history,
    }
  }

  private solveQPSubproblem(
    g: number[],
    H: number[][],
    Aeq: number[][],
    Aineq: number[][],
    beq: number[],
    bineq: number[]
  ): number[] {
    const n = g.length

    const direction = this.matrixVectorMultiply(H, g.map(gi => -gi))

    if (Aeq.length === 0 && Aineq.length === 0) {
      return direction
    }

    for (const aeq of Aeq) {
      const ad = aeq.reduce((s, ai, i) => s + ai * direction[i], 0)
      const aa = aeq.reduce((s, ai) => s + ai * ai, 0)
      if (aa > 1e-10) {
        const scale = ad / aa
        for (let i = 0; i < n; i++) {
          direction[i] -= scale * aeq[i]
        }
      }
    }

    return direction
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
