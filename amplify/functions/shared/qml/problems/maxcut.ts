import type { Hamiltonian, PauliTerm } from '../../types'

export interface Graph {
  nodes: number
  edges: [number, number, number][]
}

export class MaxCutProblem {
  private graph: Graph

  constructor(graph: Graph) {
    this.graph = graph
  }

  createHamiltonian(): Hamiltonian {
    const terms: PauliTerm[] = []
    let constantTerm = 0

    for (const [i, j, weight] of this.graph.edges) {
      terms.push({
        coefficient: -weight / 2,
        operators: [
          { qubit: i, pauli: 'Z' },
          { qubit: j, pauli: 'Z' },
        ],
      })

      constantTerm += weight / 2
    }

    return {
      numQubits: this.graph.nodes,
      terms,
      constantTerm,
    }
  }

  evaluateCut(bitstring: number[]): number {
    let cutValue = 0

    for (const [i, j, weight] of this.graph.edges) {
      if (bitstring[i] !== bitstring[j]) {
        cutValue += weight
      }
    }

    return cutValue
  }

  getOptimalCut(): { bitstring: number[]; value: number } {
    const n = this.graph.nodes
    let bestBitstring: number[] = []
    let bestValue = 0

    for (let i = 0; i < Math.pow(2, n); i++) {
      const bitstring = Array.from({ length: n }, (_, j) => (i >> j) & 1)
      const value = this.evaluateCut(bitstring)
      if (value > bestValue) {
        bestValue = value
        bestBitstring = bitstring
      }
    }

    return { bitstring: bestBitstring, value: bestValue }
  }

  static createRandomGraph(nodes: number, edgeProbability: number = 0.5): Graph {
    const edges: [number, number, number][] = []

    for (let i = 0; i < nodes; i++) {
      for (let j = i + 1; j < nodes; j++) {
        if (Math.random() < edgeProbability) {
          const weight = Math.random() * 2 + 0.5
          edges.push([i, j, weight])
        }
      }
    }

    return { nodes, edges }
  }

  static createRegularGraph(nodes: number, degree: number): Graph {
    const edges: [number, number, number][] = []

    for (let i = 0; i < nodes; i++) {
      for (let d = 1; d <= degree / 2; d++) {
        const j = (i + d) % nodes
        edges.push([Math.min(i, j), Math.max(i, j), 1.0])
      }
    }

    const uniqueEdges = Array.from(
      new Map(edges.map(e => [`${e[0]}-${e[1]}`, e])).values()
    )

    return { nodes, edges: uniqueEdges }
  }
}

export function createMaxCutHamiltonian(graph: Graph): Hamiltonian {
  const problem = new MaxCutProblem(graph)
  return problem.createHamiltonian()
}
