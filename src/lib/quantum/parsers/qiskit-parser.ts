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
  GATE_NAME_MAP,
  getExpectedParamCount,
} from './types'

const PATTERNS = {
  quantumRegister: /QuantumRegister\s*\(\s*(\d+)(?:\s*,\s*['"](\w+)['"]\s*)?\)/g,
  classicalRegister: /ClassicalRegister\s*\(\s*(\d+)(?:\s*,\s*['"](\w+)['"]\s*)?\)/g,

  quantumCircuitFull: /QuantumCircuit\s*\(\s*(\w+)\s*(?:,\s*(\w+)\s*)?\)/,
  quantumCircuitSimple: /QuantumCircuit\s*\(\s*(\d+)(?:\s*,\s*(\d+))?\s*\)/,

  singleGateSimple: /\.(\w+)\s*\(\s*(\d+)\s*\)/g,
  singleGateReg: /\.(\w+)\s*\(\s*(\w+)\s*\[\s*(\d+)\s*\]\s*\)/g,

  singleGateParams: /\.(\w+)\s*\(\s*([\d.e+-]+(?:\s*\*\s*(?:np\.)?pi)?)\s*,\s*(\d+)\s*\)/g,
  singleGateParamsReg: /\.(\w+)\s*\(\s*([\d.e+-]+(?:\s*\*\s*(?:np\.)?pi)?)\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*\)/g,

  uGate: /\.u\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*(\d+)\s*\)/g,
  uGateReg: /\.u\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*\)/g,

  twoGateSimple: /\.(cx|cy|cz|swap|ch)\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi,
  twoGateReg: /\.(cx|cy|cz|swap|ch)\s*\(\s*(\w+)\s*\[\s*(\d+)\s*\]\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*\)/gi,

  twoGateParams: /\.(crx|cry|crz|cp)\s*\(\s*([\d.e+-]+(?:\s*\*\s*(?:np\.)?pi)?)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi,
  twoGateParamsReg: /\.(crx|cry|crz|cp)\s*\(\s*([\d.e+-]+(?:\s*\*\s*(?:np\.)?pi)?)\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*\)/gi,

  threeGateSimple: /\.(ccx|cswap|toffoli|fredkin)\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi,
  threeGateReg: /\.(ccx|cswap|toffoli|fredkin)\s*\(\s*(\w+)\s*\[\s*(\d+)\s*\]\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*\)/gi,

  measureSingle: /\.measure\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g,
  measureRegSingle: /\.measure\s*\(\s*(\w+)\s*\[\s*(\d+)\s*\]\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*\)/g,
  measureAll: /\.measure_all\s*\(\s*\)/g,
  measureReg: /\.measure\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/g,

  barrierSimple: /\.barrier\s*\(\s*([\d,\s]+)\s*\)/g,
  barrierAll: /\.barrier\s*\(\s*\)/g,

  resetSimple: /\.reset\s*\(\s*(\d+)\s*\)/g,
  resetReg: /\.reset\s*\(\s*(\w+)\s*\[\s*(\d+)\s*\]\s*\)/g,

  comment: /#.*/,

  varAssignment: /(\w+)\s*=\s*/,
}

export class QiskitParser implements QuantumCodeParser {
  language = 'qiskit' as const

  parse(code: string): ParseResult {
    const startTime = performance.now()
    const errors: ParseError[] = []
    const warnings: ParseWarning[] = []

    const quantumRegisters: QuantumRegister[] = []
    const classicalRegisters: ClassicalRegister[] = []
    const gates: ParsedGate[] = []
    const measurements: ParsedMeasurement[] = []

    let position = 0
    let numQubits = 0
    let numClassicalBits = 0

    const lines = code.split('\n')
    const registerVars: Record<string, { type: 'quantum' | 'classical'; name: string }> = {}

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineNum = lineIndex + 1
      let line = lines[lineIndex]

      const commentIndex = line.indexOf('#')
      if (commentIndex !== -1) {
        line = line.substring(0, commentIndex)
      }

      const qrMatch = [...line.matchAll(PATTERNS.quantumRegister)]
      for (const match of qrMatch) {
        const size = parseInt(match[1], 10)
        const name = match[2] || `q${quantumRegisters.length}`

        const varMatch = line.match(PATTERNS.varAssignment)
        const varName = varMatch ? varMatch[1] : name

        registerVars[varName] = { type: 'quantum', name }
        quantumRegisters.push({
          name,
          size,
          startIndex: numQubits,
        })
        numQubits += size
      }

      const crMatch = [...line.matchAll(PATTERNS.classicalRegister)]
      for (const match of crMatch) {
        const size = parseInt(match[1], 10)
        const name = match[2] || `c${classicalRegisters.length}`

        const varMatch = line.match(PATTERNS.varAssignment)
        const varName = varMatch ? varMatch[1] : name

        registerVars[varName] = { type: 'classical', name }
        classicalRegisters.push({
          name,
          size,
          startIndex: numClassicalBits,
        })
        numClassicalBits += size
      }

      const simpleMatch = line.match(PATTERNS.quantumCircuitSimple)
      if (simpleMatch && quantumRegisters.length === 0) {
        numQubits = parseInt(simpleMatch[1], 10)
        if (simpleMatch[2]) {
          numClassicalBits = parseInt(simpleMatch[2], 10)
        }
        quantumRegisters.push({
          name: 'q',
          size: numQubits,
          startIndex: 0,
        })
        if (numClassicalBits > 0) {
          classicalRegisters.push({
            name: 'c',
            size: numClassicalBits,
            startIndex: 0,
          })
        }
      }
    }

    if (numQubits === 0) {
      const maxQubit = this.inferMaxQubit(code)
      numQubits = maxQubit + 1
      quantumRegisters.push({
        name: 'q',
        size: numQubits,
        startIndex: 0,
      })
    }

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineNum = lineIndex + 1
      let line = lines[lineIndex]

      const commentIndex = line.indexOf('#')
      if (commentIndex !== -1) {
        line = line.substring(0, commentIndex)
      }

      if (line.trim().length === 0) continue

      const singleGateMatches = [...line.matchAll(/\.(\w+)\s*\(\s*(\d+)\s*\)/g)]
      for (const match of singleGateMatches) {
        const gateName = match[1].toLowerCase()
        const gateType = GATE_NAME_MAP[gateName]

        if (gateType && this.isSingleQubitGate(gateName)) {
          const qubit = parseInt(match[2], 10)

          if (qubit >= numQubits) {
            errors.push(
              createParseError('E001', `Qubit ${qubit} exceeds register size (${numQubits})`, lineNum, match.index || 0)
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
        }
      }

      const singleGateRegMatches = [...line.matchAll(/\.(\w+)\s*\(\s*(\w+)\s*\[\s*(\d+)\s*\]\s*\)/g)]
      for (const match of singleGateRegMatches) {
        const gateName = match[1].toLowerCase()
        const gateType = GATE_NAME_MAP[gateName]

        if (gateType && this.isSingleQubitGate(gateName)) {
          const regName = match[2]
          const index = parseInt(match[3], 10)
          const qubit = this.resolveQubit(regName, index, quantumRegisters, registerVars)

          if (qubit === null) {
            errors.push(
              createParseError('E007', `Register '${regName}' not found`, lineNum, match.index || 0)
            )
            continue
          }

          if (qubit >= numQubits) {
            errors.push(
              createParseError('E001', `Qubit index ${index} exceeds register size`, lineNum, match.index || 0)
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
        }
      }

      const rotGateMatches = [...line.matchAll(/\.(rx|ry|rz|p|u1)\s*\(\s*([^,)]+)\s*,\s*(\d+)\s*\)/gi)]
      for (const match of rotGateMatches) {
        const gateName = match[1].toLowerCase()
        const gateType = GATE_NAME_MAP[gateName]
        const param = this.parseParameter(match[2])
        const qubit = parseInt(match[3], 10)

        if (gateType) {
          if (qubit >= numQubits) {
            errors.push(
              createParseError('E001', `Qubit ${qubit} exceeds register size`, lineNum, match.index || 0)
            )
            continue
          }

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
        }
      }

      const rotGateRegMatches = [...line.matchAll(/\.(rx|ry|rz|p|u1)\s*\(\s*([^,)]+)\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*\)/gi)]
      for (const match of rotGateRegMatches) {
        const gateName = match[1].toLowerCase()
        const gateType = GATE_NAME_MAP[gateName]
        const param = this.parseParameter(match[2])
        const regName = match[3]
        const index = parseInt(match[4], 10)
        const qubit = this.resolveQubit(regName, index, quantumRegisters, registerVars)

        if (gateType && qubit !== null) {
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
        }
      }

      const uGateMatches = [...line.matchAll(/\.u\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*(\d+)\s*\)/gi)]
      for (const match of uGateMatches) {
        const theta = this.parseParameter(match[1])
        const phi = this.parseParameter(match[2])
        const lam = this.parseParameter(match[3])
        const qubit = parseInt(match[4], 10)

        if (qubit < numQubits) {
          gates.push({
            id: generateGateId(),
            type: 'U',
            qubits: [qubit],
            parameters: [theta, phi, lam],
            controlQubits: [],
            position: position++,
            line: lineNum,
            column: match.index || 0,
            sourceCode: match[0],
            isConditional: false,
          })
        }
      }

      const twoGateMatches = [...line.matchAll(/\.(cx|cy|cz|swap|ch)\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi)]
      for (const match of twoGateMatches) {
        const gateName = match[1].toLowerCase()
        const gateType = GATE_NAME_MAP[gateName]
        const qubit1 = parseInt(match[2], 10)
        const qubit2 = parseInt(match[3], 10)

        if (gateType) {
          if (qubit1 >= numQubits || qubit2 >= numQubits) {
            errors.push(
              createParseError('E001', `Qubit index exceeds register size`, lineNum, match.index || 0)
            )
            continue
          }

          if (qubit1 === qubit2) {
            errors.push(
              createParseError('E004', 'Control and target qubits must be different', lineNum, match.index || 0)
            )
            continue
          }

          const isControlled = ['CNOT', 'CX', 'CY', 'CZ'].includes(gateType)

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

      const twoGateRegMatches = [...line.matchAll(/\.(cx|cy|cz|swap|ch)\s*\(\s*(\w+)\s*\[\s*(\d+)\s*\]\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*\)/gi)]
      for (const match of twoGateRegMatches) {
        const gateName = match[1].toLowerCase()
        const gateType = GATE_NAME_MAP[gateName]
        const qubit1 = this.resolveQubit(match[2], parseInt(match[3], 10), quantumRegisters, registerVars)
        const qubit2 = this.resolveQubit(match[4], parseInt(match[5], 10), quantumRegisters, registerVars)

        if (gateType && qubit1 !== null && qubit2 !== null) {
          if (qubit1 === qubit2) {
            errors.push(
              createParseError('E004', 'Control and target qubits must be different', lineNum, match.index || 0)
            )
            continue
          }

          const isControlled = ['CNOT', 'CX', 'CY', 'CZ'].includes(gateType)

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

      const crGateMatches = [...line.matchAll(/\.(crx|cry|crz|cp)\s*\(\s*([^,)]+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi)]
      for (const match of crGateMatches) {
        const gateName = match[1].toLowerCase()
        const gateType = GATE_NAME_MAP[gateName]
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
        }
      }

      const threeGateMatches = [...line.matchAll(/\.(ccx|cswap|toffoli|fredkin)\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi)]
      for (const match of threeGateMatches) {
        const gateName = match[1].toLowerCase()
        const gateType = GATE_NAME_MAP[gateName]
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
        }
      }

      const measureMatches = [...line.matchAll(/\.measure\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g)]
      for (const match of measureMatches) {
        const qubit = parseInt(match[1], 10)
        const cbit = parseInt(match[2], 10)

        measurements.push({
          qubit,
          classicalBit: cbit,
          position: position++,
          line: lineNum,
          column: match.index || 0,
        })
      }

      const measureRegMatches = [...line.matchAll(/\.measure\s*\(\s*(\w+)\s*\[\s*(\d+)\s*\]\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*\)/g)]
      for (const match of measureRegMatches) {
        const qubit = this.resolveQubit(match[1], parseInt(match[2], 10), quantumRegisters, registerVars)
        const cbit = this.resolveClassicalBit(match[3], parseInt(match[4], 10), classicalRegisters, registerVars)

        if (qubit !== null && cbit !== null) {
          measurements.push({
            qubit,
            classicalBit: cbit,
            position: position++,
            line: lineNum,
            column: match.index || 0,
          })
        }
      }

      if (/\.measure_all\s*\(\s*\)/.test(line)) {
        for (let q = 0; q < numQubits; q++) {
          measurements.push({
            qubit: q,
            classicalBit: q,
            position: position++,
            line: lineNum,
            column: 0,
          })
        }
        if (numClassicalBits < numQubits) {
          numClassicalBits = numQubits
        }
      }

      const barrierMatches = [...line.matchAll(/\.barrier\s*\(\s*([\d,\s]*)\s*\)/g)]
      for (const match of barrierMatches) {
        let barrierQubits: number[]
        if (match[1].trim() === '') {
          barrierQubits = Array.from({ length: numQubits }, (_, i) => i)
        } else {
          barrierQubits = match[1].split(',').map((s) => parseInt(s.trim(), 10))
        }

        gates.push({
          id: generateGateId(),
          type: 'Barrier',
          qubits: barrierQubits,
          parameters: [],
          controlQubits: [],
          position: position++,
          line: lineNum,
          column: match.index || 0,
          sourceCode: match[0],
          isConditional: false,
        })
      }

      const resetMatches = [...line.matchAll(/\.reset\s*\(\s*(\d+)\s*\)/g)]
      for (const match of resetMatches) {
        const qubit = parseInt(match[1], 10)

        gates.push({
          id: generateGateId(),
          type: 'Reset',
          qubits: [qubit],
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
      numClassicalBits: numClassicalBits || numQubits,
      gates,
      measurements,
      registers: quantumRegisters,
      classicalRegisters,
      metadata: {
        hasBarriers: gates.some((g) => g.type === 'Barrier'),
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
      language: 'qiskit',
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
    const supported: ParserFeature[] = ['barriers', 'reset', 'parametric_gates', 'multi_qubit_measure']
    return supported.includes(feature)
  }

  private isSingleQubitGate(gateName: string): boolean {
    const singleGates = ['h', 'x', 'y', 'z', 's', 't', 'sdg', 'tdg', 'id', 'i', 'sx', 'sxdg']
    return singleGates.includes(gateName.toLowerCase())
  }

  private parseParameter(paramStr: string): number {
    let expr = paramStr.trim()

    expr = expr.replace(/np\.pi/gi, String(Math.PI))
    expr = expr.replace(/math\.pi/gi, String(Math.PI))
    expr = expr.replace(/\bpi\b/gi, String(Math.PI))
    expr = expr.replace(/π/g, String(Math.PI))

    try {
      return Function(`"use strict"; return (${expr})`)()
    } catch {
      return parseFloat(expr) || 0
    }
  }

  private resolveQubit(
    regName: string,
    index: number,
    registers: QuantumRegister[],
    varMap: Record<string, { type: 'quantum' | 'classical'; name: string }>
  ): number | null {
    const varInfo = varMap[regName]
    if (varInfo && varInfo.type === 'quantum') {
      const reg = registers.find((r) => r.name === varInfo.name)
      if (reg && index < reg.size) {
        return reg.startIndex + index
      }
    }

    const reg = registers.find((r) => r.name === regName)
    if (reg && index < reg.size) {
      return reg.startIndex + index
    }

    if (registers.length === 1) {
      const singleReg = registers[0]
      if (index < singleReg.size) {
        return singleReg.startIndex + index
      }
    }

    return null
  }

  private resolveClassicalBit(
    regName: string,
    index: number,
    registers: ClassicalRegister[],
    varMap: Record<string, { type: 'quantum' | 'classical'; name: string }>
  ): number | null {
    const varInfo = varMap[regName]
    if (varInfo && varInfo.type === 'classical') {
      const reg = registers.find((r) => r.name === varInfo.name)
      if (reg && index < reg.size) {
        return reg.startIndex + index
      }
    }

    const reg = registers.find((r) => r.name === regName)
    if (reg && index < reg.size) {
      return reg.startIndex + index
    }

    if (registers.length === 1) {
      const singleReg = registers[0]
      if (index < singleReg.size) {
        return singleReg.startIndex + index
      }
    }

    return null
  }

  private inferMaxQubit(code: string): number {
    let maxQubit = 0

    const matches = code.matchAll(/\(\s*(\d+)\s*[,)]/g)
    for (const match of matches) {
      const num = parseInt(match[1], 10)
      if (num > maxQubit) maxQubit = num
    }

    return maxQubit
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

export const qiskitParser = new QiskitParser()

export function parseQiskit(code: string): ParseResult {
  return qiskitParser.parse(code)
}
