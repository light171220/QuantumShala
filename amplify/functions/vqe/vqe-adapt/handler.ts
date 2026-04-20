import type { Handler } from 'aws-lambda'
import type { VQERequest, VQEResponse, VQEHistoryEntry, Hamiltonian, AnsatzType, OptimizerType, BasisSet, QubitMapping } from '../../shared/types'
import { validateVQERequest } from '../../shared/chemistry/vqe-engine'
import { Circuit, executeCircuit } from '../../shared/quantum-core/circuit'
import { computeHamiltonianExpectation } from '../../shared/quantum-core/measurement'
import { createOptimizer } from '../../shared/optimizers'
import { getMoleculeByIdOrName, computeHamiltonianForMolecule } from '../../shared/chemistry/molecules'
import { hamiltonianCache, createCacheKeys } from '../../shared/cache'

const MAX_QUBITS = 14
const HARTREE_TO_KCAL = 627.5094740631
const CHEMICAL_ACCURACY = 0.0016

interface GraphQLAdaptInput {
  moleculeId: string
  moleculeName?: string
  numQubits: number
  numElectrons: number
  hamiltonian?: string
  basisSet?: string
  qubitMapping?: string
  ansatzType?: string
  gradientThreshold?: number
  maxOperators?: number
  optimizerType?: string
  maxIterations?: number
  tolerance?: number
  learningRate?: number
  shots?: number
  useCache?: boolean
}

interface OperatorPool {
  pauliStrings: string[]
  qubits: number[][]
  gradients: number[]
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

function transformGraphQLToVQERequest(input: GraphQLAdaptInput): VQERequest {
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
      type: (input.ansatzType || 'adapt') as AnsatzType,
      gradientThreshold: input.gradientThreshold || 1e-4,
      maxOperators: input.maxOperators || 50,
    },
    optimizer: {
      type: (input.optimizerType || 'cobyla') as OptimizerType,
      maxIterations: input.maxIterations || 200,
      tolerance: input.tolerance || 1e-6,
      learningRate: input.learningRate,
    },
    execution: {
      shots: input.shots,
      useCache: input.useCache !== false,
    },
  }
}

function generateFermionicOperatorPool(numQubits: number, numElectrons: number): OperatorPool {
  const pool: OperatorPool = { pauliStrings: [], qubits: [], gradients: [] }
  const numOcc = Math.min(numElectrons, numQubits)

  for (let i = 0; i < numOcc; i++) {
    for (let a = numOcc; a < numQubits; a++) {
      pool.pauliStrings.push('XY')
      pool.qubits.push([i, a])
      pool.gradients.push(0)

      pool.pauliStrings.push('YX')
      pool.qubits.push([i, a])
      pool.gradients.push(0)
    }
  }

  for (let i = 0; i < numOcc; i++) {
    for (let j = i + 1; j < numOcc; j++) {
      for (let a = numOcc; a < numQubits; a++) {
        for (let b = a + 1; b < numQubits; b++) {
          pool.pauliStrings.push('XXYY')
          pool.qubits.push([i, j, a, b])
          pool.gradients.push(0)

          pool.pauliStrings.push('XYXY')
          pool.qubits.push([i, j, a, b])
          pool.gradients.push(0)

          pool.pauliStrings.push('YXXY')
          pool.qubits.push([i, j, a, b])
          pool.gradients.push(0)

          pool.pauliStrings.push('YYXX')
          pool.qubits.push([i, j, a, b])
          pool.gradients.push(0)
        }
      }
    }
  }

  return pool
}

function generateQubitOperatorPool(numQubits: number): OperatorPool {
  const pool: OperatorPool = { pauliStrings: [], qubits: [], gradients: [] }

  for (let i = 0; i < numQubits; i++) {
    pool.pauliStrings.push('Y')
    pool.qubits.push([i])
    pool.gradients.push(0)
  }

  for (let i = 0; i < numQubits; i++) {
    for (let j = i + 1; j < numQubits; j++) {
      for (const paulis of ['XY', 'YX', 'XZ', 'ZX', 'YZ', 'ZY']) {
        pool.pauliStrings.push(paulis)
        pool.qubits.push([i, j])
        pool.gradients.push(0)
      }
    }
  }

  return pool
}

function computeOperatorGradients(
  circuit: Circuit,
  hamiltonian: Hamiltonian,
  params: number[],
  pool: OperatorPool
): number[] {
  const gradients: number[] = []
  const epsilon = 1e-4

  const circuitCopy = circuit.clone()
  circuitCopy.setParameters(params)
  const baseState = executeCircuit(circuitCopy)
  const baseEnergy = computeHamiltonianExpectation(baseState, hamiltonian)

  for (let i = 0; i < pool.pauliStrings.length; i++) {
    const testCircuit = circuitCopy.clone()
    testCircuit.addPauliRotation(pool.pauliStrings[i], pool.qubits[i], epsilon)

    const plusState = executeCircuit(testCircuit)
    const plusEnergy = computeHamiltonianExpectation(plusState, hamiltonian)

    testCircuit.gates.pop()
    testCircuit.addPauliRotation(pool.pauliStrings[i], pool.qubits[i], -epsilon)

    const minusState = executeCircuit(testCircuit)
    const minusEnergy = computeHamiltonianExpectation(minusState, hamiltonian)

    const gradient = (plusEnergy - minusEnergy) / (2 * epsilon)
    gradients.push(Math.abs(gradient))
  }

  return gradients
}

async function runAdaptVQE(request: VQERequest): Promise<VQEResponse> {
  const startTime = performance.now()
  const history: VQEHistoryEntry[] = []

  let hamiltonian: Hamiltonian | null = request.hamiltonian || null

  if (!hamiltonian) {
    const cacheKey = createCacheKeys.hamiltonian(
      request.molecule.id,
      request.quantum.basisSet || 'sto-3g',
      request.quantum.qubitMapping || 'jordan_wigner'
    )

    hamiltonian = hamiltonianCache.get(cacheKey) || null

    if (!hamiltonian) {
      const molecule = getMoleculeByIdOrName(request.molecule.id)
      if (!molecule) {
        return {
          success: false,
          error: { code: 'MOLECULE_NOT_FOUND', message: `Molecule ${request.molecule.id} not found` },
        }
      }

      hamiltonian = computeHamiltonianForMolecule(
        molecule,
        request.quantum.qubitMapping || 'jordan_wigner',
        request.molecule.bondLength
      )

      if (hamiltonian) {
        hamiltonianCache.set(cacheKey, hamiltonian)
      }
    }
  }

  if (!hamiltonian) {
    return {
      success: false,
      error: { code: 'HAMILTONIAN_ERROR', message: 'Failed to compute Hamiltonian' },
    }
  }

  const isQubitAdapt = request.ansatz.type === 'qubit_adapt'
  const pool = isQubitAdapt
    ? generateQubitOperatorPool(request.quantum.numQubits)
    : generateFermionicOperatorPool(request.quantum.numQubits, request.quantum.numElectrons)

  console.log(`[ADAPT-VQE] Operator pool size: ${pool.pauliStrings.length}`)

  const circuit = new Circuit(request.quantum.numQubits)
  circuit.initializeHartreeFock(request.quantum.numElectrons)

  const selectedOperators: { pauliString: string; qubits: number[] }[] = []
  let params: number[] = []

  const gradientThreshold = request.ansatz.gradientThreshold || 1e-4
  const maxOperators = request.ansatz.maxOperators || 50
  const maxIterations = request.optimizer.maxIterations

  let totalIteration = 0
  let operatorsAdded = 0

  const circuitCopy = circuit.clone()
  const initialState = executeCircuit(circuitCopy)
  let currentEnergy = computeHamiltonianExpectation(initialState, hamiltonian)

  console.log(`[ADAPT-VQE] Initial energy: ${currentEnergy.toFixed(8)} Ha`)

  history.push({
    iteration: 0,
    energy: currentEnergy,
    timestamp: performance.now() - startTime,
  })

  while (operatorsAdded < maxOperators) {
    const gradients = computeOperatorGradients(circuit, hamiltonian, params, pool)

    let maxGradient = 0
    let maxIndex = -1
    for (let i = 0; i < gradients.length; i++) {
      if (gradients[i] > maxGradient) {
        maxGradient = gradients[i]
        maxIndex = i
      }
    }

    console.log(`[ADAPT-VQE] Max gradient: ${maxGradient.toFixed(8)} (operator ${maxIndex})`)

    if (maxGradient < gradientThreshold) {
      console.log(`[ADAPT-VQE] Converged: gradient below threshold`)
      break
    }

    selectedOperators.push({
      pauliString: pool.pauliStrings[maxIndex],
      qubits: pool.qubits[maxIndex],
    })
    operatorsAdded++

    circuit.addPauliRotation(
      pool.pauliStrings[maxIndex],
      pool.qubits[maxIndex],
      0
    )

    params.push(0)

    const optimizer = createOptimizer({
      ...request.optimizer,
      maxIterations: Math.min(50, maxIterations - totalIteration),
    })

    const costFn = (p: number[]) => {
      const evalCircuit = new Circuit(request.quantum.numQubits)
      evalCircuit.initializeHartreeFock(request.quantum.numElectrons)

      for (let i = 0; i < selectedOperators.length; i++) {
        evalCircuit.addPauliRotation(
          selectedOperators[i].pauliString,
          selectedOperators[i].qubits,
          p[i]
        )
      }

      const state = executeCircuit(evalCircuit)
      return computeHamiltonianExpectation(state, hamiltonian!)
    }

    const result = optimizer.optimize(params, costFn, undefined, (iter, value) => {
      totalIteration++
      if (iter % 10 === 0) {
        console.log(`[ADAPT-VQE] Op ${operatorsAdded}, Iter ${iter}: E = ${value.toFixed(8)} Ha`)
      }
      history.push({
        iteration: totalIteration,
        energy: value,
        gradientNorm: maxGradient,
        timestamp: performance.now() - startTime,
      })
    })

    params = result.parameters
    currentEnergy = result.value

    console.log(`[ADAPT-VQE] Added operator ${operatorsAdded}: E = ${currentEnergy.toFixed(8)} Ha`)

    if (totalIteration >= maxIterations) {
      console.log(`[ADAPT-VQE] Max iterations reached`)
      break
    }
  }

  const molecule = getMoleculeByIdOrName(request.molecule.id)
  const exactEnergy = molecule?.exactEnergy ?? hamiltonian.constantTerm

  const errorHartree = Math.abs(currentEnergy - exactEnergy)
  const errorKcalMol = errorHartree * HARTREE_TO_KCAL

  const executionTime = performance.now() - startTime
  const memoryUsed = process.memoryUsage().heapUsed / (1024 * 1024)

  return {
    success: true,
    result: {
      finalEnergy: currentEnergy,
      exactEnergy,
      errorHartree,
      errorKcalMol,
      chemicalAccuracy: errorHartree < CHEMICAL_ACCURACY,
      parameters: params,
      converged: errorHartree < CHEMICAL_ACCURACY,
      iterations: totalIteration,
      history,
    },
    metrics: {
      executionTimeMs: executionTime,
      memoryUsedMB: memoryUsed,
      circuitDepth: selectedOperators.length * 4,
      cnotCount: selectedOperators.reduce((sum, op) => sum + (op.qubits.length - 1) * 2, 0),
      parameterCount: params.length,
      operatorsAdded,
    },
  }
}

export const handler: Handler = async (event) => {
  console.log(`[VQE-ADAPT] Received request`)

  let input: GraphQLAdaptInput

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

  if (!['adapt', 'qubit_adapt'].includes(request.ansatz.type)) {
    return {
      success: false,
      error: {
        code: 'WRONG_ANSATZ',
        message: `This Lambda handles ADAPT-VQE (adapt, qubit_adapt). Got: ${request.ansatz.type}`,
      },
    }
  }

  if (request.quantum.numQubits > MAX_QUBITS) {
    return {
      success: false,
      error: {
        code: 'QUBITS_EXCEEDED',
        message: `Maximum qubits for ADAPT-VQE is ${MAX_QUBITS}, got ${request.quantum.numQubits}`,
      },
    }
  }

  console.log(`[VQE-ADAPT] Running ${request.ansatz.type} for ${request.molecule.id}`)
  console.log(`[VQE-ADAPT] Qubits: ${request.quantum.numQubits}, Electrons: ${request.quantum.numElectrons}`)

  try {
    const response = await runAdaptVQE(request)

    if (response.success) {
      console.log(`[VQE-ADAPT] Completed successfully`)
      console.log(`[VQE-ADAPT] Final energy: ${response.result?.finalEnergy.toFixed(8)} Ha`)
      console.log(`[VQE-ADAPT] Operators added: ${response.metrics?.operatorsAdded}`)
      console.log(`[VQE-ADAPT] Chemical accuracy: ${response.result?.chemicalAccuracy}`)
    } else {
      console.error(`[VQE-ADAPT] Failed:`, response.error)
    }

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[VQE-ADAPT] Error:`, message)

    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message },
    }
  }
}
