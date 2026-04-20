import type { Optimizer, CostFunction, OptimizationResult } from '../../types'

export interface NelderMeadConfig {
  maxIterations: number
  tolerance: number
  alpha?: number
  gamma?: number
  rho?: number
  sigma?: number
  initialStep?: number
}

export class NelderMeadOptimizer implements Optimizer {
  name = 'nelder_mead'
  private config: Required<NelderMeadConfig>

  constructor(config: NelderMeadConfig) {
    this.config = {
      maxIterations: config.maxIterations,
      tolerance: config.tolerance,
      alpha: config.alpha ?? 1.0,
      gamma: config.gamma ?? 2.0,
      rho: config.rho ?? 0.5,
      sigma: config.sigma ?? 0.5,
      initialStep: config.initialStep ?? 0.1,
    }
  }

  optimize(
    initialParams: number[],
    costFn: CostFunction,
    _gradientFn?: undefined,
    callback?: (iteration: number, value: number, params: number[]) => void
  ): OptimizationResult {
    const n = initialParams.length
    const { maxIterations, tolerance, alpha, gamma, rho, sigma, initialStep } = this.config

    const simplex: { point: number[]; value: number }[] = []
    simplex.push({
      point: [...initialParams],
      value: costFn(initialParams),
    })

    for (let i = 0; i < n; i++) {
      const point = [...initialParams]
      point[i] += initialStep
      simplex.push({
        point,
        value: costFn(point),
      })
    }

    const history: { iteration: number; value: number; params?: number[] }[] = []
    let iteration = 0

    const sortSimplex = () => {
      simplex.sort((a, b) => a.value - b.value)
    }

    const centroid = (): number[] => {
      const c = new Array(n).fill(0)
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          c[j] += simplex[i].point[j]
        }
      }
      return c.map(x => x / n)
    }

    const reflect = (c: number[], worst: number[]): number[] => {
      return c.map((ci, i) => ci + alpha * (ci - worst[i]))
    }

    const expand = (c: number[], reflected: number[]): number[] => {
      return c.map((ci, i) => ci + gamma * (reflected[i] - ci))
    }

    const contract = (c: number[], point: number[], outside: boolean): number[] => {
      if (outside) {
        return c.map((ci, i) => ci + rho * (point[i] - ci))
      } else {
        return c.map((ci, i) => ci - rho * (ci - point[i]))
      }
    }

    const shrink = () => {
      const best = simplex[0].point
      for (let i = 1; i <= n; i++) {
        simplex[i].point = simplex[i].point.map((xi, j) => best[j] + sigma * (xi - best[j]))
        simplex[i].value = costFn(simplex[i].point)
      }
    }

    sortSimplex()
    history.push({ iteration: 0, value: simplex[0].value, params: [...simplex[0].point] })
    callback?.(0, simplex[0].value, simplex[0].point)

    while (iteration < maxIterations) {
      iteration++

      sortSimplex()
      const best = simplex[0]
      const secondWorst = simplex[n - 1]
      const worst = simplex[n]

      let values = simplex.map(s => s.value)
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
      const stdDev = Math.sqrt(variance)

      if (stdDev < tolerance) {
        history.push({ iteration, value: best.value, params: [...best.point] })
        return {
          parameters: best.point,
          value: best.value,
          iterations: iteration,
          converged: true,
          history,
        }
      }

      const c = centroid()
      const reflected = reflect(c, worst.point)
      const reflectedValue = costFn(reflected)

      if (reflectedValue >= best.value && reflectedValue < secondWorst.value) {
        simplex[n] = { point: reflected, value: reflectedValue }
      } else if (reflectedValue < best.value) {
        const expanded = expand(c, reflected)
        const expandedValue = costFn(expanded)

        if (expandedValue < reflectedValue) {
          simplex[n] = { point: expanded, value: expandedValue }
        } else {
          simplex[n] = { point: reflected, value: reflectedValue }
        }
      } else {
        if (reflectedValue < worst.value) {
          const contracted = contract(c, reflected, true)
          const contractedValue = costFn(contracted)

          if (contractedValue < reflectedValue) {
            simplex[n] = { point: contracted, value: contractedValue }
          } else {
            shrink()
          }
        } else {
          const contracted = contract(c, worst.point, false)
          const contractedValue = costFn(contracted)

          if (contractedValue < worst.value) {
            simplex[n] = { point: contracted, value: contractedValue }
          } else {
            shrink()
          }
        }
      }

      sortSimplex()
      history.push({ iteration, value: simplex[0].value })
      callback?.(iteration, simplex[0].value, simplex[0].point)
    }

    sortSimplex()
    return {
      parameters: simplex[0].point,
      value: simplex[0].value,
      iterations: iteration,
      converged: false,
      history,
    }
  }
}
