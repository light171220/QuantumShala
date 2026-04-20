import type { EnvironmentState, EnvironmentSpec } from '../types'

export interface Environment {
  reset(): EnvironmentState
  step(action: number): EnvironmentState
  getSpec(): EnvironmentSpec
  render?(): string
}

export abstract class BaseEnvironment implements Environment {
  protected state: number[]
  protected done: boolean
  protected stepCount: number
  protected maxSteps: number

  constructor(maxSteps: number = 200) {
    this.state = []
    this.done = false
    this.stepCount = 0
    this.maxSteps = maxSteps
  }

  abstract reset(): EnvironmentState
  abstract step(action: number): EnvironmentState
  abstract getSpec(): EnvironmentSpec

  protected getObservation(): number[] {
    return [...this.state]
  }

  protected checkDone(): boolean {
    return this.done || this.stepCount >= this.maxSteps
  }
}
