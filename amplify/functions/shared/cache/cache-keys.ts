import type { AnsatzConfig, OptimizerConfig, Hamiltonian, AnsatzType, OptimizerType } from '../types'

export function generateHamiltonianKey(
  moleculeId: string,
  basisSet: string,
  bondLength?: number
): string {
  const bondLengthStr = bondLength !== undefined ? bondLength.toFixed(4) : 'equilibrium'
  return `ham:${moleculeId}:${basisSet}:${bondLengthStr}`
}

export function generateCircuitKey(
  ansatzConfig: AnsatzConfig,
  numQubits: number,
  numElectrons: number
): string {
  const parts = [
    'circuit',
    ansatzConfig.type,
    numQubits.toString(),
    numElectrons.toString(),
  ]

  if (ansatzConfig.layers !== undefined) {
    parts.push(`l${ansatzConfig.layers}`)
  }
  if (ansatzConfig.entanglement) {
    parts.push(ansatzConfig.entanglement)
  }
  if (ansatzConfig.trotterOrder !== undefined) {
    parts.push(`t${ansatzConfig.trotterOrder}`)
  }
  if (ansatzConfig.kFactor !== undefined) {
    parts.push(`k${ansatzConfig.kFactor}`)
  }

  return parts.join(':')
}

export function generateVQEResultKey(
  moleculeId: string,
  ansatzConfig: AnsatzConfig,
  optimizerConfig: OptimizerConfig,
  bondLength?: number
): string {
  const bondLengthStr = bondLength !== undefined ? bondLength.toFixed(4) : 'equilibrium'
  const ansatzStr = `${ansatzConfig.type}-l${ansatzConfig.layers ?? 1}`
  const optimizerStr = `${optimizerConfig.type}-i${optimizerConfig.maxIterations}`

  return `vqe:${moleculeId}:${bondLengthStr}:${ansatzStr}:${optimizerStr}`
}

export function generateGradientKey(
  operatorIndex: number,
  parametersHash: string
): string {
  return `grad:${operatorIndex}:${parametersHash}`
}

export function hashParameters(params: number[], precision: number = 6): string {
  const rounded = params.map(p => p.toFixed(precision))
  return simpleHash(rounded.join(','))
}

export function hashHamiltonian(hamiltonian: Hamiltonian): string {
  const termStrings = hamiltonian.terms.map(term => {
    const ops = term.operators
      .map(op => `${op.pauli}${op.qubit}`)
      .sort()
      .join('')
    return `${term.coefficient.toFixed(8)}:${ops}`
  })
  return simpleHash(termStrings.sort().join('|'))
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

export function generateSessionKey(): string {
  return `session:${Date.now()}:${Math.random().toString(36).substring(2, 10)}`
}

export const createCacheKeys = {
  hamiltonian: (moleculeId: string, basisSet: string, qubitMapping: string): string => {
    return `ham:${moleculeId}:${basisSet}:${qubitMapping}`
  },

  vqeResult: (
    moleculeId: string,
    ansatzType: AnsatzType,
    layers: number,
    optimizerType: OptimizerType,
    maxIterations: number
  ): string => {
    return `vqe:${moleculeId}:${ansatzType}:l${layers}:${optimizerType}:i${maxIterations}`
  },

  circuit: (
    ansatzType: AnsatzType,
    numQubits: number,
    numElectrons: number,
    layers?: number
  ): string => {
    return `circuit:${ansatzType}:q${numQubits}:e${numElectrons}:l${layers ?? 1}`
  },

  gradient: (circuitKey: string, paramHash: string): string => {
    return `grad:${circuitKey}:${paramHash}`
  },
}
