import type { Handler } from 'aws-lambda'
import type { SimulatorResponse, Complex } from '../../shared/types'
import { Circuit, executeCircuit } from '../../shared/quantum-core/circuit'
import { StateVector } from '../../shared/quantum-core/state-vector'

const MIN_QUBITS = 13
const MAX_QUBITS = 18
const TIER = 'medium'

interface GraphQLSimulatorInput {
  circuitId?: string
  numQubits: number
  gates: string
  shots?: number
  seed?: number
  measureQubits?: number[]
}

interface CircuitData {
  numQubits: number
  gates: Array<{
    name: string
    qubits: number[]
    params?: number[]
  }>
}

function stateVectorToComplex(sv: StateVector): Complex[] {
  const amps = sv.getAmplitudes()
  const result: Complex[] = []
  for (let i = 0; i < amps.length; i += 2) {
    result.push({ re: amps[i], im: amps[i + 1] })
  }
  return result
}

function createSeededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

function parseCircuitData(input: GraphQLSimulatorInput): CircuitData {
  let gatesData: any

  if (typeof input.gates === 'string') {
    try {
      gatesData = JSON.parse(input.gates)
    } catch {
      gatesData = { numQubits: input.numQubits, gates: [] }
    }
  } else {
    gatesData = input.gates
  }

  if (Array.isArray(gatesData)) {
    return {
      numQubits: input.numQubits,
      gates: gatesData
    }
  }

  if (gatesData && typeof gatesData === 'object' && 'gates' in gatesData) {
    return {
      numQubits: gatesData.numQubits || input.numQubits,
      gates: gatesData.gates || []
    }
  }

  return {
    numQubits: input.numQubits,
    gates: []
  }
}

function buildCircuitFromData(data: CircuitData): Circuit {
  const circuit = new Circuit(data.numQubits)

  for (const gate of data.gates) {
    const gateType = gate.name.toUpperCase()
    const qubits = gate.qubits || []
    const params = gate.params || []

    switch (gateType) {
      case 'H':
        circuit.h(qubits[0])
        break
      case 'X':
        circuit.x(qubits[0])
        break
      case 'Y':
        circuit.y(qubits[0])
        break
      case 'Z':
        circuit.z(qubits[0])
        break
      case 'S':
        circuit.s(qubits[0])
        break
      case 'T':
        circuit.t(qubits[0])
        break
      case 'RX':
        circuit.rx(qubits[0], params[0] || 0)
        break
      case 'RY':
        circuit.ry(qubits[0], params[0] || 0)
        break
      case 'RZ':
        circuit.rz(qubits[0], params[0] || 0)
        break
      case 'CNOT':
      case 'CX':
        circuit.cnot(qubits[0], qubits[1])
        break
      case 'CZ':
        circuit.cz(qubits[0], qubits[1])
        break
      case 'SWAP':
        circuit.swap(qubits[0], qubits[1])
        break
      default:
        console.warn(`[SIM-${TIER.toUpperCase()}] Unknown gate type: ${gateType}`)
    }
  }

  return circuit
}

function simulateCircuit(circuitData: CircuitData, input: GraphQLSimulatorInput): SimulatorResponse {
  const startTime = performance.now()

  try {
    const circuit = buildCircuitFromData(circuitData)
    const state = executeCircuit(circuit)

    const returnStatevector = circuitData.numQubits <= 16
    const statevector = returnStatevector ? stateVectorToComplex(state) : undefined
    const probabilities = Array.from(state.getProbabilities())

    let counts: Record<string, number> | undefined

    if (input.shots && input.shots > 0) {
      counts = {}
      const rng = input.seed !== undefined
        ? createSeededRandom(input.seed)
        : Math.random

      const measureQubits = input.measureQubits ||
        Array.from({ length: circuit.numQubits }, (_, i) => i)

      for (let shot = 0; shot < input.shots; shot++) {
        const r = rng()
        let cumulative = 0
        let outcome = 0

        for (let i = 0; i < probabilities.length; i++) {
          cumulative += probabilities[i]
          if (r < cumulative) {
            outcome = i
            break
          }
        }

        let bitstring = ''
        for (const qubit of measureQubits) {
          bitstring += (outcome >> qubit) & 1
        }

        counts[bitstring] = (counts[bitstring] || 0) + 1
      }
    }

    const executionTimeMs = performance.now() - startTime

    return {
      success: true,
      statevector,
      probabilities,
      counts,
      executionTimeMs,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: message,
      executionTimeMs: performance.now() - startTime,
    }
  }
}

export const handler: Handler = async (event) => {
  console.log(`[SIM-${TIER.toUpperCase()}] Received request`)
  console.log(`[SIM-${TIER.toUpperCase()}] Memory: ${process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE} MB`)

  let input: GraphQLSimulatorInput

  try {
    if (typeof event === 'string') {
      input = JSON.parse(event)
    } else if (event.arguments) {
      input = event.arguments
    } else if (event.body) {
      input = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
    } else {
      input = event
    }
  } catch (parseError) {
    return {
      success: false,
      error: 'Failed to parse input',
    }
  }

  if (!input.numQubits) {
    return {
      success: false,
      error: 'numQubits is required',
    }
  }

  if (input.numQubits > MAX_QUBITS) {
    return {
      success: false,
      error: `Maximum qubits for ${TIER} simulator is ${MAX_QUBITS}, got ${input.numQubits}. Use simulator-large for larger circuits.`,
    }
  }

  const circuitData = parseCircuitData(input)
  const memBefore = process.memoryUsage().heapUsed / (1024 * 1024)

  console.log(`[SIM-${TIER.toUpperCase()}] Simulating ${circuitData.numQubits}-qubit circuit`)
  console.log(`[SIM-${TIER.toUpperCase()}] Gates: ${circuitData.gates.length}`)
  console.log(`[SIM-${TIER.toUpperCase()}] State dimension: ${Math.pow(2, circuitData.numQubits)}`)

  const response = simulateCircuit(circuitData, input)

  const memAfter = process.memoryUsage().heapUsed / (1024 * 1024)

  if (response.success) {
    console.log(`[SIM-${TIER.toUpperCase()}] Completed in ${response.executionTimeMs?.toFixed(2)} ms`)
    console.log(`[SIM-${TIER.toUpperCase()}] Memory: ${memBefore.toFixed(0)} -> ${memAfter.toFixed(0)} MB`)
  } else {
    console.error(`[SIM-${TIER.toUpperCase()}] Error:`, response.error)
  }

  return response
}
