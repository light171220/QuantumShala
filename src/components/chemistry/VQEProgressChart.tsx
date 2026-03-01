import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import type { VQEIterationData, MolecularHamiltonian } from '@/lib/chemistry/molecules/types'

interface VQEProgressChartProps {
  history: VQEIterationData[]
  hamiltonian?: MolecularHamiltonian | null
  height?: number
}

const CHEMICAL_ACCURACY = 0.0016 // 1.6 mHartree

export function VQEProgressChart({ history, hamiltonian, height = 350 }: VQEProgressChartProps) {
  const data = useMemo(() => {
    return history.map((h, i) => ({
      iteration: h.iteration || i + 1,
      energy: h.energy,
      error: hamiltonian ? Math.abs(h.energy - hamiltonian.exactEnergy) : undefined,
      errorMHa: hamiltonian ? Math.abs(h.energy - hamiltonian.exactEnergy) * 1000 : undefined
    }))
  }, [history, hamiltonian])

  const currentEnergy = history.length > 0 ? history[history.length - 1].energy : null
  const bestEnergy = history.length > 0 ? Math.min(...history.map(h => h.energy)) : null
  const currentError = hamiltonian && currentEnergy !== null
    ? Math.abs(currentEnergy - hamiltonian.exactEnergy)
    : null
  const isChemicallyAccurate = currentError !== null && currentError < CHEMICAL_ACCURACY

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg">
        <p className="text-slate-400">Run VQE to see energy convergence.</p>
      </div>
    )
  }

  return (
    <div className="bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">VQE Energy Convergence</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">Energy (Hartree)</h4>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="iteration"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
              />
              <YAxis
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`${value.toFixed(6)} Ha`, 'Energy']}
              />
              <Legend />

              <Line
                type="monotone"
                dataKey="energy"
                name="VQE Energy"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#3B82F6' }}
              />

              {hamiltonian && (
                <>
                  <ReferenceLine
                    y={hamiltonian.exactEnergy}
                    stroke="#10B981"
                    strokeDasharray="5 5"
                    label={{ value: 'Exact', fill: '#10B981', fontSize: 10 }}
                  />
                  <ReferenceLine
                    y={hamiltonian.hartreeFockEnergy}
                    stroke="#F59E0B"
                    strokeDasharray="3 3"
                    label={{ value: 'HF', fill: '#F59E0B', fontSize: 10 }}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {hamiltonian && (
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-2">Error from Exact (mHartree)</h4>
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="iteration"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                />
                <YAxis
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`${value.toFixed(3)} mHa`, 'Error']}
                />
                <Legend />

                <Line
                  type="monotone"
                  dataKey="errorMHa"
                  name="Error"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#EF4444' }}
                />

                <ReferenceLine
                  y={CHEMICAL_ACCURACY * 1000}
                  stroke="#10B981"
                  strokeDasharray="5 5"
                  label={{ value: 'Chemical Accuracy', fill: '#10B981', fontSize: 10 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-white/[0.06]">
        <div className="text-center">
          <p className="text-xs text-slate-400">Current Energy</p>
          <p className="text-lg font-bold text-blue-400">
            {currentEnergy?.toFixed(6) || '-'} Ha
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-400">Best Energy</p>
          <p className="text-lg font-bold text-green-400">
            {bestEnergy?.toFixed(6) || '-'} Ha
          </p>
        </div>
        {hamiltonian && (
          <>
            <div className="text-center">
              <p className="text-xs text-slate-400">Exact Energy</p>
              <p className="text-lg font-bold text-purple-400">
                {hamiltonian.exactEnergy.toFixed(6)} Ha
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">Error</p>
              <p className={`text-lg font-bold ${isChemicallyAccurate ? 'text-green-400' : 'text-amber-400'}`}>
                {currentError ? (currentError * 1000).toFixed(3) : '-'} mHa
              </p>
            </div>
          </>
        )}
      </div>

      {hamiltonian && currentError !== null && (
        <div className={`mt-4 p-3 rounded-lg border ${
          isChemicallyAccurate
            ? 'bg-green-600/20 border-green-500 text-green-400'
            : 'bg-amber-600/20 border-amber-500 text-amber-400'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{isChemicallyAccurate ? '✅' : '⏳'}</span>
            <div>
              <p className="font-medium">
                {isChemicallyAccurate ? 'Chemical Accuracy Achieved!' : 'Converging...'}
              </p>
              <p className="text-xs opacity-75">
                Target: {"<"} 1.6 mHa (1 kcal/mol) | Current: {(currentError * 1000).toFixed(3)} mHa ({(currentError * 627.5).toFixed(2)} kcal/mol)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VQEProgressChart
