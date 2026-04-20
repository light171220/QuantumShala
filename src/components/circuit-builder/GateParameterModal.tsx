import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { GATE_DEFINITIONS } from '@/lib/quantum/gates'
import type { CircuitGate, GateType } from '@/types/simulator'

interface GateParameterModalProps {
  isOpen: boolean
  gate: CircuitGate | null
  onClose: () => void
  onSave: (gateId: string, parameters: number[]) => void
  onDelete: (gateId: string) => void
}

export function GateParameterModal({ isOpen, gate, onClose, onSave, onDelete }: GateParameterModalProps) {
  const [parameters, setParameters] = useState<number[]>([])

  useEffect(() => {
    if (gate) {
      setParameters([...(gate.parameters || [])])
    }
  }, [gate])

  if (!gate) return null

  const gateDef = GATE_DEFINITIONS[gate.type]

  const handleParamChange = (index: number, value: number) => {
    const newParams = [...parameters]
    newParams[index] = value
    setParameters(newParams)
  }

  const handleReset = (index: number) => {
    const newParams = [...parameters]
    newParams[index] = gateDef.parameters[index].default
    setParameters(newParams)
  }

  const formatAngle = (value: number) => {
    const piMultiple = value / Math.PI
    if (Math.abs(piMultiple - Math.round(piMultiple)) < 0.01) {
      const rounded = Math.round(piMultiple)
      if (rounded === 0) return '0'
      if (rounded === 1) return 'π'
      if (rounded === -1) return '-π'
      return `${rounded}π`
    }
    if (Math.abs(piMultiple * 2 - Math.round(piMultiple * 2)) < 0.01) {
      const rounded = Math.round(piMultiple * 2)
      if (rounded === 1) return 'π/2'
      if (rounded === -1) return '-π/2'
      return `${rounded}π/2`
    }
    if (Math.abs(piMultiple * 4 - Math.round(piMultiple * 4)) < 0.01) {
      const rounded = Math.round(piMultiple * 4)
      if (rounded === 1) return 'π/4'
      if (rounded === -1) return '-π/4'
      return `${rounded}π/4`
    }
    return value.toFixed(3)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-mono font-bold"
                  style={{ backgroundColor: gateDef.color }}
                >
                  {gateDef.symbol}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{gateDef.name}</h3>
                  <p className="text-xs text-slate-400">Qubit{gate.qubits.length > 1 ? 's' : ''}: {gate.qubits.join(', ')}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-400">{gateDef.description}</p>

              {gateDef.parameters.length > 0 ? (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-white">Parameters</h4>
                  {gateDef.parameters.map((param, index) => (
                    <div key={param.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-slate-300">{param.name}</label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-quantum-400">
                            {formatAngle(parameters[index] ?? param.default)}
                          </span>
                          <button
                            onClick={() => handleReset(index)}
                            className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-white"
                            title="Reset to default"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={param.min}
                        max={param.max}
                        step={param.step}
                        value={parameters[index] ?? param.default}
                        onChange={(e) => handleParamChange(index, parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-quantum-500"
                      />
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>0</span>
                        <span>π/2</span>
                        <span>π</span>
                        <span>3π/2</span>
                        <span>2π</span>
                      </div>
                      <div className="flex gap-2">
                        {[0, Math.PI / 4, Math.PI / 2, Math.PI, 3 * Math.PI / 2].map((preset) => (
                          <button
                            key={preset}
                            onClick={() => handleParamChange(index, preset)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              Math.abs((parameters[index] ?? param.default) - preset) < 0.01
                                ? 'bg-quantum-500 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {formatAngle(preset)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-slate-500 text-sm">
                  This gate has no configurable parameters
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-slate-900/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onDelete(gate.id)
                  onClose()
                }}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                Delete Gate
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onSave(gate.id, parameters)
                    onClose()
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
