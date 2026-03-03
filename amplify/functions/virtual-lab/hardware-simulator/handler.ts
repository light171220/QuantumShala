import type { Handler } from 'aws-lambda'

interface QubitCharacterization {
  qubitId: number
  t1: number
  t1Error: number
  t2: number
  t2Error: number
  frequency: number
  anharmonicity: number
  readoutFidelity: number
  readoutAssignmentError: number
}

interface GateCharacterization {
  gateType: string
  qubits: number[]
  fidelity: number
  errorRate: number
  gateTime: number
  calibratedAt: string
}

interface RandomizedBenchmarkingResult {
  qubitId: number
  sequenceLengths: number[]
  survivalProbabilities: number[]
  averageGateFidelity: number
  errorPerGate: number
  fitParameters: {
    a: number
    b: number
    p: number
  }
  standardError: number
}

interface T1Measurement {
  qubitId: number
  delayTimes: number[]
  probabilities: number[]
  t1Value: number
  t1Error: number
  fitQuality: number
}

interface T2Measurement {
  qubitId: number
  delayTimes: number[]
  probabilities: number[]
  t2Value: number
  t2Error: number
  decayType: 'ramsey' | 'echo' | 'cpmg'
  fitQuality: number
}

interface HardwareSimulatorRequest {
  action: 't1_measurement' | 't2_measurement' | 'randomized_benchmarking' | 'full_characterization' | 'gate_calibration'
  numQubits?: number
  qubitIds?: number[]
  gateTypes?: string[]
  config?: {
    t1Config?: {
      maxDelay?: number
      numPoints?: number
      shots?: number
    }
    t2Config?: {
      maxDelay?: number
      numPoints?: number
      shots?: number
      decayType?: 'ramsey' | 'echo' | 'cpmg'
    }
    rbConfig?: {
      sequenceLengths?: number[]
      numSequences?: number
      shots?: number
    }
    noiseModel?: {
      t1Range?: [number, number]
      t2Range?: [number, number]
      readoutErrorRange?: [number, number]
      gateErrorRange?: [number, number]
    }
  }
  seed?: number
}

interface HardwareSimulatorResponse {
  success: boolean
  t1Results?: T1Measurement[]
  t2Results?: T2Measurement[]
  rbResults?: RandomizedBenchmarkingResult[]
  characterization?: {
    qubits: QubitCharacterization[]
    gates: GateCharacterization[]
    systemMetrics: {
      averageT1: number
      averageT2: number
      averageReadoutFidelity: number
      averageGateFidelity: number
      quantumVolume: number
      timestamp: string
    }
  }
  executionTimeMs: number
  error?: {
    code: string
    message: string
  }
}

class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed
  }

  next(): number {
    this.state = (this.state * 1103515245 + 12345) & 0x7fffffff
    return this.state / 0x7fffffff
  }

  gaussian(mean: number, stdDev: number): number {
    const u1 = this.next()
    const u2 = this.next()
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return mean + z0 * stdDev
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }
}

function simulateT1Measurement(
  qubitId: number,
  config: { maxDelay?: number; numPoints?: number; shots?: number },
  noiseModel: { t1Range?: [number, number] },
  rng: SeededRandom
): T1Measurement {
  const maxDelay = config.maxDelay || 500
  const numPoints = config.numPoints || 50
  const shots = config.shots || 1024

  const t1Range = noiseModel.t1Range || [50, 150]
  const t1True = rng.range(t1Range[0], t1Range[1])

  const delayTimes: number[] = []
  const probabilities: number[] = []

  for (let i = 0; i < numPoints; i++) {
    const t = (i / (numPoints - 1)) * maxDelay
    delayTimes.push(t)

    const decayProb = Math.exp(-t / t1True)

    const measuredProb = decayProb + rng.gaussian(0, 0.02 / Math.sqrt(shots))
    probabilities.push(Math.max(0, Math.min(1, measuredProb)))
  }

  const t1Fitted = t1True * (1 + rng.gaussian(0, 0.05))
  const t1Error = t1True * 0.05 * Math.sqrt(2 / numPoints)

  const fitQuality = 0.95 + rng.next() * 0.05

  return {
    qubitId,
    delayTimes,
    probabilities,
    t1Value: t1Fitted,
    t1Error,
    fitQuality,
  }
}

function simulateT2Measurement(
  qubitId: number,
  config: { maxDelay?: number; numPoints?: number; shots?: number; decayType?: 'ramsey' | 'echo' | 'cpmg' },
  noiseModel: { t2Range?: [number, number] },
  rng: SeededRandom
): T2Measurement {
  const maxDelay = config.maxDelay || 200
  const numPoints = config.numPoints || 50
  const shots = config.shots || 1024
  const decayType = config.decayType || 'ramsey'

  const t2Range = noiseModel.t2Range || [20, 100]
  let t2True = rng.range(t2Range[0], t2Range[1])

  if (decayType === 'echo') {
    t2True *= 1.5
  } else if (decayType === 'cpmg') {
    t2True *= 2.0
  }

  const delayTimes: number[] = []
  const probabilities: number[] = []

  const detuning = rng.range(-0.01, 0.01)

  for (let i = 0; i < numPoints; i++) {
    const t = (i / (numPoints - 1)) * maxDelay
    delayTimes.push(t)

    let prob: number
    if (decayType === 'ramsey') {
      const decay = Math.exp(-t / t2True)
      const oscillation = Math.cos(2 * Math.PI * detuning * t)
      prob = 0.5 * (1 + decay * oscillation)
    } else {
      prob = 0.5 * (1 + Math.exp(-t / t2True))
    }

    const measuredProb = prob + rng.gaussian(0, 0.02 / Math.sqrt(shots))
    probabilities.push(Math.max(0, Math.min(1, measuredProb)))
  }

  const t2Fitted = t2True * (1 + rng.gaussian(0, 0.08))
  const t2Error = t2True * 0.08 * Math.sqrt(2 / numPoints)
  const fitQuality = 0.90 + rng.next() * 0.08

  return {
    qubitId,
    delayTimes,
    probabilities,
    t2Value: t2Fitted,
    t2Error,
    decayType,
    fitQuality,
  }
}

function simulateRandomizedBenchmarking(
  qubitId: number,
  config: { sequenceLengths?: number[]; numSequences?: number; shots?: number },
  noiseModel: { gateErrorRange?: [number, number] },
  rng: SeededRandom
): RandomizedBenchmarkingResult {
  const sequenceLengths = config.sequenceLengths || [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]
  const numSequences = config.numSequences || 30
  const shots = config.shots || 1024

  const errorRange = noiseModel.gateErrorRange || [0.0001, 0.005]
  const errorPerGate = rng.range(errorRange[0], errorRange[1])

  const p = 1 - 2 * errorPerGate

  const a = 0.98 + rng.next() * 0.02
  const b = 0.5

  const survivalProbabilities: number[] = []

  for (const m of sequenceLengths) {
    const idealSurvival = a * Math.pow(p, m) + b

    const sequenceVariance = (1 / numSequences) * a * a * Math.pow(p, 2 * m) * (1 - Math.pow(p, 2))
    const shotNoise = idealSurvival * (1 - idealSurvival) / shots

    const totalStd = Math.sqrt(sequenceVariance + shotNoise)
    const measuredSurvival = idealSurvival + rng.gaussian(0, totalStd)

    survivalProbabilities.push(Math.max(0, Math.min(1, measuredSurvival)))
  }

  const averageGateFidelity = 1 - errorPerGate
  const standardError = errorPerGate * 0.1

  return {
    qubitId,
    sequenceLengths,
    survivalProbabilities,
    averageGateFidelity,
    errorPerGate,
    fitParameters: { a, b, p },
    standardError,
  }
}

function generateQubitCharacterization(
  qubitId: number,
  noiseModel: {
    t1Range?: [number, number]
    t2Range?: [number, number]
    readoutErrorRange?: [number, number]
  },
  rng: SeededRandom
): QubitCharacterization {
  const t1Range = noiseModel.t1Range || [50, 150]
  const t2Range = noiseModel.t2Range || [20, 100]
  const readoutErrorRange = noiseModel.readoutErrorRange || [0.01, 0.05]

  const t1 = rng.range(t1Range[0], t1Range[1])
  const t2 = Math.min(rng.range(t2Range[0], t2Range[1]), 2 * t1)

  const frequency = 4.5 + rng.gaussian(0, 0.3)
  const anharmonicity = -0.33 + rng.gaussian(0, 0.02)

  const readoutAssignmentError = rng.range(readoutErrorRange[0], readoutErrorRange[1])
  const readoutFidelity = 1 - readoutAssignmentError

  return {
    qubitId,
    t1,
    t1Error: t1 * 0.05,
    t2,
    t2Error: t2 * 0.08,
    frequency,
    anharmonicity,
    readoutFidelity,
    readoutAssignmentError,
  }
}

function generateGateCharacterization(
  gateType: string,
  qubits: number[],
  noiseModel: { gateErrorRange?: [number, number] },
  rng: SeededRandom
): GateCharacterization {
  const errorRange = noiseModel.gateErrorRange || [0.0001, 0.005]

  let baseError = rng.range(errorRange[0], errorRange[1])
  let baseGateTime = 25

  if (qubits.length === 2) {
    baseError *= 10
    baseGateTime = 300 + rng.next() * 200
  }

  if (gateType === 'X' || gateType === 'SX') {
    baseGateTime = 25 + rng.next() * 10
  } else if (gateType === 'RZ') {
    baseGateTime = 0
    baseError = 0
  } else if (gateType === 'CX' || gateType === 'CNOT') {
    baseGateTime = 300 + rng.next() * 200
  } else if (gateType === 'CZ') {
    baseGateTime = 100 + rng.next() * 50
  }

  return {
    gateType,
    qubits,
    fidelity: 1 - baseError,
    errorRate: baseError,
    gateTime: baseGateTime,
    calibratedAt: new Date().toISOString(),
  }
}

function calculateQuantumVolume(
  qubits: QubitCharacterization[],
  gates: GateCharacterization[]
): number {
  const avgGateFidelity = gates
    .filter(g => g.qubits.length === 2)
    .reduce((sum, g) => sum + g.fidelity, 0) / Math.max(1, gates.filter(g => g.qubits.length === 2).length)

  const avgT1 = qubits.reduce((sum, q) => sum + q.t1, 0) / qubits.length
  const avgGateTime = gates
    .filter(g => g.qubits.length === 2)
    .reduce((sum, g) => sum + g.gateTime, 0) / Math.max(1, gates.filter(g => g.qubits.length === 2).length)

  const effectiveDepth = Math.floor((avgT1 * 1000) / avgGateTime)

  const maxQV = Math.min(qubits.length, effectiveDepth)
  const fidelityFactor = Math.pow(avgGateFidelity, maxQV * maxQV)

  if (fidelityFactor > 2/3) {
    return Math.pow(2, maxQV)
  }

  for (let n = maxQV; n >= 1; n--) {
    const successProb = Math.pow(avgGateFidelity, n * n)
    if (successProb > 2/3) {
      return Math.pow(2, n)
    }
  }

  return 2
}

export const handler: Handler = async (event): Promise<HardwareSimulatorResponse> => {
  const startTime = performance.now()

  console.log('[HW-SIM] Received request')

  try {
    let input: HardwareSimulatorRequest

    if (typeof event === 'string') {
      input = JSON.parse(event)
    } else if (event.arguments) {
      input = event.arguments
    } else if (event.body) {
      input = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
    } else {
      input = event
    }

    const { action, numQubits = 5, qubitIds, gateTypes, config = {}, seed } = input

    const rng = new SeededRandom(seed || Date.now())

    const targetQubits = qubitIds || Array.from({ length: numQubits }, (_, i) => i)
    const noiseModel = config.noiseModel || {}

    console.log(`[HW-SIM] Action: ${action}`)
    console.log(`[HW-SIM] Qubits: ${targetQubits.join(', ')}`)

    switch (action) {
      case 't1_measurement': {
        const t1Config = config.t1Config || {}
        const t1Results = targetQubits.map(qId =>
          simulateT1Measurement(qId, t1Config, noiseModel, rng)
        )

        console.log(`[HW-SIM] T1 measurement complete for ${targetQubits.length} qubits`)

        return {
          success: true,
          t1Results,
          executionTimeMs: performance.now() - startTime,
        }
      }

      case 't2_measurement': {
        const t2Config = config.t2Config || {}
        const t2Results = targetQubits.map(qId =>
          simulateT2Measurement(qId, t2Config, noiseModel, rng)
        )

        console.log(`[HW-SIM] T2 measurement complete for ${targetQubits.length} qubits`)

        return {
          success: true,
          t2Results,
          executionTimeMs: performance.now() - startTime,
        }
      }

      case 'randomized_benchmarking': {
        const rbConfig = config.rbConfig || {}
        const rbResults = targetQubits.map(qId =>
          simulateRandomizedBenchmarking(qId, rbConfig, noiseModel, rng)
        )

        console.log(`[HW-SIM] RB complete for ${targetQubits.length} qubits`)

        return {
          success: true,
          rbResults,
          executionTimeMs: performance.now() - startTime,
        }
      }

      case 'full_characterization': {
        const qubits = targetQubits.map(qId =>
          generateQubitCharacterization(qId, noiseModel, rng)
        )

        const targetGates = gateTypes || ['X', 'SX', 'RZ', 'CX']
        const gates: GateCharacterization[] = []

        for (const gateType of targetGates) {
          if (gateType === 'CX' || gateType === 'CNOT' || gateType === 'CZ') {
            for (let i = 0; i < targetQubits.length - 1; i++) {
              gates.push(generateGateCharacterization(
                gateType,
                [targetQubits[i], targetQubits[i + 1]],
                noiseModel,
                rng
              ))
            }
          } else {
            for (const qId of targetQubits) {
              gates.push(generateGateCharacterization(
                gateType,
                [qId],
                noiseModel,
                rng
              ))
            }
          }
        }

        const avgT1 = qubits.reduce((s, q) => s + q.t1, 0) / qubits.length
        const avgT2 = qubits.reduce((s, q) => s + q.t2, 0) / qubits.length
        const avgReadoutFidelity = qubits.reduce((s, q) => s + q.readoutFidelity, 0) / qubits.length
        const avgGateFidelity = gates.reduce((s, g) => s + g.fidelity, 0) / gates.length
        const quantumVolume = calculateQuantumVolume(qubits, gates)

        console.log(`[HW-SIM] Full characterization complete`)
        console.log(`[HW-SIM] Avg T1: ${avgT1.toFixed(1)} us, Avg T2: ${avgT2.toFixed(1)} us`)
        console.log(`[HW-SIM] Quantum Volume: ${quantumVolume}`)

        return {
          success: true,
          characterization: {
            qubits,
            gates,
            systemMetrics: {
              averageT1: avgT1,
              averageT2: avgT2,
              averageReadoutFidelity: avgReadoutFidelity,
              averageGateFidelity: avgGateFidelity,
              quantumVolume,
              timestamp: new Date().toISOString(),
            },
          },
          executionTimeMs: performance.now() - startTime,
        }
      }

      case 'gate_calibration': {
        const targetGates = gateTypes || ['X', 'SX', 'RZ', 'CX']
        const gates: GateCharacterization[] = []

        for (const gateType of targetGates) {
          if (gateType === 'CX' || gateType === 'CNOT' || gateType === 'CZ') {
            for (let i = 0; i < targetQubits.length - 1; i++) {
              gates.push(generateGateCharacterization(
                gateType,
                [targetQubits[i], targetQubits[i + 1]],
                noiseModel,
                rng
              ))
            }
          } else {
            for (const qId of targetQubits) {
              gates.push(generateGateCharacterization(
                gateType,
                [qId],
                noiseModel,
                rng
              ))
            }
          }
        }

        console.log(`[HW-SIM] Gate calibration complete for ${gates.length} gates`)

        return {
          success: true,
          characterization: {
            qubits: [],
            gates,
            systemMetrics: {
              averageT1: 0,
              averageT2: 0,
              averageReadoutFidelity: 0,
              averageGateFidelity: gates.reduce((s, g) => s + g.fidelity, 0) / gates.length,
              quantumVolume: 0,
              timestamp: new Date().toISOString(),
            },
          },
          executionTimeMs: performance.now() - startTime,
        }
      }

      default:
        return {
          success: false,
          error: { code: 'INVALID_ACTION', message: `Unknown action: ${action}` },
          executionTimeMs: performance.now() - startTime,
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[HW-SIM] Error:', message)

    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message },
      executionTimeMs: performance.now() - startTime,
    }
  }
}
