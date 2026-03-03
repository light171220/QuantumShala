import type { Hamiltonian, PauliTerm } from '../../types'

export interface City {
  x: number
  y: number
}

export class TSPProblem {
  private cities: City[]
  private distances: number[][]
  private penalty: number

  constructor(cities: City[], penalty: number = 100) {
    this.cities = cities
    this.penalty = penalty
    this.distances = this.computeDistances()
  }

  private computeDistances(): number[][] {
    const n = this.cities.length
    const dist: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = Math.sqrt(
          Math.pow(this.cities[i].x - this.cities[j].x, 2) +
          Math.pow(this.cities[i].y - this.cities[j].y, 2)
        )
        dist[i][j] = d
        dist[j][i] = d
      }
    }

    return dist
  }

  createHamiltonian(): Hamiltonian {
    const n = this.cities.length
    const numQubits = n * n
    const terms: PauliTerm[] = []
    let constantTerm = 0

    const qubitIndex = (city: number, position: number) => city * n + position

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let p = 0; p < n; p++) {
          const q1 = qubitIndex(i, p)
          const q2 = qubitIndex(j, p)

          terms.push({
            coefficient: this.penalty / 4,
            operators: [
              { qubit: q1, pauli: 'Z' },
              { qubit: q2, pauli: 'Z' },
            ],
          })
        }
      }
    }

    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        for (let i = 0; i < n; i++) {
          const q1 = qubitIndex(i, p)
          const q2 = qubitIndex(i, q)

          terms.push({
            coefficient: this.penalty / 4,
            operators: [
              { qubit: q1, pauli: 'Z' },
              { qubit: q2, pauli: 'Z' },
            ],
          })
        }
      }
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          for (let p = 0; p < n; p++) {
            const nextP = (p + 1) % n
            const q1 = qubitIndex(i, p)
            const q2 = qubitIndex(j, nextP)

            terms.push({
              coefficient: this.distances[i][j] / 4,
              operators: [
                { qubit: q1, pauli: 'Z' },
                { qubit: q2, pauli: 'Z' },
              ],
            })
          }
        }
      }
    }

    return {
      numQubits,
      terms,
      constantTerm,
    }
  }

  evaluateTour(tour: number[]): number {
    let totalDistance = 0

    for (let i = 0; i < tour.length; i++) {
      const from = tour[i]
      const to = tour[(i + 1) % tour.length]
      totalDistance += this.distances[from][to]
    }

    return totalDistance
  }

  decodeResult(bitstring: number[]): number[] | null {
    const n = this.cities.length
    const tour: number[] = []

    for (let p = 0; p < n; p++) {
      let cityAtPosition = -1
      for (let i = 0; i < n; i++) {
        if (bitstring[i * n + p] === 1) {
          if (cityAtPosition !== -1) {
            return null
          }
          cityAtPosition = i
        }
      }
      if (cityAtPosition === -1) {
        return null
      }
      tour.push(cityAtPosition)
    }

    const uniqueCities = new Set(tour)
    if (uniqueCities.size !== n) {
      return null
    }

    return tour
  }

  static createRandomCities(numCities: number): City[] {
    return Array.from({ length: numCities }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
    }))
  }
}

export function createTSPHamiltonian(cities: City[], penalty: number = 100): Hamiltonian {
  const problem = new TSPProblem(cities, penalty)
  return problem.createHamiltonian()
}
