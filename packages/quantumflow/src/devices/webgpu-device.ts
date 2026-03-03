import { QTensor } from '../core/tensor'
import { Complex } from '../core/complex'
import { QuantumTape, TapeOperation } from '../autodiff/tape'
import { QubitDevice, DeviceCapabilities, ExecutionConfig, registerDevice } from './base-device'
import { Observable, PauliZObservable } from '../circuit/operations/observables'
import { getGate } from '../circuit/operations/gates'

interface GPUState {
  device: GPUDevice | null
  adapter: GPUAdapter | null
  stateBuffer: GPUBuffer | null
  scratchBuffer: GPUBuffer | null
  uniformBuffer: GPUBuffer | null
  pipelines: Map<string, GPUComputePipeline>
  bindGroupLayout: GPUBindGroupLayout | null
  initialized: boolean
}

const WORKGROUP_SIZE = 256

export class WebGPUStateVectorDevice extends QubitDevice {
  private _gpu: GPUState
  private _fallbackDevice: QubitDevice | null

  constructor(options: { wires?: number; shots?: number | null; seed?: number } = {}) {
    super('webgpu.state', options)

    this._gpu = {
      device: null,
      adapter: null,
      stateBuffer: null,
      scratchBuffer: null,
      uniformBuffer: null,
      pipelines: new Map(),
      bindGroupLayout: null,
      initialized: false
    }

    this._fallbackDevice = null
  }

  get capabilities(): DeviceCapabilities {
    return {
      supportsAdjoint: true,
      supportsBackprop: false,
      supportsBatchExecution: true,
      supportsDerivatives: true,
      maxWires: 30,
      nativeGates: [
        'PauliX', 'PauliY', 'PauliZ', 'Hadamard', 'S', 'T', 'SX',
        'RX', 'RY', 'RZ', 'PhaseShift', 'Rot', 'U3',
        'CNOT', 'CY', 'CZ', 'SWAP', 'ISWAP',
        'CRX', 'CRY', 'CRZ', 'RXX', 'RYY', 'RZZ',
        'Toffoli', 'CSWAP',
        'X', 'Y', 'Z', 'H', 'CX', 'CCX', 'Fredkin'
      ],
      supportedObservables: [
        'PauliX', 'PauliY', 'PauliZ', 'Identity', 'Hadamard', 'Hermitian', 'Tensor', 'Hamiltonian'
      ]
    }
  }

  private async initGPU(): Promise<boolean> {
    if (this._gpu.initialized) {
      return this._gpu.device !== null
    }

    this._gpu.initialized = true

    if (typeof navigator === 'undefined' || !navigator.gpu) {
      console.warn('WebGPU not available, falling back to CPU simulation')
      return false
    }

    try {
      this._gpu.adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      })

      if (!this._gpu.adapter) {
        console.warn('No WebGPU adapter found')
        return false
      }

      this._gpu.device = await this._gpu.adapter.requestDevice({
        requiredLimits: {
          maxStorageBufferBindingSize: 1024 * 1024 * 1024,
          maxComputeWorkgroupSizeX: 1024,
          maxComputeInvocationsPerWorkgroup: 1024
        }
      })

      await this.createPipelines()
      return true
    } catch (error) {
      console.warn('Failed to initialize WebGPU:', error)
      return false
    }
  }

  private async createPipelines(): Promise<void> {
    if (!this._gpu.device) return

    this._gpu.bindGroupLayout = this._gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' }
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' }
        }
      ]
    })

    const singleQubitGateShader = `
      struct Uniforms {
        numQubits: u32,
        targetWire: u32,
        matrixReal00: f32,
        matrixImag00: f32,
        matrixReal01: f32,
        matrixImag01: f32,
        matrixReal10: f32,
        matrixImag10: f32,
        matrixReal11: f32,
        matrixImag11: f32,
      }

      @group(0) @binding(0) var<storage, read> inputState: array<vec2<f32>>;
      @group(0) @binding(1) var<storage, read_write> outputState: array<vec2<f32>>;
      @group(0) @binding(2) var<uniform> uniforms: Uniforms;

      @compute @workgroup_size(${WORKGROUP_SIZE})
      fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let dim = 1u << uniforms.numQubits;
        let idx = globalId.x;

        if (idx >= dim) {
          return;
        }

        let stride = 1u << (uniforms.numQubits - 1u - uniforms.targetWire);
        let groupIdx = idx / (stride * 2u);
        let localIdx = idx % stride;
        let idx0 = groupIdx * stride * 2u + localIdx;
        let idx1 = idx0 + stride;

        if (idx == idx0) {
          let s0 = inputState[idx0];
          let s1 = inputState[idx1];

          let m00 = vec2<f32>(uniforms.matrixReal00, uniforms.matrixImag00);
          let m01 = vec2<f32>(uniforms.matrixReal01, uniforms.matrixImag01);
          let m10 = vec2<f32>(uniforms.matrixReal10, uniforms.matrixImag10);
          let m11 = vec2<f32>(uniforms.matrixReal11, uniforms.matrixImag11);

          let new0Real = m00.x * s0.x - m00.y * s0.y + m01.x * s1.x - m01.y * s1.y;
          let new0Imag = m00.x * s0.y + m00.y * s0.x + m01.x * s1.y + m01.y * s1.x;
          let new1Real = m10.x * s0.x - m10.y * s0.y + m11.x * s1.x - m11.y * s1.y;
          let new1Imag = m10.x * s0.y + m10.y * s0.x + m11.x * s1.y + m11.y * s1.x;

          outputState[idx0] = vec2<f32>(new0Real, new0Imag);
          outputState[idx1] = vec2<f32>(new1Real, new1Imag);
        }
      }
    `

    const probabilitiesShader = `
      @group(0) @binding(0) var<storage, read> stateVector: array<vec2<f32>>;
      @group(0) @binding(1) var<storage, read_write> probabilities: array<f32>;
      @group(0) @binding(2) var<uniform> uniforms: Uniforms;

      struct Uniforms {
        numQubits: u32,
        _padding: u32,
      }

      @compute @workgroup_size(${WORKGROUP_SIZE})
      fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
        let dim = 1u << uniforms.numQubits;
        let idx = globalId.x;

        if (idx >= dim) {
          return;
        }

        let amplitude = stateVector[idx];
        probabilities[idx] = amplitude.x * amplitude.x + amplitude.y * amplitude.y;
      }
    `

    const pipelineLayout = this._gpu.device.createPipelineLayout({
      bindGroupLayouts: [this._gpu.bindGroupLayout!]
    })

    const createPipeline = (code: string) => {
      const shaderModule = this._gpu.device!.createShaderModule({ code })
      return this._gpu.device!.createComputePipeline({
        layout: pipelineLayout,
        compute: {
          module: shaderModule,
          entryPoint: 'main'
        }
      })
    }

    this._gpu.pipelines.set('singleQubitGate', createPipeline(singleQubitGateShader))
    this._gpu.pipelines.set('probabilities', createPipeline(probabilitiesShader))
  }

  private async allocateBuffers(): Promise<void> {
    if (!this._gpu.device) return

    const dim = 1 << this._numWires
    const stateSize = dim * 2 * 4

    if (this._gpu.stateBuffer) {
      this._gpu.stateBuffer.destroy()
    }
    if (this._gpu.scratchBuffer) {
      this._gpu.scratchBuffer.destroy()
    }
    if (this._gpu.uniformBuffer) {
      this._gpu.uniformBuffer.destroy()
    }

    this._gpu.stateBuffer = this._gpu.device.createBuffer({
      size: stateSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })

    this._gpu.scratchBuffer = this._gpu.device.createBuffer({
      size: stateSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    })

    this._gpu.uniformBuffer = this._gpu.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })
  }

  reset(): void {
    super.reset()

    if (this._gpu.device && this._gpu.stateBuffer) {
      const dim = 1 << this._numWires
      const initialState = new Float32Array(dim * 2)
      initialState[0] = 1.0

      this._gpu.device.queue.writeBuffer(this._gpu.stateBuffer, 0, initialState)
    }
  }

  async execute(tape: QuantumTape, config?: ExecutionConfig): Promise<number | number[] | QTensor> {
    this._numWires = tape.numWires

    const gpuAvailable = await this.initGPU()

    if (!gpuAvailable) {
      return this.executeCPU(tape, config)
    }

    await this.allocateBuffers()
    this.reset()

    const operations = tape.operations
    const measurements = tape.getMeasurements()

    for (const record of operations) {
      if (record.operation.type === 'gate') {
        await this.applyOperationGPU(record.operation)
      }
    }

    if (measurements.length === 0) {
      return await this.readStateFromGPU()
    }

    const results: (number | number[])[] = []

    for (const measurement of measurements) {
      const op = measurement.operation

      switch (op.name) {
        case 'expval': {
          const state = await this.readStateFromGPU()
          const observable = this.operationToObservable(op)
          results.push(this.measureFromState(state, observable, op.wires))
          break
        }
        case 'probs': {
          const probs = await this.computeProbabilitiesGPU(op.wires)
          results.push(probs)
          break
        }
        case 'state': {
          return await this.readStateFromGPU()
        }
        default: {
          const state = await this.readStateFromGPU()
          this._stateVector = state
          const cpuResult = this.executeMeasurementCPU(op, config)
          results.push(cpuResult)
        }
      }
    }

    if (results.length === 1) {
      const result = results[0]
      if (typeof result === 'number') {
        return result
      }
      return result
    }

    return results.flat()
  }

  private async applyOperationGPU(op: TapeOperation): Promise<void> {
    if (!this._gpu.device || !this._gpu.stateBuffer || !this._gpu.scratchBuffer) return

    const gate = getGate(op.name)
    if (!gate) {
      throw new Error(`Unknown gate: ${op.name}`)
    }

    const params = op.paramTensors.length > 0
      ? op.paramTensors.map(t => t.item())
      : op.params

    const matrix = gate.matrix(params)

    if (op.wires.length === 1) {
      await this.applySingleQubitGateGPU(matrix, op.wires[0])
    } else {
      const state = await this.readStateFromGPU()
      this._stateVector = state
      this.applyOperation(op)
      await this.writeStateToGPU()
    }
  }

  private async applySingleQubitGateGPU(matrix: QTensor, wire: number): Promise<void> {
    if (!this._gpu.device || !this._gpu.stateBuffer || !this._gpu.scratchBuffer || !this._gpu.uniformBuffer) return

    const uniforms = new Float32Array([
      this._numWires,
      wire,
      matrix.data[0], matrix.data[1],
      matrix.data[2], matrix.data[3],
      matrix.data[4], matrix.data[5],
      matrix.data[6], matrix.data[7]
    ])

    this._gpu.device.queue.writeBuffer(this._gpu.uniformBuffer, 0, uniforms)

    const pipeline = this._gpu.pipelines.get('singleQubitGate')!
    const bindGroup = this._gpu.device.createBindGroup({
      layout: this._gpu.bindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: this._gpu.stateBuffer } },
        { binding: 1, resource: { buffer: this._gpu.scratchBuffer } },
        { binding: 2, resource: { buffer: this._gpu.uniformBuffer } }
      ]
    })

    const dim = 1 << this._numWires
    const workgroups = Math.ceil(dim / WORKGROUP_SIZE)

    const commandEncoder = this._gpu.device.createCommandEncoder()
    const passEncoder = commandEncoder.beginComputePass()
    passEncoder.setPipeline(pipeline)
    passEncoder.setBindGroup(0, bindGroup)
    passEncoder.dispatchWorkgroups(workgroups)
    passEncoder.end()

    commandEncoder.copyBufferToBuffer(this._gpu.scratchBuffer, 0, this._gpu.stateBuffer, 0, dim * 2 * 4)

    this._gpu.device.queue.submit([commandEncoder.finish()])
    await this._gpu.device.queue.onSubmittedWorkDone()
  }

  private async computeProbabilitiesGPU(wires?: number[]): Promise<number[]> {
    const state = await this.readStateFromGPU()
    this._stateVector = state
    return this.getProbabilities(wires)
  }

  private async readStateFromGPU(): Promise<QTensor> {
    if (!this._gpu.device || !this._gpu.stateBuffer) {
      throw new Error('GPU not initialized')
    }

    const dim = 1 << this._numWires
    const readBuffer = this._gpu.device.createBuffer({
      size: dim * 2 * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    })

    const commandEncoder = this._gpu.device.createCommandEncoder()
    commandEncoder.copyBufferToBuffer(this._gpu.stateBuffer, 0, readBuffer, 0, dim * 2 * 4)
    this._gpu.device.queue.submit([commandEncoder.finish()])

    await readBuffer.mapAsync(GPUMapMode.READ)
    const data = new Float32Array(readBuffer.getMappedRange())
    const stateData = new Float64Array(dim * 2)

    for (let i = 0; i < dim * 2; i++) {
      stateData[i] = data[i]
    }

    readBuffer.unmap()
    readBuffer.destroy()

    return new QTensor(stateData, [dim], { dtype: 'complex128' })
  }

  private async writeStateToGPU(): Promise<void> {
    if (!this._gpu.device || !this._gpu.stateBuffer || !this._stateVector) return

    const dim = 1 << this._numWires
    const data = new Float32Array(dim * 2)

    for (let i = 0; i < dim * 2; i++) {
      data[i] = this._stateVector.data[i]
    }

    this._gpu.device.queue.writeBuffer(this._gpu.stateBuffer, 0, data)
  }

  private operationToObservable(op: TapeOperation): Observable {
    if (op.paramTensors.length > 0) {
      const matrix = op.paramTensors[0]
      return {
        name: 'Hermitian',
        wires: op.wires,
        matrix: () => matrix,
        eigenvalues: () => []
      }
    }
    return new PauliZObservable(op.wires[0])
  }

  private measureFromState(state: QTensor, observable: Observable, wires: number[]): number {
    this._stateVector = state
    return this.measure(observable, wires)
  }

  private executeCPU(tape: QuantumTape, config?: ExecutionConfig): number | number[] | QTensor {
    if (!this._fallbackDevice) {
      const { DefaultStateVectorDevice } = require('./default-state')
      this._fallbackDevice = new DefaultStateVectorDevice({
        wires: this._numWires,
        shots: this._shots ?? undefined
      }) as QubitDevice
    }
    return this._fallbackDevice.execute(tape, config)
  }

  private executeMeasurementCPU(op: TapeOperation, config?: ExecutionConfig): number | number[] {
    const shots = config?.shots ?? this._shots ?? 1000

    switch (op.name) {
      case 'var': {
        const observable = this.operationToObservable(op)
        return this.variance(observable, op.wires)
      }
      case 'sample': {
        const samples = this.sampleCircuit(shots)
        return samples.map(s => op.wires.map(w => s[w])).flat()
      }
      case 'counts': {
        const samples = this.sampleCircuit(shots)
        const counts: Record<string, number> = {}
        for (const sample of samples) {
          const key = op.wires.map(w => sample[w]).join('')
          counts[key] = (counts[key] ?? 0) + 1
        }
        return Object.values(counts)
      }
      default:
        return 0
    }
  }

  applyOperation(op: TapeOperation): void {
    if (!this._stateVector) {
      throw new Error('State vector not initialized')
    }

    const gate = getGate(op.name)
    if (!gate) {
      throw new Error(`Unknown gate: ${op.name}`)
    }

    const params = op.paramTensors.length > 0
      ? op.paramTensors.map(t => t.item())
      : op.params

    let matrix = gate.matrix(params)
    if (op.inverse) {
      matrix = matrix.dag()
    }

    if (op.wires.length === 1) {
      this.applySingleQubitGateCPU(matrix, op.wires[0])
    } else {
      this.applyMultiQubitGateCPU(matrix, op.wires)
    }
  }

  private applySingleQubitGateCPU(matrix: QTensor, wire: number): void {
    if (!this._stateVector) return

    const dim = 1 << this._numWires
    const newState = QTensor.zeros([dim], { dtype: 'complex128' })
    const stride = 1 << (this._numWires - 1 - wire)

    for (let i = 0; i < dim; i += stride * 2) {
      for (let j = 0; j < stride; j++) {
        const idx0 = i + j
        const idx1 = i + j + stride

        const s0 = this._stateVector.getComplex(idx0)
        const s1 = this._stateVector.getComplex(idx1)

        const m00 = matrix.getComplex(0)
        const m01 = matrix.getComplex(1)
        const m10 = matrix.getComplex(2)
        const m11 = matrix.getComplex(3)

        newState.setComplex(idx0, m00.mul(s0).add(m01.mul(s1)))
        newState.setComplex(idx1, m10.mul(s0).add(m11.mul(s1)))
      }
    }

    this._stateVector = newState
  }

  private applyMultiQubitGateCPU(matrix: QTensor, wires: number[]): void {
    if (!this._stateVector) return

    const dim = 1 << this._numWires
    const gateDim = 1 << wires.length
    const newState = QTensor.zeros([dim], { dtype: 'complex128' })

    for (let i = 0; i < dim; i++) {
      let sumRe = 0
      let sumIm = 0

      for (let j = 0; j < dim; j++) {
        let match = true

        for (let k = 0; k < this._numWires; k++) {
          if (!wires.includes(k)) {
            if (((i >> (this._numWires - 1 - k)) & 1) !== ((j >> (this._numWires - 1 - k)) & 1)) {
              match = false
              break
            }
          }
        }

        if (match) {
          let matrixRow = 0
          let matrixCol = 0

          for (let w = 0; w < wires.length; w++) {
            const wire = wires[w]
            matrixRow |= ((i >> (this._numWires - 1 - wire)) & 1) << (wires.length - 1 - w)
            matrixCol |= ((j >> (this._numWires - 1 - wire)) & 1) << (wires.length - 1 - w)
          }

          const matrixElement = matrix.getComplex(matrixRow * gateDim + matrixCol)
          const stateElement = this._stateVector.getComplex(j)

          const product = matrixElement.mul(stateElement)
          sumRe += product.re
          sumIm += product.im
        }
      }

      newState.setComplex(i, new Complex(sumRe, sumIm))
    }

    this._stateVector = newState
  }

  async destroy(): Promise<void> {
    if (this._gpu.stateBuffer) {
      this._gpu.stateBuffer.destroy()
    }
    if (this._gpu.scratchBuffer) {
      this._gpu.scratchBuffer.destroy()
    }
    if (this._gpu.uniformBuffer) {
      this._gpu.uniformBuffer.destroy()
    }
    if (this._gpu.device) {
      this._gpu.device.destroy()
    }

    this._gpu = {
      device: null,
      adapter: null,
      stateBuffer: null,
      scratchBuffer: null,
      uniformBuffer: null,
      pipelines: new Map(),
      bindGroupLayout: null,
      initialized: false
    }
  }
}

registerDevice('webgpu.state', WebGPUStateVectorDevice)
registerDevice('webgpu.qubit', WebGPUStateVectorDevice)
