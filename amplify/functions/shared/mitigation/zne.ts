import type { ZNEConfig, Hamiltonian } from '../types'
import { Circuit, executeCircuit } from '../quantum-core/circuit'
import { computeHamiltonianExpectation } from '../quantum-core/measurement'

export function applyZNE(
  circuit: Circuit,
  hamiltonian: Hamiltonian,
  params: number[],
  config: ZNEConfig
): number {
  const scaleFactors = config.scaleFactors || [1, 2, 3]
  const energies: number[] = []

  for (const scaleFactor of scaleFactors) {
    const scaledCircuit = foldCircuit(circuit, scaleFactor, config.foldingMethod)
    scaledCircuit.setParameters(params)
    const state = executeCircuit(scaledCircuit)
    const energy = computeHamiltonianExpectation(state, hamiltonian)
    energies.push(energy)
  }

  return extrapolateToZeroNoise(scaleFactors, energies, config.extrapolation)
}

function foldCircuit(
  circuit: Circuit,
  scaleFactor: number,
  method: 'global' | 'local' | 'random'
): Circuit {
  if (scaleFactor === 1) {
    return circuit.clone()
  }

  const folded = new Circuit(circuit.numQubits)
  const numFolds = Math.floor((scaleFactor - 1) / 2)

  switch (method) {
    case 'global':
      return foldGlobal(circuit, numFolds)
    case 'local':
      return foldLocal(circuit, scaleFactor)
    case 'random':
      return foldRandom(circuit, scaleFactor)
    default:
      return foldGlobal(circuit, numFolds)
  }
}

function foldGlobal(circuit: Circuit, numFolds: number): Circuit {
  const folded = circuit.clone()

  for (let fold = 0; fold < numFolds; fold++) {
    const inverseGates = [...circuit.gates].reverse()
    for (const gate of inverseGates) {
      addInverseGate(folded, gate)
    }

    for (const gate of circuit.gates) {
      const gateClone = {
        name: gate.name,
        qubits: [...gate.qubits],
        params: gate.params ? [...gate.params] : undefined,
      }
      folded.gates.push(gateClone)
    }
  }

  return folded
}

function foldLocal(circuit: Circuit, scaleFactor: number): Circuit {
  const folded = new Circuit(circuit.numQubits)
  const foldFraction = (scaleFactor - 1) / 2

  for (let i = 0; i < circuit.gates.length; i++) {
    const gate = circuit.gates[i]
    const gateClone = {
      name: gate.name,
      qubits: [...gate.qubits],
      params: gate.params ? [...gate.params] : undefined,
    }
    folded.gates.push(gateClone)

    const shouldFold = (i / circuit.gates.length) < foldFraction
    if (shouldFold) {
      addInverseGate(folded, gate)
      folded.gates.push({ ...gateClone })
    }
  }

  return folded
}

function foldRandom(circuit: Circuit, scaleFactor: number): Circuit {
  const folded = new Circuit(circuit.numQubits)
  const foldProbability = (scaleFactor - 1) / (2 * circuit.gates.length)

  for (const gate of circuit.gates) {
    const gateClone = {
      name: gate.name,
      qubits: [...gate.qubits],
      params: gate.params ? [...gate.params] : undefined,
    }
    folded.gates.push(gateClone)

    if (Math.random() < foldProbability) {
      addInverseGate(folded, gate)
      folded.gates.push({ ...gateClone })
    }
  }

  return folded
}

function addInverseGate(circuit: Circuit, gate: { name: string; qubits: number[]; params?: number[] }): void {
  const name = gate.name.toLowerCase()

  switch (name) {
    case 'x':
    case 'y':
    case 'z':
    case 'h':
    case 'cnot':
    case 'cx':
    case 'cz':
    case 'swap':
      circuit.gates.push({
        name: gate.name,
        qubits: [...gate.qubits],
      })
      break

    case 's':
      circuit.gates.push({
        name: 'sdg',
        qubits: [...gate.qubits],
      })
      break

    case 'sdg':
      circuit.gates.push({
        name: 's',
        qubits: [...gate.qubits],
      })
      break

    case 't':
      circuit.gates.push({
        name: 'tdg',
        qubits: [...gate.qubits],
      })
      break

    case 'tdg':
      circuit.gates.push({
        name: 't',
        qubits: [...gate.qubits],
      })
      break

    case 'rx':
    case 'ry':
    case 'rz':
    case 'p':
    case 'u1':
      circuit.gates.push({
        name: gate.name,
        qubits: [...gate.qubits],
        params: gate.params ? [-gate.params[0]] : [0],
      })
      break

    case 'crx':
    case 'cry':
    case 'crz':
    case 'cp':
      circuit.gates.push({
        name: gate.name,
        qubits: [...gate.qubits],
        params: gate.params ? [-gate.params[0]] : [0],
      })
      break

    case 'u2':
      circuit.gates.push({
        name: 'u2',
        qubits: [...gate.qubits],
        params: gate.params ? [
          -gate.params[1] - Math.PI,
          -gate.params[0] + Math.PI
        ] : [0, 0],
      })
      break

    case 'u3':
      circuit.gates.push({
        name: 'u3',
        qubits: [...gate.qubits],
        params: gate.params ? [
          -gate.params[0],
          -gate.params[2],
          -gate.params[1]
        ] : [0, 0, 0],
      })
      break

    default:
      circuit.gates.push({
        name: gate.name,
        qubits: [...gate.qubits],
        params: gate.params ? [...gate.params] : undefined,
      })
  }
}

function extrapolateToZeroNoise(
  scaleFactors: number[],
  energies: number[],
  method: 'linear' | 'polynomial' | 'exponential' | 'richardson'
): number {
  switch (method) {
    case 'linear':
      return linearExtrapolation(scaleFactors, energies)
    case 'polynomial':
      return polynomialExtrapolation(scaleFactors, energies)
    case 'exponential':
      return exponentialExtrapolation(scaleFactors, energies)
    case 'richardson':
      return richardsonExtrapolation(scaleFactors, energies)
    default:
      return linearExtrapolation(scaleFactors, energies)
  }
}

function linearExtrapolation(x: number[], y: number[]): number {
  const n = x.length
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0

  for (let i = 0; i < n; i++) {
    sumX += x[i]
    sumY += y[i]
    sumXY += x[i] * y[i]
    sumX2 += x[i] * x[i]
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  return intercept
}

function polynomialExtrapolation(x: number[], y: number[]): number {
  const n = Math.min(x.length, 3)

  if (n <= 2) {
    return linearExtrapolation(x, y)
  }

  const A: number[][] = []
  const b: number[] = []

  for (let i = 0; i < n; i++) {
    A.push([1, x[i], x[i] * x[i]])
    b.push(y[i])
  }

  const coeffs = solveLinearSystem(A, b)
  return coeffs[0]
}

function exponentialExtrapolation(x: number[], y: number[]): number {
  const logY = y.map(val => Math.log(Math.abs(val) + 1e-10))
  const n = x.length
  let sumX = 0, sumLogY = 0, sumXLogY = 0, sumX2 = 0

  for (let i = 0; i < n; i++) {
    sumX += x[i]
    sumLogY += logY[i]
    sumXLogY += x[i] * logY[i]
    sumX2 += x[i] * x[i]
  }

  const slope = (n * sumXLogY - sumX * sumLogY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumLogY - slope * sumX) / n

  return Math.exp(intercept)
}

function richardsonExtrapolation(scaleFactors: number[], energies: number[]): number {
  if (scaleFactors.length < 2) {
    return energies[0]
  }

  let result = 0
  const n = scaleFactors.length

  for (let i = 0; i < n; i++) {
    let term = energies[i]
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        term *= scaleFactors[j] / (scaleFactors[j] - scaleFactors[i])
      }
    }
    result += term
  }

  return result
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length
  const augmented = A.map((row, i) => [...row, b[i]])

  for (let i = 0; i < n; i++) {
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]]

    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i]
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j]
      }
    }
  }

  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n]
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j]
    }
    x[i] /= augmented[i][i]
  }

  return x
}

export interface ZNEResult {
  extrapolatedEnergy: number
  scaledEnergies: { scaleFactor: number; energy: number }[]
  method: string
}

export function runZNEAnalysis(
  circuit: Circuit,
  hamiltonian: Hamiltonian,
  params: number[],
  config: ZNEConfig
): ZNEResult {
  const scaleFactors = config.scaleFactors || [1, 2, 3]
  const scaledEnergies: { scaleFactor: number; energy: number }[] = []

  for (const scaleFactor of scaleFactors) {
    const scaledCircuit = foldCircuit(circuit, scaleFactor, config.foldingMethod)
    scaledCircuit.setParameters(params)
    const state = executeCircuit(scaledCircuit)
    const energy = computeHamiltonianExpectation(state, hamiltonian)
    scaledEnergies.push({ scaleFactor, energy })
  }

  const energies = scaledEnergies.map(e => e.energy)
  const extrapolatedEnergy = extrapolateToZeroNoise(scaleFactors, energies, config.extrapolation)

  return {
    extrapolatedEnergy,
    scaledEnergies,
    method: config.extrapolation,
  }
}
