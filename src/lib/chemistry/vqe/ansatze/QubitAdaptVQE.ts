import { QMLCircuit } from '@/lib/qml/core/QMLCircuit'
import type { MolecularHamiltonian } from '../../molecules/types'
import type { AdaptConfig, AdaptIteration, OperatorGradient, AnsatzResult } from './types'
import { generateQubitAdaptPool, type PauliOperator, type OperatorPool } from '../operators/PauliPool'

export class QubitAdaptVQEBuilder {
  private config: AdaptConfig
  private operatorPool: OperatorPool | null = null
  private selectedOperators: PauliOperator[] = []
  private iterationHistory: AdaptIteration[] = []

  constructor(config: AdaptConfig) {
    this.config = config
  }

  initialize(numQubits: number): void {
    this.operatorPool = generateQubitAdaptPool(numQubits)
    this.selectedOperators = []
    this.iterationHistory = []
  }

  computeOperatorGradients(
    circuit: QMLCircuit,
    hamiltonian: MolecularHamiltonian
  ): OperatorGradient[] {
    if (!this.operatorPool) {
      throw new Error('Operator pool not initialized')
    }

    const gradients: OperatorGradient[] = []

    for (const op of this.operatorPool.operators) {
      const gradient = this.computeCommutatorGradient(circuit, hamiltonian, op)
      gradients.push({
        operatorLabel: op.label || op.pauliString,
        pauliString: op.pauliString,
        gradient,
        absGradient: Math.abs(gradient)
      })
    }

    return gradients.sort((a, b) => b.absGradient - a.absGradient)
  }

  private computeCommutatorGradient(
    circuit: QMLCircuit,
    hamiltonian: MolecularHamiltonian,
    operator: PauliOperator
  ): number {
    let gradient = 0

    for (const term of hamiltonian.terms) {
      if (term.paulis.split('').every(p => p === 'I')) continue

      if (!this.operatorsCommute(operator.pauliString, term.paulis)) {
        const commutatorExpectation = this.evaluateCommutatorExpectation(
          circuit,
          operator.pauliString,
          term.paulis
        )
        gradient += term.coefficient * commutatorExpectation
      }
    }

    return gradient
  }

  private operatorsCommute(p1: string, p2: string): boolean {
    let anticommutingPairs = 0

    for (let i = 0; i < p1.length; i++) {
      if (p1[i] !== 'I' && p2[i] !== 'I' && p1[i] !== p2[i]) {
        anticommutingPairs++
      }
    }

    return anticommutingPairs % 2 === 0
  }

  private evaluateCommutatorExpectation(
    circuit: QMLCircuit,
    p1: string,
    p2: string
  ): number {
    const { result: productString, phase } = this.multiplyPauliStrings(p1, p2)

    if (phase === 0) return 0

    const expectation = circuit.expectationPauli(productString)
    return 2 * phase * expectation.value
  }

  private multiplyPauliStrings(p1: string, p2: string): { result: string; phase: number } {
    let phase = 0
    const result: string[] = []

    for (let i = 0; i < p1.length; i++) {
      const a = p1[i]
      const b = p2[i]

      if (a === 'I') {
        result.push(b)
      } else if (b === 'I') {
        result.push(a)
      } else if (a === b) {
        result.push('I')
      } else {
        const products: Record<string, { r: string; p: number }> = {
          'XY': { r: 'Z', p: 1 },
          'YX': { r: 'Z', p: -1 },
          'YZ': { r: 'X', p: 1 },
          'ZY': { r: 'X', p: -1 },
          'ZX': { r: 'Y', p: 1 },
          'XZ': { r: 'Y', p: -1 },
        }
        const key = a + b
        result.push(products[key].r)
        phase += products[key].p
      }
    }

    return { result: result.join(''), phase }
  }

  selectOperator(gradients: OperatorGradient[]): OperatorGradient | null {
    for (const grad of gradients) {
      if (grad.absGradient > this.config.gradientThreshold) {
        const alreadySelected = this.selectedOperators.some(
          op => op.pauliString === grad.pauliString
        )
        if (!alreadySelected) {
          return grad
        }
      }
    }
    return null
  }

  addOperatorToCircuit(
    circuit: QMLCircuit,
    pauliString: string
  ): QMLCircuit {
    const operator: PauliOperator = {
      pauliString,
      coefficient: 1.0
    }

    this.selectedOperators.push(operator)
    this.addPauliRotation(circuit, operator)

    return circuit
  }

  private addPauliRotation(circuit: QMLCircuit, pauli: PauliOperator): void {
    const pauliString = pauli.pauliString
    const activeQubits: number[] = []

    for (let q = 0; q < pauliString.length; q++) {
      const p = pauliString[q]
      if (p !== 'I') {
        activeQubits.push(q)
        if (p === 'X') {
          circuit.addGate('H', [q])
        } else if (p === 'Y') {
          circuit.addGate('Sdg', [q])
          circuit.addGate('H', [q])
        }
      }
    }

    for (let i = 0; i < activeQubits.length - 1; i++) {
      circuit.addGate('CNOT', [activeQubits[i], activeQubits[i + 1]])
    }

    const lastQubit = activeQubits[activeQubits.length - 1]
    circuit.addParameterizedGate('Rz', lastQubit)

    for (let i = activeQubits.length - 2; i >= 0; i--) {
      circuit.addGate('CNOT', [activeQubits[i], activeQubits[i + 1]])
    }

    for (let q = pauliString.length - 1; q >= 0; q--) {
      const p = pauliString[q]
      if (p === 'X') {
        circuit.addGate('H', [q])
      } else if (p === 'Y') {
        circuit.addGate('H', [q])
        circuit.addGate('S', [q])
      }
    }
  }

  recordIteration(
    iteration: number,
    selectedOperator: string,
    gradient: number,
    energy: number,
    numParameters: number
  ): void {
    this.iterationHistory.push({
      iteration,
      selectedOperator,
      gradient,
      energy,
      numParameters
    })
  }

  getHistory(): AdaptIteration[] {
    return [...this.iterationHistory]
  }

  getSelectedOperators(): PauliOperator[] {
    return [...this.selectedOperators]
  }

  buildCircuit(): AnsatzResult {
    const circuit = new QMLCircuit(this.config.numQubits)

    const numElectrons = this.config.numElectrons || 2
    for (let i = 0; i < numElectrons && i < this.config.numQubits; i++) {
      circuit.addGate('X', [i])
    }

    for (const operator of this.selectedOperators) {
      this.addPauliRotation(circuit, operator)
    }

    return {
      circuit,
      numParameters: circuit.getTrainableParameters().length,
      estimatedDepth: Math.ceil(circuit.getGates().length / this.config.numQubits),
      operatorsUsed: this.selectedOperators.map(op => op.pauliString)
    }
  }

  shouldTerminate(): boolean {
    return this.selectedOperators.length >= this.config.maxOperators
  }
}

export function createQubitAdaptBuilder(config: Partial<AdaptConfig> & { numQubits: number }): QubitAdaptVQEBuilder {
  const fullConfig: AdaptConfig = {
    type: 'qubit_adapt',
    numQubits: config.numQubits,
    numElectrons: config.numElectrons || 2,
    gradientThreshold: config.gradientThreshold ?? 1e-3,
    maxOperators: config.maxOperators ?? 30,
    operatorPoolType: 'qubit'
  }

  return new QubitAdaptVQEBuilder(fullConfig)
}

export async function runQubitAdaptVQE(
  hamiltonian: MolecularHamiltonian,
  config: Partial<AdaptConfig>,
  onIteration?: (iteration: AdaptIteration) => void
): Promise<{
  circuit: QMLCircuit
  energy: number
  iterations: AdaptIteration[]
  converged: boolean
}> {
  const adaptConfig: AdaptConfig = {
    type: 'qubit_adapt',
    numQubits: hamiltonian.numQubits,
    numElectrons: config.numElectrons || 2,
    gradientThreshold: config.gradientThreshold ?? 1e-3,
    maxOperators: config.maxOperators ?? 20,
    operatorPoolType: 'qubit'
  }

  const builder = new QubitAdaptVQEBuilder(adaptConfig)
  builder.initialize(hamiltonian.numQubits)

  let circuit = new QMLCircuit(hamiltonian.numQubits)

  const numElectrons = adaptConfig.numElectrons || 2
  for (let i = 0; i < numElectrons && i < hamiltonian.numQubits; i++) {
    circuit.addGate('X', [i])
  }

  let iteration = 0
  let converged = false

  while (!builder.shouldTerminate() && iteration < adaptConfig.maxOperators) {
    const gradients = builder.computeOperatorGradients(circuit, hamiltonian)

    const selectedOp = builder.selectOperator(gradients)

    if (!selectedOp) {
      converged = true
      break
    }

    circuit = builder.addOperatorToCircuit(circuit, selectedOp.pauliString)

    circuit.initializeRandom(0.1)

    let energy = 0
    for (const term of hamiltonian.terms) {
      if (term.paulis.split('').every(p => p === 'I')) {
        energy += term.coefficient
      } else {
        const expectation = circuit.expectationPauli(term.paulis)
        energy += term.coefficient * expectation.value
      }
    }

    const iterData: AdaptIteration = {
      iteration,
      selectedOperator: selectedOp.pauliString,
      gradient: selectedOp.absGradient,
      energy,
      numParameters: circuit.getTrainableParameters().length
    }

    builder.recordIteration(
      iteration,
      selectedOp.pauliString,
      selectedOp.absGradient,
      energy,
      circuit.getTrainableParameters().length
    )

    if (onIteration) {
      onIteration(iterData)
    }

    iteration++
  }

  let finalEnergy = 0
  for (const term of hamiltonian.terms) {
    if (term.paulis.split('').every(p => p === 'I')) {
      finalEnergy += term.coefficient
    } else {
      const expectation = circuit.expectationPauli(term.paulis)
      finalEnergy += term.coefficient * expectation.value
    }
  }

  return {
    circuit,
    energy: finalEnergy,
    iterations: builder.getHistory(),
    converged
  }
}
