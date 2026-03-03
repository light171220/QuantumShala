import { Circuit } from '../../quantum-core'
import type { EncoderConfig, EncoderType } from '../types'

export { angleEncoding } from './angle'
export { amplitudeEncoding } from './amplitude'
export { iqpEncoding } from './iqp'
export { denseAngleEncoding } from './dense-angle'
export { basisEncoding } from './basis'
export { zzFeatureMapEncoding } from './zz-feature-map'
export { pauliFeatureMapEncoding } from './pauli-feature-map'
export { displacementEncoding } from './displacement'
export { dataReuploadingEncoding } from './data-reuploading'
export { trainableEncoding } from './trainable'
export { qaoaEmbedding } from './qaoa-embedding'

import { angleEncoding } from './angle'
import { amplitudeEncoding } from './amplitude'
import { iqpEncoding } from './iqp'
import { denseAngleEncoding } from './dense-angle'
import { basisEncoding } from './basis'
import { zzFeatureMapEncoding } from './zz-feature-map'
import { pauliFeatureMapEncoding } from './pauli-feature-map'
import { displacementEncoding } from './displacement'
import { dataReuploadingEncoding } from './data-reuploading'
import { trainableEncoding } from './trainable'
import { qaoaEmbedding } from './qaoa-embedding'

export function encode(
  circuit: Circuit,
  data: number[],
  config: EncoderConfig
): Circuit {
  const { type, reps = 1 } = config

  for (let r = 0; r < reps; r++) {
    switch (type) {
      case 'angle':
        angleEncoding(circuit, data, config)
        break
      case 'amplitude':
        amplitudeEncoding(circuit, data, config)
        break
      case 'iqp':
        iqpEncoding(circuit, data, config)
        break
      case 'dense_angle':
        denseAngleEncoding(circuit, data, config)
        break
      case 'basis':
        basisEncoding(circuit, data, config)
        break
      case 'zz_feature':
        zzFeatureMapEncoding(circuit, data, config)
        break
      case 'pauli_feature':
        pauliFeatureMapEncoding(circuit, data, config)
        break
      case 'displacement':
        displacementEncoding(circuit, data, config)
        break
      case 'data_reuploading':
        dataReuploadingEncoding(circuit, data, config)
        break
      case 'trainable':
        trainableEncoding(circuit, data, config)
        break
      case 'qaoa_embedding':
        qaoaEmbedding(circuit, data, config)
        break
      default:
        throw new Error(`Unknown encoder type: ${type}`)
    }
  }

  return circuit
}

export function getRequiredQubits(numFeatures: number, encoderType: EncoderType): number {
  switch (encoderType) {
    case 'angle':
    case 'dense_angle':
    case 'iqp':
    case 'zz_feature':
    case 'pauli_feature':
    case 'displacement':
    case 'data_reuploading':
    case 'trainable':
    case 'qaoa_embedding':
      return numFeatures
    case 'amplitude':
      return Math.ceil(Math.log2(numFeatures))
    case 'basis':
      return numFeatures
    default:
      return numFeatures
  }
}

export function getEncoderInfo(type: EncoderType): {
  name: string
  description: string
  qubitsPerFeature: number
  trainable: boolean
} {
  const info: Record<EncoderType, { name: string; description: string; qubitsPerFeature: number; trainable: boolean }> = {
    angle: {
      name: 'Angle Encoding',
      description: 'Encodes features as rotation angles on individual qubits',
      qubitsPerFeature: 1,
      trainable: false,
    },
    amplitude: {
      name: 'Amplitude Encoding',
      description: 'Encodes features in the amplitudes of the quantum state',
      qubitsPerFeature: 0,
      trainable: false,
    },
    iqp: {
      name: 'IQP Encoding',
      description: 'Instantaneous Quantum Polynomial encoding with ZZ interactions',
      qubitsPerFeature: 1,
      trainable: false,
    },
    dense_angle: {
      name: 'Dense Angle Encoding',
      description: 'Encodes two features per qubit using Ry and Rz rotations',
      qubitsPerFeature: 0.5,
      trainable: false,
    },
    basis: {
      name: 'Basis Encoding',
      description: 'Encodes binary features as computational basis states',
      qubitsPerFeature: 1,
      trainable: false,
    },
    zz_feature: {
      name: 'ZZ Feature Map',
      description: 'Feature map with ZZ entangling interactions',
      qubitsPerFeature: 1,
      trainable: false,
    },
    pauli_feature: {
      name: 'Pauli Feature Map',
      description: 'Feature map using configurable Pauli rotations',
      qubitsPerFeature: 1,
      trainable: false,
    },
    displacement: {
      name: 'Displacement Encoding',
      description: 'CV-inspired encoding using displacement-like operations',
      qubitsPerFeature: 1,
      trainable: false,
    },
    data_reuploading: {
      name: 'Data Re-uploading',
      description: 'Interleaves data encoding with variational layers',
      qubitsPerFeature: 1,
      trainable: true,
    },
    trainable: {
      name: 'Trainable Encoding',
      description: 'Feature map with trainable parameters',
      qubitsPerFeature: 1,
      trainable: true,
    },
    qaoa_embedding: {
      name: 'QAOA Embedding',
      description: 'Encodes data using QAOA-like mixer and cost layers',
      qubitsPerFeature: 1,
      trainable: true,
    },
  }

  return info[type]
}
