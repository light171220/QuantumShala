import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Table, TrendingUp, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useSimulatorStore } from '@/stores/simulatorStore'
import { formatMetricValue, summarizeComparison } from '@/lib/quantum/comparison'
import type { ComparisonResult } from '@/types/simulator'

export function ComparisonResults() {
  const { comparisonResult, setComparisonResult } = useSimulatorStore()

  if (!comparisonResult) return null

  const summary = useMemo(() => {
    return summarizeComparison(comparisonResult)
  }, [comparisonResult])

  return (
    <Card variant="neumorph" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white text-sm flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-quantum-400" />
          Comparison Results
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setComparisonResult(null)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-slate-800/50 rounded-lg text-center">
          <div className="text-xs text-slate-400 mb-1">Backends</div>
          <div className="text-xl font-bold text-white">
            {comparisonResult.results.length}
          </div>
        </div>
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
          <div className="text-xs text-green-400 mb-1">Best Fidelity</div>
          <div className="text-xl font-bold text-green-400">
            {formatMetricValue(summary.bestMatch.fidelity, 'fidelity')}
          </div>
        </div>
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-center">
          <div className="text-xs text-amber-400 mb-1">Avg Fidelity</div>
          <div className="text-xl font-bold text-amber-400">
            {formatMetricValue(summary.averageFidelity, 'fidelity')}
          </div>
        </div>
      </div>

      <Tabs defaultValue="histogram">
        <TabsList className="mb-3">
          <TabsTrigger value="histogram" className="text-xs">
            <BarChart3 className="w-3 h-3 mr-1" />
            Histogram
          </TabsTrigger>
          <TabsTrigger value="table" className="text-xs">
            <Table className="w-3 h-3 mr-1" />
            Table
          </TabsTrigger>
          <TabsTrigger value="metrics" className="text-xs">
            <TrendingUp className="w-3 h-3 mr-1" />
            Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="histogram">
          <ComparisonHistogram result={comparisonResult} />
        </TabsContent>

        <TabsContent value="table">
          <ComparisonTable result={comparisonResult} />
        </TabsContent>

        <TabsContent value="metrics">
          <MetricsTable result={comparisonResult} />
        </TabsContent>
      </Tabs>
    </Card>
  )
}

function ComparisonHistogram({ result }: { result: ComparisonResult }) {
  const allStates = useMemo(() => {
    const states = new Set<string>()
    result.results.forEach((r) => {
      Object.keys(r.result.probabilities).forEach((s) => states.add(s))
    })
    return Array.from(states)
      .sort()
      .slice(0, 8)
  }, [result])

  const colors = ['#00D9FF', '#FF6B6B', '#4ADE80', '#FBBF24', '#A78BFA']

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 mb-2">
        {result.results.map((r, index) => (
          <div key={r.backendId} className="flex items-center gap-1 text-xs">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            <span className="text-slate-300">{r.backendName}</span>
          </div>
        ))}
      </div>

      {allStates.map((state) => (
        <div key={state} className="space-y-1">
          <div className="text-xs font-mono text-slate-400">|{state}⟩</div>
          <div className="flex gap-0.5">
            {result.results.map((r, index) => {
              const prob = r.result.probabilities[state] || 0
              return (
                <motion.div
                  key={r.backendId}
                  initial={{ width: 0 }}
                  animate={{ width: `${(prob / result.results.length) * 100}%` }}
                  className="h-4 rounded-sm flex items-center justify-end pr-1 min-w-[2px]"
                  style={{ backgroundColor: colors[index % colors.length] }}
                >
                  {prob > 0.1 && (
                    <span className="text-[8px] text-white font-medium">
                      {(prob * 100).toFixed(0)}%
                    </span>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function ComparisonTable({ result }: { result: ComparisonResult }) {
  const allStates = useMemo(() => {
    const states = new Set<string>()
    result.results.forEach((r) => {
      Object.keys(r.result.probabilities).forEach((s) => states.add(s))
    })
    return Array.from(states).sort().slice(0, 12)
  }, [result])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-2 text-slate-400">State</th>
            {result.results.map((r) => (
              <th key={r.backendId} className="text-right py-2 text-slate-400">
                {r.backendName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allStates.map((state) => (
            <tr key={state} className="border-b border-white/5">
              <td className="py-1 font-mono text-quantum-400">|{state}⟩</td>
              {result.results.map((r) => (
                <td key={r.backendId} className="text-right py-1 text-white">
                  {((r.result.probabilities[state] || 0) * 100).toFixed(2)}%
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MetricsTable({ result }: { result: ComparisonResult }) {
  const metrics = result.metrics

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-slate-400 mb-2">Fidelity Matrix</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2"></th>
                {result.results.map((r) => (
                  <th key={r.backendId} className="text-center py-2 text-slate-400 px-2">
                    {r.backendName.slice(0, 10)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.results.map((r1) => (
                <tr key={r1.backendId} className="border-b border-white/5">
                  <td className="py-1 text-slate-400">{r1.backendName.slice(0, 10)}</td>
                  {result.results.map((r2) => {
                    const fidelity = metrics.fidelityMatrix[r1.backendId]?.[r2.backendId] ?? 1
                    const isIdentity = r1.backendId === r2.backendId
                    return (
                      <td
                        key={r2.backendId}
                        className={`text-center py-1 px-2 ${
                          isIdentity
                            ? 'text-slate-500'
                            : fidelity > 0.95
                            ? 'text-green-400'
                            : fidelity > 0.8
                            ? 'text-yellow-400'
                            : 'text-red-400'
                        }`}
                      >
                        {formatMetricValue(fidelity, 'fidelity')}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-400 mb-2">Total Variation Distance</div>
        <div className="grid grid-cols-2 gap-2">
          {result.results.slice(1).map((r) => {
            const tvd = metrics.tvdMatrix[result.results[0].backendId]?.[r.backendId] ?? 0
            return (
              <div
                key={r.backendId}
                className="p-2 bg-slate-800/50 rounded-lg"
              >
                <div className="text-[10px] text-slate-400">
                  vs {r.backendName}
                </div>
                <div className={`text-sm font-mono ${
                  tvd < 0.05 ? 'text-green-400' : tvd < 0.15 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {formatMetricValue(tvd, 'tvd')}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="text-xs text-slate-500 text-center">
        Compared at {new Date(result.timestamp).toLocaleTimeString()}
      </div>
    </div>
  )
}
