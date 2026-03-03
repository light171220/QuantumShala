import type { Optimizer, OptimizerConfig, CostFunction, GradientFunction, OptimizationResult } from '../types'

import { NelderMeadOptimizer } from './gradient-free/nelder-mead'
import { COBYLAOptimizer } from './gradient-free/cobyla'
import { PowellOptimizer } from './gradient-free/powell'
import { AdamOptimizer } from './gradient-based/adam'
import { SGDOptimizer } from './gradient-based/sgd'
import { LBFGSBOptimizer } from './gradient-based/lbfgsb'
import { SLSQPOptimizer } from './gradient-based/slsqp'
import { SPSAOptimizer } from './quantum-aware/spsa'
import { QNSPSAOptimizer } from './quantum-aware/qn-spsa'
import { QNGOptimizer } from './quantum-aware/qng'
import { RotosolveOptimizer } from './quantum-aware/rotosolve'

export * from './gradient-free/nelder-mead'
export * from './gradient-free/cobyla'
export * from './gradient-free/powell'
export * from './gradient-based/adam'
export * from './gradient-based/sgd'
export * from './gradient-based/lbfgsb'
export * from './gradient-based/slsqp'
export * from './quantum-aware/spsa'
export * from './quantum-aware/qn-spsa'
export * from './quantum-aware/qng'
export * from './quantum-aware/rotosolve'

export function createOptimizer(config: OptimizerConfig): Optimizer {
  const baseConfig = {
    maxIterations: config.maxIterations,
    tolerance: config.tolerance,
  }

  switch (config.type) {
    case 'nelder_mead':
      return new NelderMeadOptimizer(baseConfig)

    case 'cobyla':
      return new COBYLAOptimizer(baseConfig)

    case 'powell':
      return new PowellOptimizer(baseConfig)

    case 'adam':
      return new AdamOptimizer({
        ...baseConfig,
        learningRate: config.learningRate ?? 0.01,
        beta1: config.beta1 ?? 0.9,
        beta2: config.beta2 ?? 0.999,
        epsilon: config.epsilon ?? 1e-8,
      })

    case 'sgd':
      return new SGDOptimizer({
        ...baseConfig,
        learningRate: config.learningRate ?? 0.01,
        momentum: config.momentum ?? 0.9,
        decay: config.decay ?? 0,
      })

    case 'lbfgsb':
      return new LBFGSBOptimizer(baseConfig)

    case 'slsqp':
      return new SLSQPOptimizer(baseConfig)

    case 'spsa':
      return new SPSAOptimizer({
        ...baseConfig,
        a: config.learningRate ?? 0.1,
        c: config.perturbation ?? 0.1,
      })

    case 'qn_spsa':
      return new QNSPSAOptimizer({
        ...baseConfig,
        learningRate: config.learningRate ?? 0.1,
        perturbation: config.perturbation ?? 0.1,
      })

    case 'qng':
      return new QNGOptimizer({
        ...baseConfig,
        learningRate: config.learningRate ?? 0.1,
      })

    case 'rotosolve':
      return new RotosolveOptimizer(baseConfig)

    default:
      console.warn(`Unknown optimizer type: ${config.type}, falling back to COBYLA`)
      return new COBYLAOptimizer(baseConfig)
  }
}

export function optimize(
  initialParams: number[],
  costFn: CostFunction,
  gradientFn: GradientFunction | undefined,
  optimizer: Optimizer,
  options?: {
    maxIterations?: number
    tolerance?: number
    callback?: (iteration: number, value: number, params: number[]) => void
  }
): OptimizationResult {
  return optimizer.optimize(
    initialParams,
    costFn,
    gradientFn,
    options?.callback
  )
}

export const OPTIMIZER_INFO: Record<string, {
  name: string
  description: string
  gradientBased: boolean
  recommended: string[]
  complexity: 'low' | 'medium' | 'high'
}> = {
  cobyla: {
    name: 'COBYLA',
    description: 'Constrained Optimization BY Linear Approximation - gradient-free',
    gradientBased: false,
    recommended: ['small systems', 'beginners', 'noisy landscapes'],
    complexity: 'low',
  },
  nelder_mead: {
    name: 'Nelder-Mead',
    description: 'Simplex-based gradient-free optimization',
    gradientBased: false,
    recommended: ['refinement', 'smooth landscapes'],
    complexity: 'low',
  },
  powell: {
    name: 'Powell',
    description: 'Conjugate direction method without gradients',
    gradientBased: false,
    recommended: ['smooth landscapes', 'moderate dimensions'],
    complexity: 'low',
  },
  adam: {
    name: 'Adam',
    description: 'Adaptive Moment Estimation - robust gradient-based optimizer',
    gradientBased: true,
    recommended: ['deep circuits', 'noisy gradients', 'general use'],
    complexity: 'medium',
  },
  sgd: {
    name: 'SGD',
    description: 'Stochastic Gradient Descent with momentum',
    gradientBased: true,
    recommended: ['simple cases', 'well-behaved landscapes'],
    complexity: 'low',
  },
  lbfgsb: {
    name: 'L-BFGS-B',
    description: 'Limited-memory BFGS with bounds - quasi-Newton method',
    gradientBased: true,
    recommended: ['noiseless simulators', 'bounded parameters', 'high accuracy'],
    complexity: 'high',
  },
  slsqp: {
    name: 'SLSQP',
    description: 'Sequential Least Squares Programming - constrained optimization',
    gradientBased: true,
    recommended: ['constrained problems', 'smooth landscapes'],
    complexity: 'high',
  },
  spsa: {
    name: 'SPSA',
    description: 'Simultaneous Perturbation Stochastic Approximation - shot-efficient',
    gradientBased: false,
    recommended: ['large parameter counts', 'noisy evaluations', 'shot-limited'],
    complexity: 'low',
  },
  qn_spsa: {
    name: 'QN-SPSA',
    description: 'Quantum Natural SPSA - second-order SPSA with Hessian estimation',
    gradientBased: false,
    recommended: ['shot-frugal optimization', 'ill-conditioned problems'],
    complexity: 'medium',
  },
  qng: {
    name: 'QNG',
    description: 'Quantum Natural Gradient - uses quantum geometry',
    gradientBased: true,
    recommended: ['fast convergence', 'research applications'],
    complexity: 'high',
  },
  rotosolve: {
    name: 'Rotosolve',
    description: 'Analytical single-parameter optimization',
    gradientBased: false,
    recommended: ['Pauli rotations', 'parameter-shift circuits'],
    complexity: 'low',
  },
}
