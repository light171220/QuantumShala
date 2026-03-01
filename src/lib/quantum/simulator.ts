import type { QuantumCircuit, CircuitGate, SimulationResult, Complex, BlochVector } from '@/types/simulator'

const BROWSER_MAX_QUBITS = 20

export class QuantumSimulator {
  private numQubits: number
  private numStates: number
  private stateReal: Float64Array
  private stateImag: Float64Array

  constructor(numQubits: number) {
    if (numQubits > BROWSER_MAX_QUBITS) {
      throw new Error(`Browser supports max ${BROWSER_MAX_QUBITS} qubits. Use cloud for larger circuits.`)
    }
    this.numQubits = numQubits
    this.numStates = 1 << numQubits
    this.stateReal = new Float64Array(this.numStates)
    this.stateImag = new Float64Array(this.numStates)
    this.stateReal[0] = 1
  }

  reset(): void {
    this.stateReal.fill(0)
    this.stateImag.fill(0)
    this.stateReal[0] = 1
  }

  getStateVector(): Complex[] {
    const result: Complex[] = new Array(this.numStates)
    for (let i = 0; i < this.numStates; i++) {
      result[i] = { re: this.stateReal[i], im: this.stateImag[i] }
    }
    return result
  }

  private applySingleQubitGate(qubit: number, m00r: number, m00i: number, m01r: number, m01i: number, m10r: number, m10i: number, m11r: number, m11i: number): void {
    const stride = 1 << qubit
    for (let i = 0; i < this.numStates; i += stride << 1) {
      for (let j = 0; j < stride; j++) {
        const idx0 = i + j
        const idx1 = idx0 + stride
        const r0 = this.stateReal[idx0], i0 = this.stateImag[idx0]
        const r1 = this.stateReal[idx1], i1 = this.stateImag[idx1]
        this.stateReal[idx0] = m00r * r0 - m00i * i0 + m01r * r1 - m01i * i1
        this.stateImag[idx0] = m00r * i0 + m00i * r0 + m01r * i1 + m01i * r1
        this.stateReal[idx1] = m10r * r0 - m10i * i0 + m11r * r1 - m11i * i1
        this.stateImag[idx1] = m10r * i0 + m10i * r0 + m11r * i1 + m11i * r1
      }
    }
  }

  private applyControlledGate(control: number, target: number, m00r: number, m00i: number, m01r: number, m01i: number, m10r: number, m10i: number, m11r: number, m11i: number): void {
    const controlMask = 1 << control
    const targetMask = 1 << target
    for (let i = 0; i < this.numStates; i++) {
      if ((i & controlMask) === 0) continue
      if ((i & targetMask) !== 0) continue
      const idx0 = i
      const idx1 = i | targetMask
      const r0 = this.stateReal[idx0], i0 = this.stateImag[idx0]
      const r1 = this.stateReal[idx1], i1 = this.stateImag[idx1]
      this.stateReal[idx0] = m00r * r0 - m00i * i0 + m01r * r1 - m01i * i1
      this.stateImag[idx0] = m00r * i0 + m00i * r0 + m01r * i1 + m01i * r1
      this.stateReal[idx1] = m10r * r0 - m10i * i0 + m11r * r1 - m11i * i1
      this.stateImag[idx1] = m10r * i0 + m10i * r0 + m11r * i1 + m11i * r1
    }
  }

  private applySwap(qubit1: number, qubit2: number): void {
    const mask1 = 1 << qubit1
    const mask2 = 1 << qubit2
    for (let i = 0; i < this.numStates; i++) {
      const bit1 = (i & mask1) !== 0
      const bit2 = (i & mask2) !== 0
      if (bit1 !== bit2) {
        const swapped = (i ^ mask1) ^ mask2
        if (i < swapped) {
          const tr = this.stateReal[i], ti = this.stateImag[i]
          this.stateReal[i] = this.stateReal[swapped]
          this.stateImag[i] = this.stateImag[swapped]
          this.stateReal[swapped] = tr
          this.stateImag[swapped] = ti
        }
      }
    }
  }

  private applyiSwap(qubit1: number, qubit2: number): void {
    const mask1 = 1 << qubit1
    const mask2 = 1 << qubit2
    for (let i = 0; i < this.numStates; i++) {
      const bit1 = (i & mask1) !== 0
      const bit2 = (i & mask2) !== 0
      if (bit1 !== bit2) {
        const swapped = (i ^ mask1) ^ mask2
        if (i < swapped) {
          const tr = this.stateReal[i], ti = this.stateImag[i]
          const sr = this.stateReal[swapped], si = this.stateImag[swapped]
          this.stateReal[i] = -si
          this.stateImag[i] = sr
          this.stateReal[swapped] = -ti
          this.stateImag[swapped] = tr
        }
      }
    }
  }

  private applyToffoli(c1: number, c2: number, target: number): void {
    const c1Mask = 1 << c1
    const c2Mask = 1 << c2
    const targetMask = 1 << target
    for (let i = 0; i < this.numStates; i++) {
      if ((i & c1Mask) === 0 || (i & c2Mask) === 0) continue
      if ((i & targetMask) !== 0) continue
      const idx0 = i
      const idx1 = i | targetMask
      const tr = this.stateReal[idx0], ti = this.stateImag[idx0]
      this.stateReal[idx0] = this.stateReal[idx1]
      this.stateImag[idx0] = this.stateImag[idx1]
      this.stateReal[idx1] = tr
      this.stateImag[idx1] = ti
    }
  }

  private applyFredkin(control: number, t1: number, t2: number): void {
    const controlMask = 1 << control
    const t1Mask = 1 << t1
    const t2Mask = 1 << t2
    for (let i = 0; i < this.numStates; i++) {
      if ((i & controlMask) === 0) continue
      const bit1 = (i & t1Mask) !== 0
      const bit2 = (i & t2Mask) !== 0
      if (bit1 !== bit2) {
        const swapped = (i ^ t1Mask) ^ t2Mask
        if (i < swapped) {
          const tr = this.stateReal[i], ti = this.stateImag[i]
          this.stateReal[i] = this.stateReal[swapped]
          this.stateImag[i] = this.stateImag[swapped]
          this.stateReal[swapped] = tr
          this.stateImag[swapped] = ti
        }
      }
    }
  }

  applyGate(gate: CircuitGate): void {
    const { type, qubits, parameters, controlQubits } = gate
    const sqrt2Inv = 0.7071067811865476

    switch (type) {
      case 'H':
        this.applySingleQubitGate(qubits[0], sqrt2Inv, 0, sqrt2Inv, 0, sqrt2Inv, 0, -sqrt2Inv, 0)
        break
      case 'X':
        this.applySingleQubitGate(qubits[0], 0, 0, 1, 0, 1, 0, 0, 0)
        break
      case 'Y':
        this.applySingleQubitGate(qubits[0], 0, 0, 0, -1, 0, 1, 0, 0)
        break
      case 'Z':
        this.applySingleQubitGate(qubits[0], 1, 0, 0, 0, 0, 0, -1, 0)
        break
      case 'S':
        this.applySingleQubitGate(qubits[0], 1, 0, 0, 0, 0, 0, 0, 1)
        break
      case 'T':
        this.applySingleQubitGate(qubits[0], 1, 0, 0, 0, 0, 0, sqrt2Inv, sqrt2Inv)
        break
      case 'Sdg':
        this.applySingleQubitGate(qubits[0], 1, 0, 0, 0, 0, 0, 0, -1)
        break
      case 'Tdg':
        this.applySingleQubitGate(qubits[0], 1, 0, 0, 0, 0, 0, sqrt2Inv, -sqrt2Inv)
        break
      case 'Rx': {
        const theta = parameters?.[0] || 0
        const cos = Math.cos(theta / 2), sin = Math.sin(theta / 2)
        this.applySingleQubitGate(qubits[0], cos, 0, 0, -sin, 0, -sin, cos, 0)
        break
      }
      case 'Ry': {
        const theta = parameters?.[0] || 0
        const cos = Math.cos(theta / 2), sin = Math.sin(theta / 2)
        this.applySingleQubitGate(qubits[0], cos, 0, -sin, 0, sin, 0, cos, 0)
        break
      }
      case 'Rz': {
        const theta = parameters?.[0] || 0
        const cosN = Math.cos(-theta / 2), sinN = Math.sin(-theta / 2)
        const cosP = Math.cos(theta / 2), sinP = Math.sin(theta / 2)
        this.applySingleQubitGate(qubits[0], cosN, sinN, 0, 0, 0, 0, cosP, sinP)
        break
      }
      case 'Phase':
      case 'U1': {
        const lambda = parameters?.[0] || 0
        const cosL = Math.cos(lambda), sinL = Math.sin(lambda)
        this.applySingleQubitGate(qubits[0], 1, 0, 0, 0, 0, 0, cosL, sinL)
        break
      }
      case 'U2': {
        const phi = parameters?.[0] || 0
        const lambda = parameters?.[1] || 0
        const cosP = Math.cos(phi), sinP = Math.sin(phi)
        const cosL = Math.cos(lambda), sinL = Math.sin(lambda)
        const cosPL = Math.cos(phi + lambda), sinPL = Math.sin(phi + lambda)
        this.applySingleQubitGate(qubits[0], sqrt2Inv, 0, -sqrt2Inv * cosL, -sqrt2Inv * sinL, sqrt2Inv * cosP, sqrt2Inv * sinP, sqrt2Inv * cosPL, sqrt2Inv * sinPL)
        break
      }
      case 'U':
      case 'U3': {
        const theta = parameters?.[0] || 0
        const phi = parameters?.[1] || 0
        const lambda = parameters?.[2] || 0
        const cos = Math.cos(theta / 2), sin = Math.sin(theta / 2)
        const cosP = Math.cos(phi), sinP = Math.sin(phi)
        const cosL = Math.cos(lambda), sinL = Math.sin(lambda)
        const cosPL = Math.cos(phi + lambda), sinPL = Math.sin(phi + lambda)
        this.applySingleQubitGate(qubits[0], cos, 0, -sin * cosL, -sin * sinL, sin * cosP, sin * sinP, cos * cosPL, cos * sinPL)
        break
      }
      case 'CNOT':
      case 'CX': {
        const control = controlQubits?.[0] ?? qubits[0]
        const target = qubits.length > 1 ? qubits[1] : qubits[0]
        this.applyControlledGate(control, target, 0, 0, 1, 0, 1, 0, 0, 0)
        break
      }
      case 'CY': {
        const control = controlQubits?.[0] ?? qubits[0]
        const target = qubits.length > 1 ? qubits[1] : qubits[0]
        this.applyControlledGate(control, target, 0, 0, 0, -1, 0, 1, 0, 0)
        break
      }
      case 'CZ': {
        const control = controlQubits?.[0] ?? qubits[0]
        const target = qubits.length > 1 ? qubits[1] : qubits[0]
        this.applyControlledGate(control, target, 1, 0, 0, 0, 0, 0, -1, 0)
        break
      }
      case 'CPhase': {
        const control = controlQubits?.[0] ?? qubits[0]
        const target = qubits.length > 1 ? qubits[1] : qubits[0]
        const lambda = parameters?.[0] || 0
        const cosL = Math.cos(lambda), sinL = Math.sin(lambda)
        this.applyControlledGate(control, target, 1, 0, 0, 0, 0, 0, cosL, sinL)
        break
      }
      case 'CRx': {
        const control = controlQubits?.[0] ?? qubits[0]
        const target = qubits.length > 1 ? qubits[1] : qubits[0]
        const theta = parameters?.[0] || 0
        const cos = Math.cos(theta / 2), sin = Math.sin(theta / 2)
        this.applyControlledGate(control, target, cos, 0, 0, -sin, 0, -sin, cos, 0)
        break
      }
      case 'CRy': {
        const control = controlQubits?.[0] ?? qubits[0]
        const target = qubits.length > 1 ? qubits[1] : qubits[0]
        const theta = parameters?.[0] || 0
        const cos = Math.cos(theta / 2), sin = Math.sin(theta / 2)
        this.applyControlledGate(control, target, cos, 0, -sin, 0, sin, 0, cos, 0)
        break
      }
      case 'CRz': {
        const control = controlQubits?.[0] ?? qubits[0]
        const target = qubits.length > 1 ? qubits[1] : qubits[0]
        const theta = parameters?.[0] || 0
        const cosN = Math.cos(-theta / 2), sinN = Math.sin(-theta / 2)
        const cosP = Math.cos(theta / 2), sinP = Math.sin(theta / 2)
        this.applyControlledGate(control, target, cosN, sinN, 0, 0, 0, 0, cosP, sinP)
        break
      }
      case 'SWAP':
        if (qubits.length >= 2) this.applySwap(qubits[0], qubits[1])
        break
      case 'iSWAP':
        if (qubits.length >= 2) this.applyiSwap(qubits[0], qubits[1])
        break
      case 'Toffoli':
        if (qubits.length >= 3) this.applyToffoli(qubits[0], qubits[1], qubits[2])
        break
      case 'Fredkin':
        if (qubits.length >= 3) this.applyFredkin(qubits[0], qubits[1], qubits[2])
        break
      case 'Reset':
        this.measureAndCollapse(qubits[0], 0)
        break
      case 'Barrier':
        break
      case 'Custom':
        break
    }
  }

  private measureAndCollapse(qubit: number, outcome: number): void {
    const mask = 1 << qubit
    let norm = 0
    for (let i = 0; i < this.numStates; i++) {
      const bitValue = (i & mask) !== 0 ? 1 : 0
      if (bitValue === outcome) {
        norm += this.stateReal[i] * this.stateReal[i] + this.stateImag[i] * this.stateImag[i]
      } else {
        this.stateReal[i] = 0
        this.stateImag[i] = 0
      }
    }
    if (norm === 0) norm = 1
    const normFactor = 1 / Math.sqrt(norm)
    for (let i = 0; i < this.numStates; i++) {
      const bitValue = (i & mask) !== 0 ? 1 : 0
      if (bitValue === outcome) {
        this.stateReal[i] *= normFactor
        this.stateImag[i] *= normFactor
      }
    }
  }

  measure(qubit: number): number {
    const mask = 1 << qubit
    let prob0 = 0
    for (let i = 0; i < this.numStates; i++) {
      if ((i & mask) === 0) {
        prob0 += this.stateReal[i] * this.stateReal[i] + this.stateImag[i] * this.stateImag[i]
      }
    }
    const outcome = Math.random() < prob0 ? 0 : 1
    this.measureAndCollapse(qubit, outcome)
    return outcome
  }

  measureAll(): number[] {
    let cumulative = 0
    const probs = new Float64Array(this.numStates)
    for (let i = 0; i < this.numStates; i++) {
      cumulative += this.stateReal[i] * this.stateReal[i] + this.stateImag[i] * this.stateImag[i]
      probs[i] = cumulative
    }
    const rand = Math.random()
    let outcome = 0
    for (let i = 0; i < this.numStates; i++) {
      if (rand <= probs[i]) {
        outcome = i
        break
      }
    }
    this.stateReal.fill(0)
    this.stateImag.fill(0)
    this.stateReal[outcome] = 1
    const bits: number[] = []
    for (let q = 0; q < this.numQubits; q++) {
      bits.push((outcome >> q) & 1)
    }
    return bits
  }

  getProbabilities(): Float64Array {
    const probs = new Float64Array(this.numStates)
    for (let i = 0; i < this.numStates; i++) {
      probs[i] = this.stateReal[i] * this.stateReal[i] + this.stateImag[i] * this.stateImag[i]
    }
    return probs
  }

  getBlochVector(qubit: number): BlochVector {
    const mask = 1 << qubit
    let rho00r = 0, rho00i = 0, rho01r = 0, rho01i = 0, rho11r = 0, rho11i = 0
    for (let i = 0; i < this.numStates; i++) {
      for (let j = 0; j < this.numStates; j++) {
        const otherBitsI = i & ~mask
        const otherBitsJ = j & ~mask
        if (otherBitsI !== otherBitsJ) continue
        const bitI = (i & mask) !== 0 ? 1 : 0
        const bitJ = (j & mask) !== 0 ? 1 : 0
        const cr = this.stateReal[i] * this.stateReal[j] + this.stateImag[i] * this.stateImag[j]
        const ci = this.stateReal[j] * this.stateImag[i] - this.stateReal[i] * this.stateImag[j]
        if (bitI === 0 && bitJ === 0) { rho00r += cr; rho00i += ci }
        else if (bitI === 0 && bitJ === 1) { rho01r += cr; rho01i += ci }
        else if (bitI === 1 && bitJ === 1) { rho11r += cr; rho11i += ci }
      }
    }
    const x = 2 * rho01r
    const y = 2 * rho01i
    const z = rho00r - rho11r
    const zClamped = Math.max(-1, Math.min(1, z))
    const theta = Math.acos(zClamped)
    const phi = Math.atan2(y, x)
    return { qubit, x, y, z, theta: isNaN(theta) ? 0 : theta, phi: isNaN(phi) ? 0 : phi }
  }
}

export function simulateCircuit(circuit: QuantumCircuit, shots: number = 1024): SimulationResult {
  const startTime = performance.now()
  const sim = new QuantumSimulator(circuit.numQubits)
  const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)
  for (const gate of sortedGates) {
    sim.applyGate(gate)
  }
  const stateVector = sim.getStateVector()
  const probabilities = sim.getProbabilities()
  const blochVectors: BlochVector[] = []
  for (let q = 0; q < circuit.numQubits; q++) {
    blochVectors.push(sim.getBlochVector(q))
  }
  const counts: Record<string, number> = {}
  for (let shot = 0; shot < shots; shot++) {
    let cumulative = 0
    const rand = Math.random()
    let outcome = 0
    for (let i = 0; i < probabilities.length; i++) {
      cumulative += probabilities[i]
      if (rand <= cumulative) {
        outcome = i
        break
      }
    }
    const bitString = outcome.toString(2).padStart(circuit.numQubits, '0')
    counts[bitString] = (counts[bitString] || 0) + 1
  }
  const probsFromCounts: Record<string, number> = {}
  for (const [state, count] of Object.entries(counts)) {
    probsFromCounts[state] = count / shots
  }
  const executionTime = performance.now() - startTime
  return {
    circuitId: circuit.id,
    backend: 'browser',
    method: 'state-vector',
    executionTime,
    shots,
    counts,
    probabilities: probsFromCounts,
    stateVector,
    blochVectors,
    metadata: {
      tier: 'browser',
      memoryUsedMB: (circuit.numQubits <= 20) ? Math.pow(2, circuit.numQubits) * 16 / (1024 * 1024) : 0
    }
  }
}

export function verifyBellState(): boolean {
  const circuit: QuantumCircuit = {
    id: 'test-bell',
    name: 'Bell State Test',
    numQubits: 2,
    gates: [
      { id: 'h0', type: 'H', qubits: [0], position: 0 },
      { id: 'cx01', type: 'CNOT', qubits: [0, 1], position: 1 },
    ],
    measurements: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublic: false,
    likes: 0,
    tags: [],
  }
  const result = simulateCircuit(circuit, 10000)
  const count00 = result.counts['00'] || 0
  const count11 = result.counts['11'] || 0
  const count01 = result.counts['01'] || 0
  const count10 = result.counts['10'] || 0
  const ratio00 = count00 / 10000
  const ratio11 = count11 / 10000
  return ratio00 > 0.45 && ratio00 < 0.55 && ratio11 > 0.45 && ratio11 < 0.55 && count01 < 100 && count10 < 100
}

export { BROWSER_MAX_QUBITS }
