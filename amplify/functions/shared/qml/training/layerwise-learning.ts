import { Circuit } from '../../quantum-core'
import type { OptimizerConfig } from '../../types'
import { createOptimizer } from '../../optimizers'

export interface LayerwiseConfig {
  numLayers: number
  paramsPerLayer: number
  freezePreviousLayers: boolean
  warmStartNextLayer: boolean
  iterationsPerLayer: number
}

export interface LayerwiseResult {
  parameters: number[]
  layerHistory: {
    layer: number
    finalLoss: number
    iterations: number
  }[]
  totalIterations: number
  finalLoss: number
}

export class LayerwiseLearning {
  private config: LayerwiseConfig
  private optimizerConfig: OptimizerConfig

  constructor(config: LayerwiseConfig, optimizerConfig: OptimizerConfig) {
    this.config = config
    this.optimizerConfig = optimizerConfig
  }

  train(
    buildCircuitFn: (numLayers: number) => Circuit,
    costFn: (circuit: Circuit, params: number[]) => number
  ): LayerwiseResult {
    const layerHistory: { layer: number; finalLoss: number; iterations: number }[] = []
    let allParams: number[] = []
    let totalIterations = 0

    for (let layer = 1; layer <= this.config.numLayers; layer++) {
      const circuit = buildCircuitFn(layer)
      const numParams = circuit.getParameterCount()

      let initialParams: number[]
      if (this.config.warmStartNextLayer && allParams.length > 0) {
        initialParams = [
          ...allParams,
          ...Array(numParams - allParams.length).fill(0).map(() => Math.random() * 0.1),
        ]
      } else {
        initialParams = Array(numParams).fill(0).map(() => Math.random() * 0.1)
      }

      const trainableStart = this.config.freezePreviousLayers
        ? (layer - 1) * this.config.paramsPerLayer
        : 0

      const wrappedCostFn = (trainableParams: number[]): number => {
        const fullParams = [...initialParams]
        for (let i = 0; i < trainableParams.length; i++) {
          fullParams[trainableStart + i] = trainableParams[i]
        }
        circuit.setParameters(fullParams)
        return costFn(circuit, fullParams)
      }

      const trainableParams = initialParams.slice(trainableStart)

      const optimizer = createOptimizer({
        ...this.optimizerConfig,
        maxIterations: this.config.iterationsPerLayer,
      })

      const result = optimizer.optimize(trainableParams, wrappedCostFn)

      allParams = [...initialParams]
      for (let i = 0; i < result.parameters.length; i++) {
        allParams[trainableStart + i] = result.parameters[i]
      }

      layerHistory.push({
        layer,
        finalLoss: result.value,
        iterations: result.iterations,
      })

      totalIterations += result.iterations
    }

    return {
      parameters: allParams,
      layerHistory,
      totalIterations,
      finalLoss: layerHistory[layerHistory.length - 1]?.finalLoss ?? 0,
    }
  }
}
