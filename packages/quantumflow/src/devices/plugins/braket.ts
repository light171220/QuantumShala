import { QTensor } from '../../core/tensor'
import { QuantumTape, TapeOperation } from '../../autodiff/tape'
import { Device, DeviceCapabilities, ExecutionConfig, DevicePlugin, registerDevice } from '../base-device'
import { Observable } from '../../circuit/operations/observables'

export interface BraketConfig {
  awsAccessKeyId?: string
  awsSecretAccessKey?: string
  awsSessionToken?: string
  region?: string
  s3Bucket?: string
  s3Prefix?: string
}

export interface BraketDeviceArn {
  provider: 'rigetti' | 'ionq' | 'oqc' | 'xanadu' | 'amazon'
  device: string
  region?: string
}

export interface BraketTask {
  taskId: string
  status: 'CREATED' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLING' | 'CANCELLED'
  deviceArn: string
  shots: number
  createdAt: Date
  endedAt?: Date
  result?: any
  failureReason?: string
}

export class AmazonBraketDevice extends Device {
  private _config: BraketConfig
  private _deviceArn: string
  private _tasks: Map<string, BraketTask>
  private _region: string
  private _s3Bucket: string
  private _s3Prefix: string
  private _isLocalSimulator: boolean

  constructor(options: {
    wires?: number
    shots?: number | null
    config?: BraketConfig
    deviceArn?: string | BraketDeviceArn
    region?: string
  } = {}) {
    super('braket.aws', options)
    this._config = options.config ?? {}
    this._region = options.region ?? this._config.region ?? 'us-east-1'
    this._s3Bucket = this._config.s3Bucket ?? ''
    this._s3Prefix = this._config.s3Prefix ?? 'amazon-braket-results'
    this._tasks = new Map()

    if (typeof options.deviceArn === 'string') {
      this._deviceArn = options.deviceArn
    } else if (options.deviceArn) {
      this._deviceArn = this._buildDeviceArn(options.deviceArn)
    } else {
      this._deviceArn = 'arn:aws:braket:::device/quantum-simulator/amazon/sv1'
    }

    this._isLocalSimulator = this._deviceArn.includes('local')
  }

  private _buildDeviceArn(arn: BraketDeviceArn): string {
    const region = arn.region ?? this._region

    const providerMap: Record<string, string> = {
      'rigetti': 'rigetti',
      'ionq': 'ionq',
      'oqc': 'oqc',
      'xanadu': 'xanadu',
      'amazon': 'amazon'
    }

    const provider = providerMap[arn.provider] ?? 'amazon'

    if (arn.device.includes('simulator')) {
      return `arn:aws:braket:::device/quantum-simulator/${provider}/${arn.device}`
    }

    return `arn:aws:braket:${region}::device/qpu/${provider}/${arn.device}`
  }

  get capabilities(): DeviceCapabilities {
    if (this._deviceArn.includes('sv1') || this._deviceArn.includes('dm1')) {
      return {
        supportsAdjoint: true,
        supportsBackprop: false,
        supportsBatchExecution: true,
        supportsDerivatives: true,
        maxWires: 34,
        nativeGates: [
          'I', 'X', 'Y', 'Z', 'H', 'S', 'T', 'V', 'Si', 'Ti', 'Vi',
          'RX', 'RY', 'RZ', 'PhaseShift', 'U',
          'CNOT', 'CX', 'CY', 'CZ', 'SWAP', 'ISWAP', 'CSWAP',
          'XY', 'XX', 'YY', 'ZZ',
          'CCX', 'Toffoli'
        ],
        supportedObservables: [
          'PauliX', 'PauliY', 'PauliZ', 'Identity', 'Hadamard', 'Hermitian', 'Tensor'
        ]
      }
    }

    if (this._deviceArn.includes('tn1')) {
      return {
        supportsAdjoint: false,
        supportsBackprop: false,
        supportsBatchExecution: true,
        supportsDerivatives: false,
        maxWires: 50,
        nativeGates: [
          'I', 'X', 'Y', 'Z', 'H', 'S', 'T',
          'RX', 'RY', 'RZ', 'PhaseShift',
          'CNOT', 'CZ', 'SWAP'
        ],
        supportedObservables: [
          'PauliX', 'PauliY', 'PauliZ', 'Identity'
        ]
      }
    }

    if (this._deviceArn.includes('ionq')) {
      return {
        supportsAdjoint: false,
        supportsBackprop: false,
        supportsBatchExecution: false,
        supportsDerivatives: true,
        maxWires: 11,
        nativeGates: [
          'X', 'Y', 'Z', 'H', 'S', 'T', 'Si', 'Ti',
          'RX', 'RY', 'RZ', 'V', 'Vi',
          'XX', 'YY', 'ZZ', 'CNOT', 'SWAP'
        ],
        supportedObservables: [
          'PauliX', 'PauliY', 'PauliZ', 'Identity'
        ]
      }
    }

    if (this._deviceArn.includes('rigetti')) {
      return {
        supportsAdjoint: false,
        supportsBackprop: false,
        supportsBatchExecution: true,
        supportsDerivatives: true,
        maxWires: 80,
        nativeGates: [
          'RX', 'RZ', 'CZ', 'XY', 'CPHASE'
        ],
        supportedObservables: [
          'PauliZ', 'Identity'
        ]
      }
    }

    if (this._deviceArn.includes('oqc')) {
      return {
        supportsAdjoint: false,
        supportsBackprop: false,
        supportsBatchExecution: false,
        supportsDerivatives: true,
        maxWires: 8,
        nativeGates: [
          'RZ', 'SX', 'ECR'
        ],
        supportedObservables: [
          'PauliZ', 'Identity'
        ]
      }
    }

    return {
      supportsAdjoint: false,
      supportsBackprop: false,
      supportsBatchExecution: true,
      supportsDerivatives: true,
      maxWires: 30,
      nativeGates: [
        'X', 'Y', 'Z', 'H', 'S', 'T',
        'RX', 'RY', 'RZ', 'PhaseShift',
        'CNOT', 'CZ', 'SWAP', 'ISWAP'
      ],
      supportedObservables: [
        'PauliX', 'PauliY', 'PauliZ', 'Identity', 'Hermitian'
      ]
    }
  }

  get deviceArn(): string {
    return this._deviceArn
  }

  set deviceArn(value: string) {
    this._deviceArn = value
    this._isLocalSimulator = value.includes('local')
  }

  execute(tape: QuantumTape, config?: ExecutionConfig): number | number[] | QTensor {
    const openQasm = this.tapeToOpenQASM3(tape)
    const shots = config?.shots ?? this._shots ?? 1000

    console.log('Amazon Braket execution (simulated):')
    console.log('Device ARN:', this._deviceArn)
    console.log('Shots:', shots)
    console.log('OpenQASM 3.0:', openQasm)

    const measurements = tape.getMeasurements()
    if (measurements.length === 0) {
      return QTensor.zeros([1 << tape.numWires], { dtype: 'complex128' })
    }

    const results: (number | number[])[] = []

    for (const measurement of measurements) {
      switch (measurement.operation.name) {
        case 'expval':
          results.push(Math.random() * 2 - 1)
          break
        case 'probs': {
          const numOutcomes = 1 << measurement.operation.wires.length
          const probs = new Array(numOutcomes).fill(0)
          let sum = 0
          for (let i = 0; i < numOutcomes; i++) {
            probs[i] = Math.random()
            sum += probs[i]
          }
          for (let i = 0; i < numOutcomes; i++) {
            probs[i] /= sum
          }
          results.push(probs)
          break
        }
        case 'counts': {
          const numOutcomes = 1 << measurement.operation.wires.length
          const counts = new Array(numOutcomes).fill(0)
          for (let i = 0; i < shots; i++) {
            const outcome = Math.floor(Math.random() * numOutcomes)
            counts[outcome]++
          }
          results.push(counts)
          break
        }
        case 'sample': {
          const samples: number[] = []
          const numQubits = measurement.operation.wires.length
          for (let i = 0; i < shots; i++) {
            samples.push(Math.floor(Math.random() * (1 << numQubits)))
          }
          results.push(samples)
          break
        }
      }
    }

    if (results.length === 1) {
      const result = results[0]
      return typeof result === 'number' ? result : result
    }

    return results.flat()
  }

  async executeAsync(tape: QuantumTape, config?: ExecutionConfig): Promise<BraketTask> {
    const taskId = `arn:aws:braket:${this._region}:${Date.now()}:quantum-task/${this._generateUUID()}`
    const shots = config?.shots ?? this._shots ?? 1000

    const task: BraketTask = {
      taskId,
      status: 'CREATED',
      deviceArn: this._deviceArn,
      shots,
      createdAt: new Date()
    }

    this._tasks.set(taskId, task)

    setTimeout(() => {
      task.status = 'QUEUED'
    }, 50)

    setTimeout(() => {
      task.status = 'RUNNING'
    }, 100)

    setTimeout(() => {
      task.status = 'COMPLETED'
      task.endedAt = new Date()
      task.result = this.execute(tape, config)
    }, 500)

    return task
  }

  private _generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  async getTaskStatus(taskId: string): Promise<BraketTask | null> {
    return this._tasks.get(taskId) ?? null
  }

  async waitForTask(taskId: string, pollInterval: number = 1000, timeout: number = 300000): Promise<any> {
    const startTime = Date.now()

    return new Promise((resolve, reject) => {
      const poll = async () => {
        const task = this._tasks.get(taskId)
        if (!task) {
          reject(new Error(`Task ${taskId} not found`))
          return
        }

        if (task.status === 'COMPLETED') {
          resolve(task.result)
          return
        }

        if (task.status === 'FAILED') {
          reject(new Error(task.failureReason ?? 'Task failed'))
          return
        }

        if (task.status === 'CANCELLED') {
          reject(new Error('Task was cancelled'))
          return
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error('Task timeout'))
          return
        }

        setTimeout(poll, pollInterval)
      }

      poll()
    })
  }

  async cancelTask(taskId: string): Promise<void> {
    const task = this._tasks.get(taskId)
    if (task && (task.status === 'QUEUED' || task.status === 'RUNNING')) {
      task.status = 'CANCELLING'
      setTimeout(() => {
        task.status = 'CANCELLED'
      }, 100)
    }
  }

  private tapeToOpenQASM3(tape: QuantumTape): string {
    const lines: string[] = []
    lines.push('OPENQASM 3.0;')
    lines.push('')
    lines.push(`qubit[${tape.numWires}] q;`)

    const measurements = tape.getMeasurements()
    const needsClassicalBits = measurements.some(m =>
      m.operation.name === 'sample' || m.operation.name === 'counts'
    )

    if (needsClassicalBits) {
      lines.push(`bit[${tape.numWires}] c;`)
    }

    lines.push('')

    for (const record of tape.operations) {
      const op = record.operation
      if (op.type !== 'gate') continue

      const wireDef = op.wires.map(w => `q[${w}]`).join(', ')
      const inverseStr = op.inverse ? 'inv @ ' : ''

      switch (op.name) {
        case 'PauliX':
        case 'X':
          lines.push(`${inverseStr}x ${wireDef};`)
          break
        case 'PauliY':
        case 'Y':
          lines.push(`${inverseStr}y ${wireDef};`)
          break
        case 'PauliZ':
        case 'Z':
          lines.push(`${inverseStr}z ${wireDef};`)
          break
        case 'Hadamard':
        case 'H':
          lines.push(`${inverseStr}h ${wireDef};`)
          break
        case 'S':
          lines.push(`${inverseStr}s ${wireDef};`)
          break
        case 'T':
          lines.push(`${inverseStr}t ${wireDef};`)
          break
        case 'SX':
          lines.push(`${inverseStr}sx ${wireDef};`)
          break
        case 'RX':
          lines.push(`${inverseStr}rx(${op.params[0]}) ${wireDef};`)
          break
        case 'RY':
          lines.push(`${inverseStr}ry(${op.params[0]}) ${wireDef};`)
          break
        case 'RZ':
          lines.push(`${inverseStr}rz(${op.params[0]}) ${wireDef};`)
          break
        case 'PhaseShift':
          lines.push(`${inverseStr}phaseshift(${op.params[0]}) ${wireDef};`)
          break
        case 'Rot':
          lines.push(`${inverseStr}rz(${op.params[0]}) ${wireDef};`)
          lines.push(`${inverseStr}ry(${op.params[1]}) ${wireDef};`)
          lines.push(`${inverseStr}rz(${op.params[2]}) ${wireDef};`)
          break
        case 'U3':
          lines.push(`${inverseStr}u3(${op.params[0]}, ${op.params[1]}, ${op.params[2]}) ${wireDef};`)
          break
        case 'CNOT':
        case 'CX':
          lines.push(`${inverseStr}cnot q[${op.wires[0]}], q[${op.wires[1]}];`)
          break
        case 'CY':
          lines.push(`${inverseStr}cy q[${op.wires[0]}], q[${op.wires[1]}];`)
          break
        case 'CZ':
          lines.push(`${inverseStr}cz q[${op.wires[0]}], q[${op.wires[1]}];`)
          break
        case 'SWAP':
          lines.push(`${inverseStr}swap q[${op.wires[0]}], q[${op.wires[1]}];`)
          break
        case 'ISWAP':
          lines.push(`${inverseStr}iswap q[${op.wires[0]}], q[${op.wires[1]}];`)
          break
        case 'CRX':
          lines.push(`${inverseStr}crx(${op.params[0]}) q[${op.wires[0]}], q[${op.wires[1]}];`)
          break
        case 'CRY':
          lines.push(`${inverseStr}cry(${op.params[0]}) q[${op.wires[0]}], q[${op.wires[1]}];`)
          break
        case 'CRZ':
          lines.push(`${inverseStr}crz(${op.params[0]}) q[${op.wires[0]}], q[${op.wires[1]}];`)
          break
        case 'RXX':
        case 'XX':
          lines.push(`${inverseStr}xx(${op.params[0]}) q[${op.wires[0]}], q[${op.wires[1]}];`)
          break
        case 'RYY':
        case 'YY':
          lines.push(`${inverseStr}yy(${op.params[0]}) q[${op.wires[0]}], q[${op.wires[1]}];`)
          break
        case 'RZZ':
        case 'ZZ':
          lines.push(`${inverseStr}zz(${op.params[0]}) q[${op.wires[0]}], q[${op.wires[1]}];`)
          break
        case 'XY':
          lines.push(`${inverseStr}xy(${op.params[0]}) q[${op.wires[0]}], q[${op.wires[1]}];`)
          break
        case 'Toffoli':
        case 'CCX':
          lines.push(`${inverseStr}ccnot q[${op.wires[0]}], q[${op.wires[1]}], q[${op.wires[2]}];`)
          break
        case 'CSWAP':
        case 'Fredkin':
          lines.push(`${inverseStr}cswap q[${op.wires[0]}], q[${op.wires[1]}], q[${op.wires[2]}];`)
          break
        default:
          lines.push(`// Unsupported gate: ${op.name}`)
      }
    }

    if (measurements.length > 0) {
      lines.push('')
      for (const m of measurements) {
        if (m.operation.name === 'sample' || m.operation.name === 'counts') {
          for (const wire of m.operation.wires) {
            lines.push(`c[${wire}] = measure q[${wire}];`)
          }
        }
      }
    }

    return lines.join('\n')
  }

  async getAvailableDevices(): Promise<Array<{ name: string; arn: string; status: string }>> {
    return [
      { name: 'SV1', arn: 'arn:aws:braket:::device/quantum-simulator/amazon/sv1', status: 'AVAILABLE' },
      { name: 'DM1', arn: 'arn:aws:braket:::device/quantum-simulator/amazon/dm1', status: 'AVAILABLE' },
      { name: 'TN1', arn: 'arn:aws:braket:::device/quantum-simulator/amazon/tn1', status: 'AVAILABLE' },
      { name: 'Aria 1', arn: 'arn:aws:braket:us-east-1::device/qpu/ionq/Aria-1', status: 'AVAILABLE' },
      { name: 'Aria 2', arn: 'arn:aws:braket:us-east-1::device/qpu/ionq/Aria-2', status: 'AVAILABLE' },
      { name: 'Forte 1', arn: 'arn:aws:braket:us-east-1::device/qpu/ionq/Forte-1', status: 'AVAILABLE' },
      { name: 'Aspen-M-3', arn: 'arn:aws:braket:us-west-1::device/qpu/rigetti/Aspen-M-3', status: 'AVAILABLE' },
      { name: 'Ankaa-2', arn: 'arn:aws:braket:us-west-1::device/qpu/rigetti/Ankaa-2', status: 'AVAILABLE' },
      { name: 'Lucy', arn: 'arn:aws:braket:eu-west-2::device/qpu/oqc/Lucy', status: 'AVAILABLE' },
      { name: 'Borealis', arn: 'arn:aws:braket:us-east-1::device/qpu/xanadu/Borealis', status: 'AVAILABLE' }
    ]
  }

  async getDeviceStatus(): Promise<{
    status: string
    queueDepth: number
    availability: string
  }> {
    return {
      status: 'ONLINE',
      queueDepth: Math.floor(Math.random() * 50),
      availability: 'Available'
    }
  }

  async getDeviceProperties(): Promise<{
    paradigm: string
    qubitCount: number
    connectivity: string
    nativeGateSet: string[]
  }> {
    if (this._deviceArn.includes('ionq')) {
      return {
        paradigm: 'trapped-ion',
        qubitCount: 11,
        connectivity: 'all-to-all',
        nativeGateSet: ['GPI', 'GPI2', 'MS']
      }
    }

    if (this._deviceArn.includes('rigetti')) {
      return {
        paradigm: 'superconducting',
        qubitCount: 80,
        connectivity: 'grid',
        nativeGateSet: ['RX', 'RZ', 'CZ', 'XY']
      }
    }

    if (this._deviceArn.includes('oqc')) {
      return {
        paradigm: 'superconducting',
        qubitCount: 8,
        connectivity: 'ring',
        nativeGateSet: ['RZ', 'SX', 'ECR']
      }
    }

    return {
      paradigm: 'simulator',
      qubitCount: 34,
      connectivity: 'full',
      nativeGateSet: this.capabilities.nativeGates
    }
  }

  reset(): void {
    this._tasks.clear()
  }

  applyOperation(op: TapeOperation): void {
    throw new Error('Direct state manipulation not supported for Amazon Braket')
  }

  measure(observable: Observable, wires: number[]): number {
    throw new Error('Direct measurement not supported for Amazon Braket')
  }

  sampleCircuit(shots: number): number[][] {
    throw new Error('Direct sampling not supported for Amazon Braket')
  }

  getProbabilities(wires?: number[]): number[] {
    throw new Error('Direct probability access not supported for Amazon Braket')
  }

  getStateVector(): QTensor {
    throw new Error('State vector not accessible for Amazon Braket')
  }
}

export class LocalBraketSimulator extends AmazonBraketDevice {
  constructor(options: { wires?: number; shots?: number | null } = {}) {
    super({
      ...options,
      deviceArn: 'local:braket/default'
    })
  }

  get capabilities(): DeviceCapabilities {
    return {
      supportsAdjoint: true,
      supportsBackprop: true,
      supportsBatchExecution: true,
      supportsDerivatives: true,
      maxWires: 28,
      nativeGates: [
        'I', 'X', 'Y', 'Z', 'H', 'S', 'T', 'V', 'Si', 'Ti', 'Vi',
        'RX', 'RY', 'RZ', 'PhaseShift', 'U', 'Rot',
        'CNOT', 'CX', 'CY', 'CZ', 'SWAP', 'ISWAP', 'CSWAP',
        'XY', 'XX', 'YY', 'ZZ',
        'CCX', 'Toffoli', 'CCZ'
      ],
      supportedObservables: [
        'PauliX', 'PauliY', 'PauliZ', 'Identity', 'Hadamard', 'Hermitian', 'Tensor', 'Hamiltonian'
      ]
    }
  }
}

export const braketPlugin: DevicePlugin = {
  name: 'braket',
  version: '0.1.0',
  devices: new Map([
    ['braket.aws', AmazonBraketDevice],
    ['braket.sv1', class extends AmazonBraketDevice {
      constructor(options: any = {}) {
        super({ ...options, deviceArn: 'arn:aws:braket:::device/quantum-simulator/amazon/sv1' })
      }
    }],
    ['braket.dm1', class extends AmazonBraketDevice {
      constructor(options: any = {}) {
        super({ ...options, deviceArn: 'arn:aws:braket:::device/quantum-simulator/amazon/dm1' })
      }
    }],
    ['braket.tn1', class extends AmazonBraketDevice {
      constructor(options: any = {}) {
        super({ ...options, deviceArn: 'arn:aws:braket:::device/quantum-simulator/amazon/tn1' })
      }
    }],
    ['braket.ionq', class extends AmazonBraketDevice {
      constructor(options: any = {}) {
        super({ ...options, deviceArn: 'arn:aws:braket:us-east-1::device/qpu/ionq/Aria-1' })
      }
    }],
    ['braket.rigetti', class extends AmazonBraketDevice {
      constructor(options: any = {}) {
        super({ ...options, deviceArn: 'arn:aws:braket:us-west-1::device/qpu/rigetti/Ankaa-2' })
      }
    }],
    ['braket.oqc', class extends AmazonBraketDevice {
      constructor(options: any = {}) {
        super({ ...options, deviceArn: 'arn:aws:braket:eu-west-2::device/qpu/oqc/Lucy' })
      }
    }],
    ['braket.local', LocalBraketSimulator]
  ]),
  register(): void {
    for (const [name, deviceClass] of this.devices) {
      registerDevice(name, deviceClass)
    }
  }
}

braketPlugin.register()
