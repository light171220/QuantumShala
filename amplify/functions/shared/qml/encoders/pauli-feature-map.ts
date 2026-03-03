import { Circuit } from '../../quantum-core'
import type { EncoderConfig } from '../types'

export function pauliFeatureMapEncoding(
  circuit: Circuit,
  data: number[],
  config: EncoderConfig
): Circuit {
  const numQubits = circuit.numQubits
  const pauliStrings = config.pauliStrings || generateDefaultPauliStrings(numQubits)
  const entanglement = config.entanglement || 'full'

  for (let i = 0; i < numQubits; i++) {
    circuit.h(i)
  }

  for (let i = 0; i < Math.min(data.length, numQubits); i++) {
    circuit.p(i, 2 * data[i])
  }

  for (const pauliString of pauliStrings) {
    applyPauliRotation(circuit, pauliString, data)
  }

  if (entanglement === 'full' || entanglement === 'linear') {
    for (let i = 0; i < numQubits - 1; i++) {
      if (i < data.length && i + 1 < data.length) {
        const phi = data[i] * data[i + 1]
        circuit.rzz(i, i + 1, 2 * phi)
      }
    }
  }

  return circuit
}

function generateDefaultPauliStrings(numQubits: number): string[] {
  const strings: string[] = []

  for (let i = 0; i < numQubits; i++) {
    let s = ''
    for (let j = 0; j < numQubits; j++) {
      s += j === i ? 'Z' : 'I'
    }
    strings.push(s)
  }

  return strings
}

function applyPauliRotation(
  circuit: Circuit,
  pauliString: string,
  data: number[]
): void {
  const activeQubits: number[] = []
  const pauliOps: string[] = []

  for (let i = 0; i < pauliString.length; i++) {
    if (pauliString[i] !== 'I') {
      activeQubits.push(i)
      pauliOps.push(pauliString[i])
    }
  }

  if (activeQubits.length === 0) return

  let phi = 1.0
  for (const q of activeQubits) {
    if (q < data.length) {
      phi *= data[q]
    }
  }

  for (let i = 0; i < activeQubits.length; i++) {
    const q = activeQubits[i]
    const p = pauliOps[i]
    if (p === 'X') {
      circuit.h(q)
    } else if (p === 'Y') {
      circuit.sdg(q)
      circuit.h(q)
    }
  }

  for (let i = 0; i < activeQubits.length - 1; i++) {
    circuit.cnot(activeQubits[i], activeQubits[i + 1])
  }

  if (activeQubits.length > 0) {
    circuit.rz(activeQubits[activeQubits.length - 1], 2 * phi)
  }

  for (let i = activeQubits.length - 2; i >= 0; i--) {
    circuit.cnot(activeQubits[i], activeQubits[i + 1])
  }

  for (let i = 0; i < activeQubits.length; i++) {
    const q = activeQubits[i]
    const p = pauliOps[i]
    if (p === 'X') {
      circuit.h(q)
    } else if (p === 'Y') {
      circuit.h(q)
      circuit.s(q)
    }
  }
}
