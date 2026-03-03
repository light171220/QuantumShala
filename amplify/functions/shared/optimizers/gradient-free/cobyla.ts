import type { Optimizer, CostFunction, OptimizationResult } from '../../types'

export interface COBYLAConfig {
  maxIterations: number
  tolerance: number
  rhoBeg?: number
  rhoEnd?: number
}

export class COBYLAOptimizer implements Optimizer {
  name = 'cobyla'
  private config: Required<COBYLAConfig>

  constructor(config: COBYLAConfig) {
    this.config = {
      maxIterations: config.maxIterations,
      tolerance: config.tolerance,
      rhoBeg: config.rhoBeg ?? 0.5,
      rhoEnd: config.rhoEnd ?? config.tolerance,
    }
  }

  optimize(
    initialParams: number[],
    costFn: CostFunction,
    _gradientFn?: undefined,
    callback?: (iteration: number, value: number, params: number[]) => void
  ): OptimizationResult {
    const n = initialParams.length
    const { maxIterations, tolerance, rhoBeg, rhoEnd } = this.config

    let rho = rhoBeg
    let x = [...initialParams]
    let fx = costFn(x)

    const history: { iteration: number; value: number; params?: number[] }[] = []
    history.push({ iteration: 0, value: fx, params: [...x] })
    callback?.(0, fx, x)

    const simplex: number[][] = [x]
    const fValues: number[] = [fx]

    for (let i = 0; i < n; i++) {
      const point = [...x]
      point[i] += rho
      simplex.push(point)
      fValues.push(costFn(point))
    }

    let iteration = 0
    let converged = false

    while (iteration < maxIterations && rho > rhoEnd) {
      iteration++

      let bestIdx = 0
      let worstIdx = 0
      for (let i = 1; i <= n; i++) {
        if (fValues[i] < fValues[bestIdx]) bestIdx = i
        if (fValues[i] > fValues[worstIdx]) worstIdx = i
      }

      const centroid = new Array(n).fill(0)
      for (let i = 0; i <= n; i++) {
        if (i !== worstIdx) {
          for (let j = 0; j < n; j++) {
            centroid[j] += simplex[i][j]
          }
        }
      }
      for (let j = 0; j < n; j++) {
        centroid[j] /= n
      }

      const reflected = centroid.map((c, j) => 2 * c - simplex[worstIdx][j])
      const fReflected = costFn(reflected)

      if (fReflected < fValues[bestIdx]) {
        const expanded = centroid.map((c, j) => c + 2 * (reflected[j] - c))
        const fExpanded = costFn(expanded)

        if (fExpanded < fReflected) {
          simplex[worstIdx] = expanded
          fValues[worstIdx] = fExpanded
        } else {
          simplex[worstIdx] = reflected
          fValues[worstIdx] = fReflected
        }
      } else if (fReflected < fValues[worstIdx]) {
        simplex[worstIdx] = reflected
        fValues[worstIdx] = fReflected
      } else {
        const contracted = centroid.map((c, j) => c + 0.5 * (simplex[worstIdx][j] - c))
        const fContracted = costFn(contracted)

        if (fContracted < fValues[worstIdx]) {
          simplex[worstIdx] = contracted
          fValues[worstIdx] = fContracted
        } else {
          for (let i = 0; i <= n; i++) {
            if (i !== bestIdx) {
              for (let j = 0; j < n; j++) {
                simplex[i][j] = simplex[bestIdx][j] + 0.5 * (simplex[i][j] - simplex[bestIdx][j])
              }
              fValues[i] = costFn(simplex[i])
            }
          }
        }
      }

      let newBestIdx = 0
      for (let i = 1; i <= n; i++) {
        if (fValues[i] < fValues[newBestIdx]) newBestIdx = i
      }

      if (fValues[newBestIdx] < fx - tolerance) {
        x = [...simplex[newBestIdx]]
        fx = fValues[newBestIdx]
      }

      let maxDist = 0
      for (let i = 0; i <= n; i++) {
        for (let j = i + 1; j <= n; j++) {
          let dist = 0
          for (let k = 0; k < n; k++) {
            dist += (simplex[i][k] - simplex[j][k]) ** 2
          }
          maxDist = Math.max(maxDist, Math.sqrt(dist))
        }
      }

      if (maxDist < rho * 0.5) {
        rho *= 0.5

        if (rho > rhoEnd) {
          for (let i = 0; i <= n; i++) {
            simplex[i] = [...x]
            if (i > 0) {
              simplex[i][i - 1] += rho
            }
            fValues[i] = costFn(simplex[i])
          }
        }
      }

      const improvement = Math.abs(fValues[newBestIdx] - fx)
      if (improvement < tolerance && rho <= rhoEnd) {
        converged = true
        break
      }

      history.push({ iteration, value: fValues[newBestIdx] })
      callback?.(iteration, fValues[newBestIdx], simplex[newBestIdx])
    }

    let finalBestIdx = 0
    for (let i = 1; i <= n; i++) {
      if (fValues[i] < fValues[finalBestIdx]) finalBestIdx = i
    }

    return {
      parameters: simplex[finalBestIdx],
      value: fValues[finalBestIdx],
      iterations: iteration,
      converged,
      history,
    }
  }
}
