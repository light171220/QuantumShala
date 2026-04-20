export * from './core'

export * from './autodiff'

export * from './circuit'

export * from './devices'

export * from './nn'

export * from './optim'

export * from './templates'

export * from './transforms'

import { QTensor, tensor, zeros, ones, eye, rand, randn, arange, linspace, kron, matmul, dot } from './core/tensor'
import { Complex } from './core/complex'
import { Variable, VariableCollection, variable, trainable, constant } from './core/variable'

import { QuantumTape, tape, getActiveTape, setActiveTape, withTape } from './autodiff/tape'
import { backward, grad, jacobian, hessian, vjp, jvp, numericalGrad, gradCheck, zeroGrad, clipGradNorm, clipGradValue } from './autodiff/backward'

import { QNode, qnode, execute, batch_execute, QMLModel } from './circuit/qnode'
import {
  H, X, Y, Z, rx, ry, rz, rot, u3,
  cnot, cx, cy, cz, swap, iswap,
  crx, cry, crz, rxx, ryy, rzz,
  toffoli, ccx, cswap, fredkin,
  barrier, reset
} from './circuit/operations/gates'
import {
  expval, variance, sample, probs, counts, state,
  PauliXObs, PauliYObs, PauliZObs, Identity, Hermitian,
  tensorObs, hamiltonian, sparseHamiltonian
} from './circuit/operations/observables'

import { Device, QubitDevice, getDevice, listDevices, registerDevice, registerPlugin } from './devices/base-device'
import { DefaultStateVectorDevice } from './devices/default-state'
import { WebGPUStateVectorDevice } from './devices/webgpu-device'
import { qiskitPlugin, braketPlugin } from './devices/plugins'

import {
  QuantumLayer, Sequential,
  AngleEncodingLayer, AmplitudeEncodingLayer,
  StronglyEntanglingLayer, BasicEntanglerLayer,
  RandomLayer, MeasurementLayer,
  TwoLocal, EfficientSU2, RealAmplitudes,
  angleEncoding, amplitudeEncoding,
  stronglyEntangling, basicEntangler,
  randomLayer, measurement, sequential,
  twoLocal, efficientSU2, realAmplitudes
} from './nn/layers'

import {
  HybridLayer, TorchLikeModule, HybridSequential,
  QuantumLinear, QuantumConv,
  ClassicalPreprocessing, ClassicalPostprocessing,
  quantumLinear, quantumConv,
  classicalPreprocessing, classicalPostprocessing,
  hybridSequential
} from './nn/hybrid'

import {
  Optimizer, SGD, Adam, AdamW, RMSprop, Adagrad, SPSA, QNSPSA,
  LRScheduler, StepLR, ExponentialLR, CosineAnnealingLR, ReduceLROnPlateau,
  sgd, adam, adamw, rmsprop, adagrad, spsa, qnspsa,
  stepLR, exponentialLR, cosineAnnealingLR, reduceLROnPlateau,
  TensorOptimizer, createOptimizer
} from './optim'

export const qf = {
  tensor,
  zeros,
  ones,
  eye,
  rand,
  randn,
  arange,
  linspace,
  kron,
  matmul,
  dot,

  Complex,
  QTensor,
  Variable,
  VariableCollection,
  variable,
  trainable,
  constant,

  QuantumTape,
  tape,
  getActiveTape,
  setActiveTape,
  withTape,

  backward,
  grad,
  jacobian,
  hessian,
  vjp,
  jvp,
  numericalGrad,
  gradCheck,
  zeroGrad,
  clipGradNorm,
  clipGradValue,

  QNode,
  qnode,
  execute,
  batch_execute,
  QMLModel,

  H, X, Y, Z,
  rx, ry, rz, rot, u3,
  cnot, cx, cy, cz,
  swap, iswap,
  crx, cry, crz,
  rxx, ryy, rzz,
  toffoli, ccx,
  cswap, fredkin,
  barrier, reset,

  expval, variance, sample, probs, counts, state,
  PauliXObs, PauliYObs, PauliZObs, Identity, Hermitian,
  tensorObs, hamiltonian, sparseHamiltonian,

  Device,
  QubitDevice,
  getDevice,
  listDevices,
  registerDevice,
  registerPlugin,
  DefaultStateVectorDevice,
  WebGPUStateVectorDevice,
  qiskitPlugin,
  braketPlugin,

  QuantumLayer,
  Sequential,
  AngleEncodingLayer,
  AmplitudeEncodingLayer,
  StronglyEntanglingLayer,
  BasicEntanglerLayer,
  RandomLayer,
  MeasurementLayer,
  TwoLocal,
  EfficientSU2,
  RealAmplitudes,
  angleEncoding,
  amplitudeEncoding,
  stronglyEntangling,
  basicEntangler,
  randomLayer,
  measurement,
  sequential,
  twoLocal,
  efficientSU2,
  realAmplitudes,

  HybridLayer,
  TorchLikeModule,
  HybridSequential,
  QuantumLinear,
  QuantumConv,
  ClassicalPreprocessing,
  ClassicalPostprocessing,
  quantumLinear,
  quantumConv,
  classicalPreprocessing,
  classicalPostprocessing,
  hybridSequential,

  Optimizer,
  SGD,
  Adam,
  AdamW,
  RMSprop,
  Adagrad,
  SPSA,
  QNSPSA,
  LRScheduler,
  StepLR,
  ExponentialLR,
  CosineAnnealingLR,
  ReduceLROnPlateau,
  sgd,
  adam,
  adamw,
  rmsprop,
  adagrad,
  spsa,
  qnspsa,
  stepLR,
  exponentialLR,
  cosineAnnealingLR,
  reduceLROnPlateau,
  TensorOptimizer,
  createOptimizer
}

export default qf
