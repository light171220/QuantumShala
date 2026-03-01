import { generateClient } from 'aws-amplify/data'
import type { MolecularHamiltonian, VQEResult } from '@/lib/chemistry/molecules/types'

let _client: ReturnType<typeof generateClient<any>> | null = null

function getClient() {
  if (!_client) {
    _client = generateClient<any>()
  }
  return _client
}

export type VQEBackend = 'browser' | 'lambda' | 'lambda_large'

export interface VQEJobConfig {
  moleculeId: string
  moleculeName?: string
  numQubits: number
  numElectrons: number
  hamiltonian: MolecularHamiltonian
  ansatzType: 'hea' | 'uccsd' | 'adapt' | 'qubit_adapt'
  numLayers: number
  optimizerType: 'cobyla' | 'spsa' | 'adam' | 'slsqp'
  maxIterations: number
  tolerance: number
  shots?: number
}

export interface VQEJobResult {
  success: boolean
  energy?: number
  parameters?: number[]
  iterations?: number
  converged?: boolean
  errorFromExact?: number
  errorInKcalMol?: number
  history?: { iteration: number; energy: number }[]
  executionTimeMs?: number
  memoryUsedMB?: number
  error?: string
}

export function selectVQEBackend(numQubits: number): VQEBackend {
  if (numQubits <= 10) {
    return 'browser'
  } else if (numQubits <= 20) {
    return 'lambda'
  } else {
    return 'lambda_large'
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
    case 'lambda':
      return {
        name: 'Lambda Standard',
        description: 'AWS Lambda with 2GB memory',
        maxQubits: 20,
        memory: '2 GB',
        timeout: '5 minutes'
      }
    case 'lambda_large':
      return {
        name: 'Lambda Large',
        description: 'AWS Lambda with 10GB memory for large molecules',
        maxQubits: 28,
        memory: '10 GB',
        timeout: '15 minutes'
      }
  }
}

export async function runVQEOnLambda(config: VQEJobConfig): Promise<VQEJobResult> {
  const backend = selectVQEBackend(config.numQubits)

  if (backend === 'browser') {
    throw new Error('Use browser-based VQE for molecules with 10 or fewer qubits')
  }

  const hamiltonianTerms = config.hamiltonian.terms.map(term => ({
    paulis: term.paulis,
    coefficient: term.coefficient
  }))

  const input = {
    moleculeId: config.moleculeId,
    moleculeName: config.moleculeName,
    numQubits: config.numQubits,
    numElectrons: config.numElectrons,
    hamiltonianTerms: JSON.stringify(hamiltonianTerms),
    exactEnergy: config.hamiltonian.exactEnergy,
    hartreeFockEnergy: config.hamiltonian.hartreeFockEnergy,
    ansatzType: config.ansatzType,
    numLayers: config.numLayers,
    optimizerType: config.optimizerType,
    maxIterations: config.maxIterations,
    tolerance: config.tolerance,
    shots: config.shots
  }

  try {
    let response: any

    if (backend === 'lambda_large') {
      response = await getClient().mutations.runVqeLarge(input)
    } else {
      response = await getClient().mutations.runVqe(input)
    }

    if (response.errors) {
      return {
        success: false,
        error: response.errors.map((e: any) => e.message).join(', ')
      }
    }

    const result = response.data as VQEJobResult
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
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
  } else if (backend === 'lambda') {
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
  hamiltonian: MolecularHamiltonian
): VQEResult {
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
      parameters: []
    }))
  }
}
