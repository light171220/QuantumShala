import type { EnvironmentState, EnvironmentSpec } from '../types'
import { BaseEnvironment } from './base'

export class FrozenLakeEnvironment extends BaseEnvironment {
  private gridSize: number
  private agentPos: number
  private map: string[]
  private slippery: boolean

  constructor(gridSize: number = 4, slippery: boolean = true, maxSteps: number = 100) {
    super(maxSteps)
    this.gridSize = gridSize
    this.slippery = slippery
    this.agentPos = 0

    if (gridSize === 4) {
      this.map = [
        'SFFF',
        'FHFH',
        'FFFH',
        'HFFG',
      ]
    } else {
      this.map = this.generateMap(gridSize)
    }
  }

  private generateMap(size: number): string[] {
    const map: string[] = []
    for (let i = 0; i < size; i++) {
      let row = ''
      for (let j = 0; j < size; j++) {
        if (i === 0 && j === 0) {
          row += 'S'
        } else if (i === size - 1 && j === size - 1) {
          row += 'G'
        } else if (Math.random() < 0.2) {
          row += 'H'
        } else {
          row += 'F'
        }
      }
      map.push(row)
    }
    return map
  }

  reset(): EnvironmentState {
    this.agentPos = 0
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
    let actualAction = action

    if (this.slippery) {
      const rand = Math.random()
      if (rand < 1 / 3) {
        actualAction = action
      } else if (rand < 2 / 3) {
        actualAction = (action + 1) % 4
      } else {
        actualAction = (action + 3) % 4
      }
    }

    const row = Math.floor(this.agentPos / this.gridSize)
    const col = this.agentPos % this.gridSize
    let newRow = row
    let newCol = col

    switch (actualAction) {
      case 0:
        newCol = Math.max(0, col - 1)
        break
      case 1:
        newRow = Math.min(this.gridSize - 1, row + 1)
        break
      case 2:
        newCol = Math.min(this.gridSize - 1, col + 1)
        break
      case 3:
        newRow = Math.max(0, row - 1)
        break
    }

    this.agentPos = newRow * this.gridSize + newCol
    this.state = this.posToState(this.agentPos)
    this.stepCount++

    const cell = this.map[newRow][newCol]
    let reward = 0

    if (cell === 'H') {
      this.done = true
      reward = 0
    } else if (cell === 'G') {
      this.done = true
      reward = 1
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

  private posToState(pos: number): number[] {
    const state = new Array(this.gridSize * this.gridSize).fill(0)
    state[pos] = 1
    return state
  }

  render(): string {
    let display = ''

    for (let row = 0; row < this.gridSize; row++) {
      let line = ''
      for (let col = 0; col < this.gridSize; col++) {
        const pos = row * this.gridSize + col
        if (pos === this.agentPos) {
          line += 'A '
        } else {
          line += this.map[row][col] + ' '
        }
      }
      display += line + '\n'
    }

    display += `Step: ${this.stepCount}, Done: ${this.done}`
    display += `\nS=Start, F=Frozen, H=Hole, G=Goal, A=Agent`
    return display
  }
}
