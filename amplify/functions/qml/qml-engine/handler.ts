import type { Schema } from '../../../data/resource'
import type { QMLRequest, QMLResponse } from '../../shared/qml/types'

import { runVQC } from './algorithms/vqc'
import { runQSVM } from './algorithms/qsvm'
import { runQCNN } from './algorithms/qcnn'
import { runQGAN } from './algorithms/qgan'
import { runQAOA } from './algorithms/qaoa'
import { runQRL } from './algorithms/qrl'
import { runQTransformer } from './algorithms/qtransformer'
import { runQGNN } from './algorithms/qgnn'
import { runQReservoir } from './algorithms/qreservoir'
import { runQAutoencoder } from './algorithms/qautoencoder'
import { runQVAE } from './algorithms/qvae'
import { analyzeCircuit } from './algorithms/analyze'

export const handler = async (event: any): Promise<QMLResponse> => {
  const startTime = Date.now()

  try {
    const request: QMLRequest = {
      algorithm: event.arguments.algorithm,
      numQubits: event.arguments.numQubits,
      shots: event.arguments.shots,
      seed: event.arguments.seed,
      datasetId: event.arguments.datasetId,
      customData: event.arguments.customData,
      trainTestSplit: event.arguments.trainTestSplit,
      encoderType: event.arguments.encoderType,
      encoderConfig: event.arguments.encoderConfig,
      ansatzType: event.arguments.ansatzType,
      ansatzConfig: event.arguments.ansatzConfig,
      optimizerType: event.arguments.optimizerType,
      optimizerConfig: event.arguments.optimizerConfig,
      trainingConfig: event.arguments.trainingConfig,
      analysisOptions: event.arguments.analysisOptions,
      mitigationConfig: event.arguments.mitigationConfig,
      kernelConfig: event.arguments.kernelConfig,
      qaoaConfig: event.arguments.qaoaConfig,
      qrlConfig: event.arguments.qrlConfig,
      qgnnConfig: event.arguments.qgnnConfig,
      qtransformerConfig: event.arguments.qtransformerConfig,
      qreservoirConfig: event.arguments.qreservoirConfig,
      qautoencoderConfig: event.arguments.qautoencoderConfig,
      qvaeConfig: event.arguments.qvaeConfig,
      qganConfig: event.arguments.qganConfig,
      algorithmConfig: event.arguments.algorithmConfig,
    }

    let result: Partial<QMLResponse>

    switch (request.algorithm) {
      case 'vqc':
        result = await runVQC(request)
        break
      case 'qsvm':
        result = await runQSVM(request)
        break
      case 'qcnn':
        result = await runQCNN(request)
        break
      case 'qgan':
        result = await runQGAN(request)
        break
      case 'qaoa':
        result = await runQAOA(request)
        break
      case 'qrl':
        result = await runQRL(request)
        break
      case 'qtransformer':
        result = await runQTransformer(request)
        break
      case 'qgnn':
        result = await runQGNN(request)
        break
      case 'qreservoir':
        result = await runQReservoir(request)
        break
      case 'qautoencoder':
        result = await runQAutoencoder(request)
        break
      case 'qvae':
        result = await runQVAE(request)
        break
      case 'analyze':
        result = await analyzeCircuit(request)
        break
      default:
        throw new Error(`Unknown algorithm: ${request.algorithm}`)
    }

    const executionTimeMs = Date.now() - startTime

    return {
      success: true,
      ...result,
      metrics: {
        ...result.metrics,
        executionTimeMs,
      },
    } as QMLResponse
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: 'QML_ERROR',
        message: error.message || 'Unknown error occurred',
        details: error.stack,
      },
      metrics: {
        executionTimeMs: Date.now() - startTime,
        depth: 0,
        gateCount: 0,
        cnotCount: 0,
        parameterCount: 0,
        numQubits: 0,
      },
    }
  }
}
