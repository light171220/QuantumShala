import type {
  QuantumCircuit,
  CircuitGate,
  Complex,
  BlochVector,
  DebuggerSnapshot,
  DebuggerState,
} from '@/types/simulator'
import { QuantumSimulator } from './simulator'

export type { DebuggerSnapshot, DebuggerState } from '@/types/simulator'

export const DEFAULT_DEBUGGER_STATE: DebuggerState = {
  isActive: false,
  currentStep: -1,
  totalSteps: 0,
  isPlaying: false,
  playbackSpeed: 1,
  breakpoints: new Set(),
  snapshots: [],
  highlightedGateId: null,
}

export class CircuitDebugger {
  private circuit: QuantumCircuit
  private simulator: QuantumSimulator
  private sortedGates: CircuitGate[]
  private snapshots: DebuggerSnapshot[]
  private currentStep: number
  private breakpoints: Set<number>
  private isPlaying: boolean
  private playbackSpeed: number
  private playbackTimer: ReturnType<typeof setTimeout> | null

  constructor(circuit: QuantumCircuit) {
    this.circuit = circuit
    this.simulator = new QuantumSimulator(circuit.numQubits)
    this.sortedGates = [...circuit.gates].sort((a, b) => a.position - b.position)
    this.snapshots = []
    this.currentStep = -1
    this.breakpoints = new Set()
    this.isPlaying = false
    this.playbackSpeed = 1
    this.playbackTimer = null

    this.captureInitialSnapshot()
  }

  private captureInitialSnapshot(): void {
    const snapshot = this.captureSnapshot(null)
    this.snapshots.push(snapshot)
  }

  private captureSnapshot(gate: CircuitGate | null): DebuggerSnapshot {
    const stateVector = this.simulator.getStateVector()
    const probabilities = this.calculateProbabilities(stateVector)
    const blochVectors: BlochVector[] = []

    for (let q = 0; q < this.circuit.numQubits; q++) {
      blochVectors.push(this.simulator.getBlochVector(q))
    }

    return {
      stepIndex: this.currentStep,
      gateApplied: gate,
      stateVector,
      probabilities,
      blochVectors,
      timestamp: Date.now(),
    }
  }

  private calculateProbabilities(stateVector: Complex[]): Record<string, number> {
    const probs: Record<string, number> = {}
    const numQubits = this.circuit.numQubits

    for (let i = 0; i < stateVector.length; i++) {
      const amplitude = stateVector[i]
      const prob = amplitude.re * amplitude.re + amplitude.im * amplitude.im

      if (prob > 1e-10) {
        const bitString = i.toString(2).padStart(numQubits, '0')
        probs[bitString] = prob
      }
    }

    return probs
  }

  reset(): void {
    this.simulator = new QuantumSimulator(this.circuit.numQubits)
    this.currentStep = -1
    this.snapshots = []
    this.captureInitialSnapshot()
    this.stopPlayback()
  }

  stepForward(): DebuggerSnapshot | null {
    if (this.currentStep >= this.sortedGates.length - 1) {
      return null
    }

    this.currentStep++
    const gate = this.sortedGates[this.currentStep]
    this.simulator.applyGate(gate)

    const snapshot = this.captureSnapshot(gate)
    this.snapshots.push(snapshot)

    return snapshot
  }

  stepBackward(): DebuggerSnapshot | null {
    if (this.currentStep < 0) {
      return null
    }

    this.currentStep--
    this.simulator = new QuantumSimulator(this.circuit.numQubits)

    for (let i = 0; i <= this.currentStep; i++) {
      this.simulator.applyGate(this.sortedGates[i])
    }

    if (this.currentStep >= 0 && this.snapshots.length > this.currentStep + 1) {
      return this.snapshots[this.currentStep + 1]
    }

    return this.captureSnapshot(
      this.currentStep >= 0 ? this.sortedGates[this.currentStep] : null
    )
  }

  jumpToStep(step: number): DebuggerSnapshot | null {
    if (step < -1 || step >= this.sortedGates.length) {
      return null
    }

    this.currentStep = -1
    this.simulator = new QuantumSimulator(this.circuit.numQubits)
    this.snapshots = []
    this.captureInitialSnapshot()

    while (this.currentStep < step) {
      this.stepForward()
    }

    return this.getCurrentSnapshot()
  }

  jumpToStart(): DebuggerSnapshot {
    this.reset()
    return this.snapshots[0]
  }

  jumpToEnd(): DebuggerSnapshot | null {
    return this.jumpToStep(this.sortedGates.length - 1)
  }

  startPlayback(onStep?: (snapshot: DebuggerSnapshot) => void): void {
    if (this.isPlaying) return

    this.isPlaying = true
    this.runPlaybackStep(onStep)
  }

  private runPlaybackStep(onStep?: (snapshot: DebuggerSnapshot) => void): void {
    if (!this.isPlaying) return

    if (this.currentStep >= this.sortedGates.length - 1) {
      this.stopPlayback()
      return
    }

    const snapshot = this.stepForward()
    if (snapshot && onStep) {
      onStep(snapshot)
    }

    if (this.breakpoints.has(this.currentStep)) {
      this.stopPlayback()
      return
    }

    const delay = 1000 / this.playbackSpeed
    this.playbackTimer = setTimeout(() => this.runPlaybackStep(onStep), delay)
  }

  stopPlayback(): void {
    this.isPlaying = false
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer)
      this.playbackTimer = null
    }
  }

  togglePlayback(onStep?: (snapshot: DebuggerSnapshot) => void): void {
    if (this.isPlaying) {
      this.stopPlayback()
    } else {
      this.startPlayback(onStep)
    }
  }

  setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = Math.max(0.25, Math.min(4, speed))
  }

  addBreakpoint(step: number): void {
    if (step >= 0 && step < this.sortedGates.length) {
      this.breakpoints.add(step)
    }
  }

  removeBreakpoint(step: number): void {
    this.breakpoints.delete(step)
  }

  toggleBreakpoint(step: number): void {
    if (this.breakpoints.has(step)) {
      this.removeBreakpoint(step)
    } else {
      this.addBreakpoint(step)
    }
  }

  hasBreakpoint(step: number): boolean {
    return this.breakpoints.has(step)
  }

  getBreakpoints(): number[] {
    return Array.from(this.breakpoints).sort((a, b) => a - b)
  }

  clearBreakpoints(): void {
    this.breakpoints.clear()
  }

  getCurrentSnapshot(): DebuggerSnapshot | null {
    if (this.snapshots.length === 0) return null
    return this.snapshots[this.snapshots.length - 1]
  }

  getAllSnapshots(): DebuggerSnapshot[] {
    return [...this.snapshots]
  }

  getState(): DebuggerState {
    return {
      isActive: true,
      currentStep: this.currentStep,
      totalSteps: this.sortedGates.length,
      isPlaying: this.isPlaying,
      playbackSpeed: this.playbackSpeed,
      breakpoints: new Set(this.breakpoints),
      snapshots: this.snapshots,
      highlightedGateId: this.currentStep >= 0 ? this.sortedGates[this.currentStep]?.id ?? null : null,
    }
  }

  getCurrentGate(): CircuitGate | null {
    if (this.currentStep < 0 || this.currentStep >= this.sortedGates.length) {
      return null
    }
    return this.sortedGates[this.currentStep]
  }

  getNextGate(): CircuitGate | null {
    const nextStep = this.currentStep + 1
    if (nextStep >= this.sortedGates.length) {
      return null
    }
    return this.sortedGates[nextStep]
  }

  getProgress(): { current: number; total: number; percent: number } {
    return {
      current: this.currentStep + 1,
      total: this.sortedGates.length,
      percent:
        this.sortedGates.length > 0
          ? ((this.currentStep + 1) / this.sortedGates.length) * 100
          : 0,
    }
  }

  getStateVectorAtStep(step: number): Complex[] | null {
    if (step < -1 || step >= this.sortedGates.length) {
      return null
    }

    const sim = new QuantumSimulator(this.circuit.numQubits)
    for (let i = 0; i <= step; i++) {
      sim.applyGate(this.sortedGates[i])
    }

    return sim.getStateVector()
  }

  compareStates(step1: number, step2: number): {
    fidelity: number
    overlapReal: number
    overlapImag: number
  } | null {
    const sv1 = this.getStateVectorAtStep(step1)
    const sv2 = this.getStateVectorAtStep(step2)

    if (!sv1 || !sv2) return null

    let overlapReal = 0
    let overlapImag = 0

    for (let i = 0; i < sv1.length; i++) {
      overlapReal += sv1[i].re * sv2[i].re + sv1[i].im * sv2[i].im
      overlapImag += sv1[i].re * sv2[i].im - sv1[i].im * sv2[i].re
    }

    const fidelity = overlapReal * overlapReal + overlapImag * overlapImag

    return { fidelity, overlapReal, overlapImag }
  }
}

export function createDebugger(circuit: QuantumCircuit): CircuitDebugger {
  return new CircuitDebugger(circuit)
}

export function formatAmplitude(c: Complex, precision: number = 4): string {
  const re = c.re.toFixed(precision)
  const im = c.im.toFixed(precision)

  if (Math.abs(c.im) < 1e-10) {
    return re
  }
  if (Math.abs(c.re) < 1e-10) {
    return `${im}i`
  }
  if (c.im >= 0) {
    return `${re} + ${im}i`
  }
  return `${re} - ${Math.abs(c.im).toFixed(precision)}i`
}

export function formatProbability(prob: number, precision: number = 2): string {
  return `${(prob * 100).toFixed(precision)}%`
}

export function getSignificantStates(
  stateVector: Complex[],
  threshold: number = 1e-6
): Array<{ index: number; bitString: string; amplitude: Complex; probability: number }> {
  const numQubits = Math.log2(stateVector.length)
  const states: Array<{ index: number; bitString: string; amplitude: Complex; probability: number }> = []

  for (let i = 0; i < stateVector.length; i++) {
    const amp = stateVector[i]
    const prob = amp.re * amp.re + amp.im * amp.im

    if (prob > threshold) {
      states.push({
        index: i,
        bitString: i.toString(2).padStart(numQubits, '0'),
        amplitude: amp,
        probability: prob,
      })
    }
  }

  return states.sort((a, b) => b.probability - a.probability)
}
