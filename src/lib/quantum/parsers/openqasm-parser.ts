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
  openqasm: /^OPENQASM\s+([\d.]+)\s*;/,
  include: /^include\s+"([^"]+)"\s*;/,

  qreg: /^qreg\s+(\w+)\s*\[\s*(\d+)\s*\]\s*;/,
  creg: /^creg\s+(\w+)\s*\[\s*(\d+)\s*\]\s*;/,

  singleGate: /^(\w+)\s+(\w+)\s*\[\s*(\d+)\s*\]\s*;/,
  singleGateParam: /^(\w+)\s*\(\s*([^)]+)\s*\)\s+(\w+)\s*\[\s*(\d+)\s*\]\s*;/,

  twoQubitGate: /^(\w+)\s+(\w+)\s*\[\s*(\d+)\s*\]\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*;/,
  twoQubitGateParam: /^(\w+)\s*\(\s*([^)]+)\s*\)\s+(\w+)\s*\[\s*(\d+)\s*\]\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*;/,

  threeQubitGate: /^(\w+)\s+(\w+)\s*\[\s*(\d+)\s*\]\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*,\s*(\w+)\s*\[\s*(\d+)\s*\]\s*;/,

  measure: /^measure\s+(\w+)\s*\[\s*(\d+)\s*\]\s*->\s*(\w+)\s*\[\s*(\d+)\s*\]\s*;/,
  measureAll: /^measure\s+(\w+)\s*->\s*(\w+)\s*;/,

  barrier: /^barrier\s+(.+)\s*;/,
  barrierAll: /^barrier\s+(\w+)\s*;/,

  reset: /^reset\s+(\w+)\s*\[\s*(\d+)\s*\]\s*;/,

  comment: /^\/\/.*/,
  multilineCommentStart: /^\/\*/,
  multilineCommentEnd: /\*\//,

  empty: /^\s*$/,
}

export class OpenQASMParser implements QuantumCodeParser {
  language = 'openqasm' as const

  parse(code: string): ParseResult {
    const startTime = performance.now()
    const errors: ParseError[] = []
    const warnings: ParseWarning[] = []

    const lines = code.split('\n')
    const quantumRegisters: QuantumRegister[] = []
    const classicalRegisters: ClassicalRegister[] = []
    const gates: ParsedGate[] = []
    const measurements: ParsedMeasurement[] = []

    let position = 0
    let inMultilineComment = false
    let hasOpenQASMHeader = false
    let totalQubits = 0
    let totalClassicalBits = 0

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineNum = lineIndex + 1
      let line = lines[lineIndex].trim()

      // Skip empty lines
      if (PATTERNS.empty.test(line)) continue

      // Handle multiline comments
      if (inMultilineComment) {
        if (PATTERNS.multilineCommentEnd.test(line)) {
          inMultilineComment = false
        }
        continue
      }

      if (PATTERNS.multilineCommentStart.test(line)) {
        if (!PATTERNS.multilineCommentEnd.test(line)) {
          inMultilineComment = true
        }
        continue
      }

      // Skip single-line comments
      if (PATTERNS.comment.test(line)) continue

      // Remove inline comments
      const commentIndex = line.indexOf('//')
      if (commentIndex !== -1) {
        line = line.substring(0, commentIndex).trim()
      }

      if (PATTERNS.empty.test(line)) continue

      // Parse OPENQASM header
      const openqasmMatch = line.match(PATTERNS.openqasm)
      if (openqasmMatch) {
        hasOpenQASMHeader = true
        const version = openqasmMatch[1]
        if (version !== '2.0' && !version.startsWith('2.')) {
          warnings.push(
            createParseWarning('W010', `OpenQASM version ${version} may not be fully supported`, {
              line: lineNum,
            })
          )
        }
        continue
      }

      // Parse include
      if (PATTERNS.include.test(line)) {
        continue // We support standard gates by default
      }

      // Parse quantum register
      const qregMatch = line.match(PATTERNS.qreg)
      if (qregMatch) {
        const [, name, sizeStr] = qregMatch
        const size = parseInt(sizeStr, 10)
        quantumRegisters.push({
          name,
          size,
          startIndex: totalQubits,
        })
        totalQubits += size
        continue
      }

      // Parse classical register
      const cregMatch = line.match(PATTERNS.creg)
      if (cregMatch) {
        const [, name, sizeStr] = cregMatch
        const size = parseInt(sizeStr, 10)
        classicalRegisters.push({
          name,
          size,
          startIndex: totalClassicalBits,
        })
        totalClassicalBits += size
        continue
      }

      // Parse barrier
      if (line.startsWith('barrier')) {
        const barrierMatch = line.match(PATTERNS.barrier)
        if (barrierMatch) {
          const barrierQubits = this.parseBarrierQubits(barrierMatch[1], quantumRegisters)
          gates.push({
            id: generateGateId(),
            type: 'Barrier',
            qubits: barrierQubits,
            parameters: [],
            controlQubits: [],
            position: position++,
            line: lineNum,
            column: 1,
            sourceCode: line,
            isConditional: false,
          })
        }
        continue
      }

      // Parse reset
      const resetMatch = line.match(PATTERNS.reset)
      if (resetMatch) {
        const [, regName, indexStr] = resetMatch
        const qubit = this.resolveQubit(regName, parseInt(indexStr, 10), quantumRegisters)
        if (qubit === null) {
          errors.push(
            createParseError('E007', `Quantum register '${regName}' not defined`, lineNum, 1)
          )
          continue
        }
        gates.push({
          id: generateGateId(),
          type: 'Reset',
          qubits: [qubit],
          parameters: [],
          controlQubits: [],
          position: position++,
          line: lineNum,
          column: 1,
          sourceCode: line,
          isConditional: false,
        })
        continue
      }

      // Parse measurement
      const measureMatch = line.match(PATTERNS.measure)
      if (measureMatch) {
        const [, qRegName, qIndexStr, cRegName, cIndexStr] = measureMatch
        const qubit = this.resolveQubit(qRegName, parseInt(qIndexStr, 10), quantumRegisters)
        const cbit = this.resolveClassicalBit(cRegName, parseInt(cIndexStr, 10), classicalRegisters)

        if (qubit === null) {
          errors.push(
            createParseError('E007', `Quantum register '${qRegName}' not defined`, lineNum, 1)
          )
          continue
        }
        if (cbit === null) {
          errors.push(
            createParseError('E007', `Classical register '${cRegName}' not defined`, lineNum, 1)
          )
          continue
        }

        measurements.push({
          qubit,
          classicalBit: cbit,
          position: position++,
          line: lineNum,
          column: 1,
        })
        continue
      }

      // Parse measure all
      const measureAllMatch = line.match(PATTERNS.measureAll)
      if (measureAllMatch) {
        const [, qRegName, cRegName] = measureAllMatch
        const qReg = quantumRegisters.find((r) => r.name === qRegName)
        const cReg = classicalRegisters.find((r) => r.name === cRegName)

        if (!qReg) {
          errors.push(
            createParseError('E007', `Quantum register '${qRegName}' not defined`, lineNum, 1)
          )
          continue
        }
        if (!cReg) {
          errors.push(
            createParseError('E007', `Classical register '${cRegName}' not defined`, lineNum, 1)
          )
          continue
        }

        for (let i = 0; i < Math.min(qReg.size, cReg.size); i++) {
          measurements.push({
            qubit: qReg.startIndex + i,
            classicalBit: cReg.startIndex + i,
            position: position++,
            line: lineNum,
            column: 1,
          })
        }
        continue
      }

      // Parse three-qubit gate (e.g., ccx)
      const threeQubitMatch = line.match(PATTERNS.threeQubitGate)
      if (threeQubitMatch) {
        const gate = this.parseThreeQubitGate(threeQubitMatch, quantumRegisters, lineNum, line, position++)
        if (gate.error) {
          errors.push(gate.error)
        } else if (gate.gate) {
          gates.push(gate.gate)
        }
        continue
      }

      // Parse two-qubit gate with parameters
      const twoQubitParamMatch = line.match(PATTERNS.twoQubitGateParam)
      if (twoQubitParamMatch) {
        const gate = this.parseTwoQubitGateWithParams(twoQubitParamMatch, quantumRegisters, lineNum, line, position++)
        if (gate.error) {
          errors.push(gate.error)
        } else if (gate.gate) {
          gates.push(gate.gate)
        }
        continue
      }

      // Parse two-qubit gate
      const twoQubitMatch = line.match(PATTERNS.twoQubitGate)
      if (twoQubitMatch) {
        const gate = this.parseTwoQubitGate(twoQubitMatch, quantumRegisters, lineNum, line, position++)
        if (gate.error) {
          errors.push(gate.error)
        } else if (gate.gate) {
          gates.push(gate.gate)
        }
        continue
      }

      // Parse single-qubit gate with parameters
      const singleParamMatch = line.match(PATTERNS.singleGateParam)
      if (singleParamMatch) {
        const gate = this.parseSingleGateWithParams(singleParamMatch, quantumRegisters, lineNum, line, position++)
        if (gate.error) {
          errors.push(gate.error)
        } else if (gate.gate) {
          gates.push(gate.gate)
        }
        continue
      }

      // Parse single-qubit gate
      const singleMatch = line.match(PATTERNS.singleGate)
      if (singleMatch) {
        const gate = this.parseSingleGate(singleMatch, quantumRegisters, lineNum, line, position++)
        if (gate.error) {
          errors.push(gate.error)
        } else if (gate.gate) {
          gates.push(gate.gate)
        }
        continue
      }

      // Unknown line
      if (line.length > 0) {
        errors.push(
          createParseError('E006', `Unrecognized syntax: ${line}`, lineNum, 1, {
            sourceCode: line,
          })
        )
      }
    }

    // Warnings
    if (!hasOpenQASMHeader) {
      warnings.push(
        createParseWarning('W010', 'Missing OPENQASM header (assuming OPENQASM 2.0)', { line: 1 })
      )
    }

    // Check for unused qubits
    const usedQubits = new Set<number>()
    gates.forEach((g) => {
      g.qubits.forEach((q) => usedQubits.add(q))
      g.controlQubits.forEach((q) => usedQubits.add(q))
    })
    measurements.forEach((m) => usedQubits.add(m.qubit))

    for (let q = 0; q < totalQubits; q++) {
      if (!usedQubits.has(q)) {
        warnings.push(createParseWarning('W001', `Qubit ${q} is declared but never used`))
      }
    }

    // Check for no measurements
    if (measurements.length === 0 && gates.length > 0) {
      warnings.push(createParseWarning('W002', 'Circuit has no measurements'))
    }

    const circuit: ParsedCircuit = {
      numQubits: totalQubits || 1, // Default to 1 qubit if none declared
      numClassicalBits: totalClassicalBits,
      gates,
      measurements,
      registers: quantumRegisters,
      classicalRegisters,
      metadata: {
        hasBarriers: gates.some((g) => g.type === 'Barrier'),
        hasCustomGates: false,
        hasConditionals: gates.some((g) => g.isConditional),
        totalOperations: gates.length + measurements.length,
        circuitDepth: this.calculateDepth(gates, totalQubits),
        maxQubitIndex: totalQubits > 0 ? totalQubits - 1 : 0,
      },
    }

    return {
      success: errors.length === 0,
      circuit: errors.length === 0 ? circuit : null,
      errors,
      warnings,
      parseTimeMs: performance.now() - startTime,
      language: 'openqasm',
    }
  }

  validateSyntax(code: string): ParseError[] {
    return this.parse(code).errors
  }

  extractRegisters(code: string): { quantum: QuantumRegister[]; classical: ClassicalRegister[] } {
    const quantum: QuantumRegister[] = []
    const classical: ClassicalRegister[] = []
    let totalQubits = 0
    let totalClassicalBits = 0

    const lines = code.split('\n')
    for (const line of lines) {
      const qregMatch = line.match(PATTERNS.qreg)
      if (qregMatch) {
        const [, name, sizeStr] = qregMatch
        const size = parseInt(sizeStr, 10)
        quantum.push({ name, size, startIndex: totalQubits })
        totalQubits += size
      }

      const cregMatch = line.match(PATTERNS.creg)
      if (cregMatch) {
        const [, name, sizeStr] = cregMatch
        const size = parseInt(sizeStr, 10)
        classical.push({ name, size, startIndex: totalClassicalBits })
        totalClassicalBits += size
      }
    }

    return { quantum, classical }
  }

  supportsFeature(feature: ParserFeature): boolean {
    const supported: ParserFeature[] = ['barriers', 'reset', 'parametric_gates', 'multi_qubit_measure']
    return supported.includes(feature)
  }

  private resolveQubit(
    regName: string,
    index: number,
    registers: QuantumRegister[]
  ): number | null {
    const reg = registers.find((r) => r.name === regName)
    if (!reg) return null
    if (index < 0 || index >= reg.size) return null
    return reg.startIndex + index
  }

  private resolveClassicalBit(
    regName: string,
    index: number,
    registers: ClassicalRegister[]
  ): number | null {
    const reg = registers.find((r) => r.name === regName)
    if (!reg) return null
    if (index < 0 || index >= reg.size) return null
    return reg.startIndex + index
  }

  private parseBarrierQubits(barrierStr: string, registers: QuantumRegister[]): number[] {
    const qubits: number[] = []
    const parts = barrierStr.split(',').map((s) => s.trim())

    for (const part of parts) {
      const match = part.match(/(\w+)\s*\[\s*(\d+)\s*\]/)
      if (match) {
        const qubit = this.resolveQubit(match[1], parseInt(match[2], 10), registers)
        if (qubit !== null) qubits.push(qubit)
      } else {
        const reg = registers.find((r) => r.name === part)
        if (reg) {
          for (let i = 0; i < reg.size; i++) {
            qubits.push(reg.startIndex + i)
          }
        }
      }
    }

    return qubits
  }

  private parseParameter(paramStr: string): number {
    let expr = paramStr.trim()
    expr = expr.replace(/pi/gi, String(Math.PI))
    expr = expr.replace(/π/g, String(Math.PI))

    try {
      return Function(`"use strict"; return (${expr})`)()
    } catch {
      return parseFloat(expr) || 0
    }
  }

  private parseParameters(paramStr: string): number[] {
    return paramStr.split(',').map((p) => this.parseParameter(p))
  }

  private parseSingleGate(
    match: RegExpMatchArray,
    registers: QuantumRegister[],
    lineNum: number,
    line: string,
    position: number
  ): { gate?: ParsedGate; error?: ParseError } {
    const [, gateName, regName, indexStr] = match
    const gateType = GATE_NAME_MAP[gateName.toLowerCase()]

    if (!gateType) {
      return {
        error: createParseError('E005', `Unknown gate: ${gateName}`, lineNum, 1, {
          sourceCode: line,
          suggestion: `Did you mean 'h', 'x', 'y', 'z', 's', 't', 'rx', 'ry', 'rz'?`,
        }),
      }
    }

    const qubit = this.resolveQubit(regName, parseInt(indexStr, 10), registers)
    if (qubit === null) {
      return {
        error: createParseError('E007', `Quantum register '${regName}' not defined or index out of range`, lineNum, 1),
      }
    }

    return {
      gate: {
        id: generateGateId(),
        type: gateType,
        qubits: [qubit],
        parameters: [],
        controlQubits: [],
        position,
        line: lineNum,
        column: 1,
        sourceCode: line,
        isConditional: false,
      },
    }
  }

  private parseSingleGateWithParams(
    match: RegExpMatchArray,
    registers: QuantumRegister[],
    lineNum: number,
    line: string,
    position: number
  ): { gate?: ParsedGate; error?: ParseError } {
    const [, gateName, paramStr, regName, indexStr] = match
    const gateType = GATE_NAME_MAP[gateName.toLowerCase()]

    if (!gateType) {
      return {
        error: createParseError('E005', `Unknown gate: ${gateName}`, lineNum, 1),
      }
    }

    const qubit = this.resolveQubit(regName, parseInt(indexStr, 10), registers)
    if (qubit === null) {
      return {
        error: createParseError('E007', `Quantum register '${regName}' not defined`, lineNum, 1),
      }
    }

    const params = this.parseParameters(paramStr)
    const expectedParams = getExpectedParamCount(gateType)

    if (params.length < expectedParams) {
      return {
        error: createParseError(
          'E003',
          `Gate ${gateName} requires ${expectedParams} parameter(s), got ${params.length}`,
          lineNum,
          1
        ),
      }
    }

    return {
      gate: {
        id: generateGateId(),
        type: gateType,
        qubits: [qubit],
        parameters: params,
        controlQubits: [],
        position,
        line: lineNum,
        column: 1,
        sourceCode: line,
        isConditional: false,
      },
    }
  }

  private parseTwoQubitGate(
    match: RegExpMatchArray,
    registers: QuantumRegister[],
    lineNum: number,
    line: string,
    position: number
  ): { gate?: ParsedGate; error?: ParseError } {
    const [, gateName, reg1Name, idx1Str, reg2Name, idx2Str] = match
    const gateType = GATE_NAME_MAP[gateName.toLowerCase()]

    if (!gateType) {
      return {
        error: createParseError('E005', `Unknown gate: ${gateName}`, lineNum, 1),
      }
    }

    const qubit1 = this.resolveQubit(reg1Name, parseInt(idx1Str, 10), registers)
    const qubit2 = this.resolveQubit(reg2Name, parseInt(idx2Str, 10), registers)

    if (qubit1 === null) {
      return {
        error: createParseError('E007', `Quantum register '${reg1Name}' not defined`, lineNum, 1),
      }
    }
    if (qubit2 === null) {
      return {
        error: createParseError('E007', `Quantum register '${reg2Name}' not defined`, lineNum, 1),
      }
    }

    if (qubit1 === qubit2) {
      return {
        error: createParseError('E004', 'Control and target qubits must be different', lineNum, 1),
      }
    }

    const isControlled = ['CNOT', 'CX', 'CY', 'CZ', 'CRx', 'CRy', 'CRz', 'CPhase'].includes(gateType)

    return {
      gate: {
        id: generateGateId(),
        type: gateType,
        qubits: isControlled ? [qubit2] : [qubit1, qubit2],
        parameters: [],
        controlQubits: isControlled ? [qubit1] : [],
        position,
        line: lineNum,
        column: 1,
        sourceCode: line,
        isConditional: false,
      },
    }
  }

  private parseTwoQubitGateWithParams(
    match: RegExpMatchArray,
    registers: QuantumRegister[],
    lineNum: number,
    line: string,
    position: number
  ): { gate?: ParsedGate; error?: ParseError } {
    const [, gateName, paramStr, reg1Name, idx1Str, reg2Name, idx2Str] = match
    const gateType = GATE_NAME_MAP[gateName.toLowerCase()]

    if (!gateType) {
      return {
        error: createParseError('E005', `Unknown gate: ${gateName}`, lineNum, 1),
      }
    }

    const qubit1 = this.resolveQubit(reg1Name, parseInt(idx1Str, 10), registers)
    const qubit2 = this.resolveQubit(reg2Name, parseInt(idx2Str, 10), registers)

    if (qubit1 === null || qubit2 === null) {
      return {
        error: createParseError('E007', 'Quantum register not defined', lineNum, 1),
      }
    }

    if (qubit1 === qubit2) {
      return {
        error: createParseError('E004', 'Control and target qubits must be different', lineNum, 1),
      }
    }

    const params = this.parseParameters(paramStr)

    return {
      gate: {
        id: generateGateId(),
        type: gateType,
        qubits: [qubit2],
        parameters: params,
        controlQubits: [qubit1],
        position,
        line: lineNum,
        column: 1,
        sourceCode: line,
        isConditional: false,
      },
    }
  }

  private parseThreeQubitGate(
    match: RegExpMatchArray,
    registers: QuantumRegister[],
    lineNum: number,
    line: string,
    position: number
  ): { gate?: ParsedGate; error?: ParseError } {
    const [, gateName, reg1Name, idx1Str, reg2Name, idx2Str, reg3Name, idx3Str] = match
    const gateType = GATE_NAME_MAP[gateName.toLowerCase()]

    if (!gateType) {
      return {
        error: createParseError('E005', `Unknown gate: ${gateName}`, lineNum, 1),
      }
    }

    const qubit1 = this.resolveQubit(reg1Name, parseInt(idx1Str, 10), registers)
    const qubit2 = this.resolveQubit(reg2Name, parseInt(idx2Str, 10), registers)
    const qubit3 = this.resolveQubit(reg3Name, parseInt(idx3Str, 10), registers)

    if (qubit1 === null || qubit2 === null || qubit3 === null) {
      return {
        error: createParseError('E007', 'Quantum register not defined', lineNum, 1),
      }
    }

    return {
      gate: {
        id: generateGateId(),
        type: gateType,
        qubits: [qubit3],
        parameters: [],
        controlQubits: [qubit1, qubit2],
        position,
        line: lineNum,
        column: 1,
        sourceCode: line,
        isConditional: false,
      },
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

export const openQASMParser = new OpenQASMParser()

export function parseOpenQASM(code: string): ParseResult {
  return openQASMParser.parse(code)
}
