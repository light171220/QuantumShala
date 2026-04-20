import type { Hamiltonian, PauliTerm } from '../../types'

export interface PortfolioData {
  returns: number[]
  covariance: number[][]
  budget: number
  riskAversion: number
}

export class PortfolioProblem {
  private data: PortfolioData
  private penalty: number

  constructor(data: PortfolioData, penalty: number = 10) {
    this.data = data
    this.penalty = penalty
  }

  createHamiltonian(): Hamiltonian {
    const n = this.data.returns.length
    const { returns, covariance, budget, riskAversion } = this.data
    const terms: PauliTerm[] = []
    let constantTerm = 0

    for (let i = 0; i < n; i++) {
      terms.push({
        coefficient: -returns[i] / 2,
        operators: [{ qubit: i, pauli: 'Z' }],
      })
      constantTerm += returns[i] / 2
    }

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const covCoeff = i === j ? covariance[i][j] : 2 * covariance[i][j]

        if (i === j) {
          terms.push({
            coefficient: riskAversion * covCoeff / 4,
            operators: [{ qubit: i, pauli: 'I' }],
          })
        } else {
          terms.push({
            coefficient: riskAversion * covCoeff / 4,
            operators: [
              { qubit: i, pauli: 'Z' },
              { qubit: j, pauli: 'Z' },
            ],
          })
        }
      }
    }

    for (let i = 0; i < n; i++) {
      terms.push({
        coefficient: -this.penalty * budget,
        operators: [{ qubit: i, pauli: 'Z' }],
      })
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        terms.push({
          coefficient: this.penalty / 2,
          operators: [
            { qubit: i, pauli: 'Z' },
            { qubit: j, pauli: 'Z' },
          ],
        })
      }
    }

    constantTerm += this.penalty * budget * budget

    return {
      numQubits: n,
      terms,
      constantTerm,
    }
  }

  evaluatePortfolio(selection: number[]): {
    expectedReturn: number
    risk: number
    sharpeRatio: number
    budgetViolation: number
  } {
    const { returns, covariance, budget, riskAversion } = this.data

    let expectedReturn = 0
    let totalSelected = 0

    for (let i = 0; i < selection.length; i++) {
      if (selection[i] === 1) {
        expectedReturn += returns[i]
        totalSelected++
      }
    }

    let risk = 0
    for (let i = 0; i < selection.length; i++) {
      for (let j = 0; j < selection.length; j++) {
        if (selection[i] === 1 && selection[j] === 1) {
          risk += covariance[i][j]
        }
      }
    }
    risk = Math.sqrt(risk)

    const sharpeRatio = risk > 0 ? expectedReturn / risk : 0
    const budgetViolation = Math.abs(totalSelected - budget)

    return { expectedReturn, risk, sharpeRatio, budgetViolation }
  }

  static generateRandomPortfolio(numAssets: number): PortfolioData {
    const returns = Array.from({ length: numAssets }, () => Math.random() * 0.2 - 0.05)

    const covariance: number[][] = Array.from({ length: numAssets }, () =>
      Array(numAssets).fill(0)
    )

    for (let i = 0; i < numAssets; i++) {
      covariance[i][i] = Math.random() * 0.1 + 0.01
      for (let j = i + 1; j < numAssets; j++) {
        const cov = (Math.random() - 0.5) * 0.02
        covariance[i][j] = cov
        covariance[j][i] = cov
      }
    }

    return {
      returns,
      covariance,
      budget: Math.ceil(numAssets / 2),
      riskAversion: 0.5,
    }
  }
}

export function createPortfolioHamiltonian(data: PortfolioData, penalty: number = 10): Hamiltonian {
  const problem = new PortfolioProblem(data, penalty)
  return problem.createHamiltonian()
}
