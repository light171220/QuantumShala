export interface GroverStep {
  step: number
  name: string
  description: string
  quantumOp: string
  amplitudes: { state: string; amplitude: number }[]
  targetAmplitude: number
  averageAmplitude: number
  iteration: number
  progress: number
}

export interface GroverResourceEstimate {
  searchSpaceBits: number
  optimalIterations: number
  qubitsRequired: number
  tGatesRequired: number
  circuitDepth: number
  speedup: string
  classicalOperations: number
  quantumOperations: number
  effectiveSecurityBits: number
}

export interface GroverSimulationResult {
  searchSize: number
  targetIndex: number
  foundIndex: number
  success: boolean
  iterations: number
  steps: GroverStep[]
  resourceEstimate: GroverResourceEstimate
  finalProbability: number
}

export class GroverSimulator {
  private n: number
  private N: number
  private targetIndex: number
  private amplitudes: number[]
  private steps: GroverStep[] = []
  private isRunning: boolean = false

  constructor(numQubits: number, targetIndex?: number) {
    this.n = numQubits
    this.N = Math.pow(2, numQubits)
    this.targetIndex = targetIndex ?? Math.floor(Math.random() * this.N)
    this.amplitudes = new Array(this.N).fill(1 / Math.sqrt(this.N))
  }

  static getResourceEstimate(bits: number): GroverResourceEstimate {
    const N = Math.pow(2, bits)
    const optimalIterations = Math.floor(Math.PI / 4 * Math.sqrt(N))

    const qubitsRequired = bits + 1

    const tGatesPerIteration = 4 * bits
    const tGatesRequired = tGatesPerIteration * optimalIterations

    const circuitDepth = 10 * bits * optimalIterations

    const classicalOperations = N / 2
    const quantumOperations = optimalIterations

    const speedup = `${Math.sqrt(N).toExponential(2)}× (√N)`

    const effectiveSecurityBits = bits / 2

    return {
      searchSpaceBits: bits,
      optimalIterations,
      qubitsRequired,
      tGatesRequired,
      circuitDepth,
      speedup,
      classicalOperations,
      quantumOperations,
      effectiveSecurityBits
    }
  }

  private applyHadamard(): void {
  }

  private applyOracle(): void {
    this.amplitudes[this.targetIndex] *= -1
  }

  private applyDiffusion(): void {
    const mean = this.amplitudes.reduce((a, b) => a + b, 0) / this.N

    for (let i = 0; i < this.N; i++) {
      this.amplitudes[i] = 2 * mean - this.amplitudes[i]
    }
  }

  private getStateSnapshot(iteration: number, stepName: string): GroverStep {
    const targetAmp = this.amplitudes[this.targetIndex]
    const avgAmp = this.amplitudes.reduce((a, b) => a + Math.abs(b), 0) / this.N

    const stateAmps: { state: string; amplitude: number }[] = []

    stateAmps.push({
      state: this.targetIndex.toString(2).padStart(this.n, '0'),
      amplitude: this.amplitudes[this.targetIndex]
    })

    for (let i = 0; i < Math.min(this.N, 8); i++) {
      if (i !== this.targetIndex) {
        stateAmps.push({
          state: i.toString(2).padStart(this.n, '0'),
          amplitude: this.amplitudes[i]
        })
      }
    }

    return {
      step: this.steps.length,
      name: stepName,
      description: this.getStepDescription(stepName, iteration),
      quantumOp: this.getQuantumOp(stepName),
      amplitudes: stateAmps.slice(0, 6),
      targetAmplitude: targetAmp,
      averageAmplitude: avgAmp,
      iteration,
      progress: iteration / this.getOptimalIterations()
    }
  }

  private getStepDescription(stepName: string, iteration: number): string {
    switch (stepName) {
      case 'Initialize':
        return `Create uniform superposition over ${this.N} states`
      case 'Oracle':
        return `Mark target state |${this.targetIndex.toString(2).padStart(this.n, '0')}⟩ with phase flip`
      case 'Diffusion':
        return `Amplify marked state amplitude (iteration ${iteration})`
      case 'Measure':
        return `Measure to find target with high probability`
      default:
        return ''
    }
  }

  private getQuantumOp(stepName: string): string {
    switch (stepName) {
      case 'Initialize':
        return `H^⊗${this.n}`
      case 'Oracle':
        return 'O_f: |x⟩ → (-1)^f(x)|x⟩'
      case 'Diffusion':
        return 'D = 2|ψ⟩⟨ψ| - I'
      case 'Measure':
        return 'Measure in computational basis'
      default:
        return ''
    }
  }

  getOptimalIterations(): number {
    return Math.floor(Math.PI / 4 * Math.sqrt(this.N))
  }

  getTargetProbability(): number {
    return this.amplitudes[this.targetIndex] ** 2
  }

  async simulate(callback?: (step: GroverStep) => void): Promise<GroverSimulationResult> {
    this.isRunning = true
    this.steps = []

    this.amplitudes = new Array(this.N).fill(1 / Math.sqrt(this.N))

    const initStep = this.getStateSnapshot(0, 'Initialize')
    this.steps.push(initStep)
    if (callback) callback(initStep)
    await this.delay(300)

    const optimalIterations = this.getOptimalIterations()

    for (let iter = 1; iter <= optimalIterations && this.isRunning; iter++) {
      this.applyOracle()
      const oracleStep = this.getStateSnapshot(iter, 'Oracle')
      this.steps.push(oracleStep)
      if (callback) callback(oracleStep)
      await this.delay(200)

      if (!this.isRunning) break

      this.applyDiffusion()
      const diffusionStep = this.getStateSnapshot(iter, 'Diffusion')
      this.steps.push(diffusionStep)
      if (callback) callback(diffusionStep)
      await this.delay(200)
    }

    if (this.isRunning) {
      const measureStep = this.getStateSnapshot(optimalIterations, 'Measure')
      this.steps.push(measureStep)
      if (callback) callback(measureStep)
    }

    const finalProb = this.getTargetProbability()
    const foundIndex = Math.random() < finalProb ? this.targetIndex : this.sampleOther()

    this.isRunning = false

    return {
      searchSize: this.N,
      targetIndex: this.targetIndex,
      foundIndex,
      success: foundIndex === this.targetIndex,
      iterations: optimalIterations,
      steps: this.steps,
      resourceEstimate: GroverSimulator.getResourceEstimate(this.n),
      finalProbability: finalProb
    }
  }

  private sampleOther(): number {
    let idx: number
    do {
      idx = Math.floor(Math.random() * this.N)
    } while (idx === this.targetIndex)
    return idx
  }

  stop(): void {
    this.isRunning = false
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export function getSymmetricCryptoRecommendations(): {
  algorithm: string
  keySize: number
  classicalSecurity: number
  quantumSecurity: number
  recommendation: string
  action: string
}[] {
  return [
    {
      algorithm: 'AES-128',
      keySize: 128,
      classicalSecurity: 128,
      quantumSecurity: 64,
      recommendation: 'Upgrade to AES-256',
      action: 'Replace with AES-256 for post-quantum security'
    },
    {
      algorithm: 'AES-192',
      keySize: 192,
      classicalSecurity: 192,
      quantumSecurity: 96,
      recommendation: 'Upgrade to AES-256',
      action: 'Replace with AES-256 for post-quantum security'
    },
    {
      algorithm: 'AES-256',
      keySize: 256,
      classicalSecurity: 256,
      quantumSecurity: 128,
      recommendation: 'Quantum-safe',
      action: 'No action needed - provides 128-bit post-quantum security'
    },
    {
      algorithm: 'ChaCha20',
      keySize: 256,
      classicalSecurity: 256,
      quantumSecurity: 128,
      recommendation: 'Quantum-safe',
      action: 'No action needed - provides 128-bit post-quantum security'
    },
    {
      algorithm: 'SHA-256',
      keySize: 256,
      classicalSecurity: 256,
      quantumSecurity: 128,
      recommendation: 'Quantum-safe',
      action: 'Consider SHA-3-256 as alternative'
    },
    {
      algorithm: 'SHA-384',
      keySize: 384,
      classicalSecurity: 384,
      quantumSecurity: 192,
      recommendation: 'Quantum-safe',
      action: 'Provides excellent post-quantum security'
    },
    {
      algorithm: 'SHA-512',
      keySize: 512,
      classicalSecurity: 512,
      quantumSecurity: 256,
      recommendation: 'Quantum-safe',
      action: 'Maximum post-quantum security'
    },
    {
      algorithm: 'HMAC-SHA256',
      keySize: 256,
      classicalSecurity: 256,
      quantumSecurity: 128,
      recommendation: 'Quantum-safe',
      action: 'Ensure key is at least 256 bits'
    }
  ]
}

export function getGroverSpeedupData(maxBits: number = 64): {
  bits: number
  classicalOps: number
  quantumOps: number
  speedupFactor: number
}[] {
  const data: {
    bits: number
    classicalOps: number
    quantumOps: number
    speedupFactor: number
  }[] = []

  for (let bits = 4; bits <= maxBits; bits += 4) {
    const N = Math.pow(2, bits)
    const classicalOps = N / 2
    const quantumOps = Math.PI / 4 * Math.sqrt(N)
    const speedupFactor = classicalOps / quantumOps

    data.push({
      bits,
      classicalOps: Math.log10(classicalOps),
      quantumOps: Math.log10(quantumOps),
      speedupFactor
    })
  }

  return data
}

export function getAmplitudeAmplificationExplanation(): {
  step: number
  title: string
  explanation: string
  formula: string
}[] {
  return [
    {
      step: 1,
      title: 'Initial Superposition',
      explanation: 'Start with uniform superposition: all N states have equal amplitude 1/√N',
      formula: '|ψ₀⟩ = H^⊗n|0⟩^⊗n = (1/√N) Σ|x⟩'
    },
    {
      step: 2,
      title: 'Oracle (Phase Flip)',
      explanation: 'The oracle marks the target by flipping its phase: amplitude becomes negative',
      formula: 'O|x⟩ = (-1)^f(x)|x⟩ where f(x)=1 for target'
    },
    {
      step: 3,
      title: 'Diffusion (Inversion)',
      explanation: 'Invert all amplitudes about their mean. This increases target amplitude!',
      formula: 'D = 2|ψ⟩⟨ψ| - I (reflect about mean)'
    },
    {
      step: 4,
      title: 'Repeat',
      explanation: 'Each iteration rotates the state vector closer to the target. After √N iterations, target probability ≈ 1',
      formula: 'θ = 2arcsin(1/√N), iterations = ⌊π/(4θ)⌋ ≈ (π/4)√N'
    }
  ]
}
