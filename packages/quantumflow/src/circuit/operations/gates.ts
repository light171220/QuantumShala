import { QTensor } from '../../core/tensor'
import { Complex } from '../../core/complex'
import { QuantumTape, recordOperation } from '../../autodiff/tape'
import { resolveWires, validateWireIndices } from '../wire'

export interface GateDefinition {
  name: string
  numWires: number
  numParams: number
  matrix: (params: number[]) => QTensor
  generator?: (params: number[]) => QTensor
  adjoint?: (params: number[]) => number[]
  decomposition?: (wires: number[], params: number[]) => void
}

const SQRT2_INV = 1 / Math.SQRT2

export const PauliX: GateDefinition = {
  name: 'PauliX',
  numWires: 1,
  numParams: 0,
  matrix: () => QTensor.fromComplex([
    Complex.zero(), Complex.one(),
    Complex.one(), Complex.zero()
  ], [2, 2])
}

export const PauliY: GateDefinition = {
  name: 'PauliY',
  numWires: 1,
  numParams: 0,
  matrix: () => QTensor.fromComplex([
    Complex.zero(), new Complex(0, -1),
    new Complex(0, 1), Complex.zero()
  ], [2, 2])
}

export const PauliZ: GateDefinition = {
  name: 'PauliZ',
  numWires: 1,
  numParams: 0,
  matrix: () => QTensor.fromComplex([
    Complex.one(), Complex.zero(),
    Complex.zero(), new Complex(-1, 0)
  ], [2, 2])
}

export const Hadamard: GateDefinition = {
  name: 'Hadamard',
  numWires: 1,
  numParams: 0,
  matrix: () => QTensor.fromComplex([
    new Complex(SQRT2_INV, 0), new Complex(SQRT2_INV, 0),
    new Complex(SQRT2_INV, 0), new Complex(-SQRT2_INV, 0)
  ], [2, 2])
}

export const S: GateDefinition = {
  name: 'S',
  numWires: 1,
  numParams: 0,
  matrix: () => QTensor.fromComplex([
    Complex.one(), Complex.zero(),
    Complex.zero(), new Complex(0, 1)
  ], [2, 2])
}

export const T: GateDefinition = {
  name: 'T',
  numWires: 1,
  numParams: 0,
  matrix: () => QTensor.fromComplex([
    Complex.one(), Complex.zero(),
    Complex.zero(), Complex.expI(Math.PI / 4)
  ], [2, 2])
}

export const SX: GateDefinition = {
  name: 'SX',
  numWires: 1,
  numParams: 0,
  matrix: () => QTensor.fromComplex([
    new Complex(0.5, 0.5), new Complex(0.5, -0.5),
    new Complex(0.5, -0.5), new Complex(0.5, 0.5)
  ], [2, 2])
}

export const RX: GateDefinition = {
  name: 'RX',
  numWires: 1,
  numParams: 1,
  matrix: (params) => {
    const theta = params[0]
    const c = Math.cos(theta / 2)
    const s = Math.sin(theta / 2)
    return QTensor.fromComplex([
      new Complex(c, 0), new Complex(0, -s),
      new Complex(0, -s), new Complex(c, 0)
    ], [2, 2])
  },
  generator: () => PauliX.matrix([]).mul(-0.5),
  adjoint: (params) => [-params[0]]
}

export const RY: GateDefinition = {
  name: 'RY',
  numWires: 1,
  numParams: 1,
  matrix: (params) => {
    const theta = params[0]
    const c = Math.cos(theta / 2)
    const s = Math.sin(theta / 2)
    return QTensor.fromComplex([
      new Complex(c, 0), new Complex(-s, 0),
      new Complex(s, 0), new Complex(c, 0)
    ], [2, 2])
  },
  generator: () => PauliY.matrix([]).mul(-0.5),
  adjoint: (params) => [-params[0]]
}

export const RZ: GateDefinition = {
  name: 'RZ',
  numWires: 1,
  numParams: 1,
  matrix: (params) => {
    const theta = params[0]
    return QTensor.fromComplex([
      Complex.expI(-theta / 2), Complex.zero(),
      Complex.zero(), Complex.expI(theta / 2)
    ], [2, 2])
  },
  generator: () => PauliZ.matrix([]).mul(-0.5),
  adjoint: (params) => [-params[0]]
}

export const PhaseShift: GateDefinition = {
  name: 'PhaseShift',
  numWires: 1,
  numParams: 1,
  matrix: (params) => {
    const phi = params[0]
    return QTensor.fromComplex([
      Complex.one(), Complex.zero(),
      Complex.zero(), Complex.expI(phi)
    ], [2, 2])
  },
  adjoint: (params) => [-params[0]]
}

export const Rot: GateDefinition = {
  name: 'Rot',
  numWires: 1,
  numParams: 3,
  matrix: (params) => {
    const [phi, theta, omega] = params
    const c = Math.cos(theta / 2)
    const s = Math.sin(theta / 2)
    return QTensor.fromComplex([
      Complex.expI(-(phi + omega) / 2).mul(new Complex(c, 0)),
      Complex.expI(-(phi - omega) / 2).mul(new Complex(-s, 0)),
      Complex.expI((phi - omega) / 2).mul(new Complex(s, 0)),
      Complex.expI((phi + omega) / 2).mul(new Complex(c, 0))
    ], [2, 2])
  },
  adjoint: (params) => [-params[2], -params[1], -params[0]]
}

export const U3: GateDefinition = {
  name: 'U3',
  numWires: 1,
  numParams: 3,
  matrix: (params) => {
    const [theta, phi, lambda] = params
    const c = Math.cos(theta / 2)
    const s = Math.sin(theta / 2)
    return QTensor.fromComplex([
      new Complex(c, 0),
      Complex.expI(-lambda).mul(new Complex(-s, 0)),
      Complex.expI(phi).mul(new Complex(s, 0)),
      Complex.expI(phi + lambda).mul(new Complex(c, 0))
    ], [2, 2])
  },
  adjoint: (params) => [-params[0], -params[2], -params[1]]
}

export const CNOT: GateDefinition = {
  name: 'CNOT',
  numWires: 2,
  numParams: 0,
  matrix: () => QTensor.fromComplex([
    Complex.one(), Complex.zero(), Complex.zero(), Complex.zero(),
    Complex.zero(), Complex.one(), Complex.zero(), Complex.zero(),
    Complex.zero(), Complex.zero(), Complex.zero(), Complex.one(),
    Complex.zero(), Complex.zero(), Complex.one(), Complex.zero()
  ], [4, 4])
}

export const CY: GateDefinition = {
  name: 'CY',
  numWires: 2,
  numParams: 0,
  matrix: () => QTensor.fromComplex([
    Complex.one(), Complex.zero(), Complex.zero(), Complex.zero(),
    Complex.zero(), Complex.one(), Complex.zero(), Complex.zero(),
    Complex.zero(), Complex.zero(), Complex.zero(), new Complex(0, -1),
    Complex.zero(), Complex.zero(), new Complex(0, 1), Complex.zero()
  ], [4, 4])
}

export const CZ: GateDefinition = {
  name: 'CZ',
  numWires: 2,
  numParams: 0,
  matrix: () => QTensor.fromComplex([
    Complex.one(), Complex.zero(), Complex.zero(), Complex.zero(),
    Complex.zero(), Complex.one(), Complex.zero(), Complex.zero(),
    Complex.zero(), Complex.zero(), Complex.one(), Complex.zero(),
    Complex.zero(), Complex.zero(), Complex.zero(), new Complex(-1, 0)
  ], [4, 4])
}

export const SWAP: GateDefinition = {
  name: 'SWAP',
  numWires: 2,
  numParams: 0,
  matrix: () => QTensor.fromComplex([
    Complex.one(), Complex.zero(), Complex.zero(), Complex.zero(),
    Complex.zero(), Complex.zero(), Complex.one(), Complex.zero(),
    Complex.zero(), Complex.one(), Complex.zero(), Complex.zero(),
    Complex.zero(), Complex.zero(), Complex.zero(), Complex.one()
  ], [4, 4])
}

export const ISWAP: GateDefinition = {
  name: 'ISWAP',
  numWires: 2,
  numParams: 0,
  matrix: () => QTensor.fromComplex([
    Complex.one(), Complex.zero(), Complex.zero(), Complex.zero(),
    Complex.zero(), Complex.zero(), new Complex(0, 1), Complex.zero(),
    Complex.zero(), new Complex(0, 1), Complex.zero(), Complex.zero(),
    Complex.zero(), Complex.zero(), Complex.zero(), Complex.one()
  ], [4, 4])
}

export const CRX: GateDefinition = {
  name: 'CRX',
  numWires: 2,
  numParams: 1,
  matrix: (params) => {
    const theta = params[0]
    const c = Math.cos(theta / 2)
    const s = Math.sin(theta / 2)
    return QTensor.fromComplex([
      Complex.one(), Complex.zero(), Complex.zero(), Complex.zero(),
      Complex.zero(), Complex.one(), Complex.zero(), Complex.zero(),
      Complex.zero(), Complex.zero(), new Complex(c, 0), new Complex(0, -s),
      Complex.zero(), Complex.zero(), new Complex(0, -s), new Complex(c, 0)
    ], [4, 4])
  },
  adjoint: (params) => [-params[0]]
}

export const CRY: GateDefinition = {
  name: 'CRY',
  numWires: 2,
  numParams: 1,
  matrix: (params) => {
    const theta = params[0]
    const c = Math.cos(theta / 2)
    const s = Math.sin(theta / 2)
    return QTensor.fromComplex([
      Complex.one(), Complex.zero(), Complex.zero(), Complex.zero(),
      Complex.zero(), Complex.one(), Complex.zero(), Complex.zero(),
      Complex.zero(), Complex.zero(), new Complex(c, 0), new Complex(-s, 0),
      Complex.zero(), Complex.zero(), new Complex(s, 0), new Complex(c, 0)
    ], [4, 4])
  },
  adjoint: (params) => [-params[0]]
}

export const CRZ: GateDefinition = {
  name: 'CRZ',
  numWires: 2,
  numParams: 1,
  matrix: (params) => {
    const theta = params[0]
    return QTensor.fromComplex([
      Complex.one(), Complex.zero(), Complex.zero(), Complex.zero(),
      Complex.zero(), Complex.one(), Complex.zero(), Complex.zero(),
      Complex.zero(), Complex.zero(), Complex.expI(-theta / 2), Complex.zero(),
      Complex.zero(), Complex.zero(), Complex.zero(), Complex.expI(theta / 2)
    ], [4, 4])
  },
  adjoint: (params) => [-params[0]]
}

export const RXX: GateDefinition = {
  name: 'RXX',
  numWires: 2,
  numParams: 1,
  matrix: (params) => {
    const theta = params[0]
    const c = Math.cos(theta / 2)
    const s = Math.sin(theta / 2)
    return QTensor.fromComplex([
      new Complex(c, 0), Complex.zero(), Complex.zero(), new Complex(0, -s),
      Complex.zero(), new Complex(c, 0), new Complex(0, -s), Complex.zero(),
      Complex.zero(), new Complex(0, -s), new Complex(c, 0), Complex.zero(),
      new Complex(0, -s), Complex.zero(), Complex.zero(), new Complex(c, 0)
    ], [4, 4])
  },
  adjoint: (params) => [-params[0]]
}

export const RYY: GateDefinition = {
  name: 'RYY',
  numWires: 2,
  numParams: 1,
  matrix: (params) => {
    const theta = params[0]
    const c = Math.cos(theta / 2)
    const s = Math.sin(theta / 2)
    return QTensor.fromComplex([
      new Complex(c, 0), Complex.zero(), Complex.zero(), new Complex(0, s),
      Complex.zero(), new Complex(c, 0), new Complex(0, -s), Complex.zero(),
      Complex.zero(), new Complex(0, -s), new Complex(c, 0), Complex.zero(),
      new Complex(0, s), Complex.zero(), Complex.zero(), new Complex(c, 0)
    ], [4, 4])
  },
  adjoint: (params) => [-params[0]]
}

export const RZZ: GateDefinition = {
  name: 'RZZ',
  numWires: 2,
  numParams: 1,
  matrix: (params) => {
    const theta = params[0]
    return QTensor.fromComplex([
      Complex.expI(-theta / 2), Complex.zero(), Complex.zero(), Complex.zero(),
      Complex.zero(), Complex.expI(theta / 2), Complex.zero(), Complex.zero(),
      Complex.zero(), Complex.zero(), Complex.expI(theta / 2), Complex.zero(),
      Complex.zero(), Complex.zero(), Complex.zero(), Complex.expI(-theta / 2)
    ], [4, 4])
  },
  adjoint: (params) => [-params[0]]
}

export const Toffoli: GateDefinition = {
  name: 'Toffoli',
  numWires: 3,
  numParams: 0,
  matrix: () => {
    const size = 8
    const data: Complex[] = new Array(size * size).fill(Complex.zero())

    for (let i = 0; i < size; i++) {
      data[i * size + i] = Complex.one()
    }

    data[6 * size + 6] = Complex.zero()
    data[6 * size + 7] = Complex.one()
    data[7 * size + 6] = Complex.one()
    data[7 * size + 7] = Complex.zero()

    return QTensor.fromComplex(data, [size, size])
  }
}

export const CSWAP: GateDefinition = {
  name: 'CSWAP',
  numWires: 3,
  numParams: 0,
  matrix: () => {
    const size = 8
    const data: Complex[] = new Array(size * size).fill(Complex.zero())

    for (let i = 0; i < size; i++) {
      data[i * size + i] = Complex.one()
    }

    data[5 * size + 5] = Complex.zero()
    data[5 * size + 6] = Complex.one()
    data[6 * size + 5] = Complex.one()
    data[6 * size + 6] = Complex.zero()

    return QTensor.fromComplex(data, [size, size])
  }
}

const gateRegistry = new Map<string, GateDefinition>([
  ['X', PauliX],
  ['Y', PauliY],
  ['Z', PauliZ],
  ['H', Hadamard],
  ['S', S],
  ['T', T],
  ['SX', SX],
  ['RX', RX],
  ['RY', RY],
  ['RZ', RZ],
  ['PhaseShift', PhaseShift],
  ['Rot', Rot],
  ['U3', U3],
  ['CNOT', CNOT],
  ['CX', CNOT],
  ['CY', CY],
  ['CZ', CZ],
  ['SWAP', SWAP],
  ['ISWAP', ISWAP],
  ['CRX', CRX],
  ['CRY', CRY],
  ['CRZ', CRZ],
  ['RXX', RXX],
  ['RYY', RYY],
  ['RZZ', RZZ],
  ['Toffoli', Toffoli],
  ['CCX', Toffoli],
  ['CSWAP', CSWAP],
  ['Fredkin', CSWAP]
])

export function getGate(name: string): GateDefinition | undefined {
  return gateRegistry.get(name)
}

export function registerGate(gate: GateDefinition): void {
  gateRegistry.set(gate.name, gate)
}

export function getAllGates(): Map<string, GateDefinition> {
  return new Map(gateRegistry)
}

export function applyGate(
  tape: QuantumTape,
  gate: GateDefinition | string,
  wires: number | number[],
  params: number[] = [],
  options: { inverse?: boolean; paramTensors?: QTensor[] } = {}
): void {
  const gateDef = typeof gate === 'string' ? getGate(gate) : gate
  if (!gateDef) {
    throw new Error(`Unknown gate: ${gate}`)
  }

  const wireArray = resolveWires(wires)
  if (wireArray.length !== gateDef.numWires) {
    throw new Error(`${gateDef.name} requires ${gateDef.numWires} wires, got ${wireArray.length}`)
  }

  if (params.length !== gateDef.numParams && (!options.paramTensors || options.paramTensors.length === 0)) {
    throw new Error(`${gateDef.name} requires ${gateDef.numParams} parameters, got ${params.length}`)
  }

  const actualParams = options.inverse && gateDef.adjoint
    ? gateDef.adjoint(params)
    : params

  tape.addGate(gateDef.name, wireArray, actualParams, {
    inverse: options.inverse,
    paramTensors: options.paramTensors,
    matrix: gateDef.matrix(actualParams)
  })

  recordOperation({
    type: 'gate',
    name: gateDef.name,
    wires: wireArray,
    params: actualParams,
    paramTensors: options.paramTensors ?? [],
    inverse: options.inverse ?? false,
    controlWires: [],
    matrix: gateDef.matrix(actualParams)
  })
}

export function X(tape: QuantumTape, wire: number): void {
  applyGate(tape, 'X', wire)
}

export function Y(tape: QuantumTape, wire: number): void {
  applyGate(tape, 'Y', wire)
}

export function Z(tape: QuantumTape, wire: number): void {
  applyGate(tape, 'Z', wire)
}

export function H(tape: QuantumTape, wire: number): void {
  applyGate(tape, 'H', wire)
}

export function Sgate(tape: QuantumTape, wire: number): void {
  applyGate(tape, 'S', wire)
}

export function Tgate(tape: QuantumTape, wire: number): void {
  applyGate(tape, 'T', wire)
}

export function rx(tape: QuantumTape, wire: number, theta: number | QTensor): void {
  if (typeof theta === 'number') {
    applyGate(tape, 'RX', wire, [theta])
  } else {
    applyGate(tape, 'RX', wire, [], { paramTensors: [theta] })
  }
}

export function ry(tape: QuantumTape, wire: number, theta: number | QTensor): void {
  if (typeof theta === 'number') {
    applyGate(tape, 'RY', wire, [theta])
  } else {
    applyGate(tape, 'RY', wire, [], { paramTensors: [theta] })
  }
}

export function rz(tape: QuantumTape, wire: number, theta: number | QTensor): void {
  if (typeof theta === 'number') {
    applyGate(tape, 'RZ', wire, [theta])
  } else {
    applyGate(tape, 'RZ', wire, [], { paramTensors: [theta] })
  }
}

export function rot(tape: QuantumTape, wire: number, phi: number, theta: number, omega: number): void {
  applyGate(tape, 'Rot', wire, [phi, theta, omega])
}

export function u3(tape: QuantumTape, wire: number, theta: number, phi: number, lambda: number): void {
  applyGate(tape, 'U3', wire, [theta, phi, lambda])
}

export function cnot(tape: QuantumTape, control: number, target: number): void {
  applyGate(tape, 'CNOT', [control, target])
}

export function cx(tape: QuantumTape, control: number, target: number): void {
  cnot(tape, control, target)
}

export function cy(tape: QuantumTape, control: number, target: number): void {
  applyGate(tape, 'CY', [control, target])
}

export function cz(tape: QuantumTape, control: number, target: number): void {
  applyGate(tape, 'CZ', [control, target])
}

export function swap(tape: QuantumTape, wire1: number, wire2: number): void {
  applyGate(tape, 'SWAP', [wire1, wire2])
}

export function iswap(tape: QuantumTape, wire1: number, wire2: number): void {
  applyGate(tape, 'ISWAP', [wire1, wire2])
}

export function crx(tape: QuantumTape, control: number, target: number, theta: number): void {
  applyGate(tape, 'CRX', [control, target], [theta])
}

export function cry(tape: QuantumTape, control: number, target: number, theta: number): void {
  applyGate(tape, 'CRY', [control, target], [theta])
}

export function crz(tape: QuantumTape, control: number, target: number, theta: number): void {
  applyGate(tape, 'CRZ', [control, target], [theta])
}

export function rxx(tape: QuantumTape, wire1: number, wire2: number, theta: number): void {
  applyGate(tape, 'RXX', [wire1, wire2], [theta])
}

export function ryy(tape: QuantumTape, wire1: number, wire2: number, theta: number): void {
  applyGate(tape, 'RYY', [wire1, wire2], [theta])
}

export function rzz(tape: QuantumTape, wire1: number, wire2: number, theta: number): void {
  applyGate(tape, 'RZZ', [wire1, wire2], [theta])
}

export function toffoli(tape: QuantumTape, control1: number, control2: number, target: number): void {
  applyGate(tape, 'Toffoli', [control1, control2, target])
}

export function ccx(tape: QuantumTape, control1: number, control2: number, target: number): void {
  toffoli(tape, control1, control2, target)
}

export function cswap(tape: QuantumTape, control: number, target1: number, target2: number): void {
  applyGate(tape, 'CSWAP', [control, target1, target2])
}

export function fredkin(tape: QuantumTape, control: number, target1: number, target2: number): void {
  cswap(tape, control, target1, target2)
}

export function barrier(tape: QuantumTape, wires?: number[]): void {
  tape.addBarrier(wires)
}

export function reset(tape: QuantumTape, wire: number): void {
  tape.addReset(wire)
}
