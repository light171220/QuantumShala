export type NoiseType = 'depolarizing' | 'amplitude_damping' | 'phase_damping' | 'bit_flip' | 'phase_flip' | 'combined'

export interface NoiseModelConfig {
  type: NoiseType
  errorRate: number
  t1?: number
  t2?: number
  gateTime?: number
  thermalPopulation?: number
}

export interface NoiseChannel {
  type: NoiseType
  krausOperators: KrausOperator[]
}

export interface KrausOperator {
  matrix: number[][]
  probability: number
}

export interface Complex {
  re: number
  im: number
}

export function createDepolarizingChannel(errorRate: number): NoiseChannel {
  const p = errorRate
  const p0 = 1 - p
  const pXYZ = p / 3

  return {
    type: 'depolarizing',
    krausOperators: [
      {
        matrix: [[Math.sqrt(p0), 0], [0, Math.sqrt(p0)]],
        probability: p0
      },
      {
        matrix: [[0, Math.sqrt(pXYZ)], [Math.sqrt(pXYZ), 0]],
        probability: pXYZ
      },
      {
        matrix: [[0, -Math.sqrt(pXYZ)], [Math.sqrt(pXYZ), 0]],
        probability: pXYZ
      },
      {
        matrix: [[Math.sqrt(pXYZ), 0], [0, -Math.sqrt(pXYZ)]],
        probability: pXYZ
      }
    ]
  }
}

export function createAmplitudeDampingChannel(gamma: number): NoiseChannel {
  const sqrtGamma = Math.sqrt(gamma)
  const sqrt1MinusGamma = Math.sqrt(1 - gamma)

  return {
    type: 'amplitude_damping',
    krausOperators: [
      {
        matrix: [[1, 0], [0, sqrt1MinusGamma]],
        probability: 1 - gamma
      },
      {
        matrix: [[0, sqrtGamma], [0, 0]],
        probability: gamma
      }
    ]
  }
}

export function createPhaseDampingChannel(lambda: number): NoiseChannel {
  const sqrtLambda = Math.sqrt(lambda)
  const sqrt1MinusLambda = Math.sqrt(1 - lambda)

  return {
    type: 'phase_damping',
    krausOperators: [
      {
        matrix: [[1, 0], [0, sqrt1MinusLambda]],
        probability: 1 - lambda
      },
      {
        matrix: [[0, 0], [0, sqrtLambda]],
        probability: lambda
      }
    ]
  }
}

export function createBitFlipChannel(p: number): NoiseChannel {
  const sqrt1MinusP = Math.sqrt(1 - p)
  const sqrtP = Math.sqrt(p)

  return {
    type: 'bit_flip',
    krausOperators: [
      {
        matrix: [[sqrt1MinusP, 0], [0, sqrt1MinusP]],
        probability: 1 - p
      },
      {
        matrix: [[0, sqrtP], [sqrtP, 0]],
        probability: p
      }
    ]
  }
}

export function createPhaseFlipChannel(p: number): NoiseChannel {
  const sqrt1MinusP = Math.sqrt(1 - p)
  const sqrtP = Math.sqrt(p)

  return {
    type: 'phase_flip',
    krausOperators: [
      {
        matrix: [[sqrt1MinusP, 0], [0, sqrt1MinusP]],
        probability: 1 - p
      },
      {
        matrix: [[sqrtP, 0], [0, -sqrtP]],
        probability: p
      }
    ]
  }
}

export function createNoiseChannel(config: NoiseModelConfig): NoiseChannel {
  switch (config.type) {
    case 'depolarizing':
      return createDepolarizingChannel(config.errorRate)
    case 'amplitude_damping':
      return createAmplitudeDampingChannel(config.errorRate)
    case 'phase_damping':
      return createPhaseDampingChannel(config.errorRate)
    case 'bit_flip':
      return createBitFlipChannel(config.errorRate)
    case 'phase_flip':
      return createPhaseFlipChannel(config.errorRate)
    case 'combined':
      return createCombinedChannel(config)
    default:
      return createDepolarizingChannel(config.errorRate)
  }
}

function createCombinedChannel(config: NoiseModelConfig): NoiseChannel {
  const t1 = config.t1 ?? 50e-6
  const t2 = config.t2 ?? 100e-6
  const gateTime = config.gateTime ?? 50e-9

  const gammaRelax = 1 - Math.exp(-gateTime / t1)
  const gammaDephase = 1 - Math.exp(-gateTime / t2)

  const ampChannel = createAmplitudeDampingChannel(gammaRelax)
  const phaseChannel = createPhaseDampingChannel(gammaDephase)

  return {
    type: 'combined',
    krausOperators: [...ampChannel.krausOperators, ...phaseChannel.krausOperators]
  }
}

export function t1ToGamma(t1: number, gateTime: number): number {
  return 1 - Math.exp(-gateTime / t1)
}

export function t2ToLambda(t2: number, gateTime: number): number {
  return 1 - Math.exp(-gateTime / t2)
}

export class NoiseModel {
  private channels: Map<string, NoiseChannel> = new Map()
  private defaultChannel: NoiseChannel | null = null

  setDefaultNoise(config: NoiseModelConfig): void {
    this.defaultChannel = createNoiseChannel(config)
  }

  setGateNoise(gateType: string, config: NoiseModelConfig): void {
    this.channels.set(gateType, createNoiseChannel(config))
  }

  getNoiseChannel(gateType: string): NoiseChannel | null {
    return this.channels.get(gateType) || this.defaultChannel
  }

  applyToExpectation(idealExpectation: number, numGates: number): number {
    if (!this.defaultChannel) return idealExpectation

    const totalErrorProb = this.computeTotalError(numGates)
    const fidelity = 1 - totalErrorProb

    return idealExpectation * fidelity
  }

  private computeTotalError(numGates: number): number {
    if (!this.defaultChannel) return 0

    const singleGateError = 1 - this.defaultChannel.krausOperators[0].probability

    return 1 - Math.pow(1 - singleGateError, numGates)
  }
}

export function simulateNoiseEffect(
  idealEnergy: number,
  numGates: number,
  errorRate: number
): {
  noisyEnergy: number
  errorBound: number
  fidelity: number
} {
  const gateError = errorRate
  const fidelity = Math.pow(1 - gateError, numGates)

  const exactEnergy = idealEnergy
  const maxMixedEnergy = 0

  const noisyEnergy = fidelity * exactEnergy + (1 - fidelity) * maxMixedEnergy

  const errorBound = Math.abs(exactEnergy) * (1 - fidelity)

  return {
    noisyEnergy,
    errorBound,
    fidelity
  }
}

export const TYPICAL_ERROR_RATES = {
  singleQubitGate: 0.001,
  twoQubitGate: 0.01,
  measurement: 0.02,
  ibmq_montreal: {
    singleQubit: 0.0003,
    twoQubit: 0.01,
    readout: 0.02,
    t1: 100e-6,
    t2: 80e-6
  },
  ionq_harmony: {
    singleQubit: 0.003,
    twoQubit: 0.01,
    readout: 0.005,
    t1: 10000,
    t2: 1000
  },
  ideal: {
    singleQubit: 0,
    twoQubit: 0,
    readout: 0,
    t1: Infinity,
    t2: Infinity
  }
}

export function estimateRequiredErrorRate(
  targetAccuracy: number,
  numGates: number
): number {
  return -Math.log(1 - targetAccuracy / 100) / numGates
}

export function estimateCircuitFidelity(
  numSingleQubitGates: number,
  numTwoQubitGates: number,
  singleQubitError: number = 0.001,
  twoQubitError: number = 0.01
): number {
  const singleQubitFidelity = Math.pow(1 - singleQubitError, numSingleQubitGates)
  const twoQubitFidelity = Math.pow(1 - twoQubitError, numTwoQubitGates)

  return singleQubitFidelity * twoQubitFidelity
}
