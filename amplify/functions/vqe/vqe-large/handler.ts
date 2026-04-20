import type { Handler } from 'aws-lambda'
import type { VQERequest, Hamiltonian, AnsatzType, OptimizerType, EntanglementType, BasisSet, QubitMapping } from '../../shared/types'
import { runVQE, validateVQERequest, getQubitTier } from '../../shared/chemistry/vqe-engine'

const MIN_QUBITS = 15
const MAX_QUBITS = 20
const TIER = 'large'

interface GraphQLVQEInput {
  moleculeId: string
  moleculeName?: string
  numQubits: number
  numElectrons: number
  hamiltonian?: string
  basisSet?: string
  qubitMapping?: string
  ansatzType?: string
  ansatzLayers?: number
  entanglement?: string
  optimizerType?: string
  maxIterations?: number
  tolerance?: number
  learningRate?: number
  zneEnabled?: boolean
  zneScaleFactors?: number[]
  readoutMitigationEnabled?: boolean
  symmetryEnabled?: boolean
  shots?: number
  useCache?: boolean
}

function transformBasisSet(input?: string): BasisSet {
  if (!input) return 'sto-3g'
  const mapping: Record<string, BasisSet> = {
    'sto_3g': 'sto-3g',
    'sto-3g': 'sto-3g',
    '6_31g': '6-31g',
    '6-31g': '6-31g',
    'basis_6_31g': '6-31g',
    'cc_pvdz': 'cc-pvdz',
    'cc-pvdz': 'cc-pvdz',
  }
  return mapping[input] || 'sto-3g'
}

function transformGraphQLToVQERequest(input: GraphQLVQEInput): VQERequest {
  let hamiltonian: Hamiltonian | undefined
  if (input.hamiltonian) {
    try {
      hamiltonian = typeof input.hamiltonian === 'string'
        ? JSON.parse(input.hamiltonian)
        : input.hamiltonian
    } catch {
      hamiltonian = undefined
    }
  }

  return {
    molecule: {
      id: input.moleculeId,
      name: input.moleculeName || input.moleculeId,
    },
    quantum: {
      numQubits: input.numQubits,
      numElectrons: input.numElectrons,
      basisSet: transformBasisSet(input.basisSet),
      qubitMapping: (input.qubitMapping || 'jordan_wigner') as QubitMapping,
    },
    hamiltonian,
    ansatz: {
      type: (input.ansatzType || 'hea') as AnsatzType,
      layers: input.ansatzLayers || 2,
      entanglement: (input.entanglement || 'linear') as EntanglementType,
    },
    optimizer: {
      type: (input.optimizerType || 'cobyla') as OptimizerType,
      maxIterations: input.maxIterations || 100,
      tolerance: input.tolerance || 1e-6,
      learningRate: input.learningRate,
    },
    mitigation: {
      zne: input.zneEnabled ? {
        enabled: true,
        scaleFactors: input.zneScaleFactors || [1, 2, 3],
        foldingMethod: 'global',
        extrapolation: 'richardson',
      } : undefined,
      readout: input.readoutMitigationEnabled ? {
        enabled: true,
        method: 'matrix_inversion',
      } : undefined,
      symmetry: input.symmetryEnabled ? {
        enabled: true,
        symmetries: ['particle_number', 'spin_z'],
        postSelect: true,
      } : undefined,
    },
    execution: {
      shots: input.shots,
      useCache: input.useCache !== false,
    },
  }
}

export const handler: Handler = async (event) => {
  console.log(`[VQE-${TIER.toUpperCase()}] Received request`)
  console.log(`[VQE-${TIER.toUpperCase()}] Lambda memory: ${process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE} MB`)
  console.log(`[VQE-${TIER.toUpperCase()}] Initial heap: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`)

  let input: GraphQLVQEInput

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
      error: { code: 'INVALID_INPUT', message: 'Failed to parse input' },
    }
  }

  const request = transformGraphQLToVQERequest(input)

  const validation = validateVQERequest(request)
  if (!validation.valid) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: validation.errors.join('; ') },
    }
  }

  const tier = getQubitTier(request.quantum.numQubits)
  if (tier !== TIER) {
    return {
      success: false,
      error: {
        code: 'WRONG_TIER',
        message: `This Lambda handles ${TIER} molecules (${MIN_QUBITS}-${MAX_QUBITS} qubits). Use vqe-${tier} for ${request.quantum.numQubits} qubits.`,
      },
    }
  }

  if (request.quantum.numQubits < MIN_QUBITS || request.quantum.numQubits > MAX_QUBITS) {
    return {
      success: false,
      error: {
        code: 'QUBITS_OUT_OF_RANGE',
        message: `${TIER} tier handles ${MIN_QUBITS}-${MAX_QUBITS} qubits, got ${request.quantum.numQubits}`,
      },
    }
  }

  const stateVectorDim = Math.pow(2, request.quantum.numQubits)
  const estimatedMemoryMB = (stateVectorDim * 16) / (1024 * 1024)
  console.log(`[VQE-${TIER.toUpperCase()}] State vector dimension: ${stateVectorDim}`)
  console.log(`[VQE-${TIER.toUpperCase()}] Estimated memory for state: ${estimatedMemoryMB.toFixed(0)} MB`)

  console.log(`[VQE-${TIER.toUpperCase()}] Running VQE for ${request.molecule.id} with ${request.quantum.numQubits} qubits`)
  console.log(`[VQE-${TIER.toUpperCase()}] Ansatz: ${request.ansatz.type}, Optimizer: ${request.optimizer.type}`)

  const startTime = Date.now()

  try {
    const response = await runVQE(request, {
      enableLogging: true,
      onProgress: (iteration, energy) => {
        if (iteration % 5 === 0) {
          const elapsed = (Date.now() - startTime) / 1000
          const memUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
          console.log(`[VQE-${TIER.toUpperCase()}] Iteration ${iteration}: E = ${energy.toFixed(8)} Ha (${elapsed.toFixed(1)}s, ${memUsed} MB)`)
        }
      },
    })

    const totalTime = (Date.now() - startTime) / 1000
    const finalMem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024)

    if (response.success) {
      console.log(`[VQE-${TIER.toUpperCase()}] VQE completed in ${totalTime.toFixed(1)}s`)
      console.log(`[VQE-${TIER.toUpperCase()}] Final energy: ${response.result?.finalEnergy.toFixed(8)} Ha`)
      console.log(`[VQE-${TIER.toUpperCase()}] Error: ${response.result?.errorKcalMol?.toFixed(4)} kcal/mol`)
      console.log(`[VQE-${TIER.toUpperCase()}] Chemical accuracy: ${response.result?.chemicalAccuracy}`)
      console.log(`[VQE-${TIER.toUpperCase()}] Final memory: ${finalMem} MB`)
    } else {
      console.error(`[VQE-${TIER.toUpperCase()}] VQE failed:`, response.error)
    }

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[VQE-${TIER.toUpperCase()}] Error:`, message)

    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message },
    }
  }
}
