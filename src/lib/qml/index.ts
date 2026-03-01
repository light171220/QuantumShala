export {
  QMLCircuit,
  createHEACircuit,
  createStronglyEntanglingCircuit,
  type QMLParameter,
  type QMLGate,
  type QMLCircuitConfig,
  type ExpectationResult
} from './core/QMLCircuit'

export {
  DataEncoder,
  createAngleEncoder,
  createAmplitudeEncoder,
  createIQPEncoder,
  createDenseAngleEncoder,
  type EncoderConfig,
  type EncodingType
} from './core/DataEncoder'

export {
  createOptimizer,
  optimize,
  Optimizer,
  AdamOptimizer,
  SGDOptimizer,
  SPSAOptimizer,
  NelderMeadOptimizer,
  COBYLAOptimizer,
  type OptimizerConfig,
  type OptimizerType,
  type OptimizerState,
  type OptimizationResult,
  type OptimizationHistory
} from './core/Optimizer'

export {
  VQC,
  createVQC,
  type VQCConfig,
  type VQCTrainingResult,
  type ClassificationResult
} from './algorithms/VQC'

export {
  QSVM,
  createQSVM,
  visualizeKernelMatrix,
  type QSVMConfig,
  type QSVMTrainingResult,
  type KernelMatrix
} from './algorithms/QSVM'

export {
  QCNN,
  createQCNN,
  type QCNNConfig,
  type QCNNLayer
} from './algorithms/QCNN'

export {
  QGAN,
  createQGAN,
  type QGANConfig,
  type QGANTrainingResult
} from './algorithms/QGAN'
