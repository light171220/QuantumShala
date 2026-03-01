import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import type { TrainingMetrics } from '@/stores/qmlStore'

interface LossCurveProps {
  history: TrainingMetrics[]
  showValidation?: boolean
  height?: number
}

export function LossCurve({ history, showValidation = true, height = 300 }: LossCurveProps) {
  const data = useMemo(() => {
    return history.map((metrics, index) => ({
      epoch: metrics.epoch || index + 1,
      trainLoss: metrics.loss,
      trainAcc: metrics.accuracy * 100,
      valLoss: metrics.valLoss,
      valAcc: metrics.valAccuracy ? metrics.valAccuracy * 100 : undefined
    }))
  }, [history])

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg">
        <p className="text-slate-400">No training data yet. Start training to see the loss curve.</p>
      </div>
    )
  }

  return (
    <div className="bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Training Progress</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">Loss</h4>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="epoch"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                label={{ value: 'Epoch', position: 'insideBottom', offset: -5, fill: '#9CA3AF' }}
              />
              <YAxis
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                label={{ value: 'Loss', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: '#F9FAFB' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="trainLoss"
                name="Train Loss"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#3B82F6' }}
              />
              {showValidation && (
                <Line
                  type="monotone"
                  dataKey="valLoss"
                  name="Val Loss"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                  activeDot={{ r: 4, fill: '#10B981' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">Accuracy</h4>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="epoch"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                label={{ value: 'Epoch', position: 'insideBottom', offset: -5, fill: '#9CA3AF' }}
              />
              <YAxis
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                domain={[0, 100]}
                label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: '#F9FAFB' }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="trainAcc"
                name="Train Accuracy"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#8B5CF6' }}
              />
              {showValidation && (
                <Line
                  type="monotone"
                  dataKey="valAcc"
                  name="Val Accuracy"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                  activeDot={{ r: 4, fill: '#F59E0B' }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {history.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-white/[0.06]">
          <div className="text-center">
            <p className="text-xs text-slate-400">Current Loss</p>
            <p className="text-lg font-bold text-blue-400">
              {history[history.length - 1].loss.toFixed(4)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400">Current Accuracy</p>
            <p className="text-lg font-bold text-purple-400">
              {(history[history.length - 1].accuracy * 100).toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400">Best Loss</p>
            <p className="text-lg font-bold text-green-400">
              {Math.min(...history.map(h => h.loss)).toFixed(4)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400">Best Accuracy</p>
            <p className="text-lg font-bold text-amber-400">
              {(Math.max(...history.map(h => h.accuracy)) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default LossCurve
