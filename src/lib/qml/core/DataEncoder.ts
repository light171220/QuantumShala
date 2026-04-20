import { QMLCircuit } from './QMLCircuit'

export type EncodingType = 'angle' | 'amplitude' | 'iqp' | 'dense_angle' | 'basis'

export interface EncoderConfig {
  type: EncodingType
  numQubits: number
  numFeatures: number
  rotationGates?: ('Rx' | 'Ry' | 'Rz')[]
  repetitions?: number
  normalize?: boolean
}

export class DataEncoder {
  private config: EncoderConfig

  constructor(config: EncoderConfig) {
    this.config = {
      rotationGates: ['Ry'],
      repetitions: 1,
      normalize: true,
      ...config
    }
  }

  getRequiredQubits(): number {
    switch (this.config.type) {
      case 'amplitude':
        return Math.ceil(Math.log2(this.config.numFeatures))
      case 'angle':
      case 'dense_angle':
        return Math.ceil(this.config.numFeatures / (this.config.rotationGates?.length || 1))
      case 'iqp':
        return this.config.numFeatures
      case 'basis':
        return this.config.numFeatures
      default:
        return this.config.numQubits
    }
  }

  encode(data: number[], circuit?: QMLCircuit): QMLCircuit {
    if (!circuit) {
      const numQubits = Math.max(this.config.numQubits, this.getRequiredQubits())
      circuit = new QMLCircuit(numQubits)
    }

    const normalizedData = this.config.normalize ? this.normalizeData(data) : data

    switch (this.config.type) {
      case 'angle':
        this.angleEncoding(normalizedData, circuit)
        break
      case 'amplitude':
        this.amplitudeEncoding(normalizedData, circuit)
        break
      case 'iqp':
        this.iqpEncoding(normalizedData, circuit)
        break
      case 'dense_angle':
        this.denseAngleEncoding(normalizedData, circuit)
        break
      case 'basis':
        this.basisEncoding(normalizedData, circuit)
        break
    }

    return circuit
  }

  private normalizeData(data: number[]): number[] {
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    return data.map(x => ((x - min) / range) * 2 * Math.PI - Math.PI)
  }

  private angleEncoding(data: number[], circuit: QMLCircuit): void {
    const gates = this.config.rotationGates || ['Ry']
    const numQubits = circuit.getNumQubits()

    let featureIdx = 0
    for (let q = 0; q < numQubits && featureIdx < data.length; q++) {
      for (const gate of gates) {
        if (featureIdx >= data.length) break
        circuit.addGate(gate, [q], [data[featureIdx]])
        featureIdx++
      }
    }
  }

  private denseAngleEncoding(data: number[], circuit: QMLCircuit): void {
    const numQubits = circuit.getNumQubits()
    let featureIdx = 0

    for (let q = 0; q < numQubits && featureIdx < data.length; q++) {
      if (featureIdx < data.length) {
        circuit.addGate('Rx', [q], [data[featureIdx++]])
      }
      if (featureIdx < data.length) {
        circuit.addGate('Ry', [q], [data[featureIdx++]])
      }
      if (featureIdx < data.length) {
        circuit.addGate('Rz', [q], [data[featureIdx++]])
      }
    }
  }

  private amplitudeEncoding(data: number[], circuit: QMLCircuit): void {
    const numQubits = circuit.getNumQubits()
    const numStates = Math.pow(2, numQubits)

    const paddedData = [...data]
    while (paddedData.length < numStates) {
      paddedData.push(0)
    }

    const norm = Math.sqrt(paddedData.reduce((sum, x) => sum + x * x, 0)) || 1
    const normalizedAmplitudes = paddedData.map(x => x / norm)

    this.prepareAmplitudeState(normalizedAmplitudes, circuit)
  }

  private prepareAmplitudeState(amplitudes: number[], circuit: QMLCircuit): void {
    const numQubits = circuit.getNumQubits()

    if (numQubits === 1) {
      const theta = 2 * Math.acos(Math.min(1, Math.max(-1, amplitudes[0])))
      circuit.addGate('Ry', [0], [theta])
      return
    }

    const half = amplitudes.length / 2
    const leftNorm = Math.sqrt(
      amplitudes.slice(0, half).reduce((s, x) => s + x * x, 0)
    )
    const rightNorm = Math.sqrt(
      amplitudes.slice(half).reduce((s, x) => s + x * x, 0)
    )

    const totalNorm = Math.sqrt(leftNorm * leftNorm + rightNorm * rightNorm) || 1
    const theta = 2 * Math.acos(leftNorm / totalNorm)

    circuit.addGate('Ry', [numQubits - 1], [theta])

    if (leftNorm > 1e-10) {
      const leftAmps = amplitudes.slice(0, half).map(a => a / leftNorm)
      for (let i = 0; i < Math.min(numQubits - 1, leftAmps.length); i++) {
        const angle = 2 * Math.acos(Math.min(1, Math.max(0, leftAmps[i])))
        if (angle > 1e-10) {
          circuit.addGate('Ry', [i], [angle])
        }
      }
    }
  }

  private iqpEncoding(data: number[], circuit: QMLCircuit): void {
    const numQubits = Math.min(circuit.getNumQubits(), data.length)
    const reps = this.config.repetitions || 1

    for (let rep = 0; rep < reps; rep++) {
      for (let q = 0; q < numQubits; q++) {
        circuit.addGate('H', [q])
      }

      for (let q = 0; q < numQubits; q++) {
        const angle = data[q] || 0
        circuit.addGate('Rz', [q], [angle])
      }

      for (let i = 0; i < numQubits; i++) {
        for (let j = i + 1; j < numQubits; j++) {
          const angle = (data[i] || 0) * (data[j] || 0)
          circuit.addGate('CNOT', [i, j])
          circuit.addGate('Rz', [j], [angle])
          circuit.addGate('CNOT', [i, j])
        }
      }
    }
  }

  private basisEncoding(data: number[], circuit: QMLCircuit): void {
    const numQubits = circuit.getNumQubits()

    for (let q = 0; q < Math.min(numQubits, data.length); q++) {
      if (data[q] > 0.5) {
        circuit.addGate('X', [q])
      }
    }
  }

  encodeBatch(dataBatch: number[][]): QMLCircuit[] {
    return dataBatch.map(data => this.encode(data))
  }
}

export function createAngleEncoder(numFeatures: number, gates: ('Rx' | 'Ry' | 'Rz')[] = ['Ry']): DataEncoder {
  return new DataEncoder({
    type: 'angle',
    numQubits: Math.ceil(numFeatures / gates.length),
    numFeatures,
    rotationGates: gates
  })
}

export function createAmplitudeEncoder(numFeatures: number): DataEncoder {
  const numQubits = Math.ceil(Math.log2(numFeatures))
  return new DataEncoder({
    type: 'amplitude',
    numQubits,
    numFeatures
  })
}

export function createIQPEncoder(numFeatures: number, repetitions: number = 2): DataEncoder {
  return new DataEncoder({
    type: 'iqp',
    numQubits: numFeatures,
    numFeatures,
    repetitions
  })
}

export function createDenseAngleEncoder(numFeatures: number): DataEncoder {
  return new DataEncoder({
    type: 'dense_angle',
    numQubits: Math.ceil(numFeatures / 3),
    numFeatures
  })
}
