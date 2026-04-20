import { QTensor, GradFn } from '../core/tensor'

export interface ComputationNode {
  id: number
  tensor: QTensor
  gradFn: GradFn | null
  inputs: ComputationNode[]
  grad: QTensor | null
  visited: boolean
  order: number
}

let nodeIdCounter = 0

export class ComputationGraph {
  private nodes: Map<number, ComputationNode>
  private outputs: ComputationNode[]
  private sortedNodes: ComputationNode[]
  private built: boolean

  constructor() {
    this.nodes = new Map()
    this.outputs = []
    this.sortedNodes = []
    this.built = false
  }

  addTensor(tensor: QTensor): ComputationNode {
    const existing = this.findNode(tensor)
    if (existing) {
      return existing
    }

    const node: ComputationNode = {
      id: nodeIdCounter++,
      tensor,
      gradFn: tensor.gradFn,
      inputs: [],
      grad: null,
      visited: false,
      order: -1
    }

    if (tensor.gradFn) {
      for (const input of tensor.gradFn.inputs) {
        const inputNode = this.addTensor(input)
        node.inputs.push(inputNode)
      }
    }

    this.nodes.set(node.id, node)
    return node
  }

  private findNode(tensor: QTensor): ComputationNode | null {
    for (const node of this.nodes.values()) {
      if (node.tensor.id === tensor.id) {
        return node
      }
    }
    return null
  }

  setOutput(tensor: QTensor): void {
    const node = this.addTensor(tensor)
    if (!this.outputs.includes(node)) {
      this.outputs.push(node)
    }
    this.built = false
  }

  build(): void {
    if (this.built) {
      return
    }

    for (const node of this.nodes.values()) {
      node.visited = false
      node.order = -1
    }

    this.sortedNodes = []
    let order = 0

    const visit = (node: ComputationNode): void => {
      if (node.visited) {
        return
      }
      node.visited = true

      for (const input of node.inputs) {
        visit(input)
      }

      node.order = order++
      this.sortedNodes.push(node)
    }

    for (const output of this.outputs) {
      visit(output)
    }

    this.built = true
  }

  topologicalSort(): ComputationNode[] {
    this.build()
    return [...this.sortedNodes]
  }

  reverseTopologicalSort(): ComputationNode[] {
    this.build()
    return [...this.sortedNodes].reverse()
  }

  getLeaves(): ComputationNode[] {
    return Array.from(this.nodes.values()).filter(node => node.inputs.length === 0)
  }

  getOutputs(): ComputationNode[] {
    return [...this.outputs]
  }

  getNode(id: number): ComputationNode | undefined {
    return this.nodes.get(id)
  }

  getAllNodes(): ComputationNode[] {
    return Array.from(this.nodes.values())
  }

  clear(): void {
    this.nodes.clear()
    this.outputs = []
    this.sortedNodes = []
    this.built = false
  }

  size(): number {
    return this.nodes.size
  }

  depth(): number {
    this.build()

    const depths = new Map<number, number>()

    const computeDepth = (node: ComputationNode): number => {
      if (depths.has(node.id)) {
        return depths.get(node.id)!
      }

      if (node.inputs.length === 0) {
        depths.set(node.id, 0)
        return 0
      }

      let maxDepth = 0
      for (const input of node.inputs) {
        maxDepth = Math.max(maxDepth, computeDepth(input))
      }

      const depth = maxDepth + 1
      depths.set(node.id, depth)
      return depth
    }

    let maxDepth = 0
    for (const output of this.outputs) {
      maxDepth = Math.max(maxDepth, computeDepth(output))
    }

    return maxDepth
  }

  toString(): string {
    this.build()
    const lines: string[] = []
    lines.push(`ComputationGraph(nodes=${this.nodes.size}, outputs=${this.outputs.length})`)

    for (const node of this.sortedNodes) {
      const gradFnName = node.gradFn?.name ?? 'leaf'
      const inputIds = node.inputs.map(n => n.id).join(', ')
      const shape = node.tensor.shape.join('x')
      lines.push(`  Node ${node.id}: ${gradFnName} [${shape}] <- [${inputIds}]`)
    }

    return lines.join('\n')
  }
}

export function buildGraph(outputs: QTensor | QTensor[]): ComputationGraph {
  const graph = new ComputationGraph()
  const outputArray = Array.isArray(outputs) ? outputs : [outputs]

  for (const output of outputArray) {
    graph.setOutput(output)
  }

  graph.build()
  return graph
}

export function findPath(from: QTensor, to: QTensor): QTensor[] | null {
  const graph = buildGraph(to)
  const fromNode = graph.getAllNodes().find(n => n.tensor.id === from.id)
  const toNode = graph.getAllNodes().find(n => n.tensor.id === to.id)

  if (!fromNode || !toNode) {
    return null
  }

  const path: ComputationNode[] = []
  const visited = new Set<number>()

  const dfs = (node: ComputationNode): boolean => {
    if (node.id === toNode.id) {
      path.push(node)
      return true
    }

    if (visited.has(node.id)) {
      return false
    }
    visited.add(node.id)

    for (const otherNode of graph.getAllNodes()) {
      if (otherNode.inputs.includes(node)) {
        if (dfs(otherNode)) {
          path.unshift(node)
          return true
        }
      }
    }

    return false
  }

  if (dfs(fromNode)) {
    return path.map(n => n.tensor)
  }

  return null
}

export function getGradientPath(output: QTensor, inputs: QTensor[]): Map<number, QTensor[]> {
  const graph = buildGraph(output)
  const paths = new Map<number, QTensor[]>()

  for (const input of inputs) {
    const path = findPath(input, output)
    if (path) {
      paths.set(input.id, path)
    }
  }

  return paths
}
