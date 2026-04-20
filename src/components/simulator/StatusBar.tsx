import { useMemo } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, Clock, Cpu, Layers, Hash, Zap } from 'lucide-react'
import type { ParsedCircuit } from '@/lib/quantum/parsers/types'

function countTwoQubitGates(circuit: ParsedCircuit): number {
  return circuit.gates.filter((g) => g.qubits.length + g.controlQubits.length > 1).length
}

interface StatusBarProps {
  isSaved: boolean
  lastSaveTime?: Date
  cursorLine: number
  cursorColumn: number
  circuit: ParsedCircuit | null
  language: string
  errorCount: number
  warningCount: number
  isParsing?: boolean
}

export function StatusBar({
  isSaved,
  lastSaveTime,
  cursorLine,
  cursorColumn,
  circuit,
  language,
  errorCount,
  warningCount,
  isParsing,
}: StatusBarProps) {
  const saveStatus = useMemo(() => {
    if (!isSaved) {
      return { text: 'Unsaved', color: 'text-amber-400' }
    }
    if (lastSaveTime) {
      const seconds = Math.floor((Date.now() - lastSaveTime.getTime()) / 1000)
      if (seconds < 5) return { text: 'Saved', color: 'text-green-400' }
      if (seconds < 60) return { text: `Saved ${seconds}s ago`, color: 'text-slate-400' }
      const minutes = Math.floor(seconds / 60)
      return { text: `Saved ${minutes}m ago`, color: 'text-slate-400' }
    }
    return { text: 'Saved', color: 'text-green-400' }
  }, [isSaved, lastSaveTime])

  const languageDisplay: Record<string, { label: string; color: string }> = {
    qiskit: { label: 'Qiskit', color: 'text-blue-400' },
    cirq: { label: 'Cirq', color: 'text-yellow-400' },
    pennylane: { label: 'PennyLane', color: 'text-green-400' },
    openqasm: { label: 'OpenQASM', color: 'text-purple-400' },
  }

  const lang = languageDisplay[language] || { label: language, color: 'text-slate-400' }

  return (
    <div className="flex items-center justify-between px-3 py-1 bg-slate-900 border-t border-white/10 text-xs">
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-1.5 ${saveStatus.color}`}>
          <CheckCircle className="w-3 h-3" />
          <span>{saveStatus.text}</span>
        </div>

        <div className="text-slate-500">
          Ln {cursorLine}, Col {cursorColumn}
        </div>

        {circuit && (
          <>
            <div className="flex items-center gap-1 text-blue-400">
              <Cpu className="w-3 h-3" />
              <span>{circuit.numQubits} qubits</span>
            </div>

            <div className="flex items-center gap-1 text-green-400">
              <Hash className="w-3 h-3" />
              <span>{circuit.gates.length} gates</span>
            </div>

            <div className="flex items-center gap-1 text-purple-400">
              <Layers className="w-3 h-3" />
              <span>depth {circuit.metadata.circuitDepth}</span>
            </div>

            {countTwoQubitGates(circuit) > 0 && (
              <div className="flex items-center gap-1 text-orange-400">
                <Zap className="w-3 h-3" />
                <span>{countTwoQubitGates(circuit)} 2q</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {isParsing && (
          <div className="flex items-center gap-1.5 text-blue-400">
            <Clock className="w-3 h-3 animate-spin" />
            <span>Parsing...</span>
          </div>
        )}

        {errorCount > 0 && (
          <div className="flex items-center gap-1 text-red-400">
            <AlertCircle className="w-3 h-3" />
            <span>{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
          </div>
        )}

        {warningCount > 0 && (
          <div className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            <span>{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>
          </div>
        )}

        {errorCount === 0 && warningCount === 0 && circuit && (
          <div className="flex items-center gap-1 text-green-400">
            <CheckCircle className="w-3 h-3" />
            <span>No issues</span>
          </div>
        )}

        <div className={`font-medium ${lang.color}`}>{lang.label}</div>
      </div>
    </div>
  )
}

export default StatusBar
