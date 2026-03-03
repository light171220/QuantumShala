import type { Optimizer, CostFunction, GradientFunction, OptimizationResult } from '../../types'

export interface LBFGSBConfig {
  maxIterations: number
  tolerance: number
  memorySize?: number
  lineSearchMaxIterations?: number
  c1?: number
  c2?: number
  bounds?: { lower?: number; upper?: number }[]
}

export class LBFGSBOptimizer implements Optimizer {
  name = 'lbfgsb'
  private config: Required<Omit<LBFGSBConfig, 'bounds'>> & { bounds?: LBFGSBConfig['bounds'] }

  constructor(config: LBFGSBConfig) {
    this.config = {
      maxIterations: config.maxIterations,
      tolerance: config.tolerance,
      memorySize: config.memorySize ?? 10,
      lineSearchMaxIterations: config.lineSearchMaxIterations ?? 20,
      c1: config.c1 ?? 1e-4,
      c2: config.c2 ?? 0.9,
      bounds: config.bounds,
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

  private lineSearch(
    costFn: CostFunction,
    gradientFn: GradientFunction,
    x: number[],
    direction: number[],
    fx: number,
    gx: number[]
  ): { alpha: number; fx: number; gx: number[] } {
    const { c1, c2, lineSearchMaxIterations } = this.config

    const phi0 = fx
    const dphi0 = gx.reduce((s, g, i) => s + g * direction[i], 0)

    if (dphi0 >= 0) {
      return { alpha: 0, fx, gx }
    }

    let alpha = 1.0
    let alphaLo = 0
    let alphaHi = Infinity

    for (let iter = 0; iter < lineSearchMaxIterations; iter++) {
      const xNew = this.projectToBounds(x.map((xi, i) => xi + alpha * direction[i]))
      const fxNew = costFn(xNew)
      const gxNew = gradientFn(xNew)
      const dphiAlpha = gxNew.reduce((s, g, i) => s + g * direction[i], 0)

      if (fxNew > phi0 + c1 * alpha * dphi0 || (iter > 0 && fxNew >= fx)) {
        alphaHi = alpha
      } else {
        if (Math.abs(dphiAlpha) <= -c2 * dphi0) {
          return { alpha, fx: fxNew, gx: gxNew }
        }

        if (dphiAlpha >= 0) {
          alphaHi = alpha
        } else {
          alphaLo = alpha
        }
      }

      if (alphaHi < Infinity) {
        alpha = (alphaLo + alphaHi) / 2
      } else {
        alpha *= 2
      }

      if (alpha < 1e-16 || alpha > 1e16) {
        break
      }
    }

    const xFinal = this.projectToBounds(x.map((xi, i) => xi + alpha * direction[i]))
    return { alpha, fx: costFn(xFinal), gx: gradientFn(xFinal) }
  }

  optimize(
    initialParams: number[],
    costFn: CostFunction,
    gradientFn?: GradientFunction,
    callback?: (iteration: number, value: number, params: number[]) => void
  ): OptimizationResult {
    const n = initialParams.length
    const { maxIterations, tolerance, memorySize } = this.config

    if (!gradientFn) {
      gradientFn = (params: number[]) => this.numericalGradient(costFn, params)
    }

    let x = this.projectToBounds([...initialParams])
    let fx = costFn(x)
    let gx = gradientFn(x)

    const sHistory: number[][] = []
    const yHistory: number[][] = []
    const rhoHistory: number[] = []

    const history: { iteration: number; value: number; params?: number[] }[] = []
    history.push({ iteration: 0, value: fx, params: [...x] })
    callback?.(0, fx, x)

    let converged = false

    for (let iter = 1; iter <= maxIterations; iter++) {
      const gradNorm = Math.sqrt(gx.reduce((s, g) => s + g * g, 0))
      if (gradNorm < tolerance) {
        converged = true
        break
      }

      let direction = gx.map(g => -g)

      if (sHistory.length > 0) {
        const q = [...direction]
        const alphas: number[] = []

        for (let i = sHistory.length - 1; i >= 0; i--) {
          const alpha = rhoHistory[i] * sHistory[i].reduce((s, si, j) => s + si * q[j], 0)
          alphas.unshift(alpha)
          for (let j = 0; j < n; j++) {
            q[j] -= alpha * yHistory[i][j]
          }
        }

        const lastY = yHistory[yHistory.length - 1]
        const lastS = sHistory[sHistory.length - 1]
        const ys = lastY.reduce((s, yi, i) => s + yi * lastS[i], 0)
        const yy = lastY.reduce((s, yi) => s + yi * yi, 0)
        const gamma = ys / (yy + 1e-10)

        direction = q.map(qi => gamma * qi)

        for (let i = 0; i < sHistory.length; i++) {
          const beta = rhoHistory[i] * yHistory[i].reduce((s, yi, j) => s + yi * direction[j], 0)
          for (let j = 0; j < n; j++) {
            direction[j] += (alphas[i] - beta) * sHistory[i][j]
          }
        }
      }

      const { alpha, fx: fxNew, gx: gxNew } = this.lineSearch(costFn, gradientFn!, x, direction, fx, gx)

      if (alpha === 0) {
        break
      }

      const xNew = this.projectToBounds(x.map((xi, i) => xi + alpha * direction[i]))

      const s = xNew.map((xi, i) => xi - x[i])
      const y = gxNew.map((gi, i) => gi - gx[i])
      const ys = y.reduce((sum, yi, i) => sum + yi * s[i], 0)

      if (ys > 1e-10) {
        if (sHistory.length >= memorySize) {
          sHistory.shift()
          yHistory.shift()
          rhoHistory.shift()
        }
        sHistory.push(s)
        yHistory.push(y)
        rhoHistory.push(1 / ys)
      }

      const valueChange = Math.abs(fx - fxNew)
      if (valueChange < tolerance) {
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
