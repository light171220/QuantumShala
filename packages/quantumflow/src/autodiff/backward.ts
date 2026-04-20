import { QTensor } from '../core/tensor'
import { ComputationGraph, buildGraph, ComputationNode } from './graph'

export interface GradientResult {
  gradients: Map<number, QTensor>
  graph: ComputationGraph
}

export function backward(
  output: QTensor,
  gradOutput?: QTensor,
  retainGraph: boolean = false
): void {
  if (!output.requiresGrad) {
    throw new Error('Cannot compute gradient for tensor that does not require grad')
  }

  const graph = buildGraph(output)
  const nodes = graph.reverseTopologicalSort()

  const grads = new Map<number, QTensor>()

  const outputNode = nodes[0]
  if (gradOutput) {
    grads.set(outputNode.id, gradOutput)
  } else {
    if (output.size !== 1) {
      throw new Error('grad can be implicitly created only for scalar outputs')
    }
    grads.set(outputNode.id, QTensor.ones(output.shape, { dtype: output.dtype }))
  }

  for (const node of nodes) {
    const grad = grads.get(node.id)
    if (!grad) continue

    if (!node.gradFn) continue

    const inputGrads = (node.gradFn as any).fn(grad)

    for (let i = 0; i < node.inputs.length; i++) {
      const inputNode = node.inputs[i]
      const inputGrad = inputGrads[i]

      if (!inputGrad) continue

      if (grads.has(inputNode.id)) {
        const existing = grads.get(inputNode.id)!
        grads.set(inputNode.id, existing.add(inputGrad))
      } else {
        grads.set(inputNode.id, inputGrad)
      }
    }
  }

  for (const node of graph.getLeaves()) {
    if (node.tensor.requiresGrad) {
      const grad = grads.get(node.id)
      if (grad) {
        if (node.tensor.grad) {
          node.tensor.grad = node.tensor.grad.add(grad)
        } else {
          node.tensor.grad = grad
        }
      }
    }
  }

  if (!retainGraph) {
    graph.clear()
  }
}

export function grad(
  outputs: QTensor | QTensor[],
  inputs: QTensor | QTensor[],
  gradOutputs?: QTensor | QTensor[],
  retainGraph: boolean = false,
  createGraph: boolean = false
): QTensor[] {
  const outputArray = Array.isArray(outputs) ? outputs : [outputs]
  const inputArray = Array.isArray(inputs) ? inputs : [inputs]
  const gradOutputArray = gradOutputs
    ? (Array.isArray(gradOutputs) ? gradOutputs : [gradOutputs])
    : outputArray.map(o => QTensor.ones(o.shape, { dtype: o.dtype }))

  if (outputArray.length !== gradOutputArray.length) {
    throw new Error('Number of outputs must match number of grad outputs')
  }

  const graph = new ComputationGraph()
  for (const output of outputArray) {
    graph.setOutput(output)
  }
  graph.build()

  const nodes = graph.reverseTopologicalSort()

  const grads = new Map<number, QTensor>()

  for (let i = 0; i < outputArray.length; i++) {
    const outputNode = graph.getAllNodes().find(n => n.tensor.id === outputArray[i].id)
    if (outputNode) {
      if (grads.has(outputNode.id)) {
        const existing = grads.get(outputNode.id)!
        grads.set(outputNode.id, existing.add(gradOutputArray[i]))
      } else {
        grads.set(outputNode.id, gradOutputArray[i])
      }
    }
  }

  for (const node of nodes) {
    const nodeGrad = grads.get(node.id)
    if (!nodeGrad) continue

    if (!node.gradFn) continue

    const inputGrads = (node.gradFn as any).fn(nodeGrad)

    for (let i = 0; i < node.inputs.length; i++) {
      const inputNode = node.inputs[i]
      const inputGrad = inputGrads[i]

      if (!inputGrad) continue

      if (grads.has(inputNode.id)) {
        const existing = grads.get(inputNode.id)!
        grads.set(inputNode.id, existing.add(inputGrad))
      } else {
        grads.set(inputNode.id, inputGrad)
      }
    }
  }

  const result: QTensor[] = []
  for (const input of inputArray) {
    const inputNode = graph.getAllNodes().find(n => n.tensor.id === input.id)
    if (inputNode && grads.has(inputNode.id)) {
      result.push(grads.get(inputNode.id)!)
    } else {
      result.push(QTensor.zeros(input.shape, { dtype: input.dtype }))
    }
  }

  if (!retainGraph) {
    graph.clear()
  }

  return result
}

export function jacobian(
  output: QTensor,
  input: QTensor,
  createGraph: boolean = false
): QTensor {
  if (output.ndim > 1 || input.ndim > 1) {
    throw new Error('jacobian requires 1D tensors')
  }

  const m = output.size
  const n = input.size
  const jacobianData = new Float64Array(m * n)

  for (let i = 0; i < m; i++) {
    const gradOutput = QTensor.zeros([m])
    gradOutput.data[i] = 1

    const grads = grad(output, input, gradOutput, true, createGraph)
    const gradInput = grads[0]

    for (let j = 0; j < n; j++) {
      jacobianData[i * n + j] = gradInput.data[j]
    }
  }

  return new QTensor(jacobianData, [m, n], {
    dtype: 'float64',
    requiresGrad: createGraph
  })
}

export function hessian(
  output: QTensor,
  input: QTensor
): QTensor {
  if (output.size !== 1) {
    throw new Error('hessian requires scalar output')
  }

  const n = input.size
  const hessianData = new Float64Array(n * n)

  const firstGrad = grad(output, input, undefined, true, true)[0]

  for (let i = 0; i < n; i++) {
    const gradOutput = QTensor.zeros([n])
    gradOutput.data[i] = 1

    const secondGrad = grad(firstGrad, input, gradOutput, true, false)[0]

    for (let j = 0; j < n; j++) {
      hessianData[i * n + j] = secondGrad.data[j]
    }
  }

  return new QTensor(hessianData, [n, n], { dtype: 'float64' })
}

export function vjp(
  outputs: QTensor | QTensor[],
  inputs: QTensor | QTensor[],
  v: QTensor | QTensor[]
): QTensor[] {
  return grad(outputs, inputs, v, false, false)
}

export function jvp(
  outputs: QTensor | QTensor[],
  inputs: QTensor | QTensor[],
  v: QTensor | QTensor[]
): QTensor[] {
  const outputArray = Array.isArray(outputs) ? outputs : [outputs]
  const inputArray = Array.isArray(inputs) ? inputs : [inputs]
  const vArray = Array.isArray(v) ? v : [v]

  if (inputArray.length !== vArray.length) {
    throw new Error('Number of inputs must match number of tangent vectors')
  }

  const result: QTensor[] = []

  for (const output of outputArray) {
    let totalJvp = QTensor.zeros(output.shape, { dtype: output.dtype })

    for (let i = 0; i < inputArray.length; i++) {
      const input = inputArray[i]
      const tangent = vArray[i]

      const jac = jacobian(output.reshape([-1]) as QTensor, input.reshape([-1]) as QTensor)
      const jvpResult = jac.matmul(tangent.reshape([tangent.size, 1]))
      totalJvp = totalJvp.add(jvpResult.reshape(output.shape))
    }

    result.push(totalJvp)
  }

  return result
}

export class GradientCheckpoint {
  private savedTensors: Map<number, Float64Array>

  constructor() {
    this.savedTensors = new Map()
  }

  save(tensors: QTensor[]): void {
    for (const tensor of tensors) {
      this.savedTensors.set(tensor.id, new Float64Array(tensor.data))
    }
  }

  restore(tensors: QTensor[]): void {
    for (const tensor of tensors) {
      const saved = this.savedTensors.get(tensor.id)
      if (saved) {
        for (let i = 0; i < tensor.data.length; i++) {
          tensor.data[i] = saved[i]
        }
      }
    }
  }

  clear(): void {
    this.savedTensors.clear()
  }
}

export function numericalGrad(
  fn: (inputs: QTensor[]) => QTensor,
  inputs: QTensor[],
  eps: number = 1e-5
): QTensor[] {
  const result: QTensor[] = []

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]
    const gradData = new Float64Array(input.data.length)

    for (let j = 0; j < input.data.length; j++) {
      const originalValue = input.data[j]

      input.data[j] = originalValue + eps
      const outputPlus = fn(inputs)

      input.data[j] = originalValue - eps
      const outputMinus = fn(inputs)

      input.data[j] = originalValue

      const diff = outputPlus.sub(outputMinus)
      gradData[j] = diff.sum().item() / (2 * eps)
    }

    result.push(new QTensor(gradData, input.shape, { dtype: input.dtype }))
  }

  return result
}

export function gradCheck(
  fn: (inputs: QTensor[]) => QTensor,
  inputs: QTensor[],
  eps: number = 1e-5,
  rtol: number = 1e-3,
  atol: number = 1e-5
): { passed: boolean; maxError: number; errors: number[] } {
  const output = fn(inputs)
  const analyticGrads = grad(output, inputs)
  const numericGrads = numericalGrad(fn, inputs, eps)

  let maxError = 0
  const errors: number[] = []

  for (let i = 0; i < inputs.length; i++) {
    const analytic = analyticGrads[i]
    const numeric = numericGrads[i]

    for (let j = 0; j < analytic.data.length; j++) {
      const a = analytic.data[j]
      const n = numeric.data[j]
      const error = Math.abs(a - n)
      const relError = error / (Math.abs(n) + 1e-8)

      errors.push(error)
      maxError = Math.max(maxError, error)
    }
  }

  const passed = maxError < atol || maxError / (Math.max(...errors) + 1e-8) < rtol

  return { passed, maxError, errors }
}

export function zeroGrad(tensors: QTensor[]): void {
  for (const tensor of tensors) {
    if (tensor.grad) {
      for (let i = 0; i < tensor.grad.data.length; i++) {
        tensor.grad.data[i] = 0
      }
    }
  }
}

export function clipGradNorm(tensors: QTensor[], maxNorm: number): number {
  let totalNorm = 0

  for (const tensor of tensors) {
    if (tensor.grad) {
      for (let i = 0; i < tensor.grad.data.length; i++) {
        totalNorm += tensor.grad.data[i] * tensor.grad.data[i]
      }
    }
  }

  totalNorm = Math.sqrt(totalNorm)

  if (totalNorm > maxNorm) {
    const scale = maxNorm / totalNorm
    for (const tensor of tensors) {
      if (tensor.grad) {
        for (let i = 0; i < tensor.grad.data.length; i++) {
          tensor.grad.data[i] *= scale
        }
      }
    }
  }

  return totalNorm
}

export function clipGradValue(tensors: QTensor[], clipValue: number): void {
  for (const tensor of tensors) {
    if (tensor.grad) {
      for (let i = 0; i < tensor.grad.data.length; i++) {
        tensor.grad.data[i] = Math.max(-clipValue, Math.min(clipValue, tensor.grad.data[i]))
      }
    }
  }
}
