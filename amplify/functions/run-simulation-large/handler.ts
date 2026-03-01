import type { Handler } from 'aws-lambda'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime'
import { env } from '$amplify/env/run-simulation-large'
import type { Schema } from '../../data/resource'

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env)
Amplify.configure(resourceConfig, libraryOptions)

const client = generateClient<Schema>()

interface Gate {
  type: string
  qubits: number[]
  controlQubits?: number[]
  parameters?: number[]
  position?: number
}

interface SimulationRequest {
  circuitId: string
  numQubits: number
  gates: Gate[] | string
  shots: number
  includeStateVector?: boolean
}

interface SimulationResponse {
  success: boolean
  simulationRunId?: string
  circuitId: string
  counts: Record<string, number>
  probabilities: Record<string, number>
  stateVector?: number[][]
  executionTimeMs: number
  backend: string
  tier: string
  error?: string
}

const MIN_QUBITS = 27
const MAX_QUBITS = 27
const MAX_QUBITS_STATE_VECTOR = 12

function createStateVector(numQubits: number): Float64Array[] {
  const size = 1 << numQubits
  const real = new Float64Array(size)
  const imag = new Float64Array(size)
  real[0] = 1
  return [real, imag]
}

function applySingleQubitGate(
  real: Float64Array,
  imag: Float64Array,
  qubit: number,
  m00r: number, m00i: number, m01r: number, m01i: number,
  m10r: number, m10i: number, m11r: number, m11i: number
): void {
  const size = real.length
  const stride = 1 << qubit

  for (let i = 0; i < size; i += stride << 1) {
    for (let j = 0; j < stride; j++) {
      const idx0 = i + j
      const idx1 = idx0 + stride

      const r0 = real[idx0], i0 = imag[idx0]
      const r1 = real[idx1], i1 = imag[idx1]

      real[idx0] = m00r * r0 - m00i * i0 + m01r * r1 - m01i * i1
      imag[idx0] = m00r * i0 + m00i * r0 + m01r * i1 + m01i * r1
      real[idx1] = m10r * r0 - m10i * i0 + m11r * r1 - m11i * i1
      imag[idx1] = m10r * i0 + m10i * r0 + m11r * i1 + m11i * r1
    }
  }
}

function applyControlledGate(
  real: Float64Array,
  imag: Float64Array,
  control: number,
  target: number,
  m00r: number, m00i: number, m01r: number, m01i: number,
  m10r: number, m10i: number, m11r: number, m11i: number
): void {
  const size = real.length
  const cMask = 1 << control
  const tMask = 1 << target

  for (let i = 0; i < size; i++) {
    if ((i & cMask) === 0 || (i & tMask) !== 0) continue

    const idx0 = i
    const idx1 = i | tMask

    const r0 = real[idx0], i0 = imag[idx0]
    const r1 = real[idx1], i1 = imag[idx1]

    real[idx0] = m00r * r0 - m00i * i0 + m01r * r1 - m01i * i1
    imag[idx0] = m00r * i0 + m00i * r0 + m01r * i1 + m01i * r1
    real[idx1] = m10r * r0 - m10i * i0 + m11r * r1 - m11i * i1
    imag[idx1] = m10r * i0 + m10i * r0 + m11r * i1 + m11i * r1
  }
}

function applySwap(real: Float64Array, imag: Float64Array, q1: number, q2: number): void {
  const size = real.length
  const m1 = 1 << q1
  const m2 = 1 << q2

  for (let i = 0; i < size; i++) {
    const b1 = (i & m1) !== 0
    const b2 = (i & m2) !== 0
    if (b1 !== b2) {
      const swapped = (i ^ m1) ^ m2
      if (i < swapped) {
        const tr = real[i], ti = imag[i]
        real[i] = real[swapped]
        imag[i] = imag[swapped]
        real[swapped] = tr
        imag[swapped] = ti
      }
    }
  }
}

function applyToffoli(real: Float64Array, imag: Float64Array, c1: number, c2: number, t: number): void {
  const size = real.length
  const c1m = 1 << c1
  const c2m = 1 << c2
  const tm = 1 << t

  for (let i = 0; i < size; i++) {
    if ((i & c1m) === 0 || (i & c2m) === 0 || (i & tm) !== 0) continue
    const idx1 = i | tm
    const tr = real[i], ti = imag[i]
    real[i] = real[idx1]
    imag[i] = imag[idx1]
    real[idx1] = tr
    imag[idx1] = ti
  }
}

const SQRT2_INV = 0.7071067811865476

function applyGate(real: Float64Array, imag: Float64Array, gate: Gate): void {
  const target = gate.qubits[gate.qubits.length - 1]

  switch (gate.type) {
    case 'H':
      applySingleQubitGate(real, imag, target, SQRT2_INV, 0, SQRT2_INV, 0, SQRT2_INV, 0, -SQRT2_INV, 0)
      break
    case 'X':
      applySingleQubitGate(real, imag, target, 0, 0, 1, 0, 1, 0, 0, 0)
      break
    case 'Y':
      applySingleQubitGate(real, imag, target, 0, 0, 0, -1, 0, 1, 0, 0)
      break
    case 'Z':
      applySingleQubitGate(real, imag, target, 1, 0, 0, 0, 0, 0, -1, 0)
      break
    case 'S':
      applySingleQubitGate(real, imag, target, 1, 0, 0, 0, 0, 0, 0, 1)
      break
    case 'T':
      applySingleQubitGate(real, imag, target, 1, 0, 0, 0, 0, 0, SQRT2_INV, SQRT2_INV)
      break
    case 'Sdg':
      applySingleQubitGate(real, imag, target, 1, 0, 0, 0, 0, 0, 0, -1)
      break
    case 'Tdg':
      applySingleQubitGate(real, imag, target, 1, 0, 0, 0, 0, 0, SQRT2_INV, -SQRT2_INV)
      break
    case 'Rx': {
      const theta = gate.parameters?.[0] || 0
      const c = Math.cos(theta / 2), s = Math.sin(theta / 2)
      applySingleQubitGate(real, imag, target, c, 0, 0, -s, 0, -s, c, 0)
      break
    }
    case 'Ry': {
      const theta = gate.parameters?.[0] || 0
      const c = Math.cos(theta / 2), s = Math.sin(theta / 2)
      applySingleQubitGate(real, imag, target, c, 0, -s, 0, s, 0, c, 0)
      break
    }
    case 'Rz': {
      const theta = gate.parameters?.[0] || 0
      const cn = Math.cos(-theta / 2), sn = Math.sin(-theta / 2)
      const cp = Math.cos(theta / 2), sp = Math.sin(theta / 2)
      applySingleQubitGate(real, imag, target, cn, sn, 0, 0, 0, 0, cp, sp)
      break
    }
    case 'CNOT':
    case 'CX': {
      const c = gate.controlQubits?.[0] ?? gate.qubits[0]
      applyControlledGate(real, imag, c, target, 0, 0, 1, 0, 1, 0, 0, 0)
      break
    }
    case 'CZ': {
      const c = gate.controlQubits?.[0] ?? gate.qubits[0]
      applyControlledGate(real, imag, c, target, 1, 0, 0, 0, 0, 0, -1, 0)
      break
    }
    case 'CY': {
      const c = gate.controlQubits?.[0] ?? gate.qubits[0]
      applyControlledGate(real, imag, c, target, 0, 0, 0, -1, 0, 1, 0, 0)
      break
    }
    case 'SWAP':
      applySwap(real, imag, gate.qubits[0], gate.qubits[1])
      break
    case 'Toffoli':
    case 'CCX':
      applyToffoli(real, imag, gate.qubits[0], gate.qubits[1], gate.qubits[2])
      break
  }
}

function measureState(real: Float64Array, imag: Float64Array, numQubits: number, shots: number): Record<string, number> {
  const size = real.length
  const cumulative = new Float64Array(size)
  let sum = 0
  for (let i = 0; i < size; i++) {
    sum += real[i] * real[i] + imag[i] * imag[i]
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
    const bs = lo.toString(2).padStart(numQubits, '0')
    counts[bs] = (counts[bs] || 0) + 1
  }
  return counts
}

export const handler: Handler<SimulationRequest, SimulationResponse> = async (event) => {
  const startTime = Date.now()
  const { circuitId, numQubits, shots, includeStateVector } = event
  const gates: Gate[] = typeof event.gates === 'string' ? JSON.parse(event.gates) : event.gates

  let simulationRun: { id: string } | null = null

  try {
    if (numQubits < MIN_QUBITS || numQubits > MAX_QUBITS) {
      return {
        success: false,
        circuitId,
        counts: {},
        probabilities: {},
        executionTimeMs: Date.now() - startTime,
        backend: 'lambda_large',
        tier: 'lambda_large',
        error: `This tier handles ${MIN_QUBITS}-${MAX_QUBITS} qubits. Got ${numQubits}.`,
      }
    }

    const { data: runData } = await client.models.SimulationRun.create({
      circuitId,
      shots,
      backend: 'lambda_large',
      status: 'running',
      createdAt: new Date().toISOString(),
    })
    simulationRun = runData

    const [real, imag] = createStateVector(numQubits)
    const sortedGates = [...gates].sort((a, b) => (a.position || 0) - (b.position || 0))

    for (const gate of sortedGates) {
      applyGate(real, imag, gate)
    }

    const counts = measureState(real, imag, numQubits, shots)
    const probabilities: Record<string, number> = {}
    for (const [state, count] of Object.entries(counts)) {
      probabilities[state] = count / shots
    }

    const executionTimeMs = Date.now() - startTime

    let stateVector: number[][] | undefined
    if (includeStateVector && numQubits <= MAX_QUBITS_STATE_VECTOR) {
      stateVector = []
      for (let i = 0; i < real.length; i++) {
        stateVector.push([real[i], imag[i]])
      }
    }

    if (simulationRun) {
      await client.models.SimulationRun.update({
        id: simulationRun.id,
        status: 'completed',
        counts: JSON.stringify(counts),
        results: JSON.stringify({ probabilities }),
        stateVector: stateVector ? JSON.stringify(stateVector) : undefined,
        executionTimeMs,
        completedAt: new Date().toISOString(),
      })
    }

    return {
      success: true,
      simulationRunId: simulationRun?.id,
      circuitId,
      counts,
      probabilities,
      stateVector,
      executionTimeMs,
      backend: 'lambda_large',
      tier: 'lambda_large',
    }
  } catch (error) {
    const executionTimeMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Simulation failed'

    if (simulationRun) {
      await client.models.SimulationRun.update({
        id: simulationRun.id,
        status: 'failed',
        errorMessage,
        executionTimeMs,
        completedAt: new Date().toISOString(),
      })
    }

    return {
      success: false,
      circuitId,
      counts: {},
      probabilities: {},
      executionTimeMs,
      backend: 'lambda_large',
      tier: 'lambda_large',
      error: errorMessage,
    }
  }
}
