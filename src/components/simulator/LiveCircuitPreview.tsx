/**
 * LiveCircuitPreview Component
 * Main preview panel for the Code Playground with real-time circuit visualization
 */

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ChevronDown,
  ChevronUp,
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Check,
} from 'lucide-react'
import { useCodeParser, useCodeDiagnostics, useCircuitMetrics } from '@/hooks/useCodeParser'
import { MiniCircuitDiagram } from './MiniCircuitDiagram'
import { CircuitMetrics, MetricsBar } from './CircuitMetrics'
import { CodeDiagnostics } from './CodeDiagnostics'
import { OptimizationSuggestions } from './OptimizationSuggestions'
import { optimizeRealTime } from '@/lib/quantum/optimization'
import { parsedCircuitToQuantumCircuit } from '@/lib/quantum/parsers/types'
import type { ParseLanguage } from '@/lib/quantum/parsers'
import type { EnhancedOptimizationResult } from '@/lib/quantum/optimization/engine'
import type { OptimizationSuggestion } from '@/types/optimizer'

// ============================================================================
// Types
// ============================================================================

interface LiveCircuitPreviewProps {
  code: string
  language: ParseLanguage
  onGateClick?: (gateId: string, line: number) => void
  collapsed?: boolean
  onCollapse?: (collapsed: boolean) => void
  className?: string
}

type ActiveSection = 'circuit' | 'diagnostics' | 'optimizations'

// ============================================================================
// Component
// ============================================================================

export function LiveCircuitPreview({
  code,
  language,
  onGateClick,
  collapsed = false,
  onCollapse,
  className = '',
}: LiveCircuitPreviewProps) {
  // State
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeSection, setActiveSection] = useState<ActiveSection>('circuit')
  const [highlightedGateId, setHighlightedGateId] = useState<string | null>(null)
  const [optimizationResult, setOptimizationResult] = useState<EnhancedOptimizationResult | null>(null)

  // Parse code
  const { circuit, parseResult, isParsing, parseTimeMs } = useCodeParser(code, language, {
    debounceMs: 300,
    enabled: !collapsed,
  })

  // Get diagnostics and metrics
  const diagnostics = useCodeDiagnostics(parseResult)
  const metrics = useCircuitMetrics(circuit)

  // Run real-time optimization when circuit changes
  useEffect(() => {
    if (circuit && circuit.gates.length > 0) {
      try {
        const quantumCircuit = parsedCircuitToQuantumCircuit(circuit)
        const result = optimizeRealTime(quantumCircuit)
        setOptimizationResult(result)
      } catch (error) {
        console.error('Optimization error:', error)
        setOptimizationResult(null)
      }
    } else {
      setOptimizationResult(null)
    }
  }, [circuit])

  // Handle gate click
  const handleGateClick = useCallback(
    (gateId: string, line: number) => {
      setHighlightedGateId(gateId)
      onGateClick?.(gateId, line)

      // Clear highlight after 2 seconds
      setTimeout(() => setHighlightedGateId(null), 2000)
    },
    [onGateClick]
  )

  // Handle line click from diagnostics
  const handleLineClick = useCallback(
    (line: number) => {
      // Find a gate on that line
      const gate = circuit?.gates.find((g) => g.line === line)
      if (gate) {
        handleGateClick(gate.id, line)
      }
    },
    [circuit, handleGateClick]
  )

  // Optimization suggestions
  const suggestions: OptimizationSuggestion[] = optimizationResult?.suggestions || []

  // Status indicator
  const getStatusIndicator = () => {
    if (isParsing) {
      return (
        <div className="flex items-center gap-1.5 text-blue-400">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span className="text-xs">Parsing...</span>
        </div>
      )
    }

    if (diagnostics.hasErrors) {
      return (
        <div className="flex items-center gap-1.5 text-red-400">
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="text-xs">{diagnostics.errorCount} error{diagnostics.errorCount !== 1 ? 's' : ''}</span>
        </div>
      )
    }

    if (diagnostics.hasWarnings) {
      return (
        <div className="flex items-center gap-1.5 text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="text-xs">{diagnostics.warningCount} warning{diagnostics.warningCount !== 1 ? 's' : ''}</span>
        </div>
      )
    }

    if (circuit) {
      return (
        <div className="flex items-center gap-1.5 text-green-400">
          <Check className="w-3.5 h-3.5" />
          <span className="text-xs">Valid</span>
        </div>
      )
    }

    return null
  }

  // Collapsed view
  if (collapsed) {
    return (
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => onCollapse?.(false)}
        className={`flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-white/5 rounded-lg hover:border-white/10 transition-colors ${className}`}
      >
        <Activity className="w-4 h-4 text-quantum-400" />
        <span className="text-sm text-slate-400">Circuit Preview</span>
        {circuit && <MetricsBar circuit={circuit} className="ml-2" />}
        {getStatusIndicator()}
        <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />
      </motion.button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-slate-900/80 border border-white/10 rounded-lg overflow-hidden ${
        isExpanded ? 'fixed inset-4 z-50' : ''
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-slate-800/50">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-quantum-400" />
          <span className="text-sm font-medium text-white">Circuit Preview</span>
          {getStatusIndicator()}
        </div>

        <div className="flex items-center gap-1">
          {/* Section Tabs */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 mr-2">
            <button
              onClick={() => setActiveSection('circuit')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                activeSection === 'circuit'
                  ? 'bg-quantum-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Circuit
            </button>
            <button
              onClick={() => setActiveSection('diagnostics')}
              className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                activeSection === 'diagnostics'
                  ? 'bg-quantum-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Issues
              {(diagnostics.errorCount + diagnostics.warningCount) > 0 && (
                <span className={`px-1 rounded text-[10px] ${
                  diagnostics.hasErrors ? 'bg-red-500' : 'bg-amber-500'
                }`}>
                  {diagnostics.errorCount + diagnostics.warningCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSection('optimizations')}
              className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                activeSection === 'optimizations'
                  ? 'bg-quantum-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Optimize
            </button>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-slate-700 rounded transition-colors"
            title={isExpanded ? 'Minimize' : 'Maximize'}
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4 text-slate-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-slate-400" />
            )}
          </button>

          <button
            onClick={() => onCollapse?.(true)}
            className="p-1.5 hover:bg-slate-700 rounded transition-colors"
            title="Collapse"
          >
            <ChevronUp className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`overflow-auto ${isExpanded ? 'flex-1' : 'max-h-[400px]'}`}>
        <AnimatePresence mode="wait">
          {activeSection === 'circuit' && (
            <motion.div
              key="circuit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 space-y-3"
            >
              {/* Metrics Bar */}
              {circuit && (
                <CircuitMetrics
                  circuit={circuit}
                  parseTimeMs={parseTimeMs}
                  compact
                />
              )}

              {/* Circuit Diagram */}
              {circuit ? (
                <MiniCircuitDiagram
                  circuit={circuit}
                  onGateClick={handleGateClick}
                  highlightedGateId={highlightedGateId || undefined}
                  maxQubits={isExpanded ? 30 : 10}
                  maxGates={isExpanded ? 100 : 30}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  {isParsing ? (
                    <>
                      <RefreshCw className="w-8 h-8 mb-2 animate-spin opacity-50" />
                      <p className="text-sm">Parsing code...</p>
                    </>
                  ) : diagnostics.hasErrors ? (
                    <>
                      <AlertCircle className="w-8 h-8 mb-2 text-red-400 opacity-50" />
                      <p className="text-sm">Fix errors to see circuit</p>
                    </>
                  ) : (
                    <>
                      <Activity className="w-8 h-8 mb-2 opacity-30" />
                      <p className="text-sm">Start typing to see preview</p>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeSection === 'diagnostics' && (
            <motion.div
              key="diagnostics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <CodeDiagnostics
                errors={parseResult?.errors}
                warnings={parseResult?.warnings}
                onLineClick={handleLineClick}
              />
            </motion.div>
          )}

          {activeSection === 'optimizations' && (
            <motion.div
              key="optimizations"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              <OptimizationSuggestions
                suggestions={suggestions}
                optimizationResult={optimizationResult}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {circuit && !isExpanded && (
        <div className="px-4 py-2 border-t border-white/10 bg-slate-800/30">
          <MetricsBar circuit={circuit} />
        </div>
      )}
    </motion.div>
  )
}

export default LiveCircuitPreview
