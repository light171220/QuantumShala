import type { EnvironmentState, EnvironmentSpec } from '../types'
import { BaseEnvironment } from './base'

export class GridWorldEnvironment extends BaseEnvironment {
  private gridSize: number
  private agentPos: [number, number]
  private goalPos: [number, number]
  private obstacles: Set<string>

  constructor(gridSize: number = 5, maxSteps: number = 100) {
    super(maxSteps)
    this.gridSize = gridSize
    this.agentPos = [0, 0]
    this.goalPos = [gridSize - 1, gridSize - 1]
    this.obstacles = new Set()
  }

  reset(): EnvironmentState {
    this.agentPos = [0, 0]
    this.done = false
    this.stepCount = 0
    this.state = this.posToState(this.agentPos)

    return {
      observation: this.getObservation(),
      reward: 0,
      done: false,
    }
  }

  step(action: number): EnvironmentState {
    const [row, col] = this.agentPos
    let newRow = row
    let newCol = col

    switch (action) {
      case 0:
        newRow = Math.max(0, row - 1)
        break
      case 1:
        newRow = Math.min(this.gridSize - 1, row + 1)
        break
      case 2:
        newCol = Math.max(0, col - 1)
        break
      case 3:
        newCol = Math.min(this.gridSize - 1, col + 1)
        break
    }

    const posKey = `${newRow},${newCol}`
    if (!this.obstacles.has(posKey)) {
      this.agentPos = [newRow, newCol]
    }

    this.state = this.posToState(this.agentPos)
    this.stepCount++

    const atGoal = this.agentPos[0] === this.goalPos[0] && this.agentPos[1] === this.goalPos[1]
    this.done = atGoal

    let reward = -0.01
    if (atGoal) {
      reward = 1.0
    }

    return {
      observation: this.getObservation(),
      reward,
      done: this.checkDone(),
    }
  }

  getSpec(): EnvironmentSpec {
    return {
      observationDim: this.gridSize * this.gridSize,
      actionDim: 4,
      discreteActions: true,
      maxSteps: this.maxSteps,
    }
  }

  addObstacle(row: number, col: number): void {
    this.obstacles.add(`${row},${col}`)
  }

  private posToState(pos: [number, number]): number[] {
    const state = new Array(this.gridSize * this.gridSize).fill(0)
    const index = pos[0] * this.gridSize + pos[1]
    state[index] = 1
    return state
  }

  render(): string {
    let display = ''

    for (let row = 0; row < this.gridSize; row++) {
      let line = ''
      for (let col = 0; col < this.gridSize; col++) {
        if (this.agentPos[0] === row && this.agentPos[1] === col) {
          line += 'A '
        } else if (this.goalPos[0] === row && this.goalPos[1] === col) {
          line += 'G '
        } else if (this.obstacles.has(`${row},${col}`)) {
          line += 'X '
        } else {
          line += '. '
        }
      }
      display += line + '\n'
    }

    display += `Step: ${this.stepCount}, Done: ${this.done}`
    return display
  }
}
