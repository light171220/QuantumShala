import { QMLCircuit } from '@/lib/qml/core/QMLCircuit'
import type { MolecularHamiltonian } from '../../molecules/types'
import type { AdaptConfig, AdaptIteration, OperatorGradient, AnsatzResult } from './types'
import { generateUCCSDPool, excitationToPauli, type ExcitationOperator, type UCCOperatorPool } from '../operators/FermionicOperator'
import type { PauliOperator } from '../operators/PauliPool'

export class AdaptVQEBuilder {
  private config: AdaptConfig
  private operatorPool: UCCOperatorPool | null = null
  private selectedOperators: ExcitationOperator[] = []
  private iterationHistory: AdaptIteration[] = []

  constructor(config: AdaptConfig) {
    this.config = config
  }

  initialize(numQubits: number, numElectrons: number): void {
    this.operatorPool = generateUCCSDPool(numQubits, numElectrons)
    this.selectedOperators = []
    this.iterationHistory = []
  }

  computeOperatorGradients(
    circuit: QMLCircuit,
    hamiltonian: MolecularHamiltonian,
    epsilon: number = 1e-4
  ): OperatorGradient[] {
    if (!this.operatorPool) {
      throw new Error('Operator pool not initialized')
    }

    const gradients: OperatorGradient[] = []
    const allOperators = [...this.operatorPool.singles, ...this.operatorPool.doubles]

    for (const op of allOperators) {
      const gradient = this.computeSingleGradient(circuit, hamiltonian, op, epsilon)
      gradients.push({
        operatorLabel: op.label,
        pauliString: this.operatorToString(op),
        gradient,
        absGradient: Math.abs(gradient)
      })
    }

    return gradients.sort((a, b) => b.absGradient - a.absGradient)
  }

  private computeSingleGradient(
    circuit: QMLCircuit,
    hamiltonian: MolecularHamiltonian,
    operator: ExcitationOperator,
    epsilon: number
  ): number {
    const paulis = excitationToPauli(operator, this.config.numQubits)
    let gradient = 0

    for (const pauli of paulis) {
      const circuitPlus = this.appendOperatorRotation(circuit.clone(), pauli, epsilon)
      const circuitMinus = this.appendOperatorRotation(circuit.clone(), pauli, -epsilon)

      const energyPlus = this.computeEnergy(circuitPlus, hamiltonian)
      const energyMinus = this.computeEnergy(circuitMinus, hamiltonian)

      gradient += (energyPlus - energyMinus) / (2 * epsilon)
    }

    return gradient
  }

  private appendOperatorRotation(circuit: QMLCircuit, pauli: PauliOperator, angle: number): QMLCircuit {
    const pauliString = pauli.pauliString

    for (let q = 0; q < pauliString.length; q++) {
      const p = pauliString[q]
      if (p === 'X') {
        circuit.addGate('H', [q])
      } else if (p === 'Y') {
        circuit.addGate('Rx', [q], [Math.PI / 2])
      }
    }

    for (let q = 0; q < pauliString.length - 1; q++) {
      if (pauliString[q] !== 'I' && pauliString[q + 1] !== 'I') {
        circuit.addGate('CNOT', [q, q + 1])
      }
    }

    const lastActive = pauliString.split('').lastIndexOf('I') + 1
    circuit.addGate('Rz', [lastActive], [angle])

    for (let q = pauliString.length - 2; q >= 0; q--) {
      if (pauliString[q] !== 'I' && pauliString[q + 1] !== 'I') {
        circuit.addGate('CNOT', [q, q + 1])
      }
    }

    for (let q = 0; q < pauliString.length; q++) {
      const p = pauliString[q]
      if (p === 'X') {
        circuit.addGate('H', [q])
      } else if (p === 'Y') {
        circuit.addGate('Rx', [q], [-Math.PI / 2])
      }
    }

    return circuit
  }

  private computeEnergy(circuit: QMLCircuit, hamiltonian: MolecularHamiltonian): number {
    let energy = 0

    for (const term of hamiltonian.terms) {
      if (term.paulis.split('').every(p => p === 'I')) {
        energy += term.coefficient
      } else {
        const expectation = circuit.expectationPauli(term.paulis)
        energy += term.coefficient * expectation.value
      }
    }

    return energy
  }

  selectOperator(gradients: OperatorGradient[]): OperatorGradient | null {
    for (const grad of gradients) {
      if (grad.absGradient > this.config.gradientThreshold) {
        const alreadySelected = this.selectedOperators.some(op => op.label === grad.operatorLabel)
        if (!alreadySelected) {
          return grad
        }
      }
    }
    return null
  }

  addOperatorToCircuit(
    circuit: QMLCircuit,
    operatorLabel: string
  ): QMLCircuit {
    if (!this.operatorPool) {
      throw new Error('Operator pool not initialized')
    }

    const allOperators = [...this.operatorPool.singles, ...this.operatorPool.doubles]
    const operator = allOperators.find(op => op.label === operatorLabel)

    if (!operator) {
      throw new Error(`Operator ${operatorLabel} not found in pool`)
    }

    this.selectedOperators.push(operator)

    const paulis = excitationToPauli(operator, this.config.numQubits)

    for (const pauli of paulis) {
      this.addPauliRotation(circuit, pauli)
    }

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

  private operatorToString(op: ExcitationOperator): string {
    return op.label
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

  getSelectedOperators(): ExcitationOperator[] {
    return [...this.selectedOperators]
  }

  buildCircuit(): AnsatzResult {
    const circuit = new QMLCircuit(this.config.numQubits)

    const numElectrons = this.config.numElectrons || 2
    for (let i = 0; i < numElectrons && i < this.config.numQubits; i++) {
      circuit.addGate('X', [i])
    }

    for (const operator of this.selectedOperators) {
      const paulis = excitationToPauli(operator, this.config.numQubits)
      for (const pauli of paulis) {
        this.addPauliRotation(circuit, pauli)
      }
    }

    return {
      circuit,
      numParameters: circuit.getTrainableParameters().length,
      estimatedDepth: Math.ceil(circuit.getGates().length / this.config.numQubits),
      operatorsUsed: this.selectedOperators.map(op => op.label)
    }
  }

  shouldTerminate(): boolean {
    return this.selectedOperators.length >= this.config.maxOperators
  }
}

export function createAdaptVQEBuilder(config: Partial<AdaptConfig> & { numQubits: number }): AdaptVQEBuilder {
  const fullConfig: AdaptConfig = {
    type: 'adapt',
    numQubits: config.numQubits,
    numElectrons: config.numElectrons || 2,
    gradientThreshold: config.gradientThreshold ?? 1e-3,
    maxOperators: config.maxOperators ?? 50,
    operatorPoolType: config.operatorPoolType ?? 'fermionic'
  }

  return new AdaptVQEBuilder(fullConfig)
}

export async function runAdaptVQE(
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
    type: 'adapt',
    numQubits: hamiltonian.numQubits,
    numElectrons: config.numElectrons || 2,
    gradientThreshold: config.gradientThreshold ?? 1e-3,
    maxOperators: config.maxOperators ?? 20,
    operatorPoolType: config.operatorPoolType ?? 'fermionic'
  }

  const builder = new AdaptVQEBuilder(adaptConfig)
  builder.initialize(hamiltonian.numQubits, adaptConfig.numElectrons || 2)

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

    circuit = builder.addOperatorToCircuit(circuit, selectedOp.operatorLabel)

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
      selectedOperator: selectedOp.operatorLabel,
      gradient: selectedOp.absGradient,
      energy,
      numParameters: circuit.getTrainableParameters().length
    }

    builder.recordIteration(
      iteration,
      selectedOp.operatorLabel,
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
