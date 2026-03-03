import type { GateType } from '@/types/simulator'
import {
  ParseResult,
  ParsedCircuit,
  ParsedGate,
  ParsedMeasurement,
  ParseError,
  ParseWarning,
  QuantumRegister,
  ClassicalRegister,
  QuantumCodeParser,
  ParserFeature,
  createParseError,
  createParseWarning,
  generateGateId,
} from './types'

const PENNYLANE_GATE_MAP: Record<string, GateType> = {
  'Hadamard': 'H',
  'PauliX': 'X',
  'PauliY': 'Y',
  'PauliZ': 'Z',
  'S': 'S',
  'T': 'T',
  'SX': 'X',
  'RX': 'Rx',
  'RY': 'Ry',
  'RZ': 'Rz',
  'PhaseShift': 'Phase',
  'Rot': 'U',
  'U1': 'U1',
  'U2': 'U2',
  'U3': 'U3',
  'CNOT': 'CNOT',
  'CZ': 'CZ',
  'CY': 'CY',
  'SWAP': 'SWAP',
  'ISWAP': 'iSWAP',
  'CRX': 'CRx',
  'CRY': 'CRy',
  'CRZ': 'CRz',
  'ControlledPhaseShift': 'CPhase',
  'Toffoli': 'Toffoli',
  'CSWAP': 'Fredkin',
}

export class PennyLaneParser implements QuantumCodeParser {
  language = 'pennylane' as const

  parse(code: string): ParseResult {
    const startTime = performance.now()
    const errors: ParseError[] = []
    const warnings: ParseWarning[] = []

    const gates: ParsedGate[] = []
    const measurements: ParsedMeasurement[] = []

    let position = 0
    let numQubits = 0

    const lines = code.split('\n')

    for (const line of lines) {
      const deviceMatch = line.match(/qml\.device\s*\([^,]+,\s*wires\s*=\s*(\d+)/)
      if (deviceMatch) {
        numQubits = parseInt(deviceMatch[1], 10)
        break
      }

      const deviceArrayMatch = line.match(/qml\.device\s*\([^,]+,\s*wires\s*=\s*\[([^\]]+)\]/)
      if (deviceArrayMatch) {
        numQubits = deviceArrayMatch[1].split(',').length
        break
      }
    }

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineNum = lineIndex + 1
      let line = lines[lineIndex]

      const commentIndex = line.indexOf('#')
      if (commentIndex !== -1) {
        line = line.substring(0, commentIndex)
      }

      if (line.trim().length === 0) continue

      const singleGateMatches = [...line.matchAll(/qml\.(Hadamard|PauliX|PauliY|PauliZ|S|T|SX)\s*\(\s*wires\s*=\s*\[?(\d+)\]?\s*\)/gi)]
      for (const match of singleGateMatches) {
        const gateName = match[1]
        const gateType = PENNYLANE_GATE_MAP[gateName]
        const qubit = parseInt(match[2], 10)

        if (gateType) {
          if (qubit >= numQubits && numQubits > 0) {
            errors.push(
              createParseError('E001', `Wire ${qubit} exceeds device size (${numQubits})`, lineNum, match.index || 0)
            )
            continue
          }

          gates.push({
            id: generateGateId(),
            type: gateType,
            qubits: [qubit],
            parameters: [],
            controlQubits: [],
            position: position++,
            line: lineNum,
            column: match.index || 0,
            sourceCode: match[0],
            isConditional: false,
          })

          if (qubit >= numQubits) numQubits = qubit + 1
        }
      }

      const rotGateMatches = [...line.matchAll(/qml\.(RX|RY|RZ|PhaseShift)\s*\(\s*([^,]+)\s*,\s*wires\s*=\s*\[?(\d+)\]?\s*\)/gi)]
      for (const match of rotGateMatches) {
        const gateName = match[1]
        const gateType = PENNYLANE_GATE_MAP[gateName]
        const param = this.parseParameter(match[2])
        const qubit = parseInt(match[3], 10)

        if (gateType) {
          gates.push({
            id: generateGateId(),
            type: gateType,
            qubits: [qubit],
            parameters: [param],
            controlQubits: [],
            position: position++,
            line: lineNum,
            column: match.index || 0,
            sourceCode: match[0],
            isConditional: false,
          })

          if (qubit >= numQubits) numQubits = qubit + 1
        }
      }

      const rotMatches = [...line.matchAll(/qml\.Rot\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*wires\s*=\s*\[?(\d+)\]?\s*\)/gi)]
      for (const match of rotMatches) {
        const phi = this.parseParameter(match[1])
        const theta = this.parseParameter(match[2])
        const omega = this.parseParameter(match[3])
        const qubit = parseInt(match[4], 10)

        gates.push({
          id: generateGateId(),
          type: 'U',
          qubits: [qubit],
          parameters: [phi, theta, omega],
          controlQubits: [],
          position: position++,
          line: lineNum,
          column: match.index || 0,
          sourceCode: match[0],
          isConditional: false,
        })

        if (qubit >= numQubits) numQubits = qubit + 1
      }

      const twoGateMatches = [...line.matchAll(/qml\.(CNOT|CZ|CY|SWAP|ISWAP)\s*\(\s*wires\s*=\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]\s*\)/gi)]
      for (const match of twoGateMatches) {
        const gateName = match[1]
        const gateType = PENNYLANE_GATE_MAP[gateName.toUpperCase()]
        const qubit1 = parseInt(match[2], 10)
        const qubit2 = parseInt(match[3], 10)

        if (gateType) {
          if (qubit1 === qubit2) {
            errors.push(
              createParseError('E004', 'Control and target wires must be different', lineNum, match.index || 0)
            )
            continue
          }

          const isControlled = ['CNOT', 'CZ', 'CY'].includes(gateType)

          gates.push({
            id: generateGateId(),
            type: gateType,
            qubits: isControlled ? [qubit2] : [qubit1, qubit2],
            parameters: [],
            controlQubits: isControlled ? [qubit1] : [],
            position: position++,
            line: lineNum,
            column: match.index || 0,
            sourceCode: match[0],
            isConditional: false,
          })

          if (qubit1 >= numQubits) numQubits = qubit1 + 1
          if (qubit2 >= numQubits) numQubits = qubit2 + 1
        }
      }

      const crGateMatches = [...line.matchAll(/qml\.(CRX|CRY|CRZ|ControlledPhaseShift)\s*\(\s*([^,]+)\s*,\s*wires\s*=\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]\s*\)/gi)]
      for (const match of crGateMatches) {
        const gateName = match[1]
        const gateType = PENNYLANE_GATE_MAP[gateName]
        const param = this.parseParameter(match[2])
        const control = parseInt(match[3], 10)
        const target = parseInt(match[4], 10)

        if (gateType) {
          gates.push({
            id: generateGateId(),
            type: gateType,
            qubits: [target],
            parameters: [param],
            controlQubits: [control],
            position: position++,
            line: lineNum,
            column: match.index || 0,
            sourceCode: match[0],
            isConditional: false,
          })

          if (control >= numQubits) numQubits = control + 1
          if (target >= numQubits) numQubits = target + 1
        }
      }

      const threeGateMatches = [...line.matchAll(/qml\.(Toffoli|CSWAP)\s*\(\s*wires\s*=\s*\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]\s*\)/gi)]
      for (const match of threeGateMatches) {
        const gateName = match[1]
        const gateType = PENNYLANE_GATE_MAP[gateName]
        const control1 = parseInt(match[2], 10)
        const control2 = parseInt(match[3], 10)
        const target = parseInt(match[4], 10)

        if (gateType) {
          gates.push({
            id: generateGateId(),
            type: gateType,
            qubits: [target],
            parameters: [],
            controlQubits: [control1, control2],
            position: position++,
            line: lineNum,
            column: match.index || 0,
            sourceCode: match[0],
            isConditional: false,
          })

          if (control1 >= numQubits) numQubits = control1 + 1
          if (control2 >= numQubits) numQubits = control2 + 1
          if (target >= numQubits) numQubits = target + 1
        }
      }

      const measureMatches = [...line.matchAll(/qml\.(counts|expval|sample|probs|state|var)\s*\(\s*(?:qml\.([A-Za-z]+)\s*\(\s*(?:wires\s*=\s*)?\[?(\d+)\]?\s*\)|wires\s*=\s*\[?([^)\]]*)\]?)?\s*\)/gi)]
      for (const match of measureMatches) {
        const measureType = match[1]

        if (match[3]) {
          const qubit = parseInt(match[3], 10)
          measurements.push({
            qubit,
            classicalBit: measurements.length,
            position: position++,
            line: lineNum,
            column: match.index || 0,
          })
        } else if (match[4]) {
          const wiresStr = match[4]
          if (wiresStr.includes('range')) {
            for (let q = 0; q < numQubits; q++) {
              measurements.push({
                qubit: q,
                classicalBit: q,
                position: position++,
                line: lineNum,
                column: match.index || 0,
              })
            }
          } else {
            const wires = wiresStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
            for (const qubit of wires) {
              measurements.push({
                qubit,
                classicalBit: measurements.length,
                position: position++,
                line: lineNum,
                column: match.index || 0,
              })
            }
          }
        } else {
          for (let q = 0; q < numQubits; q++) {
            measurements.push({
              qubit: q,
              classicalBit: q,
              position: position++,
              line: lineNum,
              column: match.index || 0,
            })
          }
        }
      }
    }

    if (numQubits === 0) {
      numQubits = 1
    }

    const usedQubits = new Set<number>()
    gates.forEach((g) => {
      g.qubits.forEach((q) => usedQubits.add(q))
      g.controlQubits.forEach((q) => usedQubits.add(q))
    })
    measurements.forEach((m) => usedQubits.add(m.qubit))

    for (let q = 0; q < numQubits; q++) {
      if (!usedQubits.has(q)) {
        warnings.push(createParseWarning('W001', `Wire ${q} is declared but never used`))
      }
    }

    if (measurements.length === 0 && gates.length > 0) {
      warnings.push(createParseWarning('W002', 'Circuit has no return statement (measurements)'))
    }

    const circuit: ParsedCircuit = {
      numQubits,
      numClassicalBits: numQubits,
      gates,
      measurements,
      registers: [{ name: 'wires', size: numQubits, startIndex: 0 }],
      classicalRegisters: [{ name: 'c', size: numQubits, startIndex: 0 }],
      metadata: {
        hasBarriers: false,
        hasCustomGates: false,
        hasConditionals: false,
        totalOperations: gates.length + measurements.length,
        circuitDepth: this.calculateDepth(gates, numQubits),
        maxQubitIndex: numQubits > 0 ? numQubits - 1 : 0,
      },
    }

    return {
      success: errors.length === 0,
      circuit: errors.length === 0 ? circuit : null,
      errors,
      warnings,
      parseTimeMs: performance.now() - startTime,
      language: 'pennylane',
    }
  }

  validateSyntax(code: string): ParseError[] {
    return this.parse(code).errors
  }

  extractRegisters(code: string): { quantum: QuantumRegister[]; classical: ClassicalRegister[] } {
    const result = this.parse(code)
    return {
      quantum: result.circuit?.registers || [],
      classical: result.circuit?.classicalRegisters || [],
    }
  }

  supportsFeature(feature: ParserFeature): boolean {
    const supported: ParserFeature[] = ['parametric_gates', 'multi_qubit_measure']
    return supported.includes(feature)
  }

  private parseParameter(paramStr: string): number {
    let expr = paramStr.trim()

    expr = expr.replace(/np\.pi/gi, String(Math.PI))
    expr = expr.replace(/numpy\.pi/gi, String(Math.PI))
    expr = expr.replace(/math\.pi/gi, String(Math.PI))
    expr = expr.replace(/\bpi\b/gi, String(Math.PI))
    expr = expr.replace(/π/g, String(Math.PI))

    expr = expr.replace(/params\[\d+\]/gi, '0')
    expr = expr.replace(/\w+\[\d+\]/gi, '0')

    try {
      return Function(`"use strict"; return (${expr})`)()
    } catch {
      return parseFloat(expr) || 0
    }
  }

  private calculateDepth(gates: ParsedGate[], numQubits: number): number {
    if (gates.length === 0) return 0

    const qubitDepth: number[] = new Array(numQubits).fill(0)

    for (const gate of gates) {
      const allQubits = [...gate.qubits, ...gate.controlQubits]
      const maxDepth = Math.max(...allQubits.map((q) => qubitDepth[q] || 0))

      for (const q of allQubits) {
        qubitDepth[q] = maxDepth + 1
      }
    }

    return Math.max(...qubitDepth, 0)
  }
}

export const pennyLaneParser = new PennyLaneParser()

export function parsePennyLane(code: string): ParseResult {
  return pennyLaneParser.parse(code)
}
