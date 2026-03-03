/**
 * CodeDiagnostics Component
 * Displays errors, warnings, and suggestions for quantum code
 */

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react'
import type { ParseError, ParseWarning } from '@/lib/quantum/parsers/types'
import type { Diagnostic } from '@/lib/quantum/optimization/diagnostics'

// ============================================================================
// Types
// ============================================================================

interface CodeDiagnosticsProps {
  errors?: ParseError[]
  warnings?: ParseWarning[]
  diagnostics?: Diagnostic[]
  onLineClick?: (line: number) => void
  collapsed?: boolean
  onCollapseToggle?: (collapsed: boolean) => void
  className?: string
}

interface DiagnosticItemProps {
  type: 'error' | 'warning' | 'info' | 'hint'
  code: string
  message: string
  line?: number
  suggestion?: string
  onLineClick?: (line: number) => void
}

// ============================================================================
// Diagnostic Item Component
// ============================================================================

function DiagnosticItem({
  type,
  code,
  message,
  line,
  suggestion,
  onLineClick,
}: DiagnosticItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const icon = useMemo(() => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
      case 'info':
        return <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
      case 'hint':
        return <Lightbulb className="w-4 h-4 text-green-400 flex-shrink-0" />
    }
  }, [type])

  const bgColor = useMemo(() => {
    switch (type) {
      case 'error':
        return 'bg-red-500/10 border-red-500/30 hover:border-red-500/50'
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50'
      case 'info':
        return 'bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50'
      case 'hint':
        return 'bg-green-500/10 border-green-500/30 hover:border-green-500/50'
    }
  }, [type])

  const handleCopySuggestion = () => {
    if (suggestion) {
      navigator.clipboard.writeText(suggestion)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`rounded-lg border ${bgColor} transition-colors`}
    >
      <div
        className="flex items-start gap-2 p-2 cursor-pointer"
        onClick={() => suggestion && setExpanded(!expanded)}
      >
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500">{code}</span>
            {line !== undefined && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onLineClick?.(line)
                }}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-0.5 transition-colors"
              >
                Line {line}
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
          <p className="text-sm text-white mt-0.5">{message}</p>
        </div>
        {suggestion && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>
        )}
      </div>

      <AnimatePresence>
        {expanded && suggestion && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 pt-1 border-t border-white/5">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-xs text-slate-400">Suggestion:</span>
                  <p className="text-xs text-green-400 mt-0.5">{suggestion}</p>
                </div>
                <button
                  onClick={handleCopySuggestion}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title="Copy suggestion"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function CodeDiagnostics({
  errors = [],
  warnings = [],
  diagnostics = [],
  onLineClick,
  collapsed = false,
  onCollapseToggle,
  className = '',
}: CodeDiagnosticsProps) {
  const [errorsExpanded, setErrorsExpanded] = useState(true)
  const [warningsExpanded, setWarningsExpanded] = useState(true)
  const [hintsExpanded, setHintsExpanded] = useState(false)

  // Combine all diagnostics
  const allItems = useMemo(() => {
    const items: DiagnosticItemProps[] = []

    // Add parse errors
    for (const error of errors) {
      items.push({
        type: 'error',
        code: error.code,
        message: error.message,
        line: error.line,
        suggestion: error.suggestion,
      })
    }

    // Add parse warnings
    for (const warning of warnings) {
      items.push({
        type: 'warning',
        code: warning.code,
        message: warning.message,
        line: warning.line,
        suggestion: warning.suggestion,
      })
    }

    // Add optimization diagnostics
    for (const diag of diagnostics) {
      items.push({
        type: diag.severity === 'error' ? 'error' :
              diag.severity === 'warning' ? 'warning' :
              diag.severity === 'hint' ? 'hint' : 'info',
        code: diag.code,
        message: diag.message,
        line: diag.line,
        suggestion: diag.suggestion,
      })
    }

    return items
  }, [errors, warnings, diagnostics])

  const errorItems = allItems.filter((i) => i.type === 'error')
  const warningItems = allItems.filter((i) => i.type === 'warning')
  const hintItems = allItems.filter((i) => i.type === 'hint' || i.type === 'info')

  const hasIssues = allItems.length > 0

  if (!hasIssues) {
    return (
      <div className={`flex items-center gap-2 text-green-400 text-sm ${className}`}>
        <Check className="w-4 h-4" />
        <span>No issues detected</span>
      </div>
    )
  }

  if (collapsed) {
    return (
      <button
        onClick={() => onCollapseToggle?.(false)}
        className={`flex items-center gap-2 text-sm ${className}`}
      >
        {errorItems.length > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <AlertCircle className="w-4 h-4" />
            {errorItems.length}
          </span>
        )}
        {warningItems.length > 0 && (
          <span className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            {warningItems.length}
          </span>
        )}
        {hintItems.length > 0 && (
          <span className="flex items-center gap-1 text-green-400">
            <Lightbulb className="w-4 h-4" />
            {hintItems.length}
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </button>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Errors Section */}
      {errorItems.length > 0 && (
        <div>
          <button
            onClick={() => setErrorsExpanded(!errorsExpanded)}
            className="flex items-center gap-2 text-sm text-red-400 mb-2 hover:text-red-300 transition-colors"
          >
            {errorsExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <AlertCircle className="w-4 h-4" />
            <span>Errors ({errorItems.length})</span>
          </button>

          <AnimatePresence>
            {errorsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2 overflow-hidden"
              >
                {errorItems.map((item, idx) => (
                  <DiagnosticItem key={`error-${idx}`} {...item} onLineClick={onLineClick} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Warnings Section */}
      {warningItems.length > 0 && (
        <div>
          <button
            onClick={() => setWarningsExpanded(!warningsExpanded)}
            className="flex items-center gap-2 text-sm text-amber-400 mb-2 hover:text-amber-300 transition-colors"
          >
            {warningsExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <AlertTriangle className="w-4 h-4" />
            <span>Warnings ({warningItems.length})</span>
          </button>

          <AnimatePresence>
            {warningsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2 overflow-hidden"
              >
                {warningItems.map((item, idx) => (
                  <DiagnosticItem key={`warning-${idx}`} {...item} onLineClick={onLineClick} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Hints Section */}
      {hintItems.length > 0 && (
        <div>
          <button
            onClick={() => setHintsExpanded(!hintsExpanded)}
            className="flex items-center gap-2 text-sm text-green-400 mb-2 hover:text-green-300 transition-colors"
          >
            {hintsExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Lightbulb className="w-4 h-4" />
            <span>Suggestions ({hintItems.length})</span>
          </button>

          <AnimatePresence>
            {hintsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2 overflow-hidden"
              >
                {hintItems.map((item, idx) => (
                  <DiagnosticItem key={`hint-${idx}`} {...item} onLineClick={onLineClick} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

export default CodeDiagnostics
