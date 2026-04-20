export * from './types'
export { openQASMParser, parseOpenQASM } from './openqasm-parser'
export { qiskitParser, parseQiskit } from './qiskit-parser'
export { cirqParser, parseCirq } from './cirq-parser'
export { pennyLaneParser, parsePennyLane } from './pennylane-parser'

import type { ParseResult, ParseLanguage, QuantumCodeParser } from './types'
import { openQASMParser } from './openqasm-parser'
import { qiskitParser } from './qiskit-parser'
import { cirqParser } from './cirq-parser'
import { pennyLaneParser } from './pennylane-parser'

const parsers: Record<ParseLanguage, QuantumCodeParser> = {
  qiskit: qiskitParser,
  cirq: cirqParser,
  pennylane: pennyLaneParser,
  openqasm: openQASMParser,
}

export function getParser(language: ParseLanguage): QuantumCodeParser {
  const parser = parsers[language]
  if (!parser) {
    throw new Error(`No parser available for language: ${language}`)
  }
  return parser
}

export function parseQuantumCode(code: string, language?: ParseLanguage): ParseResult {
  const detectedLanguage = language || detectLanguage(code)
  const parser = getParser(detectedLanguage)
  return parser.parse(code)
}

export function detectLanguage(code: string): ParseLanguage {
  if (code.includes('OPENQASM') || /qreg\s+\w+\[/.test(code) || /creg\s+\w+\[/.test(code)) {
    return 'openqasm'
  }

  if (code.includes('pennylane') || code.includes('qml.') || /@qml\.qnode/.test(code)) {
    return 'pennylane'
  }

  if (code.includes('cirq') || /cirq\.(LineQubit|GridQubit|Circuit)/.test(code)) {
    return 'cirq'
  }

  if (
    code.includes('qiskit') ||
    code.includes('QuantumCircuit') ||
    code.includes('QuantumRegister') ||
    /\.cx\(|\.h\(|\.measure\(/.test(code)
  ) {
    return 'qiskit'
  }

  return 'qiskit'
}

export function getSupportedLanguages(): ParseLanguage[] {
  return Object.keys(parsers) as ParseLanguage[]
}

export function isLanguageSupported(language: string): language is ParseLanguage {
  return language in parsers
}

export function getEditorLanguage(parseLanguage: ParseLanguage): string {
  switch (parseLanguage) {
    case 'openqasm':
      return 'plaintext'
    case 'qiskit':
    case 'cirq':
    case 'pennylane':
      return 'python'
    default:
      return 'plaintext'
  }
}

export function getFileExtension(language: ParseLanguage): string {
  switch (language) {
    case 'openqasm':
      return '.qasm'
    case 'qiskit':
    case 'cirq':
    case 'pennylane':
      return '.py'
    default:
      return '.txt'
  }
}

export function formatLanguageName(language: ParseLanguage): string {
  switch (language) {
    case 'openqasm':
      return 'OpenQASM'
    case 'qiskit':
      return 'Qiskit'
    case 'cirq':
      return 'Cirq'
    case 'pennylane':
      return 'PennyLane'
    default:
      return language
  }
}
