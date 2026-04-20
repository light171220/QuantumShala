/**
 * CircuitMetrics Component
 * Displays gate count, depth, and other circuit statistics
 */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Layers, Hash, Zap, Activity, Cpu, AlertTriangle } from 'lucide-react'
import type { ParsedCircuit } from '@/lib/quantum/parsers/types'

// ============================================================================
// Types
// ============================================================================

interface CircuitMetricsProps {
  circuit: ParsedCircuit | null
  parseTimeMs?: number
  compact?: boolean
  className?: string
}

interface MetricItem {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
  warning?: string
}

// ============================================================================
// Component
// ============================================================================

export function CircuitMetrics({
  circuit,
  parseTimeMs,
  compact = false,
  className = '',
}: CircuitMetricsProps) {
  const metrics = useMemo<MetricItem[]>(() => {
    if (!circuit) {
      return []
    }

    const { gates, numQubits, measurements, metadata } = circuit

    // Count two-qubit gates
    const twoQubitGates = gates.filter(
      (g) => g.qubits.length + g.controlQubits.length > 1
    ).length

    // Count single-qubit gates
    const singleQubitGates = gates.length - twoQubitGates

    // Two-qubit ratio
    const twoQubitRatio = gates.length > 0 ? (twoQubitGates / gates.length) * 100 : 0

    // Determine warnings
    const depthWarning = metadata.circuitDepth > 100 ? 'High depth may affect execution' : undefined
    const twoQWarning = twoQubitRatio > 50 ? 'High 2q ratio increases error rate' : undefined

    return [
      {
        label: 'Qubits',
        value: numQubits,
        icon: <Cpu className="w-3.5 h-3.5" />,
        color: 'text-blue-400',
      },
      {
        label: 'Gates',
        value: gates.length,
        icon: <Hash className="w-3.5 h-3.5" />,
        color: 'text-green-400',
      },
      {
        label: 'Depth',
        value: metadata.circuitDepth,
        icon: <Layers className="w-3.5 h-3.5" />,
        color: 'text-purple-400',
        warning: depthWarning,
      },
      {
        label: '2Q Gates',
        value: twoQubitGates,
        icon: <Zap className="w-3.5 h-3.5" />,
        color: 'text-orange-400',
        warning: twoQWarning,
      },
      {
        label: 'Measures',
        value: measurements.length,
        icon: <Activity className="w-3.5 h-3.5" />,
        color: 'text-cyan-400',
      },
    ]
  }, [circuit])

  if (!circuit) {
    return (
      <div className={`flex items-center justify-center py-4 text-slate-500 text-sm ${className}`}>
        No circuit parsed
      </div>
    )
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-4 text-xs ${className}`}>
        {metrics.slice(0, 4).map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-1.5"
          >
            <span className={metric.color}>{metric.icon}</span>
            <span className="text-slate-400">{metric.label}:</span>
            <span className="text-white font-medium">{metric.value}</span>
            {metric.warning && (
              <span title={metric.warning}>
                <AlertTriangle className="w-3 h-3 text-amber-400" />
              </span>
            )}
          </motion.div>
        ))}
        {parseTimeMs !== undefined && (
          <div className="flex items-center gap-1.5 text-slate-500">
            <span>Parsed in</span>
            <span className="text-slate-400">{parseTimeMs.toFixed(1)}ms</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`grid grid-cols-5 gap-2 ${className}`}>
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          className="relative p-2.5 bg-slate-800/50 rounded-lg border border-white/5 hover:border-white/10 transition-colors group"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className={metric.color}>{metric.icon}</span>
            <span className="text-xs text-slate-400">{metric.label}</span>
            {metric.warning && (
              <span title={metric.warning}>
                <AlertTriangle
                  className="w-3 h-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </span>
            )}
          </div>
          <div className="text-lg font-bold text-white">{metric.value}</div>

          {/* Warning tooltip */}
          {metric.warning && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded text-xs text-amber-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {metric.warning}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}

// ============================================================================
// Inline Metrics Bar (for tight spaces)
// ============================================================================

interface MetricsBarProps {
  circuit: ParsedCircuit | null
  className?: string
}

export function MetricsBar({ circuit, className = '' }: MetricsBarProps) {
  if (!circuit) {
    return null
  }

  const { gates, numQubits, metadata, measurements } = circuit
  const twoQubitGates = gates.filter(
    (g) => g.qubits.length + g.controlQubits.length > 1
  ).length

  return (
    <div className={`flex items-center gap-3 text-xs font-mono ${className}`}>
      <span className="text-blue-400">{numQubits}q</span>
      <span className="text-slate-600">|</span>
      <span className="text-green-400">{gates.length}g</span>
      <span className="text-slate-600">|</span>
      <span className="text-purple-400">d={metadata.circuitDepth}</span>
      <span className="text-slate-600">|</span>
      <span className="text-orange-400">{twoQubitGates} 2q</span>
      {measurements.length > 0 && (
        <>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-400">{measurements.length}m</span>
        </>
      )}
    </div>
  )
}

export default CircuitMetrics
