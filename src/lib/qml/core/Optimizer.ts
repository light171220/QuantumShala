export type OptimizerType = 'adam' | 'sgd' | 'spsa' | 'cobyla' | 'nelder_mead' | 'slsqp' | 'lbfgsb' | 'rotosolve' | 'qng'

export interface OptimizerConfig {
  type: OptimizerType
  learningRate?: number
  beta1?: number
  beta2?: number
  epsilon?: number
  momentum?: number
  decay?: number
  maxIterations?: number
  tolerance?: number
  perturbation?: number
}

export interface OptimizationResult {
  parameters: number[]
  loss: number
  iterations: number
  converged: boolean
  history: OptimizationHistory
}

export interface OptimizationHistory {
  losses: number[]
  parameters: number[][]
  gradients?: number[][]
  learningRates?: number[]
}

export interface OptimizerState {
  step: number
  m?: number[]
  v?: number[]
  velocity?: number[]
  lastGradients?: number[]
}

export abstract class Optimizer {
  protected config: Required<OptimizerConfig>
  protected state: OptimizerState

  constructor(config: OptimizerConfig) {
    this.config = {
      type: config.type,
      learningRate: config.learningRate ?? 0.01,
      beta1: config.beta1 ?? 0.9,
      beta2: config.beta2 ?? 0.999,
      epsilon: config.epsilon ?? 1e-8,
      momentum: config.momentum ?? 0.9,
      decay: config.decay ?? 0,
      maxIterations: config.maxIterations ?? 100,
      tolerance: config.tolerance ?? 1e-6,
      perturbation: config.perturbation ?? 0.1
    }
    this.state = { step: 0 }
  }

  abstract step(
    parameters: number[],
    gradients: number[] | ((params: number[]) => number)
  ): number[]

  reset(): void {
    this.state = { step: 0 }
  }

  getState(): OptimizerState {
    return { ...this.state }
  }

  getCurrentLearningRate(): number {
    const { learningRate, decay } = this.config
    return learningRate / (1 + decay * this.state.step)
  }
}

export class AdamOptimizer extends Optimizer {
  constructor(config: Partial<OptimizerConfig> = {}) {
    super({ type: 'adam', ...config })
  }

  step(parameters: number[], gradients: number[]): number[] {
    const { beta1, beta2, epsilon } = this.config
    const lr = this.getCurrentLearningRate()
    const n = parameters.length

    if (!this.state.m) {
      this.state.m = new Array(n).fill(0)
      this.state.v = new Array(n).fill(0)
    }

    this.state.step++

    const newParams: number[] = []
    for (let i = 0; i < n; i++) {
      this.state.m![i] = beta1 * this.state.m![i] + (1 - beta1) * gradients[i]

      this.state.v![i] = beta2 * this.state.v![i] + (1 - beta2) * gradients[i] ** 2

      const mHat = this.state.m![i] / (1 - Math.pow(beta1, this.state.step))
      const vHat = this.state.v![i] / (1 - Math.pow(beta2, this.state.step))

      newParams.push(parameters[i] - lr * mHat / (Math.sqrt(vHat) + epsilon))
    }

    return newParams
  }
}

export class SGDOptimizer extends Optimizer {
  constructor(config: Partial<OptimizerConfig> = {}) {
    super({ type: 'sgd', ...config })
  }

  step(parameters: number[], gradients: number[]): number[] {
    const { momentum } = this.config
    const lr = this.getCurrentLearningRate()
    const n = parameters.length

    if (!this.state.velocity) {
      this.state.velocity = new Array(n).fill(0)
    }

    this.state.step++

    const newParams: number[] = []
    for (let i = 0; i < n; i++) {
      this.state.velocity![i] = momentum * this.state.velocity![i] + gradients[i]

      newParams.push(parameters[i] - lr * this.state.velocity![i])
    }

    return newParams
  }
}

export class SPSAOptimizer extends Optimizer {
  constructor(config: Partial<OptimizerConfig> = {}) {
    super({ type: 'spsa', learningRate: 0.1, perturbation: 0.1, ...config })
  }

  step(parameters: number[], costFunction: (params: number[]) => number): number[] {
    const { perturbation } = this.config
    const lr = this.getCurrentLearningRate()
    const n = parameters.length

    this.state.step++

    const delta = Array.from({ length: n }, () => Math.random() < 0.5 ? -1 : 1)

    const paramsPlus = parameters.map((p, i) => p + perturbation * delta[i])
    const paramsMinus = parameters.map((p, i) => p - perturbation * delta[i])

    const costPlus = costFunction(paramsPlus)
    const costMinus = costFunction(paramsMinus)

    const gradientEstimate = delta.map(d => (costPlus - costMinus) / (2 * perturbation * d))

    const newParams = parameters.map((p, i) => p - lr * gradientEstimate[i])

    return newParams
  }
}

export class NelderMeadOptimizer extends Optimizer {
  private simplex: number[][] = []
  private costs: number[] = []

  constructor(config: Partial<OptimizerConfig> = {}) {
    super({ type: 'nelder_mead', maxIterations: 200, tolerance: 1e-8, ...config })
  }

  step(parameters: number[], costFunction: (params: number[]) => number): number[] {
    const n = parameters.length

    if (this.simplex.length === 0) {
      this.initializeSimplex(parameters, costFunction)
    }

    this.state.step++

    const alpha = 1
    const gamma = 2
    const rho = 0.5
    const sigma = 0.5

    const indices = this.costs
      .map((c, i) => ({ cost: c, index: i }))
      .sort((a, b) => a.cost - b.cost)
      .map(x => x.index)

    const best = indices[0]
    const worst = indices[indices.length - 1]
    const secondWorst = indices[indices.length - 2]

    const centroid = new Array(n).fill(0)
    for (let i = 0; i < indices.length - 1; i++) {
      for (let j = 0; j < n; j++) {
        centroid[j] += this.simplex[indices[i]][j]
      }
    }
    for (let j = 0; j < n; j++) {
      centroid[j] /= (indices.length - 1)
    }

    const reflected = centroid.map((c, j) => c + alpha * (c - this.simplex[worst][j]))
    const reflectedCost = costFunction(reflected)

    if (reflectedCost < this.costs[best]) {
      const expanded = centroid.map((c, j) => c + gamma * (reflected[j] - c))
      const expandedCost = costFunction(expanded)

      if (expandedCost < reflectedCost) {
        this.simplex[worst] = expanded
        this.costs[worst] = expandedCost
      } else {
        this.simplex[worst] = reflected
        this.costs[worst] = reflectedCost
      }
    } else if (reflectedCost < this.costs[secondWorst]) {
      this.simplex[worst] = reflected
      this.costs[worst] = reflectedCost
    } else {
      const contracted = reflectedCost < this.costs[worst]
        ? centroid.map((c, j) => c + rho * (reflected[j] - c))
        : centroid.map((c, j) => c + rho * (this.simplex[worst][j] - c))
      const contractedCost = costFunction(contracted)

      if (contractedCost < Math.min(reflectedCost, this.costs[worst])) {
        this.simplex[worst] = contracted
        this.costs[worst] = contractedCost
      } else {
        for (let i = 1; i < this.simplex.length; i++) {
          for (let j = 0; j < n; j++) {
            this.simplex[i][j] = this.simplex[best][j] + sigma * (this.simplex[i][j] - this.simplex[best][j])
          }
          this.costs[i] = costFunction(this.simplex[i])
        }
      }
    }

    const bestIdx = this.costs.indexOf(Math.min(...this.costs))
    return [...this.simplex[bestIdx]]
  }

  private initializeSimplex(initial: number[], costFunction: (params: number[]) => number): void {
    const n = initial.length
    this.simplex = [initial]
    this.costs = [costFunction(initial)]

    for (let i = 0; i < n; i++) {
      const vertex = [...initial]
      vertex[i] += vertex[i] === 0 ? 0.1 : 0.1 * Math.abs(vertex[i])
      this.simplex.push(vertex)
      this.costs.push(costFunction(vertex))
    }
  }

  reset(): void {
    super.reset()
    this.simplex = []
    this.costs = []
  }
}

export class COBYLAOptimizer extends Optimizer {
  private rhoBeg: number
  private rhoEnd: number

  constructor(config: Partial<OptimizerConfig> = {}) {
    super({ type: 'cobyla', maxIterations: 200, tolerance: 1e-6, ...config })
    this.rhoBeg = 0.5
    this.rhoEnd = this.config.tolerance
  }

  step(parameters: number[], costFunction: (params: number[]) => number): number[] {
    const nm = new NelderMeadOptimizer(this.config)
    return nm.step(parameters, costFunction)
  }
}

export function createOptimizer(config: OptimizerConfig): Optimizer {
  switch (config.type) {
    case 'adam':
      return new AdamOptimizer(config)
    case 'sgd':
      return new SGDOptimizer(config)
    case 'spsa':
      return new SPSAOptimizer(config)
    case 'nelder_mead':
      return new NelderMeadOptimizer(config)
    case 'cobyla':
      return new COBYLAOptimizer(config)
    case 'slsqp':
    case 'lbfgsb':
    case 'rotosolve':
    case 'qng':
      return new COBYLAOptimizer(config)
    default:
      return new AdamOptimizer(config)
  }
}

export function optimize(
  initialParams: number[],
  costFunction: (params: number[]) => number,
  gradientFunction: ((params: number[]) => number[]) | null,
  optimizer: Optimizer,
  config: { maxIterations?: number; tolerance?: number; callback?: (iter: number, loss: number, params: number[]) => void } = {}
): OptimizationResult {
  const { maxIterations = 100, tolerance = 1e-6, callback } = config

  let params = [...initialParams]
  let loss = costFunction(params)
  let prevLoss = Infinity

  const history: OptimizationHistory = {
    losses: [loss],
    parameters: [[...params]],
    gradients: [],
    learningRates: []
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    let gradients: number[]
    if (gradientFunction) {
      gradients = gradientFunction(params)
      history.gradients!.push([...gradients])
    } else {
      gradients = []
    }

    if (optimizer instanceof SPSAOptimizer || optimizer instanceof NelderMeadOptimizer || optimizer instanceof COBYLAOptimizer) {
      params = optimizer.step(params, costFunction)
    } else {
      params = optimizer.step(params, gradients)
    }

    loss = costFunction(params)
    history.losses.push(loss)
    history.parameters.push([...params])
    history.learningRates!.push((optimizer as Optimizer).getCurrentLearningRate())

    if (callback) {
      callback(iter + 1, loss, params)
    }

    if (Math.abs(prevLoss - loss) < tolerance) {
      return {
        parameters: params,
        loss,
        iterations: iter + 1,
        converged: true,
        history
      }
    }

    prevLoss = loss
  }

  return {
    parameters: params,
    loss,
    iterations: maxIterations,
    converged: false,
    history
  }
}
