/**
 * OptimizationSuggestions Component
 * Displays optimization suggestions with click-to-apply functionality
 */

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Play,
  Check,
  ArrowRight,
  Zap,
  TrendingDown,
  Layers,
  Settings,
} from 'lucide-react'
import type { OptimizationSuggestion } from '@/types/optimizer'
import type { EnhancedOptimizationResult, PassResultSummary } from '@/lib/quantum/optimization/engine'
import { Button } from '@/components/ui/Button'

// ============================================================================
// Types
// ============================================================================

interface OptimizationSuggestionsProps {
  suggestions?: OptimizationSuggestion[]
  optimizationResult?: EnhancedOptimizationResult | null
  onApplyOptimization?: (suggestionId: string) => void
  onRunOptimization?: (preset: string) => void
  collapsed?: boolean
  onCollapseToggle?: (collapsed: boolean) => void
  className?: string
}

interface SuggestionItemProps {
  suggestion: OptimizationSuggestion
  onApply?: () => void
}

// ============================================================================
// Suggestion Item Component
// ============================================================================

function SuggestionItem({ suggestion, onApply }: SuggestionItemProps) {
  const [isApplying, setIsApplying] = useState(false)
  const [isApplied, setIsApplied] = useState(suggestion.applied)

  const handleApply = async () => {
    if (isApplied) return

    setIsApplying(true)
    try {
      onApply?.()
      setIsApplied(true)
    } finally {
      setIsApplying(false)
    }
  }

  const typeIcon = useMemo(() => {
    switch (suggestion.type) {
      case 'identity_removal':
        return <TrendingDown className="w-4 h-4 text-red-400" />
      case 'rotation_merging':
        return <Layers className="w-4 h-4 text-purple-400" />
      case 'gate_decomposition':
        return <Settings className="w-4 h-4 text-blue-400" />
      case 'template_matching':
        return <Sparkles className="w-4 h-4 text-amber-400" />
      default:
        return <Zap className="w-4 h-4 text-green-400" />
    }
  }, [suggestion.type])

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        isApplied
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-slate-800/50 border-white/5 hover:border-white/10'
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">{typeIcon}</div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{suggestion.description}</p>

        <div className="flex items-center gap-3 mt-2 text-xs">
          <span className="text-slate-500">
            {suggestion.gateIds.length} gate{suggestion.gateIds.length !== 1 ? 's' : ''}
          </span>
          {suggestion.potentialSavings > 0 && (
            <span className="flex items-center gap-1 text-green-400">
              <TrendingDown className="w-3 h-3" />
              −{suggestion.potentialSavings} gates
            </span>
          )}
        </div>
      </div>

      {!isApplied && onApply && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleApply}
          isLoading={isApplying}
          className="flex-shrink-0"
        >
          <Play className="w-3.5 h-3.5" />
        </Button>
      )}

      {isApplied && (
        <div className="flex-shrink-0 p-1.5 bg-green-500/20 rounded">
          <Check className="w-3.5 h-3.5 text-green-400" />
        </div>
      )}
    </motion.div>
  )
}

// ============================================================================
// Optimization Stats Component
// ============================================================================

interface OptimizationStatsProps {
  result: EnhancedOptimizationResult
}

function OptimizationStats({ result }: OptimizationStatsProps) {
  const { stats, executionTimeMs, iterations, passResults } = result

  const appliedPasses = passResults.filter((p) => p.applied)

  return (
    <div className="space-y-3">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 bg-slate-800/50 rounded-lg">
          <div className="text-lg font-bold text-white">{stats.gatesRemoved}</div>
          <div className="text-xs text-slate-400">Gates Removed</div>
        </div>
        <div className="p-2 bg-slate-800/50 rounded-lg">
          <div className="text-lg font-bold text-white">
            {stats.reductionPercent.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-400">Reduction</div>
        </div>
        <div className="p-2 bg-slate-800/50 rounded-lg">
          <div className="text-lg font-bold text-white">{executionTimeMs.toFixed(1)}ms</div>
          <div className="text-xs text-slate-400">Time</div>
        </div>
      </div>

      {/* Before/After */}
      <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
        <div className="text-center">
          <div className="text-sm text-slate-400">Before</div>
          <div className="text-xl font-bold text-white">{stats.originalGateCount}</div>
          <div className="text-xs text-slate-500">gates</div>
        </div>
        <ArrowRight className="w-6 h-6 text-green-400" />
        <div className="text-center">
          <div className="text-sm text-slate-400">After</div>
          <div className="text-xl font-bold text-green-400">{stats.optimizedGateCount}</div>
          <div className="text-xs text-slate-500">gates</div>
        </div>
      </div>

      {/* Depth Change */}
      {stats.originalDepth !== stats.optimizedDepth && (
        <div className="flex items-center justify-between px-3 py-2 text-sm">
          <span className="text-slate-400">Depth:</span>
          <span className="text-white">
            {stats.originalDepth} → {stats.optimizedDepth}
            <span className="text-green-400 ml-1">
              (−{stats.originalDepth - stats.optimizedDepth})
            </span>
          </span>
        </div>
      )}

      {/* Applied Passes */}
      {appliedPasses.length > 0 && (
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">
            Applied Passes ({appliedPasses.length})
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {appliedPasses.map((pass, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs px-2 py-1 bg-slate-800/30 rounded"
              >
                <span className="text-slate-300">{pass.passName}</span>
                <span className="text-green-400">−{pass.gatesRemoved}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function OptimizationSuggestions({
  suggestions = [],
  optimizationResult,
  onApplyOptimization,
  onRunOptimization,
  collapsed = false,
  onCollapseToggle,
  className = '',
}: OptimizationSuggestionsProps) {
  const [expanded, setExpanded] = useState(true)
  const [selectedPreset, setSelectedPreset] = useState<string>('standard')

  const hasSuggestions = suggestions.length > 0
  const hasResult = optimizationResult && optimizationResult.stats.gatesRemoved > 0

  if (collapsed) {
    return (
      <button
        onClick={() => onCollapseToggle?.(false)}
        className={`flex items-center gap-2 text-sm ${className}`}
      >
        <Sparkles className="w-4 h-4 text-amber-400" />
        <span className="text-slate-400">
          {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
        </span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </button>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <Sparkles className="w-4 h-4" />
          <span>
            Optimizations
            {suggestions.length > 0 && ` (${suggestions.length})`}
          </span>
        </button>

        {onRunOptimization && (
          <div className="flex items-center gap-2">
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              className="text-xs bg-slate-800 border border-white/10 rounded px-2 py-1 text-white"
            >
              <option value="realtime">Real-time</option>
              <option value="standard">Standard</option>
              <option value="deep">Deep</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRunOptimization(selectedPreset)}
              className="text-xs"
            >
              <Zap className="w-3.5 h-3.5 mr-1" />
              Optimize
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-3"
          >
            {/* Optimization Result */}
            {hasResult && <OptimizationStats result={optimizationResult!} />}

            {/* Suggestions */}
            {hasSuggestions && (
              <div className="space-y-2">
                <div className="text-xs text-slate-400 uppercase tracking-wider">
                  Suggestions
                </div>
                {suggestions.map((suggestion) => (
                  <SuggestionItem
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApply={
                      onApplyOptimization
                        ? () => onApplyOptimization(suggestion.id)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!hasSuggestions && !hasResult && (
              <div className="text-center py-6 text-slate-500">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No optimizations available</p>
                <p className="text-xs mt-1">Your circuit looks efficient!</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default OptimizationSuggestions
