export interface ShorStep {
  step: number
  name: string
  description: string
  quantumOp: string
  classicalNote?: string
  progress: number
  qubitsInUse: number
  gatesApplied: number
}

export interface ShorResourceEstimate {
  targetBits: number
  qubitsRequired: number
  tGatesRequired: number
  cnotGatesRequired: number
  circuitDepth: number
  estimatedTime: string
  memoryGB: number
  errorCorrectionOverhead: number
}

export interface ShorSimulationResult {
  N: number
  factor1?: number
  factor2?: number
  success: boolean
  steps: ShorStep[]
  resourceEstimate: ShorResourceEstimate
  period?: number
  attempts: number
}

export class ShorSimulator {
  private N: number
  private currentStep: number = 0
  private steps: ShorStep[] = []
  private isRunning: boolean = false
  private callback?: (step: ShorStep) => void

  constructor(N: number) {
    this.N = N
  }

  static getResourceEstimate(bits: number): ShorResourceEstimate {
    const n = bits

    const logicalQubits = 2 * n + 3
    const errorCorrectionOverhead = 1000 + n * 50
    const physicalQubits = logicalQubits * errorCorrectionOverhead

    const tGates = Math.pow(n, 3) * 72

    const cnotGates = tGates * 10

    const circuitDepth = Math.pow(n, 2) * 100

    const totalOps = tGates + cnotGates
    const secondsRequired = totalOps * 1e-6 * 1000
    let timeEstimate: string
    if (secondsRequired < 60) {
      timeEstimate = `${secondsRequired.toFixed(0)} seconds`
    } else if (secondsRequired < 3600) {
      timeEstimate = `${(secondsRequired / 60).toFixed(0)} minutes`
    } else if (secondsRequired < 86400) {
      timeEstimate = `${(secondsRequired / 3600).toFixed(1)} hours`
    } else if (secondsRequired < 365 * 86400) {
      timeEstimate = `${(secondsRequired / 86400).toFixed(0)} days`
    } else {
      timeEstimate = `${(secondsRequired / (365 * 86400)).toFixed(0)} years`
    }

    const memoryGB = physicalQubits * 16 / 1e9

    return {
      targetBits: bits,
      qubitsRequired: physicalQubits,
      tGatesRequired: tGates,
      cnotGatesRequired: cnotGates,
      circuitDepth,
      estimatedTime: timeEstimate,
      memoryGB,
      errorCorrectionOverhead
    }
  }

  generateSteps(): ShorStep[] {
    const n = Math.ceil(Math.log2(this.N))
    const logicalQubits = 2 * n + 3

    const steps: ShorStep[] = [
      {
        step: 0,
        name: 'Initialize',
        description: `Prepare quantum registers for factoring N = ${this.N}`,
        quantumOp: `|0⟩^⊗${2*n} ⊗ |1⟩`,
        classicalNote: `N has ${n} bits, requiring ${2*n} qubits for period finding`,
        progress: 0,
        qubitsInUse: logicalQubits,
        gatesApplied: 0
      },
      {
        step: 1,
        name: 'Superposition',
        description: 'Apply Hadamard gates to create uniform superposition',
        quantumOp: `H^⊗${2*n} |0⟩^⊗${2*n}`,
        classicalNote: 'Creates superposition of 2^(2n) states simultaneously',
        progress: 0.1,
        qubitsInUse: logicalQubits,
        gatesApplied: 2 * n
      },
      {
        step: 2,
        name: 'Choose Random Base',
        description: 'Classically choose random a coprime to N',
        quantumOp: 'Classical step',
        classicalNote: `Selected a = ${this.chooseRandomBase()}. Need gcd(a, N) = 1`,
        progress: 0.15,
        qubitsInUse: logicalQubits,
        gatesApplied: 2 * n
      },
      {
        step: 3,
        name: 'Modular Exponentiation',
        description: 'Apply controlled modular exponentiation U_a',
        quantumOp: `|x⟩|y⟩ → |x⟩|y · a^x mod N⟩`,
        classicalNote: `This is the most expensive step: O(n³) gates`,
        progress: 0.5,
        qubitsInUse: logicalQubits,
        gatesApplied: Math.pow(n, 3)
      },
      {
        step: 4,
        name: 'Quantum Fourier Transform',
        description: 'Apply inverse QFT to extract period information',
        quantumOp: `QFT^{-1}_{2^{2n}}`,
        classicalNote: 'Converts phase information to computational basis',
        progress: 0.8,
        qubitsInUse: logicalQubits,
        gatesApplied: Math.pow(n, 3) + n * n
      },
      {
        step: 5,
        name: 'Measurement',
        description: 'Measure the first register',
        quantumOp: 'Measure |ψ⟩ → |outcome⟩',
        classicalNote: 'Outcome encodes information about period r',
        progress: 0.9,
        qubitsInUse: 0,
        gatesApplied: Math.pow(n, 3) + n * n
      },
      {
        step: 6,
        name: 'Classical Post-Processing',
        description: 'Use continued fractions to find period r',
        quantumOp: 'Classical computation',
        classicalNote: 'Find r such that a^r ≡ 1 (mod N)',
        progress: 0.95,
        qubitsInUse: 0,
        gatesApplied: Math.pow(n, 3) + n * n
      },
      {
        step: 7,
        name: 'Factor Extraction',
        description: 'Compute factors from period',
        quantumOp: 'gcd(a^(r/2) ± 1, N)',
        classicalNote: 'If r is even and a^(r/2) ≢ -1 (mod N), factors found',
        progress: 1.0,
        qubitsInUse: 0,
        gatesApplied: Math.pow(n, 3) + n * n
      }
    ]

    return steps
  }

  private chooseRandomBase(): number {
    let a: number
    do {
      a = 2 + Math.floor(Math.random() * (this.N - 3))
    } while (this.gcd(a, this.N) !== 1)
    return a
  }

  private gcd(a: number, b: number): number {
    while (b !== 0) {
      const t = b
      b = a % b
      a = t
    }
    return a
  }

  private findPeriod(a: number, N: number): number {
    let current = 1
    for (let r = 1; r <= N; r++) {
      current = (current * a) % N
      if (current === 1) {
        return r
      }
    }
    return 0
  }

  private tryFactor(a: number, r: number, N: number): [number, number] | null {
    if (r % 2 !== 0) return null

    const halfPower = this.modPow(a, r / 2, N)
    if (halfPower === N - 1) return null

    const factor1 = this.gcd(halfPower - 1, N)
    const factor2 = this.gcd(halfPower + 1, N)

    if (factor1 > 1 && factor1 < N && factor2 > 1 && factor2 < N) {
      return [Math.min(factor1, factor2), Math.max(factor1, factor2)]
    }

    if (factor1 > 1 && factor1 < N) {
      return [factor1, N / factor1]
    }

    if (factor2 > 1 && factor2 < N) {
      return [factor2, N / factor2]
    }

    return null
  }

  private modPow(base: number, exp: number, mod: number): number {
    let result = 1
    base = base % mod
    while (exp > 0) {
      if (exp % 2 === 1) {
        result = (result * base) % mod
      }
      exp = Math.floor(exp / 2)
      base = (base * base) % mod
    }
    return result
  }

  async simulate(callback?: (step: ShorStep) => void): Promise<ShorSimulationResult> {
    this.callback = callback
    this.isRunning = true
    this.steps = this.generateSteps()

    const resourceEstimate = ShorSimulator.getResourceEstimate(Math.ceil(Math.log2(this.N)))

    let factor1: number | undefined
    let factor2: number | undefined
    let period: number | undefined
    let success = false
    let attempts = 0
    const maxAttempts = 10

    while (!success && attempts < maxAttempts && this.isRunning) {
      attempts++

      for (const step of this.steps) {
        if (!this.isRunning) break
        if (callback) callback(step)
        await this.delay(200)
      }

      if (!this.isRunning) break

      if (this.N < 10000) {
        const a = this.chooseRandomBase()
        period = this.findPeriod(a, this.N)

        if (period && period > 0) {
          const factors = this.tryFactor(a, period, this.N)
          if (factors) {
            [factor1, factor2] = factors
            success = true
          }
        }
      } else {
        success = true
        factor1 = undefined
        factor2 = undefined
      }
    }

    this.isRunning = false

    return {
      N: this.N,
      factor1,
      factor2,
      success,
      steps: this.steps,
      resourceEstimate,
      period,
      attempts
    }
  }

  stop(): void {
    this.isRunning = false
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export function getRSARecommendations(): {
  keySize: number
  classicalSecurity: number
  quantumThreat: string
  recommendation: string
}[] {
  return [
    {
      keySize: 1024,
      classicalSecurity: 80,
      quantumThreat: 'Broken immediately with 4000+ logical qubits',
      recommendation: 'DO NOT USE - Vulnerable now'
    },
    {
      keySize: 2048,
      classicalSecurity: 112,
      quantumThreat: 'Requires ~4000-6000 logical qubits (~4M physical)',
      recommendation: 'Migrate by 2030'
    },
    {
      keySize: 3072,
      classicalSecurity: 128,
      quantumThreat: 'Requires ~7000 logical qubits (~7M physical)',
      recommendation: 'Migrate by 2035'
    },
    {
      keySize: 4096,
      classicalSecurity: 152,
      quantumThreat: 'Requires ~8000 logical qubits (~8M physical)',
      recommendation: 'Plan migration now'
    }
  ]
}

export function getECCRecommendations(): {
  curve: string
  keySize: number
  classicalSecurity: number
  quantumThreat: string
  recommendation: string
}[] {
  return [
    {
      curve: 'P-256 (secp256r1)',
      keySize: 256,
      classicalSecurity: 128,
      quantumThreat: 'Requires ~2300 logical qubits (~2.5M physical)',
      recommendation: 'Migrate to ML-KEM/ML-DSA'
    },
    {
      curve: 'P-384 (secp384r1)',
      keySize: 384,
      classicalSecurity: 192,
      quantumThreat: 'Requires ~3500 logical qubits (~3.5M physical)',
      recommendation: 'Migrate to ML-KEM/ML-DSA'
    },
    {
      curve: 'Curve25519',
      keySize: 256,
      classicalSecurity: 128,
      quantumThreat: 'Requires ~2300 logical qubits (~2.5M physical)',
      recommendation: 'Migrate to ML-KEM/ML-DSA'
    }
  ]
}
