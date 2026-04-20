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

const CIRQ_GATE_MAP: Record<string, GateType> = {
  'H': 'H',
  'X': 'X',
  'Y': 'Y',
  'Z': 'Z',
  'S': 'S',
  'T': 'T',
  'Rx': 'Rx',
  'Ry': 'Ry',
  'Rz': 'Rz',
  'rx': 'Rx',
  'ry': 'Ry',
  'rz': 'Rz',
  'CNOT': 'CNOT',
  'CX': 'CNOT',
  'CZ': 'CZ',
  'SWAP': 'SWAP',
  'ISWAP': 'iSWAP',
  'iSWAP': 'iSWAP',
  'CCX': 'Toffoli',
  'TOFFOLI': 'Toffoli',
  'CSWAP': 'Fredkin',
  'FREDKIN': 'Fredkin',
  'ZPowGate': 'Rz',
  'XPowGate': 'Rx',
  'YPowGate': 'Ry',
  'CZPowGate': 'CPhase',
}

export class CirqParser implements QuantumCodeParser {
  language = 'cirq' as const

  parse(code: string): ParseResult {
    const startTime = performance.now()
    const errors: ParseError[] = []
    const warnings: ParseWarning[] = []

    const gates: ParsedGate[] = []
    const measurements: ParsedMeasurement[] = []
    const qubitMap: Map<string, number> = new Map()

    let position = 0
    let maxQubitIndex = -1

    const lines = code.split('\n')

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineNum = lineIndex + 1
      let line = lines[lineIndex]

      const commentIndex = line.indexOf('#')
      if (commentIndex !== -1) {
        line = line.substring(0, commentIndex)
      }

      const lineQubitRangeMatch = line.match(/(\w+(?:\s*,\s*\w+)*)\s*=\s*cirq\.LineQubit\.range\s*\(\s*(\d+)\s*\)/)
      if (lineQubitRangeMatch) {
        const varNames = lineQubitRangeMatch[1].split(',').map((s) => s.trim())
        for (let i = 0; i < varNames.length; i++) {
          qubitMap.set(varNames[i], i)
          if (i > maxQubitIndex) maxQubitIndex = i
        }
      }

      const singleQubitMatches = [...line.matchAll(/(\w+)\s*=\s*cirq\.LineQubit\s*\(\s*(\d+)\s*\)/g)]
      for (const match of singleQubitMatches) {
        const varName = match[1]
        const index = parseInt(match[2], 10)
        qubitMap.set(varName, index)
        if (index > maxQubitIndex) maxQubitIndex = index
      }

      const gridQubitMatches = [...line.matchAll(/(\w+)\s*=\s*cirq\.GridQubit\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g)]
      for (const match of gridQubitMatches) {
        const varName = match[1]
        const row = parseInt(match[2], 10)
        const col = parseInt(match[3], 10)
        const index = row * 10 + col
        qubitMap.set(varName, index)
        if (index > maxQubitIndex) maxQubitIndex = index
      }

      const namedQubitMatches = [...line.matchAll(/(\w+)\s*=\s*cirq\.NamedQubit\s*\(\s*['"]([^'"]+)['"]\s*\)/g)]
      for (const match of namedQubitMatches) {
        const varName = match[1]
        const index = qubitMap.size
        qubitMap.set(varName, index)
        if (index > maxQubitIndex) maxQubitIndex = index
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

      const singleGateMatches = [...line.matchAll(/cirq\.([A-Za-z]+)\s*(?:\(\s*(\w+)\s*\)|\.on\s*\(\s*(\w+)\s*\))/g)]
      for (const match of singleGateMatches) {
        const gateName = match[1]
        const gateType = CIRQ_GATE_MAP[gateName]
        const qubitVar = match[2] || match[3]

        if (gateType && qubitVar) {
          const qubitIndex = this.resolveQubit(qubitVar, qubitMap)
          if (qubitIndex === null) {
            const numericIndex = parseInt(qubitVar, 10)
            if (!isNaN(numericIndex)) {
              gates.push({
                id: generateGateId(),
                type: gateType,
                qubits: [numericIndex],
                parameters: [],
                controlQubits: [],
                position: position++,
                line: lineNum,
                column: match.index || 0,
                sourceCode: match[0],
                isConditional: false,
              })
              if (numericIndex > maxQubitIndex) maxQubitIndex = numericIndex
            }
          } else {
            gates.push({
              id: generateGateId(),
              type: gateType,
              qubits: [qubitIndex],
              parameters: [],
              controlQubits: [],
              position: position++,
              line: lineNum,
              column: match.index || 0,
              sourceCode: match[0],
              isConditional: false,
            })
          }
        }
      }

      const rotGateMatches = [...line.matchAll(/cirq\.([Rr][xyz])\s*\(\s*([^)]+)\s*\)\s*(?:\(\s*(\w+)\s*\)|\.on\s*\(\s*(\w+)\s*\))/gi)]
      for (const match of rotGateMatches) {
        const gateName = match[1]
        const gateType = CIRQ_GATE_MAP[gateName]
        const param = this.parseParameter(match[2])
        const qubitVar = match[3] || match[4]

        if (gateType && qubitVar) {
          const qubitIndex = this.resolveQubit(qubitVar, qubitMap)
          if (qubitIndex !== null) {
            gates.push({
              id: generateGateId(),
              type: gateType,
              qubits: [qubitIndex],
              parameters: [param],
              controlQubits: [],
              position: position++,
              line: lineNum,
              column: match.index || 0,
              sourceCode: match[0],
              isConditional: false,
            })
          }
        }
      }

      const powGateMatches = [...line.matchAll(/cirq\.([XYZ])\s*\*\*\s*([\d.]+)(?:\s*\)\s*\(\s*(\w+)\s*\)|\(\s*(\w+)\s*\))?/gi)]
      for (const match of powGateMatches) {
        const baseName = match[1].toUpperCase()
        const exponent = parseFloat(match[2])
        const qubitVar = match[3] || match[4]

        const rotType: GateType = baseName === 'X' ? 'Rx' : baseName === 'Y' ? 'Ry' : 'Rz'
        const angle = exponent * Math.PI

        if (qubitVar) {
          const qubitIndex = this.resolveQubit(qubitVar, qubitMap)
          if (qubitIndex !== null) {
            gates.push({
              id: generateGateId(),
              type: rotType,
              qubits: [qubitIndex],
              parameters: [angle],
              controlQubits: [],
              position: position++,
              line: lineNum,
              column: match.index || 0,
              sourceCode: match[0],
              isConditional: false,
            })
          }
        }
      }

      const twoGateMatches = [...line.matchAll(/cirq\.(CNOT|CX|CZ|SWAP|ISWAP|iSWAP)\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/gi)]
      for (const match of twoGateMatches) {
        const gateName = match[1]
        const gateType = CIRQ_GATE_MAP[gateName.toUpperCase()]
        const qubit1Var = match[2]
        const qubit2Var = match[3]

        if (gateType) {
          const qubit1 = this.resolveQubit(qubit1Var, qubitMap)
          const qubit2 = this.resolveQubit(qubit2Var, qubitMap)

          if (qubit1 !== null && qubit2 !== null) {
            const isControlled = ['CNOT', 'CZ'].includes(gateType)

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
          }
        }
      }

      const threeGateMatches = [...line.matchAll(/cirq\.(CCX|TOFFOLI|CSWAP|FREDKIN)\s*\(\s*(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*\)/gi)]
      for (const match of threeGateMatches) {
        const gateName = match[1]
        const gateType = CIRQ_GATE_MAP[gateName.toUpperCase()]
        const control1 = this.resolveQubit(match[2], qubitMap)
        const control2 = this.resolveQubit(match[3], qubitMap)
        const target = this.resolveQubit(match[4], qubitMap)

        if (gateType && control1 !== null && control2 !== null && target !== null) {
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
        }
      }

      const onEachMatches = [...line.matchAll(/cirq\.([A-Za-z]+)\.on_each\s*\(\s*([^)]+)\s*\)/g)]
      for (const match of onEachMatches) {
        const gateName = match[1]
        const gateType = CIRQ_GATE_MAP[gateName]
        const qubitsStr = match[2]

        if (gateType) {
          const qubitVars = qubitsStr.split(',').map((s) => s.trim())
          for (const qubitVar of qubitVars) {
            const qubitIndex = this.resolveQubit(qubitVar, qubitMap)
            if (qubitIndex !== null) {
              gates.push({
                id: generateGateId(),
                type: gateType,
                qubits: [qubitIndex],
                parameters: [],
                controlQubits: [],
                position: position++,
                line: lineNum,
                column: match.index || 0,
                sourceCode: match[0],
                isConditional: false,
              })
            }
          }
        }
      }

      const measureMatches = [...line.matchAll(/cirq\.measure\s*\(\s*([^)]+)\s*\)/g)]
      for (const match of measureMatches) {
        const argsStr = match[1]
        const keyIndex = argsStr.indexOf('key=')
        const qubitsStr = keyIndex >= 0 ? argsStr.substring(0, keyIndex) : argsStr
        const qubitVars = qubitsStr.split(',').map((s) => s.trim()).filter((s) => s && !s.includes('='))

        for (let i = 0; i < qubitVars.length; i++) {
          const qubitIndex = this.resolveQubit(qubitVars[i], qubitMap)
          if (qubitIndex !== null) {
            measurements.push({
              qubit: qubitIndex,
              classicalBit: i,
              position: position++,
              line: lineNum,
              column: match.index || 0,
            })
          }
        }
      }
    }

    if (maxQubitIndex < 0) {
      for (const gate of gates) {
        for (const q of [...gate.qubits, ...gate.controlQubits]) {
          if (q > maxQubitIndex) maxQubitIndex = q
        }
      }
      for (const m of measurements) {
        if (m.qubit > maxQubitIndex) maxQubitIndex = m.qubit
      }
    }

    const numQubits = maxQubitIndex + 1 || 1

    const usedQubits = new Set<number>()
    gates.forEach((g) => {
      g.qubits.forEach((q) => usedQubits.add(q))
      g.controlQubits.forEach((q) => usedQubits.add(q))
    })
    measurements.forEach((m) => usedQubits.add(m.qubit))

    for (let q = 0; q < numQubits; q++) {
      if (!usedQubits.has(q)) {
        warnings.push(createParseWarning('W001', `Qubit ${q} is declared but never used`))
      }
    }

    if (measurements.length === 0 && gates.length > 0) {
      warnings.push(createParseWarning('W002', 'Circuit has no measurements'))
    }

    const circuit: ParsedCircuit = {
      numQubits,
      numClassicalBits: measurements.length || numQubits,
      gates,
      measurements,
      registers: [{ name: 'q', size: numQubits, startIndex: 0 }],
      classicalRegisters: [{ name: 'c', size: measurements.length || numQubits, startIndex: 0 }],
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
      language: 'cirq',
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

  private resolveQubit(qubitVar: string, qubitMap: Map<string, number>): number | null {
    if (qubitMap.has(qubitVar)) {
      return qubitMap.get(qubitVar)!
    }

    const numMatch = qubitVar.match(/\d+/)
    if (numMatch) {
      return parseInt(numMatch[0], 10)
    }

    return null
  }

  private parseParameter(paramStr: string): number {
    let expr = paramStr.trim()

    expr = expr.replace(/np\.pi/gi, String(Math.PI))
    expr = expr.replace(/numpy\.pi/gi, String(Math.PI))
    expr = expr.replace(/math\.pi/gi, String(Math.PI))
    expr = expr.replace(/\bpi\b/gi, String(Math.PI))
    expr = expr.replace(/π/g, String(Math.PI))

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

export const cirqParser = new CirqParser()

export function parseCirq(code: string): ParseResult {
  return cirqParser.parse(code)
}
