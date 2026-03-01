import type { Handler } from 'aws-lambda'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime'
import { env } from '$amplify/env/run-simulation'
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
  error?: string
}

const MAX_QUBITS_CLOUD = 28
const MAX_QUBITS_STATE_VECTOR = 14

function createStateVector(numQubits: number): Float64Array[] {
  const size = Math.pow(2, numQubits)
  const real = new Float64Array(size)
  const imag = new Float64Array(size)
  real[0] = 1
  return [real, imag]
}

function applySingleQubitGate(
  real: Float64Array,
  imag: Float64Array,
  qubit: number,
  matrix: number[][]
): void {
  const size = real.length
  const stride = 1 << qubit
  
  for (let i = 0; i < size; i += stride * 2) {
    for (let j = 0; j < stride; j++) {
      const idx0 = i + j
      const idx1 = i + j + stride
      
      const r0 = real[idx0], i0 = imag[idx0]
      const r1 = real[idx1], i1 = imag[idx1]
      
      real[idx0] = matrix[0][0] * r0 - matrix[0][1] * i0 + matrix[0][2] * r1 - matrix[0][3] * i1
      imag[idx0] = matrix[0][0] * i0 + matrix[0][1] * r0 + matrix[0][2] * i1 + matrix[0][3] * r1
      real[idx1] = matrix[1][0] * r0 - matrix[1][1] * i0 + matrix[1][2] * r1 - matrix[1][3] * i1
      imag[idx1] = matrix[1][0] * i0 + matrix[1][1] * r0 + matrix[1][2] * i1 + matrix[1][3] * r1
    }
  }
}

function applyControlledGate(
  real: Float64Array,
  imag: Float64Array,
  control: number,
  target: number,
  matrix: number[][]
): void {
  const size = real.length
  const controlMask = 1 << control
  const targetMask = 1 << target
  
  for (let i = 0; i < size; i++) {
    if ((i & controlMask) === 0) continue
    if ((i & targetMask) !== 0) continue
    
    const idx0 = i
    const idx1 = i | targetMask
    
    const r0 = real[idx0], i0 = imag[idx0]
    const r1 = real[idx1], i1 = imag[idx1]
    
    real[idx0] = matrix[0][0] * r0 - matrix[0][1] * i0 + matrix[0][2] * r1 - matrix[0][3] * i1
    imag[idx0] = matrix[0][0] * i0 + matrix[0][1] * r0 + matrix[0][2] * i1 + matrix[0][3] * r1
    real[idx1] = matrix[1][0] * r0 - matrix[1][1] * i0 + matrix[1][2] * r1 - matrix[1][3] * i1
    imag[idx1] = matrix[1][0] * i0 + matrix[1][1] * r0 + matrix[1][2] * i1 + matrix[1][3] * r1
  }
}

function applySwap(real: Float64Array, imag: Float64Array, q1: number, q2: number): void {
  const size = real.length
  const mask1 = 1 << q1
  const mask2 = 1 << q2
  
  for (let i = 0; i < size; i++) {
    const bit1 = (i & mask1) !== 0
    const bit2 = (i & mask2) !== 0
    
    if (bit1 !== bit2) {
      const swapped = (i ^ mask1) ^ mask2
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

function applyToffoli(
  real: Float64Array,
  imag: Float64Array,
  c1: number,
  c2: number,
  target: number
): void {
  const size = real.length
  const c1Mask = 1 << c1
  const c2Mask = 1 << c2
  const targetMask = 1 << target
  
  for (let i = 0; i < size; i++) {
    if ((i & c1Mask) === 0 || (i & c2Mask) === 0) continue
    if ((i & targetMask) !== 0) continue
    
    const idx0 = i
    const idx1 = i | targetMask
    
    const tr = real[idx0], ti = imag[idx0]
    real[idx0] = real[idx1]
    imag[idx0] = imag[idx1]
    real[idx1] = tr
    imag[idx1] = ti
  }
}

function applyGate(real: Float64Array, imag: Float64Array, gate: Gate): void {
  const sqrt2Inv = 1 / Math.sqrt(2)
  
  const GATES: Record<string, number[][]> = {
    H: [[sqrt2Inv, 0, sqrt2Inv, 0], [sqrt2Inv, 0, -sqrt2Inv, 0]],
    X: [[0, 0, 1, 0], [1, 0, 0, 0]],
    Y: [[0, 0, 0, -1], [0, 1, 0, 0]],
    Z: [[1, 0, 0, 0], [0, 0, -1, 0]],
    S: [[1, 0, 0, 0], [0, 0, 0, 1]],
    T: [[1, 0, 0, 0], [0, 0, sqrt2Inv, sqrt2Inv]],
    Sdg: [[1, 0, 0, 0], [0, 0, 0, -1]],
    Tdg: [[1, 0, 0, 0], [0, 0, sqrt2Inv, -sqrt2Inv]],
  }
  
  const target = gate.qubits[gate.qubits.length - 1]
  
  switch (gate.type) {
    case 'H':
    case 'X':
    case 'Y':
    case 'Z':
    case 'S':
    case 'T':
    case 'Sdg':
    case 'Tdg':
      applySingleQubitGate(real, imag, target, GATES[gate.type])
      break
      
    case 'Rx': {
      const theta = gate.parameters?.[0] || 0
      const cos = Math.cos(theta / 2)
      const sin = Math.sin(theta / 2)
      const matrix = [[cos, 0, 0, -sin], [0, -sin, cos, 0]]
      applySingleQubitGate(real, imag, target, matrix)
      break
    }
    
    case 'Ry': {
      const theta = gate.parameters?.[0] || 0
      const cos = Math.cos(theta / 2)
      const sin = Math.sin(theta / 2)
      const matrix = [[cos, 0, -sin, 0], [sin, 0, cos, 0]]
      applySingleQubitGate(real, imag, target, matrix)
      break
    }
    
    case 'Rz': {
      const theta = gate.parameters?.[0] || 0
      const cosN = Math.cos(-theta / 2)
      const sinN = Math.sin(-theta / 2)
      const cosP = Math.cos(theta / 2)
      const sinP = Math.sin(theta / 2)
      const matrix = [[cosN, sinN, 0, 0], [0, 0, cosP, sinP]]
      applySingleQubitGate(real, imag, target, matrix)
      break
    }
    
    case 'CNOT':
    case 'CX': {
      const control = gate.controlQubits?.[0] ?? gate.qubits[0]
      applyControlledGate(real, imag, control, target, GATES.X)
      break
    }
    
    case 'CZ': {
      const control = gate.controlQubits?.[0] ?? gate.qubits[0]
      applyControlledGate(real, imag, control, target, GATES.Z)
      break
    }
    
    case 'CY': {
      const control = gate.controlQubits?.[0] ?? gate.qubits[0]
      applyControlledGate(real, imag, control, target, GATES.Y)
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

function measureState(
  real: Float64Array,
  imag: Float64Array,
  numQubits: number,
  shots: number
): Record<string, number> {
  const size = real.length
  
  const probabilities = new Float64Array(size)
  let cumulative = 0
  for (let i = 0; i < size; i++) {
    cumulative += real[i] * real[i] + imag[i] * imag[i]
    probabilities[i] = cumulative
  }
  
  const counts: Record<string, number> = {}
  
  for (let shot = 0; shot < shots; shot++) {
    const r = Math.random()
    let low = 0, high = size - 1
    while (low < high) {
      const mid = (low + high) >>> 1
      if (probabilities[mid] < r) {
        low = mid + 1
      } else {
        high = mid
      }
    }
    const outcome = low
    
    const bitstring = outcome.toString(2).padStart(numQubits, '0')
    counts[bitstring] = (counts[bitstring] || 0) + 1
  }
  
  return counts
}

export const handler: Handler<SimulationRequest, SimulationResponse> = async (event) => {
  const startTime = Date.now()
  const { circuitId, numQubits, shots, includeStateVector } = event

  const gates: Gate[] = typeof event.gates === 'string'
    ? JSON.parse(event.gates)
    : event.gates

  let simulationRun: { id: string } | null = null

  try {
    if (numQubits > MAX_QUBITS_CLOUD) {
      const errorResponse = {
        success: false,
        circuitId,
        counts: {},
        probabilities: {},
        executionTimeMs: Date.now() - startTime,
        backend: 'cloud',
        error: `Maximum ${MAX_QUBITS_CLOUD} qubits supported.`,
      }
      
      await client.models.SimulationRun.create({
        circuitId,
        shots,
        backend: 'cloud',
        status: 'failed',
        errorMessage: errorResponse.error,
        executionTimeMs: errorResponse.executionTimeMs,
        createdAt: new Date().toISOString(),
      })
      
      return errorResponse
    }
    
    if (numQubits < 1) {
      return {
        success: false,
        circuitId,
        counts: {},
        probabilities: {},
        executionTimeMs: Date.now() - startTime,
        backend: 'cloud',
        error: 'Circuit must have at least 1 qubit',
      }
    }
    
    const { data: runData } = await client.models.SimulationRun.create({
      circuitId,
      shots,
      backend: 'cloud',
      status: 'running',
      createdAt: new Date().toISOString(),
    })
    simulationRun = runData
    
    const [real, imag] = createStateVector(numQubits)
    
    const sortedGates = [...gates].sort((a, b) => 
      (a.position || 0) - (b.position || 0)
    )
    
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
      backend: 'cloud',
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
    } else {
      await client.models.SimulationRun.create({
        circuitId,
        shots,
        backend: 'cloud',
        status: 'failed',
        errorMessage,
        executionTimeMs,
        createdAt: new Date().toISOString(),
      })
    }
    
    return {
      success: false,
      circuitId,
      counts: {},
      probabilities: {},
      executionTimeMs,
      backend: 'cloud',
      error: errorMessage,
    }
  }
}
