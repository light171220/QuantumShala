import type { AnsatzConfig, Hamiltonian } from '../types'
import { Circuit, CircuitMetrics } from '../quantum-core/circuit'

export interface AnsatzBuilder {
  buildCircuit(params: number[]): Circuit
  getParameterCount(): number
  getMetrics(): CircuitMetrics
  getInitialParameters(): number[]
}

export function createAnsatzBuilder(
  config: AnsatzConfig,
  numQubits: number,
  numElectrons: number,
  hamiltonian?: Hamiltonian
): AnsatzBuilder {
  switch (config.type) {
    case 'hea':
      return new HEAAnsatzBuilder(config, numQubits)
    case 'uccsd':
      return new UCCSDBuilder(config, numQubits, numElectrons)
    case 'k_upccgsd':
      return new KUpCCGSDBuilder(config, numQubits, numElectrons)
    case 'adapt':
    case 'qubit_adapt':
      return new AdaptVQEBuilder(config, numQubits, numElectrons, hamiltonian)
    case 'symmetry_preserved':
      return new SymmetryPreservedBuilder(config, numQubits, numElectrons)
    default:
      return new HEAAnsatzBuilder(config, numQubits)
  }
}

export class HEAAnsatzBuilder implements AnsatzBuilder {
  private config: AnsatzConfig
  private numQubits: number
  private paramCount: number

  constructor(config: AnsatzConfig, numQubits: number) {
    this.config = config
    this.numQubits = numQubits
    const layers = config.layers ?? 2
    this.paramCount = 2 * numQubits * (layers + 1)
  }

  buildCircuit(params: number[]): Circuit {
    const circuit = new Circuit(this.numQubits)
    const layers = this.config.layers ?? 2
    const entanglement = this.config.entanglement ?? 'linear'
    let paramIdx = 0

    for (let layer = 0; layer < layers; layer++) {
      for (let q = 0; q < this.numQubits; q++) {
        circuit.ry(q, params[paramIdx++])
        circuit.rz(q, params[paramIdx++])
      }

      this.addEntanglement(circuit, entanglement)
    }

    for (let q = 0; q < this.numQubits; q++) {
      circuit.ry(q, params[paramIdx++])
      circuit.rz(q, params[paramIdx++])
    }

    return circuit
  }

  private addEntanglement(circuit: Circuit, type: string): void {
    switch (type) {
      case 'linear':
        for (let q = 0; q < this.numQubits - 1; q++) {
          circuit.cnot(q, q + 1)
        }
        break
      case 'circular':
        for (let q = 0; q < this.numQubits - 1; q++) {
          circuit.cnot(q, q + 1)
        }
        if (this.numQubits > 2) {
          circuit.cnot(this.numQubits - 1, 0)
        }
        break
      case 'full':
        for (let q1 = 0; q1 < this.numQubits; q1++) {
          for (let q2 = q1 + 1; q2 < this.numQubits; q2++) {
            circuit.cnot(q1, q2)
          }
        }
        break
      case 'pairwise':
        for (let q = 0; q < this.numQubits - 1; q += 2) {
          circuit.cnot(q, q + 1)
        }
        for (let q = 1; q < this.numQubits - 1; q += 2) {
          circuit.cnot(q, q + 1)
        }
        break
      case 'sca':
        for (let q = 0; q < this.numQubits - 1; q++) {
          circuit.cnot(q, q + 1)
        }
        for (let q = this.numQubits - 1; q > 0; q--) {
          circuit.cnot(q, q - 1)
        }
        break
    }
  }

  getParameterCount(): number {
    return this.paramCount
  }

  getMetrics(): CircuitMetrics {
    const dummyParams = new Array(this.paramCount).fill(0)
    return this.buildCircuit(dummyParams).getMetrics()
  }

  getInitialParameters(): number[] {
    return new Array(this.paramCount).fill(0).map(() => (Math.random() - 0.5) * 0.1)
  }
}

export class UCCSDBuilder implements AnsatzBuilder {
  private config: AnsatzConfig
  private numQubits: number
  private numElectrons: number
  private singles: [number, number][] = []
  private doubles: [number, number, number, number][] = []
  private paramCount: number

  constructor(config: AnsatzConfig, numQubits: number, numElectrons: number) {
    this.config = config
    this.numQubits = numQubits
    this.numElectrons = numElectrons
    this.generateExcitations()
    this.paramCount = this.singles.length + this.doubles.length
  }

  private generateExcitations(): void {
    const numOccupied = this.numElectrons
    const numVirtual = this.numQubits - numOccupied

    for (let i = 0; i < numOccupied; i++) {
      for (let a = numOccupied; a < this.numQubits; a++) {
        this.singles.push([i, a])
      }
    }

    for (let i = 0; i < numOccupied; i++) {
      for (let j = i + 1; j < numOccupied; j++) {
        for (let a = numOccupied; a < this.numQubits; a++) {
          for (let b = a + 1; b < this.numQubits; b++) {
            this.doubles.push([i, j, a, b])
          }
        }
      }
    }
  }

  buildCircuit(params: number[]): Circuit {
    const circuit = new Circuit(this.numQubits)
    const trotterOrder = this.config.trotterOrder ?? 1

    for (let i = 0; i < this.numElectrons; i++) {
      circuit.x(i)
    }

    for (let trotter = 0; trotter < trotterOrder; trotter++) {
      const scale = 1 / trotterOrder

      let paramIdx = 0
      for (const [i, a] of this.singles) {
        const theta = params[paramIdx] * scale
        this.addSingleExcitation(circuit, i, a, theta)
        paramIdx++
      }

      for (const [i, j, a, b] of this.doubles) {
        const theta = params[paramIdx] * scale
        this.addDoubleExcitation(circuit, i, j, a, b, theta)
        paramIdx++
      }
    }

    return circuit
  }

  private addSingleExcitation(circuit: Circuit, i: number, a: number, theta: number): void {
    circuit.cnot(i, a)
    circuit.ry(i, theta / 2)
    circuit.cnot(a, i)
    circuit.ry(i, -theta / 2)
    circuit.cnot(a, i)
    circuit.cnot(i, a)
  }

  private addDoubleExcitation(circuit: Circuit, i: number, j: number, a: number, b: number, theta: number): void {
    const qubits = [i, j, a, b].sort((x, y) => x - y)

    for (let q = 0; q < qubits.length - 1; q++) {
      circuit.cnot(qubits[q], qubits[q + 1])
    }

    circuit.rz(qubits[qubits.length - 1], theta)

    for (let q = qubits.length - 2; q >= 0; q--) {
      circuit.cnot(qubits[q], qubits[q + 1])
    }
  }

  getParameterCount(): number {
    return this.paramCount
  }

  getMetrics(): CircuitMetrics {
    const dummyParams = new Array(this.paramCount).fill(0)
    return this.buildCircuit(dummyParams).getMetrics()
  }

  getInitialParameters(): number[] {
    return new Array(this.paramCount).fill(0)
  }
}

export class KUpCCGSDBuilder implements AnsatzBuilder {
  private config: AnsatzConfig
  private numQubits: number
  private numElectrons: number
  private kFactor: number
  private paramCount: number

  constructor(config: AnsatzConfig, numQubits: number, numElectrons: number) {
    this.config = config
    this.numQubits = numQubits
    this.numElectrons = numElectrons
    this.kFactor = config.kFactor ?? 1

    const numOrbitals = numQubits / 2
    const singlesCount = numOrbitals * (numOrbitals - 1)
    const doublesCount = numOrbitals * (numOrbitals - 1) / 2

    this.paramCount = this.kFactor * (singlesCount + doublesCount)
  }

  buildCircuit(params: number[]): Circuit {
    const circuit = new Circuit(this.numQubits)

    for (let i = 0; i < this.numElectrons; i++) {
      circuit.x(i)
    }

    let paramIdx = 0
    const numOrbitals = this.numQubits / 2

    for (let k = 0; k < this.kFactor; k++) {
      for (let p = 0; p < numOrbitals; p++) {
        for (let q = p + 1; q < numOrbitals; q++) {
          const theta = params[paramIdx++]

          const alphaP = 2 * p
          const alphaQ = 2 * q
          const betaP = 2 * p + 1
          const betaQ = 2 * q + 1

          this.addOrbitalRotation(circuit, alphaP, alphaQ, theta)
          this.addOrbitalRotation(circuit, betaP, betaQ, theta)
        }
      }

      for (let p = 0; p < numOrbitals; p++) {
        for (let q = p + 1; q < numOrbitals; q++) {
          if (paramIdx < params.length) {
            const theta = params[paramIdx++]
            this.addPairExcitation(circuit, p, q, theta)
          }
        }
      }
    }

    return circuit
  }

  private addOrbitalRotation(circuit: Circuit, p: number, q: number, theta: number): void {
    circuit.cnot(p, q)
    circuit.ry(p, theta)
    circuit.cnot(q, p)
    circuit.ry(p, -theta)
    circuit.cnot(q, p)
    circuit.cnot(p, q)
  }

  private addPairExcitation(circuit: Circuit, p: number, q: number, theta: number): void {
    const alphaP = 2 * p
    const betaP = 2 * p + 1
    const alphaQ = 2 * q
    const betaQ = 2 * q + 1

    circuit.cnot(alphaP, alphaQ)
    circuit.cnot(betaP, betaQ)
    circuit.cnot(alphaQ, betaQ)
    circuit.rz(betaQ, theta)
    circuit.cnot(alphaQ, betaQ)
    circuit.cnot(betaP, betaQ)
    circuit.cnot(alphaP, alphaQ)
  }

  getParameterCount(): number {
    return this.paramCount
  }

  getMetrics(): CircuitMetrics {
    const dummyParams = new Array(this.paramCount).fill(0)
    return this.buildCircuit(dummyParams).getMetrics()
  }

  getInitialParameters(): number[] {
    return new Array(this.paramCount).fill(0)
  }
}

export class AdaptVQEBuilder implements AnsatzBuilder {
  private config: AnsatzConfig
  private numQubits: number
  private numElectrons: number
  private hamiltonian?: Hamiltonian
  private selectedOperators: { type: string; indices: number[]; pauliString?: string }[] = []
  private parameters: number[] = []
  private operatorPool: { type: string; indices: number[]; pauliString?: string }[] = []

  constructor(config: AnsatzConfig, numQubits: number, numElectrons: number, hamiltonian?: Hamiltonian) {
    this.config = config
    this.numQubits = numQubits
    this.numElectrons = numElectrons
    this.hamiltonian = hamiltonian
    this.generateOperatorPool()
  }

  private generateOperatorPool(): void {
    if (this.config.type === 'qubit_adapt') {
      this.generateQubitPool()
    } else {
      this.generateFermionicPool()
    }
  }

  private generateFermionicPool(): void {
    const numOccupied = this.numElectrons
    const numVirtual = this.numQubits - numOccupied

    for (let i = 0; i < numOccupied; i++) {
      for (let a = numOccupied; a < this.numQubits; a++) {
        this.operatorPool.push({ type: 'single', indices: [i, a] })
      }
    }

    for (let i = 0; i < numOccupied; i++) {
      for (let j = i + 1; j < numOccupied; j++) {
        for (let a = numOccupied; a < this.numQubits; a++) {
          for (let b = a + 1; b < this.numQubits; b++) {
            this.operatorPool.push({ type: 'double', indices: [i, j, a, b] })
          }
        }
      }
    }
  }

  private generateQubitPool(): void {
    for (let q = 0; q < this.numQubits; q++) {
      this.operatorPool.push({ type: 'pauli', indices: [q], pauliString: 'Y' })
    }

    for (let q1 = 0; q1 < this.numQubits; q1++) {
      for (let q2 = q1 + 1; q2 < this.numQubits; q2++) {
        this.operatorPool.push({ type: 'pauli', indices: [q1, q2], pauliString: 'XY' })
        this.operatorPool.push({ type: 'pauli', indices: [q1, q2], pauliString: 'YX' })
        this.operatorPool.push({ type: 'pauli', indices: [q1, q2], pauliString: 'YY' })
        this.operatorPool.push({ type: 'pauli', indices: [q1, q2], pauliString: 'XZ' })
        this.operatorPool.push({ type: 'pauli', indices: [q1, q2], pauliString: 'ZX' })
      }
    }
  }

  addOperator(operatorIndex: number): void {
    if (operatorIndex >= 0 && operatorIndex < this.operatorPool.length) {
      this.selectedOperators.push(this.operatorPool[operatorIndex])
      this.parameters.push(0)
    }
  }

  buildCircuit(params: number[]): Circuit {
    const circuit = new Circuit(this.numQubits)

    for (let i = 0; i < this.numElectrons; i++) {
      circuit.x(i)
    }

    for (let i = 0; i < this.selectedOperators.length; i++) {
      const op = this.selectedOperators[i]
      const theta = params[i] ?? 0

      if (op.type === 'single') {
        this.addSingleExcitation(circuit, op.indices[0], op.indices[1], theta)
      } else if (op.type === 'double') {
        this.addDoubleExcitation(circuit, op.indices[0], op.indices[1], op.indices[2], op.indices[3], theta)
      } else if (op.type === 'pauli' && op.pauliString) {
        circuit.addPauliRotation(op.pauliString, op.indices, theta)
      }
    }

    return circuit
  }

  private addSingleExcitation(circuit: Circuit, i: number, a: number, theta: number): void {
    circuit.cnot(i, a)
    circuit.ry(i, theta / 2)
    circuit.cnot(a, i)
    circuit.ry(i, -theta / 2)
    circuit.cnot(a, i)
    circuit.cnot(i, a)
  }

  private addDoubleExcitation(circuit: Circuit, i: number, j: number, a: number, b: number, theta: number): void {
    const qubits = [i, j, a, b].sort((x, y) => x - y)

    for (let q = 0; q < qubits.length - 1; q++) {
      circuit.cnot(qubits[q], qubits[q + 1])
    }

    circuit.rz(qubits[qubits.length - 1], theta)

    for (let q = qubits.length - 2; q >= 0; q--) {
      circuit.cnot(qubits[q], qubits[q + 1])
    }
  }

  getOperatorPool(): typeof this.operatorPool {
    return this.operatorPool
  }

  getSelectedOperators(): typeof this.selectedOperators {
    return this.selectedOperators
  }

  getParameterCount(): number {
    return this.selectedOperators.length
  }

  getMetrics(): CircuitMetrics {
    if (this.selectedOperators.length === 0) {
      return {
        depth: 0,
        gateCount: this.numElectrons,
        cnotCount: 0,
        singleQubitGateCount: this.numElectrons,
        twoQubitGateCount: 0,
        parameterCount: 0,
      }
    }
    const dummyParams = new Array(this.selectedOperators.length).fill(0)
    return this.buildCircuit(dummyParams).getMetrics()
  }

  getInitialParameters(): number[] {
    return new Array(this.selectedOperators.length).fill(0)
  }
}

export class SymmetryPreservedBuilder implements AnsatzBuilder {
  private config: AnsatzConfig
  private numQubits: number
  private numElectrons: number
  private paramCount: number

  constructor(config: AnsatzConfig, numQubits: number, numElectrons: number) {
    this.config = config
    this.numQubits = numQubits
    this.numElectrons = numElectrons

    const numOrbitals = numQubits / 2
    const layers = config.layers ?? 1
    this.paramCount = layers * numOrbitals * (numOrbitals - 1) / 2
  }

  buildCircuit(params: number[]): Circuit {
    const circuit = new Circuit(this.numQubits)

    for (let i = 0; i < this.numElectrons; i++) {
      circuit.x(i)
    }

    let paramIdx = 0
    const layers = this.config.layers ?? 1
    const numOrbitals = this.numQubits / 2

    for (let layer = 0; layer < layers; layer++) {
      for (let p = 0; p < numOrbitals; p++) {
        for (let q = p + 1; q < numOrbitals; q++) {
          if (paramIdx < params.length) {
            const theta = params[paramIdx++]
            this.addGivensRotation(circuit, p, q, theta)
          }
        }
      }
    }

    return circuit
  }

  private addGivensRotation(circuit: Circuit, p: number, q: number, theta: number): void {
    const alphaP = 2 * p
    const alphaQ = 2 * q
    const betaP = 2 * p + 1
    const betaQ = 2 * q + 1

    circuit.cnot(alphaP, alphaQ)
    circuit.cry(alphaQ, alphaP, theta)
    circuit.cnot(alphaP, alphaQ)

    circuit.cnot(betaP, betaQ)
    circuit.cry(betaQ, betaP, theta)
    circuit.cnot(betaP, betaQ)
  }

  getParameterCount(): number {
    return this.paramCount
  }

  getMetrics(): CircuitMetrics {
    const dummyParams = new Array(this.paramCount).fill(0)
    return this.buildCircuit(dummyParams).getMetrics()
  }

  getInitialParameters(): number[] {
    return new Array(this.paramCount).fill(0)
  }
}

export const ANSATZ_INFO: Record<string, {
  name: string
  description: string
  chemistryInspired: boolean
  complexity: 'low' | 'medium' | 'high'
  recommended: string[]
}> = {
  hea: {
    name: 'Hardware Efficient Ansatz',
    description: 'Generic parameterized circuit with rotation and entanglement layers',
    chemistryInspired: false,
    complexity: 'low',
    recommended: ['quick exploration', 'NISQ devices', 'unknown problems'],
  },
  uccsd: {
    name: 'UCCSD',
    description: 'Unitary Coupled Cluster Singles and Doubles',
    chemistryInspired: true,
    complexity: 'high',
    recommended: ['chemical accuracy', 'well-defined problems', 'small molecules'],
  },
  k_upccgsd: {
    name: 'k-UpCCGSD',
    description: 'k-fold Unitary Paired Coupled Cluster Generalized Singles and Doubles',
    chemistryInspired: true,
    complexity: 'medium',
    recommended: ['balanced accuracy/depth', 'medium molecules'],
  },
  adapt: {
    name: 'ADAPT-VQE',
    description: 'Adaptive Derivative-Assembled Pseudo-Trotter VQE',
    chemistryInspired: true,
    complexity: 'medium',
    recommended: ['compact circuits', 'avoiding barren plateaus', 'research'],
  },
  qubit_adapt: {
    name: 'Qubit-ADAPT-VQE',
    description: 'Hardware-efficient ADAPT using Pauli rotations',
    chemistryInspired: false,
    complexity: 'medium',
    recommended: ['near-term hardware', 'shallow circuits'],
  },
  symmetry_preserved: {
    name: 'Symmetry Preserved',
    description: 'Ansatz preserving particle number and spin symmetries',
    chemistryInspired: true,
    complexity: 'medium',
    recommended: ['constrained search space', 'physical states only'],
  },
}
