export {
  MergeRotationsTransform,
  MergeAdjacentRotationsTransform,
  MergeRotIntoU3Transform,
  MergeRotationsConfig,
  mergeRotations,
  mergeAdjacentRotations,
  mergeRotIntoU3
} from './merge-rotations'

export {
  CancelInversesTransform,
  CancelSelfInverseTransform,
  CancelHadamardTransform,
  CancelCNOTTransform,
  CancelDaggerTransform,
  CommuteThroughTransform,
  CancelInversesConfig,
  cancelInverses,
  cancelSelfInverse,
  cancelHadamard,
  cancelCNOT,
  cancelDagger,
  commuteThrough
} from './cancel-inverses'

export {
  DecomposeTransform,
  DecomposeMultiControlledTransform,
  UnrollToNativeTransform,
  DecomposeConfig,
  NativeGateSet,
  decompose,
  decomposeMultiControlled,
  unrollToNative,
  toIBMQ,
  toRigetti,
  toIonQ,
  toCliffordT
} from './decompose'

import { Transform, compose, pipeline, TransformPipeline } from '../base'
import { mergeRotations, mergeAdjacentRotations } from './merge-rotations'
import { cancelInverses, cancelSelfInverse, commuteThrough } from './cancel-inverses'
import { decompose, DecomposeConfig } from './decompose'

export function optimizationLevel0(): Transform {
  return compose()
}

export function optimizationLevel1(): Transform {
  return compose(
    cancelSelfInverse(),
    mergeAdjacentRotations()
  )
}

export function optimizationLevel2(): Transform {
  return compose(
    cancelInverses(),
    mergeRotations(),
    cancelInverses()
  )
}

export function optimizationLevel3(): Transform {
  return compose(
    commuteThrough(),
    cancelInverses({ maxSearchDepth: 10 }),
    mergeRotations({ maxMergeDistance: 5 }),
    cancelInverses({ maxSearchDepth: 10 }),
    mergeRotations()
  )
}

export function standardOptimization(): Transform {
  return optimizationLevel2()
}

export function createOptimizationPipeline(level: 0 | 1 | 2 | 3 = 2): TransformPipeline {
  const pip = pipeline()

  switch (level) {
    case 0:
      return pip
    case 1:
      return pip
        .addTransform('Basic', cancelSelfInverse(), mergeAdjacentRotations())
    case 2:
      return pip
        .addTransform('Cancel', cancelInverses())
        .addTransform('Merge', mergeRotations())
        .addTransform('CleanUp', cancelInverses())
    case 3:
      return pip
        .addPass({
          name: 'Commute',
          transforms: [commuteThrough()],
          maxIterations: 3,
          convergenceThreshold: 0
        })
        .addPass({
          name: 'Optimize',
          transforms: [
            cancelInverses({ maxSearchDepth: 10 }),
            mergeRotations({ maxMergeDistance: 5 })
          ],
          maxIterations: 5,
          convergenceThreshold: 1
        })
        .addTransform('Final', cancelInverses(), mergeRotations())
  }
}

export function fullOptimization(decomposeConfig?: DecomposeConfig): Transform {
  return compose(
    decompose(decomposeConfig),
    optimizationLevel3()
  )
}
