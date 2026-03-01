import { useMemo } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface DecisionBoundaryProps {
  boundary: { x: number; y: number; prediction: number; probability?: number }[]
  dataPoints?: { x: number; y: number; label: number }[]
  resolution?: number
  height?: number
}

const CLASS_COLORS = [
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
]

const BACKGROUND_COLORS = [
  'rgba(59, 130, 246, 0.2)',
  'rgba(239, 68, 68, 0.2)',
  'rgba(16, 185, 129, 0.2)',
  'rgba(245, 158, 11, 0.2)',
  'rgba(139, 92, 246, 0.2)',
]

export function DecisionBoundary({
  boundary,
  dataPoints,
  resolution = 20,
  height = 400
}: DecisionBoundaryProps) {
  const gridData = useMemo(() => {
    if (!boundary || boundary.length === 0) return []

    return boundary.map(point => ({
      ...point,
      color: BACKGROUND_COLORS[point.prediction % BACKGROUND_COLORS.length]
    }))
  }, [boundary])

  const formattedDataPoints = useMemo(() => {
    if (!dataPoints) return []
    return dataPoints.map(point => ({
      x: point.x,
      y: point.y,
      label: point.label,
      color: CLASS_COLORS[point.label % CLASS_COLORS.length]
    }))
  }, [dataPoints])

  const xRange = useMemo(() => {
    if (boundary.length === 0) return [-2, 2]
    const xs = boundary.map(p => p.x)
    return [Math.min(...xs), Math.max(...xs)]
  }, [boundary])

  const yRange = useMemo(() => {
    if (boundary.length === 0) return [-2, 2]
    const ys = boundary.map(p => p.y)
    return [Math.min(...ys), Math.max(...ys)]
  }, [boundary])

  if (boundary.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg">
        <p className="text-slate-400">Train a model to see the decision boundary.</p>
      </div>
    )
  }

  return (
    <div className="bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Decision Boundary</h3>

      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            type="number"
            dataKey="x"
            domain={xRange}
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            label={{ value: 'Feature 1', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={yRange}
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            label={{ value: 'Feature 2', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px'
            }}
            formatter={(value: number, name: string) => {
              if (name === 'prediction') return [`Class ${value}`, 'Prediction']
              if (name === 'probability') return [`${(value * 100).toFixed(1)}%`, 'Confidence']
              return [value.toFixed(3), name]
            }}
          />

          <Scatter
            name="Decision Region"
            data={gridData}
            fill="#8884d8"
          >
            {gridData.map((entry, index) => (
              <Cell
                key={`cell-bg-${index}`}
                fill={BACKGROUND_COLORS[entry.prediction % BACKGROUND_COLORS.length]}
                stroke="none"
              />
            ))}
          </Scatter>

          {formattedDataPoints.length > 0 && (
            <Scatter
              name="Data Points"
              data={formattedDataPoints}
              fill="#8884d8"
            >
              {formattedDataPoints.map((entry, index) => (
                <Cell
                  key={`cell-data-${index}`}
                  fill={CLASS_COLORS[entry.label % CLASS_COLORS.length]}
                  stroke="#fff"
                  strokeWidth={2}
                />
              ))}
            </Scatter>
          )}
        </ScatterChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-4 justify-center mt-4 pt-4 border-t border-white/[0.06]">
        {Array.from(new Set(dataPoints?.map(d => d.label) || [])).sort().map(label => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full border-2 border-white"
              style={{ backgroundColor: CLASS_COLORS[label % CLASS_COLORS.length] }}
            />
            <span className="text-sm text-slate-300">Class {label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DecisionBoundary
