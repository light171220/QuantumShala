import { Circuit } from '../../quantum-core'
import type { AnsatzConfig } from '../types'

export function buildTreeTensor(circuit: Circuit, config: AnsatzConfig): Circuit {
  const { layers } = config
  const numQubits = circuit.numQubits

  for (let layer = 0; layer < layers; layer++) {
    const step = Math.pow(2, layer)
    const activeQubits: number[] = []

    for (let q = 0; q < numQubits; q += step) {
      activeQubits.push(q)
    }

    for (const q of activeQubits) {
      circuit.paramRy(q)
      circuit.paramRz(q)
    }

    for (let i = 0; i < activeQubits.length - 1; i++) {
      const q1 = activeQubits[i]
      const q2 = activeQubits[i + 1]
      circuit.cnot(q1, q2)
    }
  }

  return circuit
}
