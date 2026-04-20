import type { EnvironmentState, EnvironmentSpec } from '../types'
import { BaseEnvironment } from './base'

export class CartPoleEnvironment extends BaseEnvironment {
  private gravity: number
  private massCart: number
  private massPole: number
  private length: number
  private forceMag: number
  private tau: number

  private thetaThreshold: number
  private xThreshold: number

  constructor(maxSteps: number = 500) {
    super(maxSteps)
    this.gravity = 9.8
    this.massCart = 1.0
    this.massPole = 0.1
    this.length = 0.5
    this.forceMag = 10.0
    this.tau = 0.02

    this.thetaThreshold = (12 * Math.PI) / 180
    this.xThreshold = 2.4
  }

  reset(): EnvironmentState {
    this.state = [
      (Math.random() - 0.5) * 0.1,
      (Math.random() - 0.5) * 0.1,
      (Math.random() - 0.5) * 0.1,
      (Math.random() - 0.5) * 0.1,
    ]
    this.done = false
    this.stepCount = 0

    return {
      observation: this.getObservation(),
      reward: 0,
      done: false,
    }
  }

  step(action: number): EnvironmentState {
    const [x, xDot, theta, thetaDot] = this.state
    const force = action === 1 ? this.forceMag : -this.forceMag

    const cosTheta = Math.cos(theta)
    const sinTheta = Math.sin(theta)

    const totalMass = this.massCart + this.massPole
    const poleMassLength = this.massPole * this.length

    const temp = (force + poleMassLength * thetaDot * thetaDot * sinTheta) / totalMass
    const thetaAcc =
      (this.gravity * sinTheta - cosTheta * temp) /
      (this.length * (4 / 3 - (this.massPole * cosTheta * cosTheta) / totalMass))
    const xAcc = temp - (poleMassLength * thetaAcc * cosTheta) / totalMass

    this.state = [
      x + this.tau * xDot,
      xDot + this.tau * xAcc,
      theta + this.tau * thetaDot,
      thetaDot + this.tau * thetaAcc,
    ]

    this.stepCount++

    const [newX, , newTheta] = this.state
    this.done =
      newX < -this.xThreshold ||
      newX > this.xThreshold ||
      newTheta < -this.thetaThreshold ||
      newTheta > this.thetaThreshold

    const reward = this.done ? 0 : 1

    return {
      observation: this.getObservation(),
      reward,
      done: this.checkDone(),
    }
  }

  getSpec(): EnvironmentSpec {
    return {
      observationDim: 4,
      actionDim: 2,
      discreteActions: true,
      maxSteps: this.maxSteps,
    }
  }

  render(): string {
    const [x, , theta] = this.state
    const width = 40
    const cartPos = Math.round((x / this.xThreshold + 1) * (width / 2))
    const poleAngle = Math.round((theta / this.thetaThreshold) * 5)

    let display = ''
    display += '-'.repeat(width + 2) + '\n'

    const poleChar = poleAngle > 2 ? '/' : poleAngle < -2 ? '\\' : '|'
    const poleLine = ' '.repeat(Math.max(0, cartPos)) + poleChar + '\n'
    display += poleLine

    const cartLine = ' '.repeat(Math.max(0, cartPos - 1)) + '[=]' + '\n'
    display += cartLine

    display += '-'.repeat(width + 2) + '\n'
    display += `Step: ${this.stepCount}, Done: ${this.done}`

    return display
  }
}
