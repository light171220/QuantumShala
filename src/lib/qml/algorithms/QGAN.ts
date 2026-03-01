import { QMLCircuit } from '../core/QMLCircuit'
import { createOptimizer, type Optimizer, type OptimizerType } from '../core/Optimizer'

export interface QGANConfig {
  numQubits: number
  generatorLayers: number
  discriminatorLayers: number
  latentDim: number
  optimizerType: OptimizerType
  learningRate: number
  maxIterations: number
}

export interface QGANTrainingResult {
  generatorLoss: number[]
  discriminatorLoss: number[]
  generatorParameters: number[]
  discriminatorParameters: number[]
  epochs: number
}

export class QGAN {
  private config: QGANConfig
  private generator: QMLCircuit
  private discriminator: QMLCircuit
  private genOptimizer: Optimizer
  private discOptimizer: Optimizer

  constructor(config: Partial<QGANConfig> = {}) {
    this.config = {
      numQubits: config.numQubits || 4,
      generatorLayers: config.generatorLayers || 3,
      discriminatorLayers: config.discriminatorLayers || 3,
      latentDim: config.latentDim || 2,
      optimizerType: config.optimizerType || 'adam',
      learningRate: config.learningRate || 0.1,
      maxIterations: config.maxIterations || 100
    }

    this.generator = this.buildGenerator()
    this.discriminator = this.buildDiscriminator()

    this.genOptimizer = createOptimizer({
      type: this.config.optimizerType,
      learningRate: this.config.learningRate
    })

    this.discOptimizer = createOptimizer({
      type: this.config.optimizerType,
      learningRate: this.config.learningRate
    })
  }

  private buildGenerator(): QMLCircuit {
    const circuit = new QMLCircuit(this.config.numQubits)

    for (let q = 0; q < this.config.numQubits; q++) {
      circuit.addGate('H', [q])
    }

    for (let layer = 0; layer < this.config.generatorLayers; layer++) {
      for (let q = 0; q < this.config.numQubits; q++) {
        circuit.addParameterizedGate('Ry', q)
        circuit.addParameterizedGate('Rz', q)
      }

      for (let q = 0; q < this.config.numQubits - 1; q++) {
        circuit.addGate('CNOT', [q, q + 1])
      }
      if (this.config.numQubits > 2) {
        circuit.addGate('CNOT', [this.config.numQubits - 1, 0])
      }
    }

    for (let q = 0; q < this.config.numQubits; q++) {
      circuit.addParameterizedGate('Ry', q)
    }

    circuit.initializeRandom()
    return circuit
  }

  private buildDiscriminator(): QMLCircuit {
    const circuit = new QMLCircuit(this.config.numQubits)

    for (let layer = 0; layer < this.config.discriminatorLayers; layer++) {
      for (let q = 0; q < this.config.numQubits; q++) {
        circuit.addParameterizedGate('Ry', q)
        circuit.addParameterizedGate('Rz', q)
      }

      for (let q = 0; q < this.config.numQubits - 1; q++) {
        circuit.addGate('CNOT', [q, q + 1])
      }
    }

    for (let q = 0; q < this.config.numQubits; q++) {
      circuit.addParameterizedGate('Ry', q)
    }

    circuit.initializeRandom()
    return circuit
  }

  generate(latentVector?: number[]): number[] {
    if (latentVector) {
      const numParams = Math.min(latentVector.length, this.config.latentDim)
      for (let i = 0; i < numParams; i++) {
        const params = this.generator.getParameterVector()
        params[i] = latentVector[i]
        this.generator.setParameterVector(params)
      }
    }

    const stateVector = this.generator.execute()

    const output: number[] = []
    for (let q = 0; q < this.config.numQubits; q++) {
      const expectation = this.generator.expectationZ([q]).value
      output.push((1 - expectation) / 2)
    }

    return output
  }

  discriminate(data: number[]): number {
    const circuit = new QMLCircuit(this.config.numQubits)

    for (let q = 0; q < Math.min(data.length, this.config.numQubits); q++) {
      circuit.addGate('Ry', [q], [data[q] * Math.PI])
    }

    const discGates = this.discriminator.toSimulatorGates()
    for (const gate of discGates) {
      if (gate.parameters && gate.parameters.length > 0) {
        circuit.addGate(gate.type, gate.qubits, gate.parameters, gate.controlQubits)
      } else {
        circuit.addGate(gate.type, gate.qubits, undefined, gate.controlQubits)
      }
    }

    const expectation = circuit.expectationZ([0]).value
    return (1 - expectation) / 2
  }

  private computeDiscriminatorLoss(realData: number[][], fakeData: number[][]): number {
    let loss = 0

    for (const real of realData) {
      const pred = this.discriminate(real)
      loss -= Math.log(pred + 1e-10)
    }

    for (const fake of fakeData) {
      const pred = this.discriminate(fake)
      loss -= Math.log(1 - pred + 1e-10)
    }

    return loss / (realData.length + fakeData.length)
  }

  private computeGeneratorLoss(fakeData: number[][]): number {
    let loss = 0

    for (const fake of fakeData) {
      const pred = this.discriminate(fake)
      loss -= Math.log(pred + 1e-10)
    }

    return loss / fakeData.length
  }

  train(
    realData: number[][],
    callback?: (epoch: number, genLoss: number, discLoss: number) => void
  ): QGANTrainingResult {
    const result: QGANTrainingResult = {
      generatorLoss: [],
      discriminatorLoss: [],
      generatorParameters: [],
      discriminatorParameters: [],
      epochs: 0
    }

    const batchSize = Math.min(16, realData.length)

    for (let epoch = 0; epoch < this.config.maxIterations; epoch++) {
      const batchIndices = Array.from({ length: batchSize }, () =>
        Math.floor(Math.random() * realData.length)
      )
      const realBatch = batchIndices.map(i => realData[i])

      const fakeBatch: number[][] = []
      for (let i = 0; i < batchSize; i++) {
        const latent = Array.from({ length: this.config.latentDim }, () => Math.random() * 2 * Math.PI)
        fakeBatch.push(this.generate(latent))
      }

      const discCostFn = (): number => {
        return this.computeDiscriminatorLoss(realBatch, fakeBatch)
      }

      const discGradients = this.discriminator.computeGradient(() => discCostFn())
      const discParams = this.discOptimizer.step(this.discriminator.getParameterVector(), discGradients)
      this.discriminator.setParameterVector(discParams)

      const newFakeBatch: number[][] = []
      for (let i = 0; i < batchSize; i++) {
        const latent = Array.from({ length: this.config.latentDim }, () => Math.random() * 2 * Math.PI)
        newFakeBatch.push(this.generate(latent))
      }

      const genCostFn = (): number => {
        const generated: number[][] = []
        for (let i = 0; i < batchSize; i++) {
          generated.push(this.generate())
        }
        return this.computeGeneratorLoss(generated)
      }

      const genGradients = this.generator.computeGradient(() => genCostFn())
      const genParams = this.genOptimizer.step(this.generator.getParameterVector(), genGradients)
      this.generator.setParameterVector(genParams)

      const discLoss = this.computeDiscriminatorLoss(realBatch, newFakeBatch)
      const genLoss = this.computeGeneratorLoss(newFakeBatch)

      result.discriminatorLoss.push(discLoss)
      result.generatorLoss.push(genLoss)

      if (callback) {
        callback(epoch, genLoss, discLoss)
      }

      result.epochs = epoch + 1
    }

    result.generatorParameters = this.generator.getParameterVector()
    result.discriminatorParameters = this.discriminator.getParameterVector()

    return result
  }

  generateSamples(numSamples: number): number[][] {
    const samples: number[][] = []

    for (let i = 0; i < numSamples; i++) {
      const latent = Array.from({ length: this.config.latentDim }, () => Math.random() * 2 * Math.PI)
      samples.push(this.generate(latent))
    }

    return samples
  }

  getGeneratorParameters(): number[] {
    return this.generator.getParameterVector()
  }

  getDiscriminatorParameters(): number[] {
    return this.discriminator.getParameterVector()
  }

  setGeneratorParameters(params: number[]): void {
    this.generator.setParameterVector(params)
  }

  setDiscriminatorParameters(params: number[]): void {
    this.discriminator.setParameterVector(params)
  }
}

export function createQGAN(numQubits: number = 4, numLayers: number = 3): QGAN {
  return new QGAN({
    numQubits,
    generatorLayers: numLayers,
    discriminatorLayers: numLayers
  })
}
