import { generateClient } from 'aws-amplify/data'
import type { VQEResult as FrontendVQEResult } from '@/lib/chemistry/molecules/types'

let _client: ReturnType<typeof generateClient<any>> | null = null

function getClient() {
  if (!_client) {
    _client = generateClient<any>()
  }
  return _client
}

export type VQEBackend = 'browser' | 'lambda_small' | 'lambda_medium' | 'lambda_large'

export interface PauliTermInput {
  paulis: string
  coefficient: number
}

export interface HamiltonianInput {
  numQubits: number
  terms: PauliTermInput[]
  exactEnergy: number
  hartreeFockEnergy: number
}

export interface VQEJobConfig {
  moleculeId: string
  moleculeName?: string
  numQubits: number
  numElectrons: number
  hamiltonian: HamiltonianInput
  ansatzType: 'hea' | 'uccsd' | 'k_upccgsd' | 'adapt' | 'qubit_adapt' | 'symmetry_preserved'
  numLayers: number
  entanglement?: 'linear' | 'circular' | 'full' | 'pairwise' | 'sca'
  optimizerType: 'cobyla' | 'nelder_mead' | 'powell' | 'adam' | 'sgd' | 'lbfgsb' | 'slsqp' | 'spsa' | 'qn_spsa' | 'qng' | 'rotosolve'
  maxIterations: number
  tolerance: number
  learningRate?: number
  shots?: number
  basisSet?: 'sto-3g' | '6-31g' | 'cc-pvdz'
  qubitMapping?: 'jordan_wigner' | 'bravyi_kitaev' | 'parity'
  zneEnabled?: boolean
  zneScaleFactors?: number[]
  readoutMitigationEnabled?: boolean
  symmetryEnabled?: boolean
  useCache?: boolean
}

export interface VQEJobResult {
  success: boolean
  energy?: number
  exactEnergy?: number
  parameters?: number[]
  iterations?: number
  converged?: boolean
  chemicalAccuracy?: boolean
  errorFromExact?: number
  errorInKcalMol?: number
  history?: { iteration: number; energy: number; gradientNorm?: number }[]
  executionTimeMs?: number
  memoryUsedMB?: number
  circuitDepth?: number
  cnotCount?: number
  parameterCount?: number
  error?: string
}

export function selectVQEBackend(numQubits: number): VQEBackend {
  if (numQubits <= 10) {
    return 'browser'
  } else if (numQubits <= 8) {
    return 'lambda_small'
  } else if (numQubits <= 14) {
    return 'lambda_medium'
  } else {
    return 'lambda_large'
  }
}

export function selectVQETier(numQubits: number): 'small' | 'medium' | 'large' {
  if (numQubits <= 8) {
    return 'small'
  } else if (numQubits <= 14) {
    return 'medium'
  } else {
    return 'large'
  }
}

export function getBackendDescription(backend: VQEBackend): {
  name: string
  description: string
  maxQubits: number
  memory: string
  timeout: string
} {
  switch (backend) {
    case 'browser':
      return {
        name: 'Browser',
        description: 'Local simulation in your browser',
        maxQubits: 10,
        memory: 'Limited by browser',
        timeout: 'None'
      }
    case 'lambda_small':
      return {
        name: 'Lambda Small',
        description: 'AWS Lambda with 512MB memory',
        maxQubits: 8,
        memory: '512 MB',
        timeout: '1 minute'
      }
    case 'lambda_medium':
      return {
        name: 'Lambda Medium',
        description: 'AWS Lambda with 2GB memory',
        maxQubits: 14,
        memory: '2 GB',
        timeout: '5 minutes'
      }
    case 'lambda_large':
      return {
        name: 'Lambda Large',
        description: 'AWS Lambda with 10GB memory for large molecules',
        maxQubits: 20,
        memory: '10 GB',
        timeout: '15 minutes'
      }
  }
}

function convertPauliStringToOperators(pauliString: string, numQubits: number): { qubit: number; pauli: 'I' | 'X' | 'Y' | 'Z' }[] {
  const operators: { qubit: number; pauli: 'I' | 'X' | 'Y' | 'Z' }[] = []
  const paddedString = pauliString.padEnd(numQubits, 'I')

  for (let i = 0; i < paddedString.length; i++) {
    const p = paddedString[i] as 'I' | 'X' | 'Y' | 'Z'
    if (p !== 'I') {
      operators.push({ qubit: i, pauli: p })
    }
  }

  return operators
}

function buildVQERequest(config: VQEJobConfig): Record<string, unknown> {
  const hamiltonianTerms = config.hamiltonian.terms.map(term => ({
    coefficient: term.coefficient,
    operators: convertPauliStringToOperators(term.paulis, config.hamiltonian.numQubits)
  }))

  const hamiltonian = {
    numQubits: config.hamiltonian.numQubits,
    terms: hamiltonianTerms,
    constantTerm: 0
  }

  return {
    molecule: {
      id: config.moleculeId,
      name: config.moleculeName || config.moleculeId
    },
    quantum: {
      numQubits: config.numQubits,
      numElectrons: config.numElectrons,
      basisSet: config.basisSet || 'sto-3g',
      qubitMapping: config.qubitMapping || 'jordan_wigner'
    },
    hamiltonian,
    ansatz: {
      type: config.ansatzType,
      layers: config.numLayers,
      entanglement: config.entanglement || 'linear'
    },
    optimizer: {
      type: config.optimizerType,
      maxIterations: config.maxIterations,
      tolerance: config.tolerance,
      learningRate: config.learningRate
    },
    mitigation: {
      zne: config.zneEnabled ? {
        enabled: true,
        scaleFactors: config.zneScaleFactors || [1, 2, 3],
        foldingMethod: 'global',
        extrapolation: 'richardson'
      } : undefined,
      readout: config.readoutMitigationEnabled ? {
        enabled: true,
        method: 'matrix_inversion'
      } : undefined,
      symmetry: config.symmetryEnabled ? {
        enabled: true,
        symmetries: ['particle_number', 'spin_z'],
        postSelect: true
      } : undefined
    },
    execution: {
      shots: config.shots,
      useCache: config.useCache !== false
    }
  }
}

function parseVQEResponse(response: unknown): VQEJobResult {
  if (!response || typeof response !== 'object') {
    return { success: false, error: 'Invalid response' }
  }

  const data = response as Record<string, unknown>

  if (data.errors) {
    const errors = data.errors as Array<{ message: string }>
    return { success: false, error: errors.map(e => e.message).join(', ') }
  }

  let result = data
  if ('data' in data && data.data) {
    result = data.data as Record<string, unknown>
  }

  if (!(result as Record<string, unknown>).success) {
    const error = (result as Record<string, unknown>).error as Record<string, unknown> | string
    const errorMessage = typeof error === 'string'
      ? error
      : (error?.message as string) || 'VQE execution failed'
    return { success: false, error: errorMessage }
  }

  const vqeResult = (result as Record<string, unknown>).result as Record<string, unknown> | undefined
  const metrics = (result as Record<string, unknown>).metrics as Record<string, unknown> | undefined

  if (!vqeResult) {
    return { success: false, error: 'No result returned' }
  }

  return {
    success: true,
    energy: vqeResult.finalEnergy as number,
    exactEnergy: vqeResult.exactEnergy as number,
    parameters: vqeResult.parameters as number[],
    iterations: vqeResult.iterations as number,
    converged: vqeResult.converged as boolean,
    chemicalAccuracy: vqeResult.chemicalAccuracy as boolean,
    errorFromExact: vqeResult.errorHartree as number,
    errorInKcalMol: vqeResult.errorKcalMol as number,
    history: (vqeResult.history as Array<{ iteration: number; energy: number; gradientNorm?: number }>) || [],
    executionTimeMs: metrics?.executionTimeMs as number,
    memoryUsedMB: metrics?.memoryUsedMB as number,
    circuitDepth: metrics?.circuitDepth as number,
    cnotCount: metrics?.cnotCount as number,
    parameterCount: metrics?.parameterCount as number
  }
}

export async function runVQEOnLambda(config: VQEJobConfig): Promise<VQEJobResult> {
  const backend = selectVQEBackend(config.numQubits)

  if (backend === 'browser') {
    return { success: false, error: 'Use browser-based VQE for molecules with 10 or fewer qubits' }
  }

  const tier = selectVQETier(config.numQubits)
  const isAdaptVQE = config.ansatzType === 'adapt' || config.ansatzType === 'qubit_adapt'

  const requestBody = buildVQERequest(config)

  try {
    const client = getClient()
    let response: unknown

    const basisSetMap: Record<string, string> = {
      'sto-3g': 'sto_3g',
      '6-31g': 'basis_6_31g',
      'cc-pvdz': 'cc_pvdz'
    }

    if (isAdaptVQE) {
      response = await client.mutations.runVqeAdapt({
        moleculeId: config.moleculeId,
        moleculeName: config.moleculeName,
        numQubits: config.numQubits,
        numElectrons: config.numElectrons,
        hamiltonian: JSON.stringify(requestBody.hamiltonian),
        basisSet: basisSetMap[config.basisSet || 'sto-3g'] || 'sto_3g',
        qubitMapping: config.qubitMapping || 'jordan_wigner',
        ansatzType: config.ansatzType,
        gradientThreshold: 0.001,
        maxOperators: 50,
        optimizerType: config.optimizerType,
        maxIterations: config.maxIterations,
        tolerance: config.tolerance,
        learningRate: config.learningRate,
        shots: config.shots,
        useCache: config.useCache
      })
    } else {
      const mutationArgs = {
        moleculeId: config.moleculeId,
        moleculeName: config.moleculeName,
        numQubits: config.numQubits,
        numElectrons: config.numElectrons,
        hamiltonian: JSON.stringify(requestBody.hamiltonian),
        basisSet: basisSetMap[config.basisSet || 'sto-3g'] || 'sto_3g',
        qubitMapping: config.qubitMapping || 'jordan_wigner',
        ansatzType: config.ansatzType,
        ansatzLayers: config.numLayers,
        entanglement: config.entanglement || 'linear',
        optimizerType: config.optimizerType,
        maxIterations: config.maxIterations,
        tolerance: config.tolerance,
        learningRate: config.learningRate,
        zneEnabled: config.zneEnabled,
        zneScaleFactors: config.zneScaleFactors,
        readoutMitigationEnabled: config.readoutMitigationEnabled,
        symmetryEnabled: config.symmetryEnabled,
        shots: config.shots,
        useCache: config.useCache
      }

      switch (tier) {
        case 'small':
          response = await client.mutations.runVqeSmall(mutationArgs)
          break
        case 'medium':
          response = await client.mutations.runVqeMedium(mutationArgs)
          break
        case 'large':
          response = await client.mutations.runVqeLarge(mutationArgs)
          break
      }
    }

    return parseVQEResponse(response)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function runVQEAdaptOnLambda(config: VQEJobConfig): Promise<VQEJobResult> {
  const ansatzType: 'adapt' | 'qubit_adapt' = config.ansatzType === 'qubit_adapt' ? 'qubit_adapt' : 'adapt'
  const modifiedConfig: VQEJobConfig = {
    ...config,
    ansatzType
  }
  return runVQEOnLambda(modifiedConfig)
}

export async function submitVQEJob(config: VQEJobConfig): Promise<{
  jobId: string
  backend: VQEBackend
}> {
  const backend = selectVQEBackend(config.numQubits)

  const job = await getClient().models.VQEJob.create({
    moleculeId: config.moleculeId,
    moleculeName: config.moleculeName,
    config: JSON.stringify({
      numQubits: config.numQubits,
      numElectrons: config.numElectrons,
      ansatzType: config.ansatzType,
      numLayers: config.numLayers,
      optimizerType: config.optimizerType,
      maxIterations: config.maxIterations,
      tolerance: config.tolerance
    }),
    status: 'pending',
    progress: 0,
    createdAt: new Date().toISOString()
  })

  if (job.errors || !job.data) {
    throw new Error('Failed to create VQE job')
  }

  const jobData = job.data as unknown as { id: string }

  return {
    jobId: jobData.id,
    backend
  }
}

export async function getVQEJobStatus(jobId: string): Promise<{
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  currentEnergy?: number
  result?: VQEJobResult
  error?: string
}> {
  const job = await getClient().models.VQEJob.get({ id: jobId })

  if (job.errors || !job.data) {
    throw new Error('Job not found')
  }

  const jobData = job.data as {
    status?: string
    progress?: number
    currentEnergy?: number
    result?: unknown
    errorMessage?: string
  }

  return {
    status: (jobData.status || 'pending') as 'pending' | 'running' | 'completed' | 'failed',
    progress: jobData.progress || 0,
    currentEnergy: jobData.currentEnergy || undefined,
    result: jobData.result ? JSON.parse(JSON.stringify(jobData.result)) : undefined,
    error: jobData.errorMessage || undefined
  }
}

export async function cancelVQEJob(jobId: string): Promise<boolean> {
  try {
    await getClient().models.VQEJob.update({
      id: jobId,
      status: 'failed',
      errorMessage: 'Cancelled by user'
    })
    return true
  } catch {
    return false
  }
}

export async function getVQEJobHistory(
  limit: number = 10
): Promise<Array<{
  id: string
  moleculeId: string
  moleculeName?: string
  status: string
  energy?: number
  createdAt: string
  completedAt?: string
}>> {
  const jobs = await getClient().models.VQEJob.list({
    limit
  })

  if (jobs.errors || !jobs.data) {
    return []
  }

  return jobs.data.map(job => ({
    id: job.id,
    moleculeId: job.moleculeId,
    moleculeName: job.moleculeName || undefined,
    status: job.status || 'unknown',
    energy: job.currentEnergy || undefined,
    createdAt: job.createdAt,
    completedAt: job.completedAt || undefined
  }))
}

export function estimateVQETime(
  numQubits: number,
  numParams: number,
  maxIterations: number
): {
  estimatedSeconds: number
  description: string
} {
  const backend = selectVQEBackend(numQubits)
  const stateVectorSize = Math.pow(2, numQubits)

  let baseTimePerIter: number
  if (backend === 'browser') {
    baseTimePerIter = stateVectorSize * numParams * 0.0001
  } else if (backend === 'lambda_small' || backend === 'lambda_medium') {
    baseTimePerIter = stateVectorSize * numParams * 0.00005
  } else {
    baseTimePerIter = stateVectorSize * numParams * 0.0001
  }

  const totalTime = baseTimePerIter * maxIterations

  let description: string
  if (totalTime < 60) {
    description = `~${Math.ceil(totalTime)} seconds`
  } else if (totalTime < 3600) {
    description = `~${Math.ceil(totalTime / 60)} minutes`
  } else {
    description = `~${(totalTime / 3600).toFixed(1)} hours`
  }

  return {
    estimatedSeconds: totalTime,
    description
  }
}

export function convertLambdaResultToVQEResult(
  lambdaResult: VQEJobResult,
  hamiltonian: HamiltonianInput
): FrontendVQEResult {
  return {
    energy: lambdaResult.energy || 0,
    parameters: lambdaResult.parameters || [],
    iterations: lambdaResult.iterations || 0,
    converged: lambdaResult.converged || false,
    errorFromExact: lambdaResult.errorFromExact || 0,
    errorInKcalMol: lambdaResult.errorInKcalMol || 0,
    history: (lambdaResult.history || []).map((h, i) => ({
      iteration: h.iteration,
      energy: h.energy,
      parameters: [],
      gradientNorm: h.gradientNorm
    }))
  }
}
