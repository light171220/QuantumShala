import { QTensor } from '../../core/tensor'
import { QuantumTape } from '../../autodiff/tape'
import { rx, ry, rz, H, cnot, cz } from '../../circuit/operations/gates'

export interface TrainableEncodingConfig {
  wires?: number[]
  numLayers?: number
  entanglement?: 'linear' | 'circular' | 'full' | 'none'
  rotationGates?: ('X' | 'Y' | 'Z')[]
  inputScaling?: 'trainable' | 'fixed' | number
}

export function trainableEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  inputWeights: number[] | QTensor,
  variationalWeights: number[] | QTensor,
  config: TrainableEncodingConfig = {}
): void {
  const numLayers = config.numLayers ?? 1
  const entanglement = config.entanglement ?? 'linear'
  const rotationGates = config.rotationGates ?? ['Y', 'Z']

  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const inputW = inputWeights instanceof QTensor
    ? Array.from(inputWeights.data)
    : inputWeights

  const varW = variationalWeights instanceof QTensor
    ? Array.from(variationalWeights.data)
    : variationalWeights

  const numFeatures = features.length
  const wires = config.wires ?? Array.from({ length: numFeatures }, (_, i) => i)
  const numWires = wires.length

  let inputIdx = 0
  let varIdx = 0

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numWires; i++) {
      const wire = wires[i]
      const featureIdx = i % numFeatures

      for (const rot of rotationGates) {
        const inputWeight = inputW[inputIdx % inputW.length] ?? 1.0
        const varWeight = varW[varIdx % varW.length] ?? 0
        inputIdx++
        varIdx++

        const angle = inputWeight * features[featureIdx] + varWeight

        switch (rot) {
          case 'X':
            rx(tape, wire, angle)
            break
          case 'Y':
            ry(tape, wire, angle)
            break
          case 'Z':
            rz(tape, wire, angle)
            break
        }
      }
    }

    if (entanglement !== 'none') {
      applyEntanglement(tape, wires, entanglement)
    }
  }
}

function applyEntanglement(
  tape: QuantumTape,
  wires: number[],
  pattern: 'linear' | 'circular' | 'full'
): void {
  const numWires = wires.length

  switch (pattern) {
    case 'linear':
      for (let i = 0; i < numWires - 1; i++) {
        cnot(tape, wires[i], wires[i + 1])
      }
      break

    case 'circular':
      for (let i = 0; i < numWires - 1; i++) {
        cnot(tape, wires[i], wires[i + 1])
      }
      if (numWires > 2) {
        cnot(tape, wires[numWires - 1], wires[0])
      }
      break

    case 'full':
      for (let i = 0; i < numWires; i++) {
        for (let j = i + 1; j < numWires; j++) {
          cz(tape, wires[i], wires[j])
        }
      }
      break
  }
}

export function trainableAmplitudeEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  weights: number[] | QTensor,
  numLayers: number = 1,
  wires?: number[]
): void {
  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const w = weights instanceof QTensor
    ? Array.from(weights.data)
    : weights

  const numFeatures = features.length
  const numQubits = Math.ceil(Math.log2(numFeatures))
  const effectiveWires = wires ?? Array.from({ length: numQubits }, (_, i) => i)

  let weightIdx = 0

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numQubits; i++) {
      H(tape, effectiveWires[i])
    }

    for (let i = 0; i < numFeatures && i < Math.pow(2, numQubits); i++) {
      const amplitude = features[i] * (w[weightIdx % w.length] ?? 1)
      weightIdx++

      const binaryRep = i.toString(2).padStart(numQubits, '0')

      for (let q = 0; q < numQubits; q++) {
        if (binaryRep[q] === '1') {
          ry(tape, effectiveWires[q], amplitude / numQubits)
        }
      }
    }
  }
}

export function fourerFeatureMap(
  tape: QuantumTape,
  data: number[] | QTensor,
  frequencies: number[] | QTensor,
  phases: number[] | QTensor,
  wires?: number[]
): void {
  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const freqs = frequencies instanceof QTensor
    ? Array.from(frequencies.data)
    : frequencies

  const phs = phases instanceof QTensor
    ? Array.from(phases.data)
    : phases

  const numFeatures = features.length
  const effectiveWires = wires ?? Array.from({ length: numFeatures }, (_, i) => i)

  for (let i = 0; i < numFeatures; i++) {
    const wire = effectiveWires[i]
    const freq = freqs[i % freqs.length] ?? 1
    const phase = phs[i % phs.length] ?? 0

    H(tape, wire)
    rz(tape, wire, freq * features[i] + phase)
    H(tape, wire)
  }
}

export function learnableKernelEncoding(
  tape: QuantumTape,
  data: number[] | QTensor,
  alpha: number[] | QTensor,
  beta: number[] | QTensor,
  numLayers: number = 1,
  wires?: number[]
): void {
  const features = data instanceof QTensor
    ? Array.from(data.data)
    : data

  const alphaW = alpha instanceof QTensor
    ? Array.from(alpha.data)
    : alpha

  const betaW = beta instanceof QTensor
    ? Array.from(beta.data)
    : beta

  const numFeatures = features.length
  const effectiveWires = wires ?? Array.from({ length: numFeatures }, (_, i) => i)

  let alphaIdx = 0
  let betaIdx = 0

  for (let layer = 0; layer < numLayers; layer++) {
    for (let i = 0; i < numFeatures; i++) {
      H(tape, effectiveWires[i])
    }

    for (let i = 0; i < numFeatures; i++) {
      const a = alphaW[alphaIdx % alphaW.length] ?? 1
      alphaIdx++

      rz(tape, effectiveWires[i], a * features[i])
    }

    for (let i = 0; i < numFeatures - 1; i++) {
      const b = betaW[betaIdx % betaW.length] ?? 1
      betaIdx++

      cnot(tape, effectiveWires[i], effectiveWires[i + 1])
      rz(tape, effectiveWires[i + 1], b * features[i] * features[i + 1])
      cnot(tape, effectiveWires[i], effectiveWires[i + 1])
    }
  }
}

export function getTrainableEncodingParamCount(
  numWires: number,
  numLayers: number,
  rotationsPerQubit: number = 2
): { inputWeights: number; variationalWeights: number } {
  const paramsPerLayer = numWires * rotationsPerQubit
  return {
    inputWeights: numLayers * paramsPerLayer,
    variationalWeights: numLayers * paramsPerLayer
  }
}

export function initializeTrainableWeights(
  numWires: number,
  numLayers: number,
  rotationsPerQubit: number = 2,
  initMethod: 'zeros' | 'random' | 'ones' = 'random'
): { inputWeights: number[]; variationalWeights: number[] } {
  const { inputWeights: inputCount, variationalWeights: varCount } =
    getTrainableEncodingParamCount(numWires, numLayers, rotationsPerQubit)

  let inputWeights: number[]
  let variationalWeights: number[]

  switch (initMethod) {
    case 'zeros':
      inputWeights = new Array(inputCount).fill(0)
      variationalWeights = new Array(varCount).fill(0)
      break

    case 'ones':
      inputWeights = new Array(inputCount).fill(1)
      variationalWeights = new Array(varCount).fill(0)
      break

    case 'random':
    default:
      inputWeights = Array.from({ length: inputCount }, () => Math.random() * 2 - 1)
      variationalWeights = Array.from({ length: varCount }, () => Math.random() * 2 * Math.PI)
      break
  }

  return { inputWeights, variationalWeights }
}
