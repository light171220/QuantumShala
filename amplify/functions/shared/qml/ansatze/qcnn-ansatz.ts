import { Circuit } from '../../quantum-core'
import type { AnsatzConfig } from '../types'

export function buildQCNNAnsatz(circuit: Circuit, config: AnsatzConfig): Circuit {
  const numQubits = circuit.numQubits
  let activeQubits = Array.from({ length: numQubits }, (_, i) => i)

  while (activeQubits.length > 1) {
    applyConvolutionalLayer(circuit, activeQubits)
    activeQubits = applyPoolingLayer(circuit, activeQubits)
  }

  if (activeQubits.length === 1) {
    circuit.paramRy(activeQubits[0])
    circuit.paramRz(activeQubits[0])
  }

  return circuit
}

function applyConvolutionalLayer(circuit: Circuit, qubits: number[]): void {
  for (let i = 0; i < qubits.length - 1; i += 2) {
    applyTwoQubitUnitary(circuit, qubits[i], qubits[i + 1])
  }

  for (let i = 1; i < qubits.length - 1; i += 2) {
    applyTwoQubitUnitary(circuit, qubits[i], qubits[i + 1])
  }
}

function applyPoolingLayer(circuit: Circuit, qubits: number[]): number[] {
  const remainingQubits: number[] = []

  for (let i = 0; i < qubits.length - 1; i += 2) {
    circuit.paramCrz(qubits[i], qubits[i + 1])
    circuit.x(qubits[i])
    circuit.paramCrx(qubits[i], qubits[i + 1])
    remainingQubits.push(qubits[i + 1])
  }

  if (qubits.length % 2 === 1) {
    remainingQubits.push(qubits[qubits.length - 1])
  }

  return remainingQubits
}

function applyTwoQubitUnitary(circuit: Circuit, q1: number, q2: number): void {
  circuit.paramRy(q1)
  circuit.paramRz(q1)
  circuit.paramRy(q2)
  circuit.paramRz(q2)
  circuit.cnot(q1, q2)
  circuit.paramRy(q1)
  circuit.paramRz(q2)
}
