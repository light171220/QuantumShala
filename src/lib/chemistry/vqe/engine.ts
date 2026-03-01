import { QMLCircuit, createHEACircuit } from '@/lib/qml/core/QMLCircuit'
import { createOptimizer, optimize, type Optimizer, type OptimizerConfig } from '@/lib/qml/core/Optimizer'
import type {
  MolecularHamiltonian,
  PauliTerm,
  VQEResult,
  VQEIterationData,
  VQEConfig,
  AnsatzConfig
} from '../molecules/types'
import { getHamiltonian } from '../molecules/database'

export class VQEEngine {
  private hamiltonian: MolecularHamiltonian
  private circuit: QMLCircuit
  private optimizer: Optimizer
  private config: VQEConfig
  private iterationHistory: VQEIterationData[] = []

  constructor(config: VQEConfig) {
    this.config = config

    const ham = getHamiltonian(config.molecule, config.bondLength)
    if (!ham) {
      throw new Error(`No Hamiltonian found for ${config.molecule} at ${config.bondLength} Å`)
    }
    this.hamiltonian = ham

    this.circuit = this.buildAnsatz(ham.numQubits, config.ansatz)

    this.optimizer = createOptimizer({
      type: config.optimizer.type as OptimizerConfig['type'],
      maxIterations: config.optimizer.maxIterations,
      tolerance: config.optimizer.tolerance,
      learningRate: config.optimizer.learningRate || 0.1
    })
  }

  private buildAnsatz(numQubits: number, config: AnsatzConfig): QMLCircuit {
    const circuit = new QMLCircuit(numQubits)

    switch (config.type) {
      case 'hea':
        circuit.buildHEA(
          config.numLayers || 2,
          config.entanglement || 'linear'
        )
        break

      case 'uccsd':
        this.buildUCCSD(circuit, numQubits, config.numLayers || 1)
        break

      case 'adaptive':
        circuit.buildHEA(1, 'linear')
        break

      default:
        circuit.buildHEA(2, 'linear')
    }

    circuit.initializeRandom(Math.PI / 2)
    return circuit
  }

  private buildUCCSD(circuit: QMLCircuit, numQubits: number, repetitions: number): void {
    for (let rep = 0; rep < repetitions; rep++) {
      for (let i = 0; i < numQubits - 1; i++) {
        circuit.addParameterizedGate('Ry', i)
        circuit.addParameterizedGate('Rz', i)
      }

      for (let i = 0; i < numQubits - 1; i++) {
        circuit.addGate('CNOT', [i, i + 1])
        circuit.addParameterizedGate('Ry', i + 1)
        circuit.addGate('CNOT', [i, i + 1])
      }

      circuit.addEntanglingLayer('linear')
    }
  }

  computeExpectation(circuit: QMLCircuit): number {
    let energy = 0

    for (const term of this.hamiltonian.terms) {
      if (term.paulis === 'I'.repeat(this.hamiltonian.numQubits)) {
        energy += term.coefficient
      } else {
        const expectation = circuit.expectationPauli(term.paulis)
        energy += term.coefficient * expectation.value
      }
    }

    return energy
  }

  private costFunction = (): number => {
    return this.computeExpectation(this.circuit)
  }

  private gradientFunction = (): number[] => {
    return this.circuit.computeGradient(() => this.costFunction())
  }

  run(callback?: (iteration: number, energy: number) => void): VQEResult {
    const initialParams = this.circuit.getParameterVector()
    this.iterationHistory = []

    let bestEnergy = Infinity
    let bestParams = [...initialParams]
    let iteration = 0

    const iterationCallback = (iter: number, energy: number, params: number[]) => {
      iteration = iter
      this.iterationHistory.push({
        iteration: iter,
        energy,
        parameters: [...params]
      })

      if (energy < bestEnergy) {
        bestEnergy = energy
        bestParams = [...params]
      }

      if (callback) {
        callback(iter, energy)
      }
    }

    const wrappedCostFunction = (params: number[]): number => {
      this.circuit.setParameterVector(params)
      return this.costFunction()
    }

    const wrappedGradientFunction = (params: number[]): number[] => {
      this.circuit.setParameterVector(params)
      return this.gradientFunction()
    }

    const result = optimize(
      initialParams,
      wrappedCostFunction,
      this.config.optimizer.type === 'adam' ? wrappedGradientFunction : null,
      this.optimizer,
      {
        maxIterations: this.config.optimizer.maxIterations,
        tolerance: this.config.optimizer.tolerance,
        callback: iterationCallback
      }
    )

    const errorFromExact = result.loss - this.hamiltonian.exactEnergy
    const errorInKcalMol = errorFromExact * 627.5094740631

    return {
      energy: result.loss,
      parameters: result.parameters,
      iterations: result.iterations,
      converged: result.converged,
      errorFromExact,
      errorInKcalMol,
      history: this.iterationHistory
    }
  }

  getCircuit(): QMLCircuit {
    return this.circuit
  }

  getHamiltonian(): MolecularHamiltonian {
    return this.hamiltonian
  }

  getHistory(): VQEIterationData[] {
    return [...this.iterationHistory]
  }

  reset(): void {
    this.circuit.initializeRandom(Math.PI / 2)
    this.iterationHistory = []
    this.optimizer.reset()
  }

  setParameters(params: number[]): void {
    this.circuit.setParameterVector(params)
  }
}

export function createVQEEngine(
  moleculeId: string,
  bondLength?: number,
  ansatzType: 'hea' | 'uccsd' = 'hea',
  numLayers: number = 2
): VQEEngine {
  const hamiltonian = getHamiltonian(moleculeId, bondLength || 0)
  if (!hamiltonian) {
    throw new Error(`Molecule ${moleculeId} not found`)
  }

  return new VQEEngine({
    molecule: moleculeId,
    bondLength: bondLength || 0.74,
    ansatz: {
      type: ansatzType,
      numLayers,
      entanglement: 'linear'
    },
    optimizer: {
      type: 'cobyla',
      maxIterations: 100,
      tolerance: 1e-6
    }
  })
}

export async function runBondLengthScan(
  moleculeId: string,
  bondLengths: number[],
  ansatzConfig?: AnsatzConfig,
  callback?: (bondLength: number, energy: number, progress: number) => void
): Promise<{ bondLength: number; vqeEnergy: number; exactEnergy: number }[]> {
  const results: { bondLength: number; vqeEnergy: number; exactEnergy: number }[] = []

  for (let i = 0; i < bondLengths.length; i++) {
    const bondLength = bondLengths[i]
    const hamiltonian = getHamiltonian(moleculeId, bondLength)

    if (!hamiltonian) continue

    const engine = new VQEEngine({
      molecule: moleculeId,
      bondLength,
      ansatz: ansatzConfig || { type: 'hea', numLayers: 2, entanglement: 'linear' },
      optimizer: { type: 'cobyla', maxIterations: 50, tolerance: 1e-5 }
    })

    const result = engine.run()

    results.push({
      bondLength,
      vqeEnergy: result.energy,
      exactEnergy: hamiltonian.exactEnergy
    })

    if (callback) {
      callback(bondLength, result.energy, (i + 1) / bondLengths.length)
    }
  }

  return results
}

export function computePauliExpectation(circuit: QMLCircuit, pauliString: string): number {
  return circuit.expectationPauli(pauliString).value
}

export function computeHamiltonianExpectation(
  circuit: QMLCircuit,
  hamiltonian: MolecularHamiltonian
): number {
  let energy = 0

  for (const term of hamiltonian.terms) {
    const isIdentity = term.paulis.split('').every(p => p === 'I')
    if (isIdentity) {
      energy += term.coefficient
    } else {
      const expectation = circuit.expectationPauli(term.paulis)
      energy += term.coefficient * expectation.value
    }
  }

  return energy
}
