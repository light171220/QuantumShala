import type { QuantumGate, QuantumCircuit, Complex } from '../types'
import { StateVector } from './state-vector'
import * as Gates from './gates'

export interface CircuitMetrics {
  depth: number
  gateCount: number
  cnotCount: number
  singleQubitGateCount: number
  twoQubitGateCount: number
  parameterCount: number
}

export class Circuit implements QuantumCircuit {
  numQubits: number
  gates: QuantumGate[] = []
  private parameterIndices: Map<number, number[]> = new Map()
  private currentParamIndex = 0

  constructor(numQubits: number) {
    this.numQubits = numQubits
  }

  private addGate(name: string, qubits: number[], params?: number[]): this {
    this.gates.push({ name, qubits, params })
    return this
  }

  private addParameterizedGate(name: string, qubits: number[], paramCount: number): this {
    const params: number[] = []
    const indices: number[] = []
    for (let i = 0; i < paramCount; i++) {
      params.push(0)
      indices.push(this.currentParamIndex++)
    }
    const gateIndex = this.gates.length
    this.gates.push({ name, qubits, params })
    this.parameterIndices.set(gateIndex, indices)
    return this
  }

  i(qubit: number): this {
    return this.addGate('i', [qubit])
  }

  x(qubit: number): this {
    return this.addGate('x', [qubit])
  }

  y(qubit: number): this {
    return this.addGate('y', [qubit])
  }

  z(qubit: number): this {
    return this.addGate('z', [qubit])
  }

  h(qubit: number): this {
    return this.addGate('h', [qubit])
  }

  s(qubit: number): this {
    return this.addGate('s', [qubit])
  }

  sdg(qubit: number): this {
    return this.addGate('sdg', [qubit])
  }

  t(qubit: number): this {
    return this.addGate('t', [qubit])
  }

  tdg(qubit: number): this {
    return this.addGate('tdg', [qubit])
  }

  sx(qubit: number): this {
    return this.addGate('sx', [qubit])
  }

  rx(qubit: number, theta: number): this {
    return this.addGate('rx', [qubit], [theta])
  }

  ry(qubit: number, theta: number): this {
    return this.addGate('ry', [qubit], [theta])
  }

  rz(qubit: number, theta: number): this {
    return this.addGate('rz', [qubit], [theta])
  }

  p(qubit: number, theta: number): this {
    return this.addGate('p', [qubit], [theta])
  }

  u3(qubit: number, theta: number, phi: number, lambda: number): this {
    return this.addGate('u3', [qubit], [theta, phi, lambda])
  }

  u2(qubit: number, phi: number, lambda: number): this {
    return this.addGate('u2', [qubit], [phi, lambda])
  }

  u1(qubit: number, lambda: number): this {
    return this.addGate('u1', [qubit], [lambda])
  }

  cnot(control: number, target: number): this {
    return this.addGate('cnot', [control, target])
  }

  cx(control: number, target: number): this {
    return this.cnot(control, target)
  }

  cy(control: number, target: number): this {
    return this.addGate('cy', [control, target])
  }

  cz(control: number, target: number): this {
    return this.addGate('cz', [control, target])
  }

  swap(qubit1: number, qubit2: number): this {
    return this.addGate('swap', [qubit1, qubit2])
  }

  iswap(qubit1: number, qubit2: number): this {
    return this.addGate('iswap', [qubit1, qubit2])
  }

  crx(control: number, target: number, theta: number): this {
    return this.addGate('crx', [control, target], [theta])
  }

  cry(control: number, target: number, theta: number): this {
    return this.addGate('cry', [control, target], [theta])
  }

  crz(control: number, target: number, theta: number): this {
    return this.addGate('crz', [control, target], [theta])
  }

  cp(control: number, target: number, theta: number): this {
    return this.addGate('cp', [control, target], [theta])
  }

  rxx(qubit1: number, qubit2: number, theta: number): this {
    return this.addGate('rxx', [qubit1, qubit2], [theta])
  }

  ryy(qubit1: number, qubit2: number, theta: number): this {
    return this.addGate('ryy', [qubit1, qubit2], [theta])
  }

  rzz(qubit1: number, qubit2: number, theta: number): this {
    return this.addGate('rzz', [qubit1, qubit2], [theta])
  }

  paramRx(qubit: number): this {
    return this.addParameterizedGate('rx', [qubit], 1)
  }

  paramRy(qubit: number): this {
    return this.addParameterizedGate('ry', [qubit], 1)
  }

  paramRz(qubit: number): this {
    return this.addParameterizedGate('rz', [qubit], 1)
  }

  paramCrx(control: number, target: number): this {
    return this.addParameterizedGate('crx', [control, target], 1)
  }

  paramCry(control: number, target: number): this {
    return this.addParameterizedGate('cry', [control, target], 1)
  }

  paramCrz(control: number, target: number): this {
    return this.addParameterizedGate('crz', [control, target], 1)
  }

  barrier(): this {
    return this.addGate('barrier', [])
  }

  buildHEA(numLayers: number, entanglement: 'linear' | 'circular' | 'full' | 'pairwise' = 'linear'): this {
    for (let layer = 0; layer < numLayers; layer++) {
      for (let q = 0; q < this.numQubits; q++) {
        this.paramRy(q)
        this.paramRz(q)
      }

      switch (entanglement) {
        case 'linear':
          for (let q = 0; q < this.numQubits - 1; q++) {
            this.cnot(q, q + 1)
          }
          break
        case 'circular':
          for (let q = 0; q < this.numQubits - 1; q++) {
            this.cnot(q, q + 1)
          }
          if (this.numQubits > 2) {
            this.cnot(this.numQubits - 1, 0)
          }
          break
        case 'full':
          for (let q1 = 0; q1 < this.numQubits; q1++) {
            for (let q2 = q1 + 1; q2 < this.numQubits; q2++) {
              this.cnot(q1, q2)
            }
          }
          break
        case 'pairwise':
          for (let q = 0; q < this.numQubits - 1; q += 2) {
            this.cnot(q, q + 1)
          }
          for (let q = 1; q < this.numQubits - 1; q += 2) {
            this.cnot(q, q + 1)
          }
          break
      }
    }

    for (let q = 0; q < this.numQubits; q++) {
      this.paramRy(q)
      this.paramRz(q)
    }

    return this
  }

  initializeHartreeFock(numElectrons: number): this {
    for (let i = 0; i < Math.min(numElectrons, this.numQubits); i++) {
      this.x(i)
    }
    return this
  }

  addSingleExcitation(i: number, a: number, theta: number): this {
    this.cnot(i, a)
    this.ry(i, theta / 2)
    this.cnot(a, i)
    this.ry(i, -theta / 2)
    this.cnot(a, i)
    this.cnot(i, a)
    return this
  }

  addDoubleExcitation(i: number, j: number, a: number, b: number, theta: number): this {
    this.cnot(a, b)
    this.cnot(i, j)
    this.cnot(j, a)
    this.h(j)
    this.h(b)
    this.cnot(j, i)
    this.cnot(b, a)
    this.ry(j, theta / 8)
    this.ry(b, theta / 8)
    this.cnot(i, j)
    this.ry(j, -theta / 8)
    this.cnot(a, b)
    this.ry(b, -theta / 8)
    this.cnot(i, j)
    this.ry(j, theta / 8)
    this.cnot(a, b)
    this.ry(b, theta / 8)
    this.cnot(j, i)
    this.cnot(b, a)
    this.h(j)
    this.h(b)
    this.cnot(j, a)
    this.cnot(i, j)
    this.cnot(a, b)
    return this
  }

  addPauliRotation(pauliString: string, qubits: number[], theta: number): this {
    for (let i = 0; i < pauliString.length; i++) {
      const pauli = pauliString[i]
      const qubit = qubits[i]
      if (pauli === 'X') {
        this.h(qubit)
      } else if (pauli === 'Y') {
        this.sdg(qubit)
        this.h(qubit)
      }
    }

    for (let i = 0; i < qubits.length - 1; i++) {
      this.cnot(qubits[i], qubits[i + 1])
    }

    this.rz(qubits[qubits.length - 1], theta)

    for (let i = qubits.length - 2; i >= 0; i--) {
      this.cnot(qubits[i], qubits[i + 1])
    }

    for (let i = 0; i < pauliString.length; i++) {
      const pauli = pauliString[i]
      const qubit = qubits[i]
      if (pauli === 'X') {
        this.h(qubit)
      } else if (pauli === 'Y') {
        this.h(qubit)
        this.s(qubit)
      }
    }

    return this
  }

  getParameterCount(): number {
    return this.currentParamIndex
  }

  setParameters(params: number[]): void {
    if (params.length !== this.currentParamIndex) {
      throw new Error(
        `Expected ${this.currentParamIndex} parameters, got ${params.length}`
      )
    }

    for (const [gateIndex, paramIndices] of this.parameterIndices) {
      const gate = this.gates[gateIndex]
      if (gate.params) {
        for (let i = 0; i < paramIndices.length; i++) {
          gate.params[i] = params[paramIndices[i]]
        }
      }
    }
  }

  getMetrics(): CircuitMetrics {
    let depth = 0
    let gateCount = 0
    let cnotCount = 0
    let singleQubitGateCount = 0
    let twoQubitGateCount = 0
    let parameterCount = this.currentParamIndex

    const qubitDepth = new Array(this.numQubits).fill(0)

    for (const gate of this.gates) {
      if (gate.name === 'barrier') continue

      gateCount++

      if (gate.qubits.length === 1) {
        singleQubitGateCount++
        qubitDepth[gate.qubits[0]]++
      } else if (gate.qubits.length === 2) {
        twoQubitGateCount++
        if (gate.name === 'cnot' || gate.name === 'cx') {
          cnotCount++
        }
        const maxDepth = Math.max(qubitDepth[gate.qubits[0]], qubitDepth[gate.qubits[1]])
        qubitDepth[gate.qubits[0]] = maxDepth + 1
        qubitDepth[gate.qubits[1]] = maxDepth + 1
      }
    }

    depth = Math.max(...qubitDepth)

    return {
      depth,
      gateCount,
      cnotCount,
      singleQubitGateCount,
      twoQubitGateCount,
      parameterCount,
    }
  }

  clone(): Circuit {
    const circuit = new Circuit(this.numQubits)
    circuit.gates = this.gates.map(g => ({
      ...g,
      qubits: [...g.qubits],
      params: g.params ? [...g.params] : undefined,
    }))
    circuit.parameterIndices = new Map(this.parameterIndices)
    circuit.currentParamIndex = this.currentParamIndex
    return circuit
  }

  toJSON(): QuantumCircuit {
    return {
      numQubits: this.numQubits,
      gates: this.gates,
    }
  }

  static fromJSON(data: QuantumCircuit): Circuit {
    const circuit = new Circuit(data.numQubits)
    circuit.gates = data.gates
    return circuit
  }
}

export function executeCircuit(circuit: Circuit | QuantumCircuit, state?: StateVector): StateVector {
  const sv = state ?? new StateVector(circuit.numQubits)

  for (const gate of circuit.gates) {
    if (gate.name === 'barrier') continue

    const name = gate.name.toLowerCase()
    const qubits = gate.qubits
    const params = gate.params

    if (qubits.length === 1) {
      const matrix = Gates.getGateByName(name, params)
      sv.applySingleQubitGate(qubits[0], matrix)
    } else if (qubits.length === 2) {
      switch (name) {
        case 'cnot':
        case 'cx':
          sv.applyCNOT(qubits[0], qubits[1])
          break
        case 'cz':
          sv.applyCZ(qubits[0], qubits[1])
          break
        case 'swap':
          sv.applySWAP(qubits[0], qubits[1])
          break
        case 'cy':
          sv.applyControlledGate(qubits[0], qubits[1], Gates.Y_GATE)
          break
        case 'crx':
          sv.applyControlledGate(qubits[0], qubits[1], Gates.RX(params?.[0] ?? 0))
          break
        case 'cry':
          sv.applyControlledGate(qubits[0], qubits[1], Gates.RY(params?.[0] ?? 0))
          break
        case 'crz':
          sv.applyControlledGate(qubits[0], qubits[1], Gates.RZ(params?.[0] ?? 0))
          break
        case 'cp':
          sv.applyControlledGate(qubits[0], qubits[1], Gates.P(params?.[0] ?? 0))
          break
        case 'rxx':
          applyRXX(sv, qubits[0], qubits[1], params?.[0] ?? 0)
          break
        case 'ryy':
          applyRYY(sv, qubits[0], qubits[1], params?.[0] ?? 0)
          break
        case 'rzz':
          applyRZZ(sv, qubits[0], qubits[1], params?.[0] ?? 0)
          break
        case 'iswap':
          applyISWAP(sv, qubits[0], qubits[1])
          break
        default:
          throw new Error(`Unknown two-qubit gate: ${name}`)
      }
    }
  }

  return sv
}

function applyRXX(sv: StateVector, q1: number, q2: number, theta: number): void {
  sv.applySingleQubitGate(q1, Gates.H_GATE)
  sv.applySingleQubitGate(q2, Gates.H_GATE)
  sv.applyCNOT(q1, q2)
  sv.applySingleQubitGate(q2, Gates.RZ(theta))
  sv.applyCNOT(q1, q2)
  sv.applySingleQubitGate(q1, Gates.H_GATE)
  sv.applySingleQubitGate(q2, Gates.H_GATE)
}

function applyRYY(sv: StateVector, q1: number, q2: number, theta: number): void {
  sv.applySingleQubitGate(q1, Gates.RX(Math.PI / 2))
  sv.applySingleQubitGate(q2, Gates.RX(Math.PI / 2))
  sv.applyCNOT(q1, q2)
  sv.applySingleQubitGate(q2, Gates.RZ(theta))
  sv.applyCNOT(q1, q2)
  sv.applySingleQubitGate(q1, Gates.RX(-Math.PI / 2))
  sv.applySingleQubitGate(q2, Gates.RX(-Math.PI / 2))
}

function applyRZZ(sv: StateVector, q1: number, q2: number, theta: number): void {
  sv.applyCNOT(q1, q2)
  sv.applySingleQubitGate(q2, Gates.RZ(theta))
  sv.applyCNOT(q1, q2)
}

function applyISWAP(sv: StateVector, q1: number, q2: number): void {
  sv.applySingleQubitGate(q1, Gates.S_GATE)
  sv.applySingleQubitGate(q2, Gates.S_GATE)
  sv.applySingleQubitGate(q1, Gates.H_GATE)
  sv.applyCNOT(q1, q2)
  sv.applyCNOT(q2, q1)
  sv.applySingleQubitGate(q2, Gates.H_GATE)
}
