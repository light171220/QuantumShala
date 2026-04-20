import { Circuit } from '../../quantum-core'
import type { AnsatzConfig } from '../types'

export function buildTwoLocal(circuit: Circuit, config: AnsatzConfig): Circuit {
  const {
    layers,
    entanglement = 'linear',
    rotationBlocks = ['ry', 'rz'],
    entanglementBlocks = ['cx'],
    skipFinalRotation = false,
    insertBarriers = false,
  } = config
  const numQubits = circuit.numQubits

  for (let layer = 0; layer < layers; layer++) {
    for (const rotation of rotationBlocks) {
      for (let q = 0; q < numQubits; q++) {
        applyRotation(circuit, q, rotation)
      }
    }

    if (insertBarriers) {
      circuit.barrier()
    }

    for (const entBlock of entanglementBlocks) {
      applyEntanglement(circuit, numQubits, entanglement, entBlock)
    }

    if (insertBarriers) {
      circuit.barrier()
    }
  }

  if (!skipFinalRotation) {
    for (const rotation of rotationBlocks) {
      for (let q = 0; q < numQubits; q++) {
        applyRotation(circuit, q, rotation)
      }
    }
  }

  return circuit
}

function applyRotation(circuit: Circuit, qubit: number, rotation: string): void {
  switch (rotation) {
    case 'rx':
      circuit.paramRx(qubit)
      break
    case 'ry':
      circuit.paramRy(qubit)
      break
    case 'rz':
      circuit.paramRz(qubit)
      break
  }
}

function applyEntanglement(
  circuit: Circuit,
  numQubits: number,
  pattern: string,
  gate: string
): void {
  const pairs = getEntanglementPairs(numQubits, pattern)

  for (const [control, target] of pairs) {
    switch (gate) {
      case 'cx':
        circuit.cx(control, target)
        break
      case 'cz':
        circuit.cz(control, target)
        break
      case 'crx':
        circuit.paramCrx(control, target)
        break
      case 'cry':
        circuit.paramCry(control, target)
        break
      case 'crz':
        circuit.paramCrz(control, target)
        break
    }
  }
}

function getEntanglementPairs(numQubits: number, pattern: string): [number, number][] {
  const pairs: [number, number][] = []

  switch (pattern) {
    case 'linear':
      for (let i = 0; i < numQubits - 1; i++) {
        pairs.push([i, i + 1])
      }
      break
    case 'circular':
      for (let i = 0; i < numQubits - 1; i++) {
        pairs.push([i, i + 1])
      }
      if (numQubits > 2) {
        pairs.push([numQubits - 1, 0])
      }
      break
    case 'full':
      for (let i = 0; i < numQubits; i++) {
        for (let j = i + 1; j < numQubits; j++) {
          pairs.push([i, j])
        }
      }
      break
    case 'pairwise':
      for (let i = 0; i < numQubits - 1; i += 2) {
        pairs.push([i, i + 1])
      }
      break
    case 'sca':
      for (let i = 0; i < numQubits - 1; i++) {
        pairs.push([i, i + 1])
      }
      for (let i = numQubits - 1; i > 0; i--) {
        pairs.push([i, i - 1])
      }
      break
  }

  return pairs
}
