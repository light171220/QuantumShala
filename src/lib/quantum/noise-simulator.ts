import type {
  QuantumCircuit,
  CircuitGate,
  SimulationResult,
  Complex,
  BlochVector,
  NoiseConfig,
  NoiseType,
  HardwarePreset,
  GateType,
} from '@/types/simulator'
import { QuantumSimulator, BROWSER_MAX_QUBITS } from './simulator'

export const HARDWARE_PRESETS: Record<HardwarePreset, Partial<NoiseConfig>> = {
  ideal: {
    enabled: false,
    model: { type: 'depolarizing', errorRate: 0 },
  },
  ibmq: {
    enabled: true,
    model: { type: 'depolarizing', errorRate: 0.001 },
    t1: 100,
    t2: 80,
    readoutError: 0.015,
    gateErrors: {
      H: 0.0005,
      X: 0.0003,
      Y: 0.0003,
      Z: 0.0001,
      S: 0.0002,
      T: 0.0002,
      Rx: 0.0008,
      Ry: 0.0008,
      Rz: 0.0001,
      CNOT: 0.008,
      CX: 0.008,
      CZ: 0.006,
      SWAP: 0.024,
    } as Record<GateType, number>,
  },
  ionq: {
    enabled: true,
    model: { type: 'depolarizing', errorRate: 0.0005 },
    t1: 10000,
    t2: 1000,
    readoutError: 0.003,
    gateErrors: {
      H: 0.0001,
      X: 0.0001,
      Y: 0.0001,
      Z: 0.00001,
      S: 0.0001,
      T: 0.0001,
      Rx: 0.0003,
      Ry: 0.0003,
      Rz: 0.00001,
      CNOT: 0.005,
      CX: 0.005,
      CZ: 0.004,
      SWAP: 0.015,
    } as Record<GateType, number>,
  },
  custom: {
    enabled: true,
    model: { type: 'depolarizing', errorRate: 0.001 },
  },
}

export const DEFAULT_NOISE_CONFIG: NoiseConfig = {
  enabled: false,
  model: { type: 'depolarizing', errorRate: 0.001 },
  preset: 'ideal',
}

export class NoisyQuantumSimulator extends QuantumSimulator {
  private noiseConfig: NoiseConfig
  private densityReal: Float64Array
  private densityImag: Float64Array

  constructor(numQubits: number, noiseConfig: NoiseConfig = DEFAULT_NOISE_CONFIG) {
    super(numQubits)
    this.noiseConfig = noiseConfig
    const dim = 1 << numQubits
    this.densityReal = new Float64Array(dim * dim)
    this.densityImag = new Float64Array(dim * dim)
  }

  setNoiseConfig(config: NoiseConfig): void {
    this.noiseConfig = config
  }

  getNoiseConfig(): NoiseConfig {
    return this.noiseConfig
  }

  applyGateWithNoise(gate: CircuitGate): void {
    super.applyGate(gate)

    if (!this.noiseConfig.enabled) {
      return
    }

    const errorRate = this.getGateErrorRate(gate.type)
    if (errorRate <= 0) {
      return
    }

    for (const qubit of gate.qubits) {
      this.applyNoiseChannel(qubit, errorRate)
    }
  }

  private getGateErrorRate(gateType: GateType): number {
    if (this.noiseConfig.gateErrors?.[gateType] !== undefined) {
      return this.noiseConfig.gateErrors[gateType]
    }
    return this.noiseConfig.model.errorRate
  }

  private applyNoiseChannel(qubit: number, errorRate: number): void {
    const noiseType = this.noiseConfig.model.type

    switch (noiseType) {
      case 'depolarizing':
        this.applyDepolarizingNoise(qubit, errorRate)
        break
      case 'amplitude_damping':
        this.applyAmplitudeDampingNoise(qubit, errorRate)
        break
      case 'phase_damping':
        this.applyPhaseDampingNoise(qubit, errorRate)
        break
      case 'bit_flip':
        this.applyBitFlipNoise(qubit, errorRate)
        break
      case 'phase_flip':
        this.applyPhaseFlipNoise(qubit, errorRate)
        break
      default:
        this.applyDepolarizingNoise(qubit, errorRate)
    }
  }

  private applyDepolarizingNoise(qubit: number, p: number): void {
    if (Math.random() >= p) return

    const errorType = Math.random()
    if (errorType < 1/3) {
      this.applyPauliX(qubit)
    } else if (errorType < 2/3) {
      this.applyPauliY(qubit)
    } else {
      this.applyPauliZ(qubit)
    }
  }

  private applyBitFlipNoise(qubit: number, p: number): void {
    if (Math.random() < p) {
      this.applyPauliX(qubit)
    }
  }

  private applyPhaseFlipNoise(qubit: number, p: number): void {
    if (Math.random() < p) {
      this.applyPauliZ(qubit)
    }
  }

  private applyAmplitudeDampingNoise(qubit: number, gamma: number): void {
    const stateVector = this.getStateVector()
    const numStates = stateVector.length
    const mask = 1 << qubit
    const sqrtGamma = Math.sqrt(gamma)
    const sqrt1MinusGamma = Math.sqrt(1 - gamma)

    for (let i = 0; i < numStates; i++) {
      const bit = (i & mask) !== 0 ? 1 : 0
      if (bit === 1) {
        const j = i ^ mask
        const prob = gamma * (stateVector[i].re * stateVector[i].re + stateVector[i].im * stateVector[i].im)
        if (Math.random() < prob) {
          this.applyPauliX(qubit)
          return
        }
      }
    }

    for (let i = 0; i < numStates; i++) {
      const bit = (i & mask) !== 0 ? 1 : 0
      if (bit === 1) {
        this.scaleAmplitude(i, sqrt1MinusGamma)
      }
    }
  }

  private applyPhaseDampingNoise(qubit: number, lambda: number): void {
    if (Math.random() < lambda) {
      this.applyPauliZ(qubit)
    }
  }

  private applyPauliX(qubit: number): void {
    const gate: CircuitGate = {
      id: 'noise-x',
      type: 'X',
      qubits: [qubit],
      position: -1,
    }
    super.applyGate(gate)
  }

  private applyPauliY(qubit: number): void {
    const gate: CircuitGate = {
      id: 'noise-y',
      type: 'Y',
      qubits: [qubit],
      position: -1,
    }
    super.applyGate(gate)
  }

  private applyPauliZ(qubit: number): void {
    const gate: CircuitGate = {
      id: 'noise-z',
      type: 'Z',
      qubits: [qubit],
      position: -1,
    }
    super.applyGate(gate)
  }

  private scaleAmplitude(stateIndex: number, factor: number): void {
    const sv = this.getStateVector()
    sv[stateIndex].re *= factor
    sv[stateIndex].im *= factor
  }

  applyReadoutError(measurement: number): number {
    if (!this.noiseConfig.enabled || !this.noiseConfig.readoutError) {
      return measurement
    }

    if (Math.random() < this.noiseConfig.readoutError) {
      return 1 - measurement
    }
    return measurement
  }
}

export function simulateNoisyCircuit(
  circuit: QuantumCircuit,
  shots: number = 1024,
  noiseConfig: NoiseConfig = DEFAULT_NOISE_CONFIG
): SimulationResult {
  if (circuit.numQubits > BROWSER_MAX_QUBITS) {
    throw new Error(`Browser supports max ${BROWSER_MAX_QUBITS} qubits.`)
  }

  const startTime = performance.now()
  const counts: Record<string, number> = {}
  const sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)

  for (let shot = 0; shot < shots; shot++) {
    const sim = new NoisyQuantumSimulator(circuit.numQubits, noiseConfig)

    for (const gate of sortedGates) {
      sim.applyGateWithNoise(gate)
    }

    const bits = sim.measureAll()
    let outcome = ''
    for (let q = circuit.numQubits - 1; q >= 0; q--) {
      let bit = bits[q]
      if (noiseConfig.enabled && noiseConfig.readoutError) {
        bit = sim.applyReadoutError(bit)
      }
      outcome += bit.toString()
    }

    counts[outcome] = (counts[outcome] || 0) + 1
  }

  const probabilities: Record<string, number> = {}
  for (const [state, count] of Object.entries(counts)) {
    probabilities[state] = count / shots
  }

  const executionTime = performance.now() - startTime

  const finalSim = new NoisyQuantumSimulator(circuit.numQubits, noiseConfig)
  for (const gate of sortedGates) {
    finalSim.applyGateWithNoise(gate)
  }
  const stateVector = finalSim.getStateVector()
  const blochVectors: BlochVector[] = []
  for (let q = 0; q < circuit.numQubits; q++) {
    blochVectors.push(finalSim.getBlochVector(q))
  }

  return {
    circuitId: circuit.id,
    backend: 'browser',
    method: 'state-vector',
    executionTime,
    shots,
    counts,
    probabilities,
    stateVector,
    blochVectors,
    metadata: {
      tier: 'browser',
      memoryUsedMB: Math.pow(2, circuit.numQubits) * 16 / (1024 * 1024),
    },
  }
}

export function createNoiseConfig(
  preset: HardwarePreset,
  overrides?: Partial<NoiseConfig>
): NoiseConfig {
  const baseConfig = HARDWARE_PRESETS[preset] || HARDWARE_PRESETS.custom
  return {
    ...DEFAULT_NOISE_CONFIG,
    ...baseConfig,
    ...overrides,
    preset,
  } as NoiseConfig
}

export function estimateNoiseImpact(
  circuit: QuantumCircuit,
  noiseConfig: NoiseConfig
): { expectedFidelity: number; errorProbability: number } {
  if (!noiseConfig.enabled) {
    return { expectedFidelity: 1.0, errorProbability: 0 }
  }

  const baseError = noiseConfig.model.errorRate
  let totalErrorProb = 0

  for (const gate of circuit.gates) {
    const gateError = noiseConfig.gateErrors?.[gate.type] ?? baseError
    totalErrorProb += gateError * gate.qubits.length
  }

  if (noiseConfig.readoutError) {
    totalErrorProb += noiseConfig.readoutError * circuit.numQubits
  }

  const errorProbability = Math.min(1, totalErrorProb)
  const expectedFidelity = Math.max(0, 1 - totalErrorProb)

  return { expectedFidelity, errorProbability }
}
