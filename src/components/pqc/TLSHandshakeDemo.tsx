import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, RotateCcw, Server, Monitor, ArrowRight, Shield, Lock, CheckCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { TLSHybridDemo, type TLSStep, type TLSHybridConfig } from '@/lib/pqc/protocols/tls-hybrid'

interface TLSHandshakeDemoProps {
  config?: TLSHybridConfig
  onComplete?: (clientKey: Uint8Array, serverKey: Uint8Array) => void
}

const ALGORITHM_OPTIONS = [
  { classical: 'x25519' as const, pqc: 'ml-kem-768' as const, label: 'X25519 + ML-KEM-768' },
  { classical: 'x25519' as const, pqc: 'ml-kem-512' as const, label: 'X25519 + ML-KEM-512' },
  { classical: 'x25519' as const, pqc: 'ml-kem-1024' as const, label: 'X25519 + ML-KEM-1024' },
  { classical: 'p256' as const, pqc: 'ml-kem-768' as const, label: 'P-256 + ML-KEM-768' }
]

export function TLSHandshakeDemo({ config, onComplete }: TLSHandshakeDemoProps) {
  const [selectedConfig, setSelectedConfig] = useState<TLSHybridConfig>(
    config || { classicalAlgorithm: 'x25519', pqcAlgorithm: 'ml-kem-768' }
  )
  const [demo, setDemo] = useState<TLSHybridDemo | null>(null)
  const [steps, setSteps] = useState<TLSStep[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [isRunning, setIsRunning] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [keys, setKeys] = useState<{ clientKey: Uint8Array; serverKey: Uint8Array } | null>(null)

  const runHandshake = useCallback(async () => {
    setIsRunning(true)
    setIsComplete(false)
    setSteps([])
    setCurrentStepIndex(-1)
    setKeys(null)

    const newDemo = new TLSHybridDemo(selectedConfig)
    setDemo(newDemo)

    await new Promise(r => setTimeout(r, 500))
    const clientHello = newDemo.clientHello()
    setSteps([...newDemo.getSteps()])
    setCurrentStepIndex(0)

    await new Promise(r => setTimeout(r, 800))
    const serverHello = newDemo.serverHello(clientHello)
    setSteps([...newDemo.getSteps()])
    setCurrentStepIndex(1)

    await new Promise(r => setTimeout(r, 800))
    const derivedKeys = newDemo.deriveKeys()
    setSteps([...newDemo.getSteps()])

    for (let i = 2; i < newDemo.getSteps().length; i++) {
      await new Promise(r => setTimeout(r, 500))
      setCurrentStepIndex(i)
    }

    setKeys(derivedKeys)
    setIsComplete(true)
    setIsRunning(false)
    onComplete?.(derivedKeys.clientKey, derivedKeys.serverKey)
  }, [selectedConfig, onComplete])

  const reset = () => {
    setDemo(null)
    setSteps([])
    setCurrentStepIndex(-1)
    setIsRunning(false)
    setIsComplete(false)
    setKeys(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={`${selectedConfig.classicalAlgorithm}|${selectedConfig.pqcAlgorithm}`}
          onChange={(e) => {
            const [classical, pqc] = e.target.value.split('|') as [TLSHybridConfig['classicalAlgorithm'], TLSHybridConfig['pqcAlgorithm']]
            setSelectedConfig({ classicalAlgorithm: classical, pqcAlgorithm: pqc })
          }}
          className="px-3 py-2 rounded-lg bg-neumorph-base border border-white/[0.02] text-white text-sm"
          disabled={isRunning}
        >
          {ALGORITHM_OPTIONS.map(opt => (
            <option key={`${opt.classical}|${opt.pqc}`} value={`${opt.classical}|${opt.pqc}`}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button onClick={runHandshake} disabled={isRunning} size="sm">
          <Play className="w-4 h-4 mr-1" />
          {isRunning ? 'Running...' : 'Run Handshake'}
        </Button>
        <Button variant="secondary" onClick={reset} size="sm" disabled={isRunning}>
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="neumorph" className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-white">Client</span>
          </div>
          <div className="space-y-2 text-xs">
            {steps.filter(s => s.sender === 'client').map((step, idx) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-2 rounded ${
                  steps.indexOf(step) <= currentStepIndex
                    ? 'bg-blue-500/20 border border-blue-500/30'
                    : 'bg-slate-800/50'
                }`}
              >
                <div className="font-medium text-white">{step.name}</div>
                <div className="text-slate-400">{step.description}</div>
              </motion.div>
            ))}
          </div>
        </Card>

        <Card variant="neumorph" className="p-4">
          <div className="flex items-center justify-center gap-2 mb-3">
            <ArrowRight className="w-4 h-4 text-slate-500" />
            <Shield className="w-5 h-5 text-green-400" />
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-center mb-4">
            <div className="text-sm font-semibold text-white">TLS 1.3 Hybrid</div>
            <div className="text-xs text-slate-400">
              {selectedConfig.classicalAlgorithm.toUpperCase()} + {selectedConfig.pqcAlgorithm.toUpperCase()}
            </div>
          </div>
          <div className="space-y-2">
            {isComplete && keys && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-lg bg-green-500/20 border border-green-500/30 text-center"
              >
                <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <div className="text-sm font-semibold text-white">Secure Channel Established</div>
                <div className="text-xs text-green-400 mt-1">
                  Quantum-resistant encryption active
                </div>
              </motion.div>
            )}
            {!isComplete && steps.length > 0 && (
              <div className="text-center text-xs text-slate-400">
                Handshake in progress...
              </div>
            )}
          </div>
        </Card>

        <Card variant="neumorph" className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-5 h-5 text-purple-400" />
            <span className="font-semibold text-white">Server</span>
          </div>
          <div className="space-y-2 text-xs">
            {steps.filter(s => s.sender === 'server').map((step, idx) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-2 rounded ${
                  steps.indexOf(step) <= currentStepIndex
                    ? 'bg-purple-500/20 border border-purple-500/30'
                    : 'bg-slate-800/50'
                }`}
              >
                <div className="font-medium text-white">{step.name}</div>
                <div className="text-slate-400">{step.description}</div>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>

      {steps.length > 0 && (
        <Card variant="neumorph" className="p-4">
          <div className="text-sm font-semibold text-white mb-3">Handshake Steps</div>
          <div className="space-y-2">
            {steps.map((step, idx) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex items-center gap-3 p-2 rounded text-xs ${
                  idx <= currentStepIndex
                    ? 'bg-slate-700/50'
                    : 'bg-slate-800/30 opacity-50'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  idx <= currentStepIndex
                    ? step.sender === 'client' ? 'bg-blue-500' : 'bg-purple-500'
                    : 'bg-slate-700'
                }`}>
                  {idx <= currentStepIndex ? (
                    <CheckCircle className="w-3 h-3 text-white" />
                  ) : (
                    <span className="text-slate-400">{idx + 1}</span>
                  )}
                </div>
                <div className="flex-1">
                  <span className="font-medium text-white">{step.name}</span>
                  <span className="text-slate-400 ml-2">{step.description}</span>
                </div>
                <Badge variant={step.sender === 'client' ? 'primary' : 'info'} size="sm">
                  {step.sender}
                </Badge>
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      {isComplete && keys && (
        <Card variant="neumorph" className="p-4">
          <div className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-green-400" />
            Derived Keys
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-slate-400 mb-1">Client Application Key</div>
              <div className="font-mono text-green-400 break-all">
                {Array.from(keys.clientKey).map(b => b.toString(16).padStart(2, '0')).join('')}
              </div>
            </div>
            <div>
              <div className="text-slate-400 mb-1">Server Application Key</div>
              <div className="font-mono text-purple-400 break-all">
                {Array.from(keys.serverKey).map(b => b.toString(16).padStart(2, '0')).join('')}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
