import type {
  VQERequest,
  VQEResponse,
  VQEResult,
  VQEMetrics,
  VQEHistoryEntry,
  Hamiltonian,
  CostFunction,
  GradientFunction,
} from '../types'
import { Circuit, executeCircuit } from '../quantum-core/circuit'
import { computeHamiltonianExpectation, computeParameterShiftGradient } from '../quantum-core/measurement'
import { createOptimizer } from '../optimizers'
import { createAnsatzBuilder } from './ansatze'
import { getMoleculeByIdOrName, computeHamiltonianForMolecule } from './molecules'
import { hamiltonianCache, vqeResultCache, createCacheKeys } from '../cache'
import { applyZNE, applyReadoutMitigation, verifySymmetry } from '../mitigation'

const HARTREE_TO_KCAL = 627.5094740631
const CHEMICAL_ACCURACY = 0.0016

export interface VQEEngineOptions {
  enableLogging?: boolean
  onProgress?: (iteration: number, energy: number) => void
}

export class VQEEngine {
  private request: VQERequest
  private options: VQEEngineOptions
  private hamiltonian: Hamiltonian | null = null
  private circuit: Circuit | null = null
  private ansatzBuilder: ReturnType<typeof createAnsatzBuilder> | null = null
  private history: VQEHistoryEntry[] = []
  private startTime: number = 0

  constructor(request: VQERequest, options: VQEEngineOptions = {}) {
    this.request = request
    this.options = options
  }

  async run(): Promise<VQEResponse> {
    this.startTime = performance.now()

    try {
      this.hamiltonian = await this.getOrComputeHamiltonian()
      if (!this.hamiltonian) {
        return this.errorResponse('HAMILTONIAN_ERROR', 'Failed to compute Hamiltonian')
      }

      this.ansatzBuilder = createAnsatzBuilder(
        this.request.ansatz,
        this.request.quantum.numQubits,
        this.request.quantum.numElectrons,
        this.hamiltonian
      )

      const initialParams = this.ansatzBuilder.getInitialParameters()
      this.circuit = this.ansatzBuilder.buildCircuit(initialParams)

      const cacheKey = this.getCacheKey()
      const cachedResult = vqeResultCache.get(cacheKey)
      if (cachedResult && this.request.execution?.useCache !== false) {
        return {
          success: true,
          result: cachedResult,
          metrics: this.getMetrics(),
          cache: { hamiltonianCached: true, resultCached: true, cacheKey },
        }
      }

      const result = await this.optimize()

      if (this.request.execution?.saveResult !== false) {
        vqeResultCache.set(cacheKey, result)
      }

      return {
        success: true,
        result,
        metrics: this.getMetrics(),
        cache: { hamiltonianCached: false, resultCached: false, cacheKey },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return this.errorResponse('VQE_ERROR', message, error)
    }
  }

  private async getOrComputeHamiltonian(): Promise<Hamiltonian | null> {
    if (this.request.hamiltonian) {
      return this.request.hamiltonian
    }

    const cacheKey = createCacheKeys.hamiltonian(
      this.request.molecule.id,
      this.request.quantum.basisSet || 'sto-3g',
      this.request.quantum.qubitMapping || 'jordan_wigner'
    )

    const cached = hamiltonianCache.get(cacheKey)
    if (cached) {
      this.log('Using cached Hamiltonian')
      return cached
    }

    const molecule = getMoleculeByIdOrName(this.request.molecule.id)
    if (!molecule) {
      return null
    }

    const hamiltonian = computeHamiltonianForMolecule(
      molecule,
      this.request.quantum.qubitMapping || 'jordan_wigner',
      this.request.molecule.bondLength
    )

    if (hamiltonian) {
      hamiltonianCache.set(cacheKey, hamiltonian)
    }

    return hamiltonian
  }

  private async optimize(): Promise<VQEResult> {
    if (!this.circuit || !this.hamiltonian || !this.ansatzBuilder) {
      throw new Error('Engine not initialized')
    }

    const optimizer = createOptimizer(this.request.optimizer)
    const initialParams = this.ansatzBuilder.getInitialParameters()

    const costFn: CostFunction = (params: number[]) => {
      return this.evaluateEnergy(params)
    }

    const gradientFn: GradientFunction | undefined = this.needsGradient()
      ? (params: number[]) => this.computeGradient(params)
      : undefined

    const callback = (iteration: number, energy: number, params: number[]) => {
      const entry: VQEHistoryEntry = {
        iteration,
        energy,
        timestamp: performance.now() - this.startTime,
      }

      if (gradientFn) {
        const gradient = gradientFn(params)
        entry.gradientNorm = Math.sqrt(gradient.reduce((sum, g) => sum + g * g, 0))
      }

      entry.parametersNorm = Math.sqrt(params.reduce((sum, p) => sum + p * p, 0))
      this.history.push(entry)

      if (this.options.onProgress) {
        this.options.onProgress(iteration, energy)
      }

      this.log(`Iteration ${iteration}: E = ${energy.toFixed(8)} Ha`)
    }

    const optimResult = optimizer.optimize(initialParams, costFn, gradientFn, callback)

    const molecule = getMoleculeByIdOrName(this.request.molecule.id)
    const exactEnergy = molecule?.exactEnergy ?? this.hamiltonian.constantTerm

    const finalEnergy = optimResult.value
    const errorHartree = Math.abs(finalEnergy - exactEnergy)
    const errorKcalMol = errorHartree * HARTREE_TO_KCAL

    return {
      finalEnergy,
      exactEnergy,
      errorHartree,
      errorKcalMol,
      chemicalAccuracy: errorHartree < CHEMICAL_ACCURACY,
      parameters: optimResult.parameters,
      converged: optimResult.converged,
      iterations: optimResult.iterations,
      history: this.history,
    }
  }

  private evaluateEnergy(params: number[]): number {
    if (!this.circuit || !this.hamiltonian) {
      throw new Error('Engine not initialized')
    }

    const circuitCopy = this.circuit.clone()
    circuitCopy.setParameters(params)

    const state = executeCircuit(circuitCopy)
    let energy = computeHamiltonianExpectation(state, this.hamiltonian)

    if (this.request.mitigation?.zne?.enabled) {
      energy = applyZNE(
        circuitCopy,
        this.hamiltonian,
        params,
        this.request.mitigation.zne
      )
    }

    if (this.request.mitigation?.readout?.enabled) {
      energy = applyReadoutMitigation(
        energy,
        this.request.quantum.numQubits,
        this.request.mitigation.readout
      )
    }

    if (this.request.mitigation?.symmetry?.enabled) {
      const isValid = verifySymmetry(
        state,
        this.request.quantum.numElectrons,
        this.request.mitigation.symmetry
      )
      if (!isValid && this.request.mitigation.symmetry.postSelect) {
        return 1e10
      }
    }

    return energy
  }

  private computeGradient(params: number[]): number[] {
    if (!this.circuit || !this.hamiltonian) {
      throw new Error('Engine not initialized')
    }

    return computeParameterShiftGradient(
      this.circuit,
      this.hamiltonian,
      params
    )
  }

  private needsGradient(): boolean {
    const gradientBased = ['adam', 'sgd', 'lbfgsb', 'slsqp', 'qng']
    return gradientBased.includes(this.request.optimizer.type)
  }

  private getCacheKey(): string {
    return createCacheKeys.vqeResult(
      this.request.molecule.id,
      this.request.ansatz.type,
      this.request.ansatz.layers || 1,
      this.request.optimizer.type,
      this.request.optimizer.maxIterations
    )
  }

  private getMetrics(): VQEMetrics {
    const circuitMetrics = this.circuit?.getMetrics()
    const executionTime = performance.now() - this.startTime

    const memoryUsed = typeof process !== 'undefined' && process.memoryUsage
      ? process.memoryUsage().heapUsed / (1024 * 1024)
      : 0

    return {
      executionTimeMs: executionTime,
      memoryUsedMB: memoryUsed,
      circuitDepth: circuitMetrics?.depth || 0,
      cnotCount: circuitMetrics?.cnotCount || 0,
      parameterCount: circuitMetrics?.parameterCount || 0,
      finalGradientNorm: this.history.length > 0
        ? this.history[this.history.length - 1].gradientNorm
        : undefined,
    }
  }

  private errorResponse(code: string, message: string, details?: unknown): VQEResponse {
    return {
      success: false,
      error: { code, message, details },
    }
  }

  private log(message: string): void {
    if (this.options.enableLogging) {
      console.log(`[VQEEngine] ${message}`)
    }
  }
}

export async function runVQE(request: VQERequest, options?: VQEEngineOptions): Promise<VQEResponse> {
  const engine = new VQEEngine(request, options)
  return engine.run()
}

export function validateVQERequest(request: VQERequest): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!request.molecule?.id) {
    errors.push('molecule.id is required')
  }

  if (!request.quantum?.numQubits || request.quantum.numQubits < 2) {
    errors.push('quantum.numQubits must be at least 2')
  }

  if (!request.quantum?.numElectrons || request.quantum.numElectrons < 1) {
    errors.push('quantum.numElectrons must be at least 1')
  }

  if (!request.ansatz?.type) {
    errors.push('ansatz.type is required')
  }

  if (!request.optimizer?.type) {
    errors.push('optimizer.type is required')
  }

  if (!request.optimizer?.maxIterations || request.optimizer.maxIterations < 1) {
    errors.push('optimizer.maxIterations must be at least 1')
  }

  if (request.quantum?.numQubits > 20) {
    errors.push('numQubits exceeds maximum of 20 for state vector simulation')
  }

  return { valid: errors.length === 0, errors }
}

export function getQubitTier(numQubits: number): 'small' | 'medium' | 'large' {
  if (numQubits <= 8) return 'small'
  if (numQubits <= 14) return 'medium'
  return 'large'
}

export function getRecommendedLambdaMemory(numQubits: number): number {
  const tier = getQubitTier(numQubits)
  switch (tier) {
    case 'small': return 512
    case 'medium': return 2048
    case 'large': return 10240
  }
}

export function getRecommendedTimeout(numQubits: number, ansatzType: string): number {
  const baseTimes: Record<string, number> = {
    hea: 30,
    uccsd: 120,
    k_upccgsd: 180,
    adapt: 300,
    qubit_adapt: 300,
    symmetry_preserved: 120,
  }

  const baseTime = baseTimes[ansatzType] || 60
  const qubitFactor = Math.pow(2, Math.max(0, numQubits - 8) / 4)

  return Math.min(900, Math.ceil(baseTime * qubitFactor))
}
