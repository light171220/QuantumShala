import type { QMLRequest, QMLResponse, AnalysisResult } from '../../../shared/qml/types'
import { buildAnsatz } from '../../../shared/qml/ansatze'
import { computeExpressibility } from '../../../shared/qml/analysis/expressibility'
import { computeTrainability } from '../../../shared/qml/analysis/trainability'
import { computeEntanglement } from '../../../shared/qml/analysis/entanglement'
import { checkSimulability } from '../../../shared/qml/analysis/simulability'
import { detectBarrenPlateau } from '../../../shared/qml/training/barren-plateau'

export async function analyzeCircuit(request: QMLRequest): Promise<Partial<QMLResponse>> {
  const {
    numQubits,
    ansatzType = 'real_amplitudes',
    ansatzConfig = {},
    analysisOptions = {},
  } = request

  const fullAnsatzConfig = {
    type: ansatzType,
    numQubits,
    layers: ansatzConfig.layers || 2,
    entanglement: ansatzConfig.entanglement || 'linear',
    ...ansatzConfig,
  }

  const numSamples = analysisOptions.numSamples || 50

  const analysis: AnalysisResult = {}

  if (analysisOptions.computeExpressibility !== false) {
    const expressResult = computeExpressibility(fullAnsatzConfig, numSamples)
    analysis.expressibility = expressResult.expressibility
  }

  if (analysisOptions.computeTrainability !== false) {
    const trainResult = computeTrainability(fullAnsatzConfig, numSamples)
    analysis.trainability = trainResult.trainability
    analysis.gradientVariance = trainResult.gradientVariance
    analysis.effectiveDimension = trainResult.effectiveDimension
  }

  if (analysisOptions.computeEntanglement !== false) {
    const entResult = computeEntanglement(fullAnsatzConfig, numSamples)
    analysis.entanglement = entResult.entanglingCapability
    analysis.meyerWallach = entResult.meyerWallach
  }

  if (analysisOptions.checkSimulability !== false) {
    const simResult = checkSimulability(fullAnsatzConfig)
    analysis.simulable = simResult.simulable
    analysis.simulabilityReason = simResult.reason
  }

  if (analysisOptions.detectBarrenPlateau !== false) {
    const bpResult = detectBarrenPlateau(fullAnsatzConfig, numSamples)
    analysis.barrenPlateauWarning = bpResult.detected
    analysis.barrenPlateauSeverity = bpResult.severity
  }

  const circuit = buildAnsatz(fullAnsatzConfig)
  const metrics = circuit.getMetrics()

  return {
    analysis,
    metrics: {
      depth: metrics.depth,
      gateCount: metrics.gateCount,
      cnotCount: metrics.cnotCount,
      parameterCount: metrics.parameterCount,
      numQubits,
      executionTimeMs: 0,
    },
  }
}
