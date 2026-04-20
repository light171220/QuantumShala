import type { QuantumCircuit, CircuitGate, SimulationResult, Complex } from '@/types/simulator'

export interface Subcircuit {
  id: number
  numQubits: number
  gates: CircuitGate[]
  originalQubits: number[]
  qubitMapping: Map<number, number>
  inputStates: number[]
  cutEdges: CutEdge[]
}

export interface CutEdge {
  originalQubit: number
  position: number
  type: 'measure' | 'prepare'
}

export interface SubcircuitResult {
  subcircuitId: number
  inputState: number
  counts: Record<string, number>
  probabilities: Record<string, number>
  executionTimeMs: number
}

export interface CuttingPlan {
  subcircuits: Subcircuit[]
  cutEdges: CutEdge[]
  totalCuts: number
  overheadFactor: number
  estimatedSubcircuitRuns: number
}

export interface CircuitCuttingResult extends SimulationResult {
  subcircuitResults: SubcircuitResult[]
  cuttingPlan: CuttingPlan
}

const LAMBDA_MAX_QUBITS = 27

export function planCircuitCuts(circuit: QuantumCircuit, maxSubcircuitQubits: number = LAMBDA_MAX_QUBITS): CuttingPlan {
  const { numQubits, gates } = circuit
  const numSubcircuits = Math.ceil(numQubits / maxSubcircuitQubits)

  if (numSubcircuits === 1) {
    return {
      subcircuits: [{
        id: 0,
        numQubits,
        gates,
        originalQubits: Array.from({ length: numQubits }, (_, i) => i),
        qubitMapping: new Map(Array.from({ length: numQubits }, (_, i) => [i, i])),
        inputStates: [0],
        cutEdges: []
      }],
      cutEdges: [],
      totalCuts: 0,
      overheadFactor: 1,
      estimatedSubcircuitRuns: 1
    }
  }

  const crossings = new Array(numQubits - 1).fill(0)
  for (const gate of gates) {
    const allQubits = [...gate.qubits, ...(gate.controlQubits || [])]
    if (allQubits.length >= 2) {
      const minQ = Math.min(...allQubits)
      const maxQ = Math.max(...allQubits)
      for (let i = minQ; i < maxQ; i++) {
        crossings[i]++
      }
    }
  }

  const cutPositions: number[] = []
  const targetSize = Math.ceil(numQubits / numSubcircuits)

  for (let i = 1; i < numSubcircuits; i++) {
    const idealPosition = i * targetSize - 1
    let bestCut = idealPosition
    let minCrossing = Infinity

    for (let j = Math.max(0, idealPosition - 3); j <= Math.min(numQubits - 2, idealPosition + 3); j++) {
      if (crossings[j] < minCrossing) {
        minCrossing = crossings[j]
        bestCut = j
      }
    }
    cutPositions.push(bestCut)
  }

  const cutEdges: CutEdge[] = []
  let position = 0
  for (const gate of gates) {
    const allQubits = [...gate.qubits, ...(gate.controlQubits || [])]
    if (allQubits.length >= 2) {
      const minQ = Math.min(...allQubits)
      const maxQ = Math.max(...allQubits)
      for (const cutPos of cutPositions) {
        if (minQ <= cutPos && maxQ > cutPos) {
          cutEdges.push({
            originalQubit: maxQ,
            position,
            type: 'measure'
          })
          cutEdges.push({
            originalQubit: maxQ,
            position: position + 1,
            type: 'prepare'
          })
        }
      }
    }
    position++
  }

  const subcircuits: Subcircuit[] = []
  let startQubit = 0

  for (let i = 0; i < numSubcircuits; i++) {
    const endQubit = i < cutPositions.length ? cutPositions[i] + 1 : numQubits
    const originalQubits = Array.from({ length: endQubit - startQubit }, (_, j) => startQubit + j)
    const qubitMapping = new Map<number, number>()
    originalQubits.forEach((oq, idx) => qubitMapping.set(oq, idx))

    const subcircuitGates = gates
      .filter(gate => {
        const allQubits = [...gate.qubits, ...(gate.controlQubits || [])]
        return allQubits.every(q => q >= startQubit && q < endQubit)
      })
      .map(gate => ({
        ...gate,
        qubits: gate.qubits.map(q => qubitMapping.get(q)!),
        controlQubits: gate.controlQubits?.map(q => qubitMapping.get(q)!)
      }))

    const subcircuitCutEdges = cutEdges.filter(
      edge => edge.originalQubit >= startQubit && edge.originalQubit < endQubit
    )

    subcircuits.push({
      id: i,
      numQubits: endQubit - startQubit,
      gates: subcircuitGates,
      originalQubits,
      qubitMapping,
      inputStates: i === 0 ? [0] : [0, 1],
      cutEdges: subcircuitCutEdges
    })

    startQubit = endQubit
  }

  const totalCuts = cutPositions.reduce((sum, pos) => sum + crossings[pos], 0)
  const overheadFactor = Math.pow(4, totalCuts)
  const estimatedSubcircuitRuns = subcircuits.reduce(
    (sum, sub) => sum * sub.inputStates.length,
    1
  ) * 4

  return {
    subcircuits,
    cutEdges,
    totalCuts,
    overheadFactor,
    estimatedSubcircuitRuns
  }
}

class MiniSimulator {
  private numQubits: number
  private stateReal: Float64Array
  private stateImag: Float64Array

  constructor(numQubits: number, initialState: number = 0) {
    this.numQubits = numQubits
    const size = 1 << numQubits
    this.stateReal = new Float64Array(size)
    this.stateImag = new Float64Array(size)
    this.stateReal[initialState] = 1
  }

  applyGate(gate: CircuitGate): void {
    const target = gate.qubits[gate.qubits.length - 1]
    const SQRT2_INV = 0.7071067811865476

    switch (gate.type) {
      case 'H':
        this.applySingle(target, SQRT2_INV, 0, SQRT2_INV, 0, SQRT2_INV, 0, -SQRT2_INV, 0)
        break
      case 'X':
        this.applySingle(target, 0, 0, 1, 0, 1, 0, 0, 0)
        break
      case 'Y':
        this.applySingle(target, 0, 0, 0, -1, 0, 1, 0, 0)
        break
      case 'Z':
        this.applySingle(target, 1, 0, 0, 0, 0, 0, -1, 0)
        break
      case 'S':
        this.applySingle(target, 1, 0, 0, 0, 0, 0, 0, 1)
        break
      case 'T':
        this.applySingle(target, 1, 0, 0, 0, 0, 0, SQRT2_INV, SQRT2_INV)
        break
      case 'Rx': {
        const theta = gate.parameters?.[0] || 0
        const c = Math.cos(theta / 2), s = Math.sin(theta / 2)
        this.applySingle(target, c, 0, 0, -s, 0, -s, c, 0)
        break
      }
      case 'Ry': {
        const theta = gate.parameters?.[0] || 0
        const c = Math.cos(theta / 2), s = Math.sin(theta / 2)
        this.applySingle(target, c, 0, -s, 0, s, 0, c, 0)
        break
      }
      case 'Rz': {
        const theta = gate.parameters?.[0] || 0
        const cn = Math.cos(-theta / 2), sn = Math.sin(-theta / 2)
        const cp = Math.cos(theta / 2), sp = Math.sin(theta / 2)
        this.applySingle(target, cn, sn, 0, 0, 0, 0, cp, sp)
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

  private applySingle(q: number, m00r: number, m00i: number, m01r: number, m01i: number, m10r: number, m10i: number, m11r: number, m11i: number): void {
    const size = this.stateReal.length
    const stride = 1 << q
    for (let i = 0; i < size; i += stride << 1) {
      for (let j = 0; j < stride; j++) {
        const idx0 = i + j, idx1 = idx0 + stride
        const r0 = this.stateReal[idx0], i0 = this.stateImag[idx0]
        const r1 = this.stateReal[idx1], i1 = this.stateImag[idx1]
        this.stateReal[idx0] = m00r * r0 - m00i * i0 + m01r * r1 - m01i * i1
        this.stateImag[idx0] = m00r * i0 + m00i * r0 + m01r * i1 + m01i * r1
        this.stateReal[idx1] = m10r * r0 - m10i * i0 + m11r * r1 - m11i * i1
        this.stateImag[idx1] = m10r * i0 + m10i * r0 + m11r * i1 + m11i * r1
      }
    }
  }

  private applyCNOT(control: number, target: number): void {
    const size = this.stateReal.length
    const cm = 1 << control, tm = 1 << target
    for (let i = 0; i < size; i++) {
      if ((i & cm) !== 0 && (i & tm) === 0) {
        const j = i | tm
        const tr = this.stateReal[i], ti = this.stateImag[i]
        this.stateReal[i] = this.stateReal[j]
        this.stateImag[i] = this.stateImag[j]
        this.stateReal[j] = tr
        this.stateImag[j] = ti
      }
    }
  }

  private applyCZ(control: number, target: number): void {
    const size = this.stateReal.length
    const cm = 1 << control, tm = 1 << target
    for (let i = 0; i < size; i++) {
      if ((i & cm) !== 0 && (i & tm) !== 0) {
        this.stateReal[i] = -this.stateReal[i]
        this.stateImag[i] = -this.stateImag[i]
      }
    }
  }

  private applySWAP(q1: number, q2: number): void {
    const size = this.stateReal.length
    const m1 = 1 << q1, m2 = 1 << q2
    for (let i = 0; i < size; i++) {
      const b1 = (i & m1) !== 0, b2 = (i & m2) !== 0
      if (b1 !== b2) {
        const swapped = (i ^ m1) ^ m2
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

  getProbabilities(): Record<string, number> {
    const probs: Record<string, number> = {}
    const size = this.stateReal.length
    for (let i = 0; i < size; i++) {
      const prob = this.stateReal[i] ** 2 + this.stateImag[i] ** 2
      if (prob > 1e-10) {
        const bs = i.toString(2).padStart(this.numQubits, '0')
        probs[bs] = prob
      }
    }
    return probs
  }

  measure(shots: number): Record<string, number> {
    const size = this.stateReal.length
    const cumulative = new Float64Array(size)
    let sum = 0
    for (let i = 0; i < size; i++) {
      sum += this.stateReal[i] ** 2 + this.stateImag[i] ** 2
      cumulative[i] = sum
    }
    const counts: Record<string, number> = {}
    for (let s = 0; s < shots; s++) {
      const r = Math.random()
      let lo = 0, hi = size - 1
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        if (cumulative[mid] < r) lo = mid + 1
        else hi = mid
      }
      const bs = lo.toString(2).padStart(this.numQubits, '0')
      counts[bs] = (counts[bs] || 0) + 1
    }
    return counts
  }
}

export function runSubcircuit(subcircuit: Subcircuit, inputState: number, shots: number): SubcircuitResult {
  const startTime = performance.now()
  const sim = new MiniSimulator(subcircuit.numQubits, inputState)

  const sortedGates = [...subcircuit.gates].sort((a, b) => a.position - b.position)
  for (const gate of sortedGates) {
    sim.applyGate(gate)
  }

  const probabilities = sim.getProbabilities()
  const counts = sim.measure(shots)

  return {
    subcircuitId: subcircuit.id,
    inputState,
    counts,
    probabilities,
    executionTimeMs: performance.now() - startTime
  }
}

export function combineSubcircuitResults(
  results: SubcircuitResult[],
  plan: CuttingPlan,
  totalQubits: number,
  shots: number
): { counts: Record<string, number>; probabilities: Record<string, number> } {
  const numSubcircuits = plan.subcircuits.length

  if (numSubcircuits === 1) {
    const r = results[0]
    return { counts: r.counts, probabilities: r.probabilities }
  }

  const groupedResults: Map<number, SubcircuitResult[]> = new Map()
  for (const r of results) {
    if (!groupedResults.has(r.subcircuitId)) {
      groupedResults.set(r.subcircuitId, [])
    }
    groupedResults.get(r.subcircuitId)!.push(r)
  }

  const combinedProbs: Record<string, number> = {}

  const subcircuitProbs: Record<string, number>[][] = []
  for (let i = 0; i < numSubcircuits; i++) {
    const subResults = groupedResults.get(i) || []
    subcircuitProbs.push(subResults.map(r => r.probabilities))
  }

  function combineRecursive(subIdx: number, inputIdx: number, prefix: string, weight: number): void {
    if (subIdx >= numSubcircuits) {
      if (weight > 1e-10) {
        combinedProbs[prefix] = (combinedProbs[prefix] || 0) + weight
      }
      return
    }

    const probs = subcircuitProbs[subIdx][inputIdx] || {}
    for (const [state, prob] of Object.entries(probs)) {
      const nextInputIdx = state[state.length - 1] === '1' ? 1 : 0
      const newWeight = weight * prob
      if (subIdx === numSubcircuits - 1) {
        const fullState = prefix + state
        if (newWeight > 1e-10) {
          combinedProbs[fullState] = (combinedProbs[fullState] || 0) + newWeight
        }
      } else {
        combineRecursive(subIdx + 1, nextInputIdx, prefix + state, newWeight)
      }
    }
  }

  combineRecursive(0, 0, '', 1)

  let total = 0
  for (const p of Object.values(combinedProbs)) {
    total += p
  }
  if (total > 0) {
    for (const state of Object.keys(combinedProbs)) {
      combinedProbs[state] /= total
    }
  }

  const cumulative: { state: string; cumProb: number }[] = []
  let cum = 0
  for (const [state, prob] of Object.entries(combinedProbs)) {
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

  return { counts, probabilities: combinedProbs }
}

export function simulateWithCircuitCutting(
  circuit: QuantumCircuit,
  shots: number = 1024,
  maxSubcircuitQubits: number = LAMBDA_MAX_QUBITS
): CircuitCuttingResult {
  const startTime = performance.now()
  const plan = planCircuitCuts(circuit, maxSubcircuitQubits)

  const results: SubcircuitResult[] = []
  const shotsPerSubcircuit = Math.ceil(shots / plan.estimatedSubcircuitRuns)

  for (const subcircuit of plan.subcircuits) {
    for (const inputState of subcircuit.inputStates) {
      const result = runSubcircuit(subcircuit, inputState, shotsPerSubcircuit)
      results.push(result)
    }
  }

  const { counts, probabilities } = combineSubcircuitResults(results, plan, circuit.numQubits, shots)
  const executionTime = performance.now() - startTime

  return {
    circuitId: circuit.id,
    backend: 'circuit_cutting',
    method: 'circuit_cutting',
    executionTime,
    shots,
    counts,
    probabilities,
    subcircuitResults: results,
    cuttingPlan: plan,
    metadata: {
      tier: 'special',
      numCuts: plan.totalCuts,
      numWorkers: plan.subcircuits.length
    }
  }
}

export interface LambdaSubcircuitPayload {
  subcircuitId: number
  numQubits: number
  gates: CircuitGate[]
  inputState: number
  shots: number
}

export function prepareParallelPayloads(circuit: QuantumCircuit, shots: number = 1024): LambdaSubcircuitPayload[] {
  const plan = planCircuitCuts(circuit)
  const payloads: LambdaSubcircuitPayload[] = []
  const shotsPerSubcircuit = Math.ceil(shots / plan.estimatedSubcircuitRuns)

  for (const subcircuit of plan.subcircuits) {
    for (const inputState of subcircuit.inputStates) {
      payloads.push({
        subcircuitId: subcircuit.id,
        numQubits: subcircuit.numQubits,
        gates: subcircuit.gates,
        inputState,
        shots: shotsPerSubcircuit
      })
    }
  }

  return payloads
}
