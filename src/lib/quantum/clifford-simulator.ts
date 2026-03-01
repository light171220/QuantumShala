import type { QuantumCircuit, CircuitGate, SimulationResult, GateType } from '@/types/simulator'

export class CliffordSimulator {
  private n: number
  private tableau: Uint8Array
  private phases: Uint8Array

  constructor(numQubits: number) {
    this.n = numQubits
    this.tableau = new Uint8Array(2 * numQubits * 2 * numQubits)
    this.phases = new Uint8Array(2 * numQubits)
    this.reset()
  }

  reset(): void {
    const n = this.n
    this.tableau.fill(0)
    this.phases.fill(0)
    for (let i = 0; i < n; i++) {
      this.setX(i, i, 1)
      this.setZ(i + n, i, 1)
    }
  }

  private idx(row: number, col: number): number {
    return row * (2 * this.n) + col
  }

  private getX(row: number, col: number): number {
    return this.tableau[this.idx(row, col)]
  }

  private getZ(row: number, col: number): number {
    return this.tableau[this.idx(row, col) + this.n]
  }

  private setX(row: number, col: number, val: number): void {
    this.tableau[this.idx(row, col)] = val & 1
  }

  private setZ(row: number, col: number, val: number): void {
    this.tableau[this.idx(row, col) + this.n] = val & 1
  }

  private rowSum(h: number, i: number): number {
    let sum = 0
    for (let j = 0; j < this.n; j++) {
      const xi = this.getX(i, j)
      const zi = this.getZ(i, j)
      const xh = this.getX(h, j)
      const zh = this.getZ(h, j)
      if (xi === 1 && zi === 1) {
        sum += zh - xh
      } else if (xi === 1 && zi === 0) {
        sum += zh * (2 * xh - 1)
      } else if (xi === 0 && zi === 1) {
        sum += xh * (1 - 2 * zh)
      }
    }
    sum += 2 * this.phases[i] + 2 * this.phases[h]
    return ((sum % 4) + 4) % 4
  }

  private rowMult(h: number, i: number): void {
    const phase = this.rowSum(h, i)
    this.phases[h] = (phase >> 1) & 1
    for (let j = 0; j < this.n; j++) {
      this.setX(h, j, this.getX(h, j) ^ this.getX(i, j))
      this.setZ(h, j, this.getZ(h, j) ^ this.getZ(i, j))
    }
  }

  applyH(qubit: number): void {
    for (let i = 0; i < 2 * this.n; i++) {
      const xi = this.getX(i, qubit)
      const zi = this.getZ(i, qubit)
      this.phases[i] ^= xi & zi
      this.setX(i, qubit, zi)
      this.setZ(i, qubit, xi)
    }
  }

  applyS(qubit: number): void {
    for (let i = 0; i < 2 * this.n; i++) {
      this.phases[i] ^= this.getX(i, qubit) & this.getZ(i, qubit)
      this.setZ(i, qubit, this.getZ(i, qubit) ^ this.getX(i, qubit))
    }
  }

  applySdg(qubit: number): void {
    this.applyS(qubit)
    this.applyS(qubit)
    this.applyS(qubit)
  }

  applyCNOT(control: number, target: number): void {
    for (let i = 0; i < 2 * this.n; i++) {
      this.phases[i] ^= this.getX(i, control) & this.getZ(i, target) & (this.getX(i, target) ^ this.getZ(i, control) ^ 1)
      this.setX(i, target, this.getX(i, target) ^ this.getX(i, control))
      this.setZ(i, control, this.getZ(i, control) ^ this.getZ(i, target))
    }
  }

  applyX(qubit: number): void {
    this.applyH(qubit)
    this.applyS(qubit)
    this.applyS(qubit)
    this.applyH(qubit)
  }

  applyY(qubit: number): void {
    this.applyS(qubit)
    this.applyS(qubit)
    this.applyH(qubit)
    this.applyS(qubit)
    this.applyS(qubit)
    this.applyH(qubit)
    this.applyS(qubit)
    this.applyS(qubit)
  }

  applyZ(qubit: number): void {
    this.applyS(qubit)
    this.applyS(qubit)
  }

  applyCZ(control: number, target: number): void {
    this.applyH(target)
    this.applyCNOT(control, target)
    this.applyH(target)
  }

  applyCY(control: number, target: number): void {
    this.applySdg(target)
    this.applyCNOT(control, target)
    this.applyS(target)
  }

  applySWAP(q1: number, q2: number): void {
    this.applyCNOT(q1, q2)
    this.applyCNOT(q2, q1)
    this.applyCNOT(q1, q2)
  }

  applyGate(gate: CircuitGate): void {
    const { type, qubits, controlQubits } = gate

    switch (type) {
      case 'H':
        this.applyH(qubits[0])
        break
      case 'S':
        this.applyS(qubits[0])
        break
      case 'Sdg':
        this.applySdg(qubits[0])
        break
      case 'X':
        this.applyX(qubits[0])
        break
      case 'Y':
        this.applyY(qubits[0])
        break
      case 'Z':
        this.applyZ(qubits[0])
        break
      case 'CNOT':
      case 'CX': {
        const control = controlQubits?.[0] ?? qubits[0]
        const target = qubits.length > 1 ? qubits[1] : qubits[0]
        this.applyCNOT(control, target)
        break
      }
      case 'CZ': {
        const control = controlQubits?.[0] ?? qubits[0]
        const target = qubits.length > 1 ? qubits[1] : qubits[0]
        this.applyCZ(control, target)
        break
      }
      case 'CY': {
        const control = controlQubits?.[0] ?? qubits[0]
        const target = qubits.length > 1 ? qubits[1] : qubits[0]
        this.applyCY(control, target)
        break
      }
      case 'SWAP':
        if (qubits.length >= 2) this.applySWAP(qubits[0], qubits[1])
        break
      case 'Barrier':
      case 'Reset':
        break
    }
  }

  measure(qubit: number): number {
    const n = this.n
    let p = -1
    for (let i = n; i < 2 * n; i++) {
      if (this.getX(i, qubit) === 1) {
        p = i
        break
      }
    }

    if (p === -1) {
      let result = 0
      for (let i = 0; i < n; i++) {
        if (this.getX(i, qubit) === 1) {
          result ^= this.phases[i + n]
        }
      }
      return result
    }

    for (let i = 0; i < 2 * n; i++) {
      if (i !== p && this.getX(i, qubit) === 1) {
        this.rowMult(i, p)
      }
    }

    for (let j = 0; j < n; j++) {
      this.setX(p - n, j, this.getX(p, j))
      this.setZ(p - n, j, this.getZ(p, j))
    }
    this.phases[p - n] = this.phases[p]

    for (let j = 0; j < n; j++) {
      this.setX(p, j, 0)
      this.setZ(p, j, 0)
    }
    this.setZ(p, qubit, 1)

    const outcome = Math.random() < 0.5 ? 0 : 1
    this.phases[p] = outcome
    return outcome
  }

  measureAll(): number[] {
    const results: number[] = []
    for (let q = 0; q < this.n; q++) {
      results.push(this.measure(q))
    }
    return results
  }
}

export function isCliffordCircuit(circuit: QuantumCircuit): boolean {
  const cliffordGates: Set<GateType> = new Set(['H', 'S', 'Sdg', 'X', 'Y', 'Z', 'CNOT', 'CX', 'CZ', 'CY', 'SWAP', 'Barrier', 'Reset'])
  for (const gate of circuit.gates) {
    if (!cliffordGates.has(gate.type)) {
      return false
    }
  }
  return true
}

export function simulateCliffordCircuit(circuit: QuantumCircuit, shots: number = 1024): SimulationResult {
  const startTime = performance.now()

  if (!isCliffordCircuit(circuit)) {
    throw new Error('Circuit contains non-Clifford gates. Use state-vector simulation instead.')
  }

  const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)
  const counts: Record<string, number> = {}

  for (let shot = 0; shot < shots; shot++) {
    const sim = new CliffordSimulator(circuit.numQubits)
    for (const gate of sortedGates) {
      sim.applyGate(gate)
    }
    const measurement = sim.measureAll()
    const bitString = measurement.reverse().map(b => b.toString()).join('')
    counts[bitString] = (counts[bitString] || 0) + 1
  }

  const probabilities: Record<string, number> = {}
  for (const [state, count] of Object.entries(counts)) {
    probabilities[state] = count / shots
  }

  const executionTime = performance.now() - startTime

  return {
    circuitId: circuit.id,
    backend: 'clifford',
    method: 'clifford',
    executionTime,
    shots,
    counts,
    probabilities,
    metadata: {
      tier: 'special',
      memoryUsedMB: (4 * circuit.numQubits * circuit.numQubits + 2 * circuit.numQubits) / (1024 * 1024)
    }
  }
}

export function estimateCliffordMemory(numQubits: number): number {
  return (4 * numQubits * numQubits + 2 * numQubits) / (1024 * 1024)
}

export function maxCliffordQubits(memoryMB: number): number {
  const n = Math.floor(Math.sqrt(memoryMB * 1024 * 1024 / 4))
  return Math.min(n, 10000)
}
