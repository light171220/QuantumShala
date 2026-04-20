import type { QuantumCircuit, CircuitGate, SimulationResult, Complex } from '@/types/simulator'

export interface MPSTensor {
  data: Float64Array
  shape: [number, number, number]
}

export interface MPSState {
  tensors: MPSTensor[]
  bondDimensions: number[]
}

const MAX_BOND_DIM = 64

export class TensorNetworkSimulator {
  private numQubits: number
  private mps: MPSState

  constructor(numQubits: number) {
    this.numQubits = numQubits
    this.mps = this.initializeMPS()
  }

  private initializeMPS(): MPSState {
    const tensors: MPSTensor[] = []
    const bondDimensions: number[] = [1]

    for (let i = 0; i < this.numQubits; i++) {
      const leftDim = i === 0 ? 1 : 2
      const rightDim = i === this.numQubits - 1 ? 1 : 2
      const shape: [number, number, number] = [leftDim, 2, rightDim]
      const size = leftDim * 2 * rightDim * 2
      const data = new Float64Array(size)
      data[0] = 1
      tensors.push({ data, shape })
      if (i < this.numQubits - 1) {
        bondDimensions.push(2)
      }
    }
    bondDimensions.push(1)

    return { tensors, bondDimensions }
  }

  applyGate(gate: CircuitGate): void {
    const target = gate.qubits[gate.qubits.length - 1]
    const SQRT2_INV = 0.7071067811865476

    switch (gate.type) {
      case 'H':
        this.applySingleQubitGate(target, [
          SQRT2_INV, 0, SQRT2_INV, 0,
          SQRT2_INV, 0, -SQRT2_INV, 0
        ])
        break
      case 'X':
        this.applySingleQubitGate(target, [0, 0, 1, 0, 1, 0, 0, 0])
        break
      case 'Y':
        this.applySingleQubitGate(target, [0, 0, 0, -1, 0, 1, 0, 0])
        break
      case 'Z':
        this.applySingleQubitGate(target, [1, 0, 0, 0, 0, 0, -1, 0])
        break
      case 'S':
        this.applySingleQubitGate(target, [1, 0, 0, 0, 0, 0, 0, 1])
        break
      case 'T':
        this.applySingleQubitGate(target, [1, 0, 0, 0, 0, 0, SQRT2_INV, SQRT2_INV])
        break
      case 'Rx': {
        const theta = gate.parameters?.[0] || 0
        const c = Math.cos(theta / 2), s = Math.sin(theta / 2)
        this.applySingleQubitGate(target, [c, 0, 0, -s, 0, -s, c, 0])
        break
      }
      case 'Ry': {
        const theta = gate.parameters?.[0] || 0
        const c = Math.cos(theta / 2), s = Math.sin(theta / 2)
        this.applySingleQubitGate(target, [c, 0, -s, 0, s, 0, c, 0])
        break
      }
      case 'Rz': {
        const theta = gate.parameters?.[0] || 0
        const cn = Math.cos(-theta / 2), sn = Math.sin(-theta / 2)
        const cp = Math.cos(theta / 2), sp = Math.sin(theta / 2)
        this.applySingleQubitGate(target, [cn, sn, 0, 0, 0, 0, cp, sp])
        break
      }
      case 'CNOT':
      case 'CX': {
        const control = gate.controlQubits?.[0] ?? gate.qubits[0]
        this.applyCNOT(control, target)
        break
      }
      case 'CZ': {
        const control = gate.controlQubits?.[0] ?? gate.qubits[0]
        this.applyCZ(control, target)
        break
      }
      case 'SWAP':
        if (gate.qubits.length >= 2) this.applySWAP(gate.qubits[0], gate.qubits[1])
        break
    }
  }

  private applySingleQubitGate(qubit: number, matrix: number[]): void {
    const tensor = this.mps.tensors[qubit]
    const [leftDim, , rightDim] = tensor.shape
    const newData = new Float64Array(leftDim * 2 * rightDim * 2)

    for (let l = 0; l < leftDim; l++) {
      for (let r = 0; r < rightDim; r++) {
        for (let pOut = 0; pOut < 2; pOut++) {
          let sumRe = 0, sumIm = 0
          for (let pIn = 0; pIn < 2; pIn++) {
            const mIdx = (pOut * 2 + pIn) * 2
            const mr = matrix[mIdx], mi = matrix[mIdx + 1]
            const tIdx = (l * 2 + pIn) * rightDim * 2 + r * 2
            const tr = tensor.data[tIdx], ti = tensor.data[tIdx + 1]
            sumRe += mr * tr - mi * ti
            sumIm += mr * ti + mi * tr
          }
          const outIdx = (l * 2 + pOut) * rightDim * 2 + r * 2
          newData[outIdx] = sumRe
          newData[outIdx + 1] = sumIm
        }
      }
    }

    tensor.data = newData
  }

  private applyCNOT(control: number, target: number): void {
    if (Math.abs(control - target) !== 1) {
      this.applyNonAdjacentCNOT(control, target)
      return
    }

    const minQ = Math.min(control, target)
    const t1 = this.mps.tensors[minQ]
    const t2 = this.mps.tensors[minQ + 1]
    const [l1, , r1] = t1.shape
    const [, , r2] = t2.shape

    const mergedSize = l1 * 4 * r2 * 2
    const merged = new Float64Array(mergedSize)

    for (let l = 0; l < l1; l++) {
      for (let p1 = 0; p1 < 2; p1++) {
        for (let p2 = 0; p2 < 2; p2++) {
          for (let r = 0; r < r2; r++) {
            let sumRe = 0, sumIm = 0
            for (let m = 0; m < r1; m++) {
              const idx1 = (l * 2 + p1) * r1 * 2 + m * 2
              const idx2 = (m * 2 + p2) * r2 * 2 + r * 2
              const r1v = t1.data[idx1], i1 = t1.data[idx1 + 1]
              const r2v = t2.data[idx2], i2 = t2.data[idx2 + 1]
              sumRe += r1v * r2v - i1 * i2
              sumIm += r1v * i2 + i1 * r2v
            }
            const outIdx = (l * 4 + p1 * 2 + p2) * r2 * 2 + r * 2
            merged[outIdx] = sumRe
            merged[outIdx + 1] = sumIm
          }
        }
      }
    }

    const isControlFirst = control < target
    const cnotSize = l1 * 4 * r2 * 2
    const cnotResult = new Float64Array(cnotSize)

    for (let l = 0; l < l1; l++) {
      for (let r = 0; r < r2; r++) {
        for (let p1 = 0; p1 < 2; p1++) {
          for (let p2 = 0; p2 < 2; p2++) {
            const inIdx = (l * 4 + p1 * 2 + p2) * r2 * 2 + r * 2
            let outP1 = p1, outP2 = p2
            if (isControlFirst && p1 === 1) {
              outP2 = 1 - p2
            } else if (!isControlFirst && p2 === 1) {
              outP1 = 1 - p1
            }
            const outIdx = (l * 4 + outP1 * 2 + outP2) * r2 * 2 + r * 2
            cnotResult[outIdx] = merged[inIdx]
            cnotResult[outIdx + 1] = merged[inIdx + 1]
          }
        }
      }
    }

    const newBondDim = Math.min(MAX_BOND_DIM, Math.min(l1 * 2, r2 * 2))
    const newT1Data = new Float64Array(l1 * 2 * newBondDim * 2)
    const newT2Data = new Float64Array(newBondDim * 2 * r2 * 2)

    for (let l = 0; l < l1; l++) {
      for (let p1 = 0; p1 < 2; p1++) {
        for (let m = 0; m < newBondDim && m < 2; m++) {
          const srcIdx = (l * 4 + p1 * 2 + m) * r2 * 2
          const dstIdx = (l * 2 + p1) * newBondDim * 2 + m * 2
          newT1Data[dstIdx] = cnotResult[srcIdx]
          newT1Data[dstIdx + 1] = cnotResult[srcIdx + 1]
        }
      }
    }

    for (let m = 0; m < newBondDim && m < 2; m++) {
      for (let p2 = 0; p2 < 2; p2++) {
        for (let r = 0; r < r2; r++) {
          const srcIdx = (m * 2 + p2) * r2 * 2 + r * 2
          const dstIdx = (m * 2 + p2) * r2 * 2 + r * 2
          newT2Data[dstIdx] = cnotResult[srcIdx] || 0
          newT2Data[dstIdx + 1] = cnotResult[srcIdx + 1] || 0
        }
      }
    }

    this.mps.tensors[minQ] = { data: newT1Data, shape: [l1, 2, newBondDim] }
    this.mps.tensors[minQ + 1] = { data: newT2Data, shape: [newBondDim, 2, r2] }
    this.mps.bondDimensions[minQ + 1] = newBondDim
  }

  private applyNonAdjacentCNOT(control: number, target: number): void {
    const minQ = Math.min(control, target)
    const maxQ = Math.max(control, target)

    for (let q = minQ; q < maxQ - 1; q++) {
      this.applySWAP(q, q + 1)
    }
    this.applyCNOT(maxQ - 1, maxQ)
    for (let q = maxQ - 2; q >= minQ; q--) {
      this.applySWAP(q, q + 1)
    }
  }

  private applyCZ(control: number, target: number): void {
    this.applySingleQubitGate(target, [1, 0, 0, 0, 0, 0, 1 / 0.7071067811865476, 1 / 0.7071067811865476])
    this.applyCNOT(control, target)
    this.applySingleQubitGate(target, [1, 0, 0, 0, 0, 0, 1 / 0.7071067811865476, -1 / 0.7071067811865476])
  }

  private applySWAP(q1: number, q2: number): void {
    this.applyCNOT(q1, q2)
    this.applyCNOT(q2, q1)
    this.applyCNOT(q1, q2)
  }

  getAmplitude(basisState: number): Complex {
    let resultRe = 1, resultIm = 0

    let leftVec = [1, 0]

    for (let q = 0; q < this.numQubits; q++) {
      const bit = (basisState >> (this.numQubits - 1 - q)) & 1
      const tensor = this.mps.tensors[q]
      const [leftDim, , rightDim] = tensor.shape
      const newLeftVec: number[] = new Array(rightDim * 2).fill(0)

      for (let r = 0; r < rightDim; r++) {
        let sumRe = 0, sumIm = 0
        for (let l = 0; l < leftDim; l++) {
          const idx = (l * 2 + bit) * rightDim * 2 + r * 2
          const tr = tensor.data[idx], ti = tensor.data[idx + 1]
          const lr = leftVec[l * 2] || 0, li = leftVec[l * 2 + 1] || 0
          sumRe += lr * tr - li * ti
          sumIm += lr * ti + li * tr
        }
        newLeftVec[r * 2] = sumRe
        newLeftVec[r * 2 + 1] = sumIm
      }
      leftVec = newLeftVec
    }

    return { re: leftVec[0] || 0, im: leftVec[1] || 0 }
  }

  getProbabilities(): Record<string, number> {
    const probs: Record<string, number> = {}
    const numStates = 1 << this.numQubits

    for (let i = 0; i < numStates; i++) {
      const amp = this.getAmplitude(i)
      const prob = amp.re * amp.re + amp.im * amp.im
      if (prob > 1e-10) {
        const bs = i.toString(2).padStart(this.numQubits, '0')
        probs[bs] = prob
      }
    }

    return probs
  }

  measure(shots: number): Record<string, number> {
    const probs = this.getProbabilities()
    const cumulative: { state: string; cumProb: number }[] = []
    let cum = 0

    for (const [state, prob] of Object.entries(probs)) {
      cum += prob
      cumulative.push({ state, cumProb: cum })
    }

    const counts: Record<string, number> = {}
    for (let i = 0; i < shots; i++) {
      const r = Math.random()
      for (const { state, cumProb } of cumulative) {
        if (r <= cumProb) {
          counts[state] = (counts[state] || 0) + 1
          break
        }
      }
    }

    return counts
  }

  getCurrentBondDimensions(): number[] {
    return [...this.mps.bondDimensions]
  }

  getMaxBondDimension(): number {
    return Math.max(...this.mps.bondDimensions)
  }
}

export function simulateWithTensorNetwork(circuit: QuantumCircuit, shots: number = 1024): SimulationResult {
  const startTime = performance.now()

  const sim = new TensorNetworkSimulator(circuit.numQubits)
  const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)

  for (const gate of sortedGates) {
    sim.applyGate(gate)
  }

  const probabilities = sim.getProbabilities()
  const counts = sim.measure(shots)
  const executionTime = performance.now() - startTime

  const probsFromCounts: Record<string, number> = {}
  for (const [state, count] of Object.entries(counts)) {
    probsFromCounts[state] = count / shots
  }

  return {
    circuitId: circuit.id,
    backend: 'tensor_network',
    method: 'tensor_network',
    executionTime,
    shots,
    counts,
    probabilities: probsFromCounts,
    metadata: {
      tier: 'special',
      bondDimension: sim.getMaxBondDimension()
    }
  }
}

export function estimateTensorNetworkFeasibility(circuit: QuantumCircuit): {
  feasible: boolean
  estimatedBondDimension: number
  reason?: string
} {
  let twoQubitGates = 0
  let maxDistance = 0

  for (const gate of circuit.gates) {
    const allQubits = [...gate.qubits, ...(gate.controlQubits || [])]
    if (allQubits.length >= 2) {
      twoQubitGates++
      const dist = Math.max(...allQubits) - Math.min(...allQubits)
      maxDistance = Math.max(maxDistance, dist)
    }
  }

  const estimatedBondDim = Math.min(
    1 << Math.min(twoQubitGates, 10),
    MAX_BOND_DIM * 2
  )

  if (estimatedBondDim > MAX_BOND_DIM * 4) {
    return {
      feasible: false,
      estimatedBondDimension: estimatedBondDim,
      reason: `High entanglement: estimated bond dimension ${estimatedBondDim} exceeds practical limit`
    }
  }

  if (circuit.numQubits > 100) {
    return {
      feasible: false,
      estimatedBondDimension: estimatedBondDim,
      reason: `Circuit has ${circuit.numQubits} qubits, maximum recommended is 100`
    }
  }

  return {
    feasible: true,
    estimatedBondDimension: estimatedBondDim
  }
}
