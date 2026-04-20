import { QMLCircuit } from '@/lib/qml/core/QMLCircuit'
import type { AnsatzConfig, AnsatzResult, AnsatzMetrics } from './types'
import {
  generateUCCSDPool,
  excitationToPauli,
  estimateUCCSDCircuitDepth,
  type UCCOperatorPool
} from '../operators/FermionicOperator'
import type { PauliOperator } from '../operators/PauliPool'

export interface UCCSDConfig extends AnsatzConfig {
  trotterOrder: 1 | 2
  trotterSteps: number
  includeTriples: boolean
  spinAdapted: boolean
}

export class UCCSDBuilder {
  private config: UCCSDConfig
  private operatorPool: UCCOperatorPool | null = null

  constructor(config: Partial<UCCSDConfig> & { numQubits: number; numElectrons: number }) {
    this.config = {
      type: 'uccsd',
      numQubits: config.numQubits,
      numElectrons: config.numElectrons,
      trotterOrder: config.trotterOrder ?? 1,
      trotterSteps: config.trotterSteps ?? 1,
      includeTriples: config.includeTriples ?? false,
      spinAdapted: config.spinAdapted ?? false,
      numLayers: config.numLayers ?? 1
    }
  }

  initialize(): void {
    this.operatorPool = generateUCCSDPool(
      this.config.numQubits,
      this.config.numElectrons ?? 0
    )
  }

  buildCircuit(): AnsatzResult {
    if (!this.operatorPool) {
      this.initialize()
    }

    const circuit = new QMLCircuit(this.config.numQubits)

    const numElectrons = this.config.numElectrons ?? 0
    for (let i = 0; i < numElectrons && i < this.config.numQubits; i++) {
      circuit.addGate('X', [i])
    }

    for (let step = 0; step < this.config.trotterSteps; step++) {
      if (this.config.trotterOrder === 1) {
        this.addFirstOrderTrotter(circuit)
      } else {
        this.addSecondOrderTrotter(circuit)
      }
    }

    const operatorsUsed = [
      ...this.operatorPool!.singles.map(op => op.label),
      ...this.operatorPool!.doubles.map(op => op.label)
    ]

    return {
      circuit,
      numParameters: circuit.getTrainableParameters().length,
      estimatedDepth: Math.ceil(circuit.getGates().length / this.config.numQubits),
      operatorsUsed
    }
  }

  private addFirstOrderTrotter(circuit: QMLCircuit): void {
    if (!this.operatorPool) return

    for (const single of this.operatorPool.singles) {
      const paulis = excitationToPauli(single, this.config.numQubits)
      this.addExcitationGenerator(circuit, paulis)
    }

    for (const double of this.operatorPool.doubles) {
      const paulis = excitationToPauli(double, this.config.numQubits)
      this.addExcitationGenerator(circuit, paulis)
    }
  }

  private addSecondOrderTrotter(circuit: QMLCircuit): void {
    if (!this.operatorPool) return

    const allOps = [...this.operatorPool.singles, ...this.operatorPool.doubles]

    for (const op of allOps) {
      const paulis = excitationToPauli(op, this.config.numQubits)
      this.addExcitationGenerator(circuit, paulis, 0.5)
    }

    for (let i = allOps.length - 1; i >= 0; i--) {
      const paulis = excitationToPauli(allOps[i], this.config.numQubits)
      this.addExcitationGenerator(circuit, paulis, 0.5)
    }
  }

  private addExcitationGenerator(
    circuit: QMLCircuit,
    paulis: PauliOperator[],
    scaleFactor: number = 1.0
  ): void {
    for (const pauli of paulis) {
      if (this.isAntihermitian(pauli.pauliString)) {
        this.addPauliExponential(circuit, pauli)
      }
    }
  }

  private isAntihermitian(pauliString: string): boolean {
    const yCount = (pauliString.match(/Y/g) || []).length
    return yCount % 2 === 1
  }

  private addPauliExponential(circuit: QMLCircuit, pauli: PauliOperator): void {
    const pauliString = pauli.pauliString
    const activeQubits: number[] = []

    for (let q = 0; q < pauliString.length; q++) {
      const p = pauliString[q]
      if (p !== 'I') {
        activeQubits.push(q)
      }
    }

    if (activeQubits.length === 0) return

    for (const q of activeQubits) {
      const p = pauliString[q]
      if (p === 'X') {
        circuit.addGate('H', [q])
      } else if (p === 'Y') {
        circuit.addGate('Sdg', [q])
        circuit.addGate('H', [q])
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

    for (let q = activeQubits.length - 1; q >= 0; q--) {
      const qubit = activeQubits[q]
      const p = pauliString[qubit]
      if (p === 'X') {
        circuit.addGate('H', [qubit])
      } else if (p === 'Y') {
        circuit.addGate('H', [qubit])
        circuit.addGate('S', [qubit])
      }
    }
  }

  getMetrics(): AnsatzMetrics {
    const estimate = estimateUCCSDCircuitDepth(
      this.config.numQubits,
      this.config.numElectrons ?? 0
    )

    const numSingles = this.operatorPool?.singles.length || 0
    const numDoubles = this.operatorPool?.doubles.length || 0

    return {
      numGates: estimate.gateCount,
      numCNOTs: Math.floor(estimate.gateCount * 0.3),
      numParameters: numSingles + numDoubles,
      estimatedDepth: estimate.estimatedDepth
    }
  }

  getDescription(): string {
    const metrics = this.getMetrics()
    return `UCCSD ansatz with ${metrics.numParameters} parameters, ` +
           `Trotter order ${this.config.trotterOrder}, ` +
           `${this.config.trotterSteps} steps`
  }
}

export function createUCCSDCircuit(
  numQubits: number,
  numElectrons: number,
  options?: Partial<UCCSDConfig>
): AnsatzResult {
  const builder = new UCCSDBuilder({
    numQubits,
    numElectrons,
    ...options
  })

  builder.initialize()
  return builder.buildCircuit()
}

export function estimateUCCSDResources(
  numQubits: number,
  numElectrons: number
): {
  numParameters: number
  estimatedGates: number
  estimatedCNOTs: number
  estimatedDepth: number
  memoryRequired: string
} {
  const estimate = estimateUCCSDCircuitDepth(numQubits, numElectrons)

  const memoryBytes = Math.pow(2, numQubits) * 16
  let memoryStr: string
  if (memoryBytes < 1024) {
    memoryStr = `${memoryBytes} B`
  } else if (memoryBytes < 1024 * 1024) {
    memoryStr = `${(memoryBytes / 1024).toFixed(1)} KB`
  } else if (memoryBytes < 1024 * 1024 * 1024) {
    memoryStr = `${(memoryBytes / (1024 * 1024)).toFixed(1)} MB`
  } else {
    memoryStr = `${(memoryBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const numOccupied = numElectrons
  const numVirtual = numQubits - numElectrons
  const numSingles = numOccupied * numVirtual
  const numDoubles = (numOccupied * (numOccupied - 1) / 2) * (numVirtual * (numVirtual - 1) / 2)

  return {
    numParameters: numSingles + numDoubles,
    estimatedGates: estimate.gateCount,
    estimatedCNOTs: Math.floor(estimate.gateCount * 0.3),
    estimatedDepth: estimate.estimatedDepth,
    memoryRequired: memoryStr
  }
}

export class PairedUCCGSD {
  private numQubits: number
  private numElectrons: number
  private kFactor: number

  constructor(numQubits: number, numElectrons: number, k: number = 1) {
    this.numQubits = numQubits
    this.numElectrons = numElectrons
    this.kFactor = k
  }

  buildCircuit(): AnsatzResult {
    const circuit = new QMLCircuit(this.numQubits)

    for (let i = 0; i < this.numElectrons && i < this.numQubits; i++) {
      circuit.addGate('X', [i])
    }

    for (let k = 0; k < this.kFactor; k++) {
      this.addPairedSingles(circuit)
      this.addPairedDoubles(circuit)
    }

    return {
      circuit,
      numParameters: circuit.getTrainableParameters().length,
      estimatedDepth: Math.ceil(circuit.getGates().length / this.numQubits),
      operatorsUsed: [`k=${this.kFactor} UpCCGSD`]
    }
  }

  private addPairedSingles(circuit: QMLCircuit): void {
    const numSpatial = Math.floor(this.numQubits / 2)

    for (let p = 0; p < numSpatial; p++) {
      for (let q = p + 1; q < numSpatial; q++) {
        const alphaP = 2 * p
        const alphaQ = 2 * q
        this.addOrbitalRotation(circuit, alphaP, alphaQ)

        const betaP = 2 * p + 1
        const betaQ = 2 * q + 1
        this.addOrbitalRotation(circuit, betaP, betaQ)
      }
    }
  }

  private addPairedDoubles(circuit: QMLCircuit): void {
    const numSpatial = Math.floor(this.numQubits / 2)

    for (let p = 0; p < numSpatial; p++) {
      for (let q = p + 1; q < numSpatial; q++) {
        const alphaP = 2 * p
        const betaP = 2 * p + 1
        const alphaQ = 2 * q
        const betaQ = 2 * q + 1

        this.addPairExcitation(circuit, [alphaP, betaP], [alphaQ, betaQ])
      }
    }
  }

  private addOrbitalRotation(circuit: QMLCircuit, from: number, to: number): void {
    const qubits = [from, to].sort((a, b) => a - b)

    circuit.addGate('CNOT', [qubits[0], qubits[1]])
    circuit.addParameterizedGate('Ry', qubits[0])
    circuit.addParameterizedGate('Ry', qubits[1])
    circuit.addGate('CNOT', [qubits[0], qubits[1]])
  }

  private addPairExcitation(
    circuit: QMLCircuit,
    from: number[],
    to: number[]
  ): void {
    const allQubits = [...from, ...to].sort((a, b) => a - b)

    for (let i = 0; i < allQubits.length - 1; i++) {
      circuit.addGate('CNOT', [allQubits[i], allQubits[i + 1]])
    }

    circuit.addParameterizedGate('Rz', allQubits[allQubits.length - 1])

    for (let i = allQubits.length - 2; i >= 0; i--) {
      circuit.addGate('CNOT', [allQubits[i], allQubits[i + 1]])
    }
  }
}

export function createPairedUCCGSD(
  numQubits: number,
  numElectrons: number,
  k: number = 1
): AnsatzResult {
  const builder = new PairedUCCGSD(numQubits, numElectrons, k)
  return builder.buildCircuit()
}
