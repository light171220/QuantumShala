import { QTensor } from '../core/tensor'
import { Variable } from '../core/variable'
import { QuantumTape, setActiveTape, getActiveTape, withTape } from '../autodiff/tape'
import { grad } from '../autodiff/backward'
import { parameterShiftGradient } from '../autodiff/gradients/parameter-shift'

export type DiffMethod = 'parameter-shift' | 'adjoint' | 'backprop' | 'finite-diff' | 'best'
export type InterfaceType = 'auto' | 'numpy' | 'torch' | 'jax' | 'tf'

export interface QNodeConfig {
  device: string
  diffMethod?: DiffMethod
  interface?: InterfaceType
  shots?: number
  maxDiff?: number
  cacheSize?: number
}

export interface ExecutionResult {
  value: number | number[] | QTensor
  tape: QuantumTape
}

export interface GradientResult {
  gradients: QTensor[]
  tape: QuantumTape
}

export type CircuitFn = (...args: (QTensor | number)[]) => void

export class QNode {
  readonly device: string
  readonly diffMethod: DiffMethod
  readonly interface: InterfaceType
  readonly shots: number | null
  readonly maxDiff: number
  private _circuitFn: CircuitFn
  private _tape: QuantumTape | null
  private _lastResult: ExecutionResult | null
  private _deviceInstance: any
  private _cache: Map<string, ExecutionResult>
  private _cacheSize: number

  constructor(circuitFn: CircuitFn, config: QNodeConfig) {
    this._circuitFn = circuitFn
    this.device = config.device
    this.diffMethod = config.diffMethod ?? 'parameter-shift'
    this.interface = config.interface ?? 'auto'
    this.shots = config.shots ?? null
    this.maxDiff = config.maxDiff ?? 1
    this._tape = null
    this._lastResult = null
    this._deviceInstance = null
    this._cache = new Map()
    this._cacheSize = config.cacheSize ?? 100
  }

  get tape(): QuantumTape | null {
    return this._tape
  }

  get lastResult(): ExecutionResult | null {
    return this._lastResult
  }

  call(...args: (QTensor | number | Variable)[]): number | number[] | QTensor {
    const processedArgs = args.map(arg => {
      if (arg instanceof Variable) {
        return arg.tensor
      }
      if (typeof arg === 'number') {
        return QTensor.scalar(arg)
      }
      return arg
    })

    this._tape = new QuantumTape()

    withTape(this._tape, () => {
      this._tape!.startRecording()
      this._circuitFn(...processedArgs)
      this._tape!.stopRecording()
    })

    const result = this.execute(this._tape)
    this._lastResult = {
      value: result,
      tape: this._tape
    }

    return result
  }

  private execute(tape: QuantumTape): number | number[] | QTensor {
    const device = this.getDevice()
    return device.execute(tape)
  }

  gradient(args: (QTensor | Variable)[], argnum?: number[]): QTensor[] {
    if (!this._tape) {
      throw new Error('Must execute QNode before computing gradients')
    }

    const processedArgs = args.map(arg => {
      if (arg instanceof Variable) {
        return arg.tensor
      }
      return arg
    })

    const indicesToDiff = argnum ?? processedArgs.map((_, i) => i)
    const argsToProcess = indicesToDiff.map(i => processedArgs[i])

    switch (this.diffMethod) {
      case 'parameter-shift':
        return this.parameterShiftGradient(argsToProcess)
      case 'adjoint':
        return this.adjointGradient(argsToProcess)
      case 'backprop':
        return this.backpropGradient(argsToProcess)
      case 'finite-diff':
        return this.finiteDiffGradient(argsToProcess)
      case 'best':
        return this.selectBestMethod(argsToProcess)
      default:
        throw new Error(`Unknown differentiation method: ${this.diffMethod}`)
    }
  }

  private parameterShiftGradient(args: QTensor[]): QTensor[] {
    const device = this.getDevice()
    const executeFunc = (tape: QuantumTape): number => {
      const result = device.execute(tape)
      if (typeof result === 'number') {
        return result
      }
      if (result instanceof QTensor) {
        return result.item()
      }
      return result[0]
    }

    const gradientValues = parameterShiftGradient(this._tape!, executeFunc)

    let offset = 0
    const gradients: QTensor[] = []

    for (const arg of args) {
      const gradData = new Float64Array(arg.size)
      for (let i = 0; i < arg.size; i++) {
        if (offset + i < gradientValues.length) {
          gradData[i] = gradientValues[offset + i]
        }
      }
      gradients.push(new QTensor(gradData, arg.shape, { dtype: arg.dtype }))
      offset += arg.size
    }

    return gradients
  }

  private adjointGradient(args: QTensor[]): QTensor[] {
    throw new Error('Adjoint differentiation requires a compatible device')
  }

  private backpropGradient(args: QTensor[]): QTensor[] {
    if (!this._lastResult) {
      throw new Error('Must execute QNode before computing gradients')
    }

    const output = this._lastResult.value instanceof QTensor
      ? this._lastResult.value
      : QTensor.scalar(this._lastResult.value as number)

    return grad(output, args)
  }

  private finiteDiffGradient(args: QTensor[], epsilon: number = 1e-7): QTensor[] {
    const gradients: QTensor[] = []

    for (const arg of args) {
      const gradData = new Float64Array(arg.size)

      for (let i = 0; i < arg.size; i++) {
        const originalValue = arg.data[i]

        arg.data[i] = originalValue + epsilon
        const resultPlus = this.call(...args)

        arg.data[i] = originalValue - epsilon
        const resultMinus = this.call(...args)

        arg.data[i] = originalValue

        const plusVal = resultPlus instanceof QTensor ? resultPlus.item() : resultPlus as number
        const minusVal = resultMinus instanceof QTensor ? resultMinus.item() : resultMinus as number

        gradData[i] = (plusVal - minusVal) / (2 * epsilon)
      }

      gradients.push(new QTensor(gradData, arg.shape, { dtype: arg.dtype }))
    }

    return gradients
  }

  private selectBestMethod(args: QTensor[]): QTensor[] {
    const device = this.getDevice()

    if (device.supportsAdjoint && this.shots === null) {
      return this.adjointGradient(args)
    }

    if (device.supportsBackprop && this.shots === null) {
      return this.backpropGradient(args)
    }

    return this.parameterShiftGradient(args)
  }

  private getDevice(): any {
    if (!this._deviceInstance) {
      this._deviceInstance = createDevice(this.device, { shots: this.shots })
    }
    return this._deviceInstance
  }

  jacobian(args: (QTensor | Variable)[]): QTensor {
    const grads = this.gradient(args)

    const totalSize = grads.reduce((sum, g) => sum + g.size, 0)
    const outputSize = this._lastResult?.value instanceof QTensor
      ? this._lastResult.value.size
      : 1

    const jacobianData = new Float64Array(outputSize * totalSize)

    let offset = 0
    for (const g of grads) {
      for (let i = 0; i < g.size; i++) {
        jacobianData[offset + i] = g.data[i]
      }
      offset += g.size
    }

    return new QTensor(jacobianData, [outputSize, totalSize])
  }

  draw(options?: { wireOrder?: number[]; showParams?: boolean }): string {
    if (!this._tape) {
      throw new Error('Must execute QNode before drawing')
    }

    return this._tape.toString()
  }

  specs(): object {
    return {
      device: this.device,
      diffMethod: this.diffMethod,
      interface: this.interface,
      shots: this.shots,
      maxDiff: this.maxDiff,
      numWires: this._tape?.numWires ?? 0,
      numOperations: this._tape?.numOperations ?? 0,
      numParameters: this._tape?.numParameters ?? 0
    }
  }
}

export function qnode(config: QNodeConfig): (fn: CircuitFn) => QNode {
  return (fn: CircuitFn) => new QNode(fn, config)
}

function createDevice(name: string, options: { shots?: number | null }): any {
  return {
    name,
    shots: options.shots,
    supportsAdjoint: name.includes('state'),
    supportsBackprop: name.includes('state'),
    execute: (tape: QuantumTape) => {
      return 0
    }
  }
}

export function execute(
  tapes: QuantumTape | QuantumTape[],
  device: string,
  options?: { shots?: number }
): (number | number[] | QTensor)[] {
  const tapeArray = Array.isArray(tapes) ? tapes : [tapes]
  const dev = createDevice(device, { shots: options?.shots })

  return tapeArray.map(tape => dev.execute(tape))
}

export function batch_execute(
  tapes: QuantumTape[],
  device: string,
  options?: { shots?: number; parallel?: boolean }
): (number | number[] | QTensor)[] {
  const dev = createDevice(device, { shots: options?.shots })

  if (options?.parallel && dev.supportsBatchExecution) {
    return dev.executeBatch(tapes)
  }

  return tapes.map(tape => dev.execute(tape))
}

export interface HybridModel {
  forward(inputs: QTensor): QTensor
  backward(gradOutputs: QTensor): QTensor[]
  parameters(): Variable[]
}

export class QMLModel implements HybridModel {
  private _qnode: QNode
  private _params: Variable[]

  constructor(qnode: QNode, params: Variable[]) {
    this._qnode = qnode
    this._params = params
  }

  forward(inputs: QTensor): QTensor {
    const result = this._qnode.call(inputs, ...this._params.map(p => p.tensor))

    if (result instanceof QTensor) {
      return result
    }

    return QTensor.scalar(result as number)
  }

  backward(gradOutputs: QTensor): QTensor[] {
    const allArgs = [QTensor.zeros([1]), ...this._params.map(p => p.tensor)]
    return this._qnode.gradient(allArgs)
  }

  parameters(): Variable[] {
    return this._params
  }

  train(): void {
    for (const param of this._params) {
      param.unfreeze()
    }
  }

  eval(): void {
    for (const param of this._params) {
      param.freeze()
    }
  }
}
