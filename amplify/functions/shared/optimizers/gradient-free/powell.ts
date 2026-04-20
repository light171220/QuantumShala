import type { Optimizer, CostFunction, OptimizationResult } from '../../types'

export interface PowellConfig {
  maxIterations: number
  tolerance: number
  lineSearchTolerance?: number
  maxLineSearchIterations?: number
}

export class PowellOptimizer implements Optimizer {
  name = 'powell'
  private config: Required<PowellConfig>

  constructor(config: PowellConfig) {
    this.config = {
      maxIterations: config.maxIterations,
      tolerance: config.tolerance,
      lineSearchTolerance: config.lineSearchTolerance ?? 1e-8,
      maxLineSearchIterations: config.maxLineSearchIterations ?? 100,
    }
  }

  private lineSearch(
    costFn: CostFunction,
    x: number[],
    direction: number[]
  ): { alpha: number; value: number } {
    const { lineSearchTolerance, maxLineSearchIterations } = this.config

    const phi = (alpha: number): number => {
      const point = x.map((xi, i) => xi + alpha * direction[i])
      return costFn(point)
    }

    let a = 0
    let b = 1
    let fa = phi(a)
    let fb = phi(b)

    while (fb < fa && b < 1000) {
      b *= 2
      fb = phi(b)
    }

    const goldenRatio = (Math.sqrt(5) - 1) / 2

    let c = b - goldenRatio * (b - a)
    let d = a + goldenRatio * (b - a)
    let fc = phi(c)
    let fd = phi(d)

    for (let iter = 0; iter < maxLineSearchIterations; iter++) {
      if (Math.abs(b - a) < lineSearchTolerance) {
        break
      }

      if (fc < fd) {
        b = d
        d = c
        fd = fc
        c = b - goldenRatio * (b - a)
        fc = phi(c)
      } else {
        a = c
        c = d
        fc = fd
        d = a + goldenRatio * (b - a)
        fd = phi(d)
      }
    }

    const alpha = (a + b) / 2
    return { alpha, value: phi(alpha) }
  }

  optimize(
    initialParams: number[],
    costFn: CostFunction,
    _gradientFn?: undefined,
    callback?: (iteration: number, value: number, params: number[]) => void
  ): OptimizationResult {
    const n = initialParams.length
    const { maxIterations, tolerance } = this.config

    let x = [...initialParams]
    let fx = costFn(x)

    const directions: number[][] = []
    for (let i = 0; i < n; i++) {
      const dir = new Array(n).fill(0)
      dir[i] = 1
      directions.push(dir)
    }

    const history: { iteration: number; value: number; params?: number[] }[] = []
    history.push({ iteration: 0, value: fx, params: [...x] })
    callback?.(0, fx, x)

    let converged = false
    let iteration = 0

    while (iteration < maxIterations) {
      iteration++

      const x0 = [...x]
      const f0 = fx
      let maxDecrease = 0
      let maxDecreaseIdx = 0

      for (let i = 0; i < n; i++) {
        const fBefore = fx

        const { alpha, value } = this.lineSearch(costFn, x, directions[i])
        x = x.map((xi, j) => xi + alpha * directions[i][j])
        fx = value

        const decrease = fBefore - fx
        if (decrease > maxDecrease) {
          maxDecrease = decrease
          maxDecreaseIdx = i
        }
      }

      const newDirection = x.map((xi, i) => xi - x0[i])
      const dirNorm = Math.sqrt(newDirection.reduce((s, d) => s + d * d, 0))

      if (dirNorm > 1e-10) {
        const normalizedDir = newDirection.map(d => d / dirNorm)

        const { alpha, value: fNew } = this.lineSearch(costFn, x, normalizedDir)

        const extrapolated = x.map((xi, i) => xi + alpha * normalizedDir[i])
        const fExtrap = costFn(extrapolated)

        if (fExtrap < fx) {
          const fE = f0
          const f1 = fx
          const f2 = fExtrap
          const delta = maxDecrease

          const shouldReplace =
            2 * (fE - 2 * f1 + f2) * (fE - f1 - delta) ** 2 <
            delta * (fE - f2) ** 2

          if (shouldReplace) {
            x = extrapolated
            fx = fExtrap

            for (let i = maxDecreaseIdx; i < n - 1; i++) {
              directions[i] = directions[i + 1]
            }
            directions[n - 1] = normalizedDir
          }
        }
      }

      const improvement = f0 - fx
      if (improvement < tolerance && improvement >= 0) {
        converged = true
      }

      history.push({ iteration, value: fx })
      callback?.(iteration, fx, x)

      if (converged) break
    }

    return {
      parameters: x,
      value: fx,
      iterations: iteration,
      converged,
      history,
    }
  }
}
