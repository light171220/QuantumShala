import type { GateType, CircuitGate, Measurement, QuantumCircuit } from '@/types/simulator'

export type ParseLanguage = 'qiskit' | 'cirq' | 'pennylane' | 'openqasm'

export interface ParseResult {
  success: boolean
  circuit: ParsedCircuit | null
  errors: ParseError[]
  warnings: ParseWarning[]
  parseTimeMs: number
  language: ParseLanguage
}

export interface ParsedCircuit {
  numQubits: number
  numClassicalBits: number
  gates: ParsedGate[]
  measurements: ParsedMeasurement[]
  registers: QuantumRegister[]
  classicalRegisters: ClassicalRegister[]
  metadata: ParsedCircuitMetadata
}

export interface ParsedCircuitMetadata {
  hasBarriers: boolean
  hasCustomGates: boolean
  hasConditionals: boolean
  totalOperations: number
  circuitDepth: number
  maxQubitIndex: number
}

export interface QuantumRegister {
  name: string
  size: number
  startIndex: number
}

export interface ClassicalRegister {
  name: string
  size: number
  startIndex: number
}

export interface ParsedGate {
  id: string
  type: GateType
  qubits: number[]
  parameters: number[]
  controlQubits: number[]
  position: number
  label?: string
  line: number
  column: number
  sourceCode: string
  isConditional: boolean
  conditionRegister?: string
  conditionValue?: number
}

export interface ParsedMeasurement {
  qubit: number
  classicalBit: number
  position: number
  line: number
  column: number
}

export type ParseErrorCode =
  | 'E001'
  | 'E002'
  | 'E003'
  | 'E004'
  | 'E005'
  | 'E006'
  | 'E007'
  | 'E008'
  | 'E009'
  | 'E010'

export interface ParseError {
  code: ParseErrorCode
  message: string
  line: number
  column: number
  endLine?: number
  endColumn?: number
  sourceCode?: string
  suggestion?: string
}

export type ParseWarningCode =
  | 'W001'
  | 'W002'
  | 'W003'
  | 'W004'
  | 'W005'
  | 'W006'
  | 'W007'
  | 'W008'
  | 'W009'
  | 'W010'

export interface ParseWarning {
  code: ParseWarningCode
  message: string
  line?: number
  column?: number
  gateIds?: string[]
  suggestion?: string
}

export interface GateMatchResult {
  matched: boolean
  gate?: Partial<ParsedGate>
  error?: string
}

export interface GatePattern {
  regex: RegExp
  type: GateType
  extractParams?: (match: RegExpMatchArray) => number[]
  extractQubits?: (match: RegExpMatchArray) => number[]
  extractControls?: (match: RegExpMatchArray) => number[]
}

export interface QuantumCodeParser {
  language: ParseLanguage
  parse(code: string): ParseResult
  validateSyntax(code: string): ParseError[]
  extractRegisters(code: string): { quantum: QuantumRegister[]; classical: ClassicalRegister[] }
  supportsFeature(feature: ParserFeature): boolean
}

export type ParserFeature =
  | 'conditionals'
  | 'custom_gates'
  | 'barriers'
  | 'reset'
  | 'parametric_gates'
  | 'multi_qubit_measure'
  | 'classical_operations'

export function parsedCircuitToQuantumCircuit(
  parsed: ParsedCircuit,
  name: string = 'Parsed Circuit'
): QuantumCircuit {
  return {
    id: `parsed-${Date.now()}`,
    name,
    description: `Parsed circuit with ${parsed.numQubits} qubits and ${parsed.gates.length} gates`,
    numQubits: parsed.numQubits,
    gates: parsed.gates.map((g) => parsedGateToCircuitGate(g)),
    measurements: parsed.measurements.map((m) => ({
      qubit: m.qubit,
      classicalBit: m.classicalBit,
      position: m.position,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublic: false,
    likes: 0,
    tags: ['parsed'],
  }
}

export function parsedGateToCircuitGate(gate: ParsedGate): CircuitGate {
  return {
    id: gate.id,
    type: gate.type,
    qubits: gate.qubits,
    parameters: gate.parameters.length > 0 ? gate.parameters : undefined,
    controlQubits: gate.controlQubits.length > 0 ? gate.controlQubits : undefined,
    position: gate.position,
    label: gate.label,
  }
}

export function createParseError(
  code: ParseErrorCode,
  message: string,
  line: number,
  column: number,
  options?: {
    endLine?: number
    endColumn?: number
    sourceCode?: string
    suggestion?: string
  }
): ParseError {
  return {
    code,
    message,
    line,
    column,
    ...options,
  }
}

export function createParseWarning(
  code: ParseWarningCode,
  message: string,
  options?: {
    line?: number
    column?: number
    gateIds?: string[]
    suggestion?: string
  }
): ParseWarning {
  return {
    code,
    message,
    ...options,
  }
}

export function generateGateId(): string {
  return `gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const GATE_NAME_MAP: Record<string, GateType> = {
  x: 'X',
  y: 'Y',
  z: 'Z',
  id: 'X', // Will be handled as identity
  i: 'X',
  h: 'H',
  hadamard: 'H',
  s: 'S',
  sdg: 'Sdg',
  t: 'T',
  tdg: 'Tdg',
  rx: 'Rx',
  ry: 'Ry',
  rz: 'Rz',
  p: 'Phase',
  phase: 'Phase',
  u1: 'U1',
  u2: 'U2',
  u3: 'U3',
  u: 'U',
  cx: 'CNOT',
  cnot: 'CNOT',
  cy: 'CY',
  cz: 'CZ',
  swap: 'SWAP',
  iswap: 'iSWAP',
  crx: 'CRx',
  cry: 'CRy',
  crz: 'CRz',
  cp: 'CPhase',
  cphase: 'CPhase',
  ccx: 'Toffoli',
  toffoli: 'Toffoli',
  ccnot: 'Toffoli',
  cswap: 'Fredkin',
  fredkin: 'Fredkin',
  barrier: 'Barrier',
  reset: 'Reset',
}

export const PARAMETERIZED_GATES: GateType[] = [
  'Rx', 'Ry', 'Rz', 'Phase', 'U', 'U1', 'U2', 'U3',
  'CRx', 'CRy', 'CRz', 'CPhase',
]

export const TWO_QUBIT_GATES: GateType[] = [
  'CNOT', 'CX', 'CY', 'CZ', 'SWAP', 'iSWAP',
  'CRx', 'CRy', 'CRz', 'CPhase',
]

export const THREE_QUBIT_GATES: GateType[] = ['Toffoli', 'Fredkin']

export function getExpectedParamCount(gateType: GateType): number {
  switch (gateType) {
    case 'Rx':
    case 'Ry':
    case 'Rz':
    case 'Phase':
    case 'U1':
    case 'CRx':
    case 'CRy':
    case 'CRz':
    case 'CPhase':
      return 1
    case 'U2':
      return 2
    case 'U':
    case 'U3':
      return 3
    default:
      return 0
  }
}

export function getExpectedQubitCount(gateType: GateType): number {
  if (THREE_QUBIT_GATES.includes(gateType)) return 3
  if (TWO_QUBIT_GATES.includes(gateType)) return 2
  return 1
}
