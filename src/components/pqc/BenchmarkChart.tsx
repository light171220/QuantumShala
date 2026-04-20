import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import type { BenchmarkResult } from '@/stores/pqcStore'
import { PQC_ALGORITHM_INFO } from '@/stores/pqcStore'

interface BenchmarkChartProps {
  benchmarks: BenchmarkResult[]
  onRunBenchmark?: () => void
  isRunning?: boolean
}

const OPERATION_COLORS: Record<string, string> = {
  keygen: '#3B82F6',
  encaps: '#10B981',
  decaps: '#F59E0B',
  sign: '#8B5CF6',
  verify: '#EF4444'
}

export function BenchmarkChart({ benchmarks, onRunBenchmark, isRunning }: BenchmarkChartProps) {
  const groupedData = useMemo(() => {
    const groups: Record<string, { name: string; [key: string]: string | number }> = {}

    for (const b of benchmarks) {
      const key = `${b.algorithm}-${b.variant}`
      if (!groups[key]) {
        groups[key] = { name: b.variant }
      }
      groups[key][b.operation] = b.timeMs
    }

    return Object.values(groups)
  }, [benchmarks])

  // Get key/signature sizes for comparison
  const sizeComparison = useMemo(() => {
    const data: { name: string; publicKey: number; secretKey: number; ciphertext?: number; signature?: number }[] = []

    Object.entries(PQC_ALGORITHM_INFO).forEach(([algo, info]) => {
      Object.entries(info.variants).forEach(([variant, sizes]) => {
        data.push({
          name: variant,
          publicKey: sizes.publicKeySize,
          secretKey: sizes.secretKeySize,
          ciphertext: 'ciphertextSize' in sizes ? (sizes as { ciphertextSize: number }).ciphertextSize : undefined,
          signature: 'signatureSize' in sizes ? (sizes as { signatureSize: number }).signatureSize : undefined
        })
      })
    })

    return data
  }, [])

  return (
    <div className="bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Performance Benchmarks</h3>
        {onRunBenchmark && (
          <button
            onClick={onRunBenchmark}
            disabled={isRunning}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running...
              </>
            ) : (
              'Run Benchmark'
            )}
          </button>
        )}
      </div>

      {groupedData.length > 0 ? (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-2">Operation Timing (ms)</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={groupedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} angle={-15} />
                <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`${value.toFixed(3)} ms`, '']}
                />
                <Legend />
                <Bar dataKey="keygen" name="Key Gen" fill={OPERATION_COLORS.keygen} />
                <Bar dataKey="encaps" name="Encaps" fill={OPERATION_COLORS.encaps} />
                <Bar dataKey="decaps" name="Decaps" fill={OPERATION_COLORS.decaps} />
                <Bar dataKey="sign" name="Sign" fill={OPERATION_COLORS.sign} />
                <Bar dataKey="verify" name="Verify" fill={OPERATION_COLORS.verify} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-2 px-3 text-slate-400">Variant</th>
                  <th className="text-right py-2 px-3 text-slate-400">Operation</th>
                  <th className="text-right py-2 px-3 text-slate-400">Time (ms)</th>
                  <th className="text-right py-2 px-3 text-slate-400">Iterations</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((b, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td className="py-2 px-3 text-white">{b.variant}</td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ backgroundColor: OPERATION_COLORS[b.operation] + '30', color: OPERATION_COLORS[b.operation] }}
                      >
                        {b.operation}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">{b.timeMs.toFixed(4)}</td>
                    <td className="py-2 px-3 text-right text-slate-400">{b.iterations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400">
          <p className="text-4xl mb-4">⏱️</p>
          <p>No benchmarks run yet.</p>
          <p className="text-sm mt-2">Click "Run Benchmark" to measure algorithm performance.</p>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-white/[0.06]">
        <h4 className="text-sm font-medium text-slate-300 mb-4">Key & Signature Sizes (bytes)</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sizeComparison} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 9 }} angle={-20} />
            <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px'
              }}
              formatter={(value: number) => [`${value.toLocaleString()} bytes`, '']}
            />
            <Legend />
            <Bar dataKey="publicKey" name="Public Key" fill="#3B82F6" />
            <Bar dataKey="secretKey" name="Secret Key" fill="#EF4444" />
            <Bar dataKey="ciphertext" name="Ciphertext" fill="#10B981" />
            <Bar dataKey="signature" name="Signature" fill="#8B5CF6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default BenchmarkChart
