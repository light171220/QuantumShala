import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight,
  Activity,
  AlertCircle,
  Sparkles,
  Terminal,
  X,
  Maximize2,
  Minimize2,
  Play,
  CheckCircle,
  XCircle,
  BarChart3,
} from 'lucide-react'
import { MiniCircuitDiagram } from './MiniCircuitDiagram'
import { CircuitMetrics } from './CircuitMetrics'
import { CodeDiagnostics } from './CodeDiagnostics'
import { OptimizationSuggestions } from './OptimizationSuggestions'
import type { ParsedCircuit, ParseResult } from '@/lib/quantum/parsers/types'
import type { EnhancedOptimizationResult } from '@/lib/quantum/optimization/engine'
import type { OptimizationSuggestion } from '@/types/optimizer'

interface ConsoleEntry {
  type: 'info' | 'success' | 'error' | 'output' | 'command'
  message: string
  timestamp: Date
}

interface RightPanelProps {
  circuit: ParsedCircuit | null
  parseResult: ParseResult | null
  parseTimeMs: number
  isParsing: boolean
  optimizationResult: EnhancedOptimizationResult | null
  suggestions: OptimizationSuggestion[]
  consoleEntries: ConsoleEntry[]
  lastResult: { counts: Record<string, number> } | null
  onGateClick?: (gateId: string, line: number) => void
  onLineClick?: (line: number) => void
  onRunCommand: (command: string) => void
  onClearConsole: () => void
  errorCount: number
  warningCount: number
}

interface SectionProps {
  title: string
  icon: React.ReactNode
  badge?: number
  badgeColor?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function Section({ title, icon, badge, badgeColor = 'bg-slate-600', defaultOpen = true, children }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800/50 transition-colors"
      >
        {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        {icon}
        <span className="text-sm font-medium text-white">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className={`ml-auto px-1.5 py-0.5 text-[10px] rounded ${badgeColor} text-white`}>
            {badge}
          </span>
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function RightPanel({
  circuit,
  parseResult,
  parseTimeMs,
  isParsing,
  optimizationResult,
  suggestions,
  consoleEntries,
  lastResult,
  onGateClick,
  onLineClick,
  onRunCommand,
  onClearConsole,
  errorCount,
  warningCount,
}: RightPanelProps) {
  const [commandInput, setCommandInput] = useState('')
  const [showResults, setShowResults] = useState(false)
  const consoleEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [consoleEntries])

  const handleCommandSubmit = () => {
    if (commandInput.trim()) {
      onRunCommand(commandInput)
      setCommandInput('')
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="h-full flex flex-col bg-slate-900/50 border-l border-white/5 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <Section
          title="Preview"
          icon={<Activity className="w-4 h-4 text-quantum-400" />}
          defaultOpen={true}
        >
          {circuit ? (
            <div className="space-y-3">
              <CircuitMetrics circuit={circuit} parseTimeMs={parseTimeMs} compact />
              <MiniCircuitDiagram
                circuit={circuit}
                onGateClick={onGateClick}
                maxQubits={8}
                maxGates={20}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <Activity className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">{isParsing ? 'Parsing...' : 'Start typing to see preview'}</p>
            </div>
          )}
        </Section>

        <Section
          title="Issues"
          icon={<AlertCircle className="w-4 h-4 text-amber-400" />}
          badge={errorCount + warningCount}
          badgeColor={errorCount > 0 ? 'bg-red-500' : 'bg-amber-500'}
          defaultOpen={errorCount > 0 || warningCount > 0}
        >
          <CodeDiagnostics
            errors={parseResult?.errors}
            warnings={parseResult?.warnings}
            onLineClick={onLineClick}
          />
        </Section>

        <Section
          title="Optimize"
          icon={<Sparkles className="w-4 h-4 text-purple-400" />}
          badge={suggestions.length}
          badgeColor="bg-purple-500"
          defaultOpen={false}
        >
          <OptimizationSuggestions
            suggestions={suggestions}
            optimizationResult={optimizationResult}
          />
        </Section>

        <Section
          title="Output"
          icon={<Terminal className="w-4 h-4 text-green-400" />}
          badge={consoleEntries.length}
          badgeColor="bg-slate-600"
          defaultOpen={true}
        >
          <div className="space-y-2">
            {lastResult && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Results</span>
                  <button
                    onClick={() => setShowResults(!showResults)}
                    className="text-xs text-quantum-400 hover:text-quantum-300"
                  >
                    {showResults ? 'Hide' : 'Show'} histogram
                  </button>
                </div>
                <AnimatePresence>
                  {showResults && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-1.5"
                    >
                      {Object.entries(lastResult.counts).map(([state, count]) => {
                        const total = Object.values(lastResult.counts).reduce((a, b) => a + b, 0)
                        const prob = count / total
                        return (
                          <div key={state} className="space-y-0.5">
                            <div className="flex justify-between text-xs">
                              <span className="font-mono text-quantum-400">|{state}⟩</span>
                              <span className="text-white">{(prob * 100).toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${prob * 100}%` }}
                                className="h-full bg-gradient-to-r from-quantum-500 to-cyan-400 rounded-full"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="max-h-48 overflow-y-auto space-y-0.5 font-mono text-xs">
              {consoleEntries.length === 0 ? (
                <div className="text-slate-500 text-center py-4">
                  Run code to see output
                </div>
              ) : (
                consoleEntries.map((entry, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 py-0.5 ${
                      entry.type === 'error' ? 'text-red-400' :
                      entry.type === 'success' ? 'text-green-400' :
                      entry.type === 'output' ? 'text-cyan-400' :
                      entry.type === 'command' ? 'text-yellow-400' :
                      'text-slate-400'
                    }`}
                  >
                    <span className="text-slate-600 flex-shrink-0">[{formatTime(entry.timestamp)}]</span>
                    {entry.type === 'success' && <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />}
                    {entry.type === 'error' && <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />}
                    <span className="whitespace-pre-wrap break-all">{entry.message}</span>
                  </div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>

            {consoleEntries.length > 0 && (
              <button
                onClick={onClearConsole}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            )}
          </div>
        </Section>
      </div>

      <div className="border-t border-white/10 bg-slate-900/80">
        <div className="flex items-center px-3 py-2">
          <span className="text-green-400 font-mono text-sm mr-2">$</span>
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCommandSubmit()}
            placeholder="Type command... (help)"
            className="flex-1 bg-transparent text-white font-mono text-sm focus:outline-none placeholder-slate-600"
          />
          {commandInput && (
            <button onClick={handleCommandSubmit} className="text-slate-400 hover:text-white">
              <Play className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default RightPanel
