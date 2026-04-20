import { useState } from 'react'
import { Volume2, VolumeX, Settings, Cpu, Zap } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useSimulatorStore } from '@/stores/simulatorStore'
import type { NoiseType, HardwarePreset } from '@/types/simulator'

const NOISE_TYPES: { value: NoiseType; label: string; description: string }[] = [
  { value: 'depolarizing', label: 'Depolarizing', description: 'Random Pauli errors' },
  { value: 'amplitude_damping', label: 'Amplitude Damping', description: 'Energy relaxation (T1)' },
  { value: 'phase_damping', label: 'Phase Damping', description: 'Dephasing (T2)' },
  { value: 'bit_flip', label: 'Bit Flip', description: 'X errors only' },
  { value: 'phase_flip', label: 'Phase Flip', description: 'Z errors only' },
]

const HARDWARE_PRESETS: { value: HardwarePreset; label: string; icon: JSX.Element; description: string }[] = [
  { value: 'ideal', label: 'Ideal', icon: <Zap className="w-4 h-4" />, description: 'No noise' },
  { value: 'ibmq', label: 'IBMQ', icon: <Cpu className="w-4 h-4" />, description: 'Superconducting' },
  { value: 'ionq', label: 'IonQ', icon: <Cpu className="w-4 h-4" />, description: 'Trapped ion' },
  { value: 'custom', label: 'Custom', icon: <Settings className="w-4 h-4" />, description: 'Configure manually' },
]

export function NoiseConfigPanel() {
  const { noiseConfig, setNoiseConfig, toggleNoise, setNoisePreset } = useSimulatorStore()
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleErrorRateChange = (value: number) => {
    setNoiseConfig({
      model: { ...noiseConfig.model, errorRate: value },
    })
  }

  const handleNoiseTypeChange = (type: NoiseType) => {
    setNoiseConfig({
      model: { ...noiseConfig.model, type },
    })
  }

  return (
    <Card variant="neumorph" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {noiseConfig.enabled ? (
            <Volume2 className="w-5 h-5 text-amber-400" />
          ) : (
            <VolumeX className="w-5 h-5 text-slate-400" />
          )}
          <h3 className="font-semibold text-white text-sm">Noise Simulation</h3>
        </div>
        <Button
          variant={noiseConfig.enabled ? 'primary' : 'secondary'}
          size="sm"
          onClick={toggleNoise}
        >
          {noiseConfig.enabled ? 'Enabled' : 'Disabled'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {HARDWARE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => setNoisePreset(preset.value)}
            className={`p-3 rounded-lg text-left transition-all ${
              noiseConfig.preset === preset.value
                ? 'bg-quantum-500/20 border border-quantum-500'
                : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {preset.icon}
              <span className="text-sm font-medium text-white">{preset.label}</span>
            </div>
            <span className="text-xs text-slate-400">{preset.description}</span>
          </button>
        ))}
      </div>

      {noiseConfig.preset === 'custom' && (
        <>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Noise Model</label>
              <div className="grid grid-cols-2 gap-1">
                {NOISE_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => handleNoiseTypeChange(type.value)}
                    className={`p-2 rounded text-left text-xs transition-all ${
                      noiseConfig.model.type === type.value
                        ? 'bg-quantum-500/20 border border-quantum-500'
                        : 'bg-slate-800/50 border border-white/[0.02] hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="font-medium text-white">{type.label}</div>
                    <div className="text-slate-400 text-[10px]">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Error Rate</span>
                <span className="text-white font-mono">
                  {(noiseConfig.model.errorRate * 100).toFixed(2)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.1"
                step="0.001"
                value={noiseConfig.model.errorRate}
                onChange={(e) => handleErrorRateChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-quantum-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>0%</span>
                <span>10%</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-quantum-400 hover:text-quantum-300"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
          </button>

          {showAdvanced && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">T1 Relaxation (us)</span>
                  <span className="text-white font-mono">{noiseConfig.t1 || 100}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="1000"
                  step="10"
                  value={noiseConfig.t1 || 100}
                  onChange={(e) => setNoiseConfig({ t1: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-quantum-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">T2 Dephasing (us)</span>
                  <span className="text-white font-mono">{noiseConfig.t2 || 80}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="500"
                  step="5"
                  value={noiseConfig.t2 || 80}
                  onChange={(e) => setNoiseConfig({ t2: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-quantum-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Readout Error</span>
                  <span className="text-white font-mono">
                    {((noiseConfig.readoutError || 0.01) * 100).toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.1"
                  step="0.005"
                  value={noiseConfig.readoutError || 0.01}
                  onChange={(e) => setNoiseConfig({ readoutError: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-quantum-500"
                />
              </div>
            </div>
          )}
        </>
      )}

      {noiseConfig.enabled && noiseConfig.preset !== 'ideal' && (
        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-xs text-amber-400">
            Noise enabled: Results will show realistic quantum hardware behavior.
          </p>
        </div>
      )}
    </Card>
  )
}
