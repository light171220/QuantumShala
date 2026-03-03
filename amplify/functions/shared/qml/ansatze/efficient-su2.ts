import { Circuit } from '../../quantum-core'
import type { AnsatzConfig } from '../types'

export function buildEfficientSU2(circuit: Circuit, config: AnsatzConfig): Circuit {
  const { layers, entanglement = 'linear', skipFinalRotation = false, insertBarriers = false } = config
  const numQubits = circuit.numQubits

  for (let layer = 0; layer < layers; layer++) {
    for (let q = 0; q < numQubits; q++) {
      circuit.paramRy(q)
      circuit.paramRz(q)
    }

    if (insertBarriers) {
      circuit.barrier()
    }

    applyEntanglement(circuit, numQubits, entanglement)

    if (insertBarriers) {
      circuit.barrier()
    }
  }

  if (!skipFinalRotation) {
    for (let q = 0; q < numQubits; q++) {
      circuit.paramRy(q)
      circuit.paramRz(q)
    }
  }

  return circuit
}

function applyEntanglement(circuit: Circuit, numQubits: number, pattern: string): void {
  switch (pattern) {
    case 'linear':
      for (let i = 0; i < numQubits - 1; i++) {
        circuit.cx(i, i + 1)
      }
      break
    case 'circular':
      for (let i = 0; i < numQubits - 1; i++) {
        circuit.cx(i, i + 1)
      }
      if (numQubits > 2) {
        circuit.cx(numQubits - 1, 0)
      }
      break
    case 'full':
      for (let i = 0; i < numQubits; i++) {
        for (let j = i + 1; j < numQubits; j++) {
          circuit.cx(i, j)
        }
      }
      break
    case 'pairwise':
      for (let i = 0; i < numQubits - 1; i += 2) {
        circuit.cx(i, i + 1)
      }
      for (let i = 1; i < numQubits - 1; i += 2) {
        circuit.cx(i, i + 1)
      }
      break
    case 'sca':
      for (let i = 0; i < numQubits - 1; i++) {
        circuit.cx(i, i + 1)
      }
      for (let i = numQubits - 1; i > 0; i--) {
        circuit.cx(i, i - 1)
      }
      break
  }
}
