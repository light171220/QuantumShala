import { useState, useEffect, useCallback, useRef } from 'react'
import {
  parseQuantumCode,
  type ParseResult,
  type ParseLanguage,
  type ParsedCircuit,
} from '@/lib/quantum/parsers'

export interface UseCodeParserOptions {
  debounceMs?: number
  enabled?: boolean
  onParseStart?: () => void
  onParseComplete?: (result: ParseResult) => void
  onParseError?: (error: Error) => void
}

export interface UseCodeParserReturn {
  circuit: ParsedCircuit | null
  parseResult: ParseResult | null
  isParsing: boolean
  error: Error | null
  parseNow: () => void
  clear: () => void
  parseTimeMs: number
}

export function useCodeParser(
  code: string,
  language: ParseLanguage,
  options: UseCodeParserOptions = {}
): UseCodeParserReturn {
  const {
    debounceMs = 300,
    enabled = true,
    onParseStart,
    onParseComplete,
    onParseError,
  } = options

  const [circuit, setCircuit] = useState<ParsedCircuit | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [parseTimeMs, setParseTimeMs] = useState(0)

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastCodeRef = useRef<string>('')
  const lastLanguageRef = useRef<ParseLanguage>(language)

  const doParse = useCallback((codeToparse: string, lang: ParseLanguage) => {
    if (!enabled) return

    setIsParsing(true)
    setError(null)
    onParseStart?.()

    try {
      const result = parseQuantumCode(codeToparse, lang)

      setParseResult(result)
      setCircuit(result.circuit)
      setParseTimeMs(result.parseTimeMs)

      if (!result.success && result.errors.length > 0) {
        const parseError = new Error(result.errors[0].message)
        setError(parseError)
      }

      onParseComplete?.(result)
    } catch (err) {
      const parseError = err instanceof Error ? err : new Error('Parse failed')
      setError(parseError)
      setCircuit(null)
      setParseResult(null)
      onParseError?.(parseError)
    } finally {
      setIsParsing(false)
    }
  }, [enabled, onParseStart, onParseComplete, onParseError])

  useEffect(() => {
    if (!enabled) return

    if (code === lastCodeRef.current && language === lastLanguageRef.current) {
      return
    }

    lastCodeRef.current = code
    lastLanguageRef.current = language

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      doParse(code, language)
    }, debounceMs)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [code, language, debounceMs, enabled, doParse])

  const parseNow = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    doParse(code, language)
  }, [code, language, doParse])

  const clear = useCallback(() => {
    setCircuit(null)
    setParseResult(null)
    setError(null)
    setParseTimeMs(0)
    lastCodeRef.current = ''
  }, [])

  return {
    circuit,
    parseResult,
    isParsing,
    error,
    parseNow,
    clear,
    parseTimeMs,
  }
}

export function useCodeDiagnostics(parseResult: ParseResult | null) {
  return {
    errors: parseResult?.errors || [],
    warnings: parseResult?.warnings || [],
    hasErrors: (parseResult?.errors?.length || 0) > 0,
    hasWarnings: (parseResult?.warnings?.length || 0) > 0,
    errorCount: parseResult?.errors?.length || 0,
    warningCount: parseResult?.warnings?.length || 0,
  }
}

export function useCircuitMetrics(circuit: ParsedCircuit | null) {
  if (!circuit) {
    return {
      numQubits: 0,
      numGates: 0,
      depth: 0,
      twoQubitGates: 0,
      singleQubitGates: 0,
      measurementCount: 0,
      hasBarriers: false,
    }
  }

  const twoQubitGates = circuit.gates.filter(
    (g) => g.qubits.length + g.controlQubits.length > 1
  ).length

  return {
    numQubits: circuit.numQubits,
    numGates: circuit.gates.length,
    depth: circuit.metadata.circuitDepth,
    twoQubitGates,
    singleQubitGates: circuit.gates.length - twoQubitGates,
    measurementCount: circuit.measurements.length,
    hasBarriers: circuit.metadata.hasBarriers,
  }
}

export default useCodeParser
