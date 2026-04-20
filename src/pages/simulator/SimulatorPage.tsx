import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Cpu, Code, Grid3X3, Play, History, BookOpen, Inbox } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { client } from '@/lib/amplify'

interface SavedCircuit {
  id: string
  name: string
  numQubits: number
  gateCount: number
  updatedAt: string
}

const FEATURES = [
  {
    title: 'Circuit Builder',
    description: 'Drag and drop quantum gates to build circuits visually',
    icon: Grid3X3,
    color: 'from-blue-500 to-cyan-500',
    link: '/simulator/circuit',
  },
  {
    title: 'Code Playground',
    description: 'Write quantum code in Qiskit, Cirq, or PennyLane',
    icon: Code,
    color: 'from-purple-500 to-pink-500',
    link: '/simulator/code',
  },
]

const TEMPLATES = [
  { id: 'bell', name: 'Bell State', description: 'Create maximally entangled state' },
  { id: 'ghz', name: 'GHZ State', description: '3-qubit entanglement' },
  { id: 'qft', name: 'Quantum Fourier Transform', description: '4-qubit QFT circuit' },
  { id: 'grover', name: 'Grover 2-qubit', description: 'Simple Grover search' },
]

export default function SimulatorPage() {
  const [recentCircuits, setRecentCircuits] = useState<SavedCircuit[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadRecentCircuits = async () => {
      try {
        const { data: circuits } = await client.models.SavedCircuit?.list?.({
          limit: 5
        }) || { data: [] }

        if (circuits && circuits.length > 0) {
          setRecentCircuits(circuits.map(c => ({
            id: c.id,
            name: c.name || 'Untitled Circuit',
            numQubits: c.numQubits || 2,
            gateCount: c.gateCount || 0,
            updatedAt: c.updatedAt || c.createdAt || new Date().toISOString(),
          })))
        }
      } catch (error) {
        console.log('No saved circuits found')
      } finally {
        setIsLoading(false)
      }
    }
    loadRecentCircuits()
  }, [])

  const formatTimeAgo = (date: string) => {
    const now = new Date()
    const then = new Date(date)
    const diff = now.getTime() - then.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">
          Quantum Simulator
        </h1>
        <p className="text-slate-400 text-sm md:text-base">
          Build, run, and visualize quantum circuits with our browser-based simulator
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link to={feature.link}>
                <Card variant="neumorph-hover" className="h-full">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-sm md:text-base text-slate-400">{feature.description}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <Card variant="neumorph">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <History className="w-5 h-5 text-quantum-400" />
                Recent Circuits
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">Your recently created quantum circuits</CardDescription>
            </CardHeader>

            {isLoading ? (
              <div className="text-center py-8 text-slate-400">
                Loading...
              </div>
            ) : recentCircuits.length > 0 ? (
              <div className="space-y-3">
                {recentCircuits.map((circuit) => (
                  <Link
                    key={circuit.id}
                    to={`/simulator/circuit?id=${circuit.id}`}
                    className="flex items-center justify-between p-3 md:p-4 rounded-lg md:rounded-xl bg-neumorph-base/50 hover:bg-neumorph-light/50 transition-colors shadow-neumorph-xs border border-white/[0.02]"
                  >
                    <div>
                      <h4 className="font-medium text-white text-sm md:text-base">{circuit.name}</h4>
                      <p className="text-xs md:text-sm text-slate-400">
                        {circuit.numQubits} qubits · {circuit.gateCount} gates
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-500">{formatTimeAgo(circuit.updatedAt)}</span>
                      <Play className="w-4 h-4 text-slate-400" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
                <Inbox className="w-10 h-10 md:w-12 md:h-12 text-slate-600 mb-3" />
                <p className="text-slate-400 mb-2">No circuits yet</p>
                <p className="text-xs md:text-sm text-slate-500 mb-4">Create your first quantum circuit!</p>
                <Link to="/simulator/circuit">
                  <Button size="sm">
                    <Cpu className="w-4 h-4 mr-2" />
                    New Circuit
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card variant="neumorph">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <BookOpen className="w-5 h-5 text-quantum-400" />
                Templates
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">Start with a template</CardDescription>
            </CardHeader>
            <div className="space-y-2">
              {TEMPLATES.map((template) => (
                <Link
                  key={template.id}
                  to={`/simulator/circuit?template=${template.id}`}
                  className="block p-3 rounded-lg hover:bg-neumorph-light/50 transition-colors"
                >
                  <h4 className="font-medium text-white text-sm">{template.name}</h4>
                  <p className="text-xs text-slate-400">{template.description}</p>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card variant="neumorph" className="bg-gradient-to-r from-quantum-500/5 to-neon-purple/5">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
              Simulation Capabilities
            </h3>
            <p className="text-sm md:text-base text-slate-300">
              Multi-tier quantum simulation supporting up to 1000+ qubits
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="text-center p-2 rounded-lg bg-neumorph-base/80 shadow-neumorph-xs border border-white/[0.02]">
              <div className="text-lg font-bold text-green-400">1-20</div>
              <div className="text-xs text-slate-400">Browser</div>
              <div className="text-xs text-slate-500">Free</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-neumorph-base/80 shadow-neumorph-xs border border-white/[0.02]">
              <div className="text-lg font-bold text-blue-400">21-24</div>
              <div className="text-xs text-slate-400">Lambda S</div>
              <div className="text-xs text-slate-500">512MB</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-neumorph-base/80 shadow-neumorph-xs border border-white/[0.02]">
              <div className="text-lg font-bold text-purple-400">25-26</div>
              <div className="text-xs text-slate-400">Lambda M</div>
              <div className="text-xs text-slate-500">1.5GB</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-neumorph-base/80 shadow-neumorph-xs border border-white/[0.02]">
              <div className="text-lg font-bold text-pink-400">27</div>
              <div className="text-xs text-slate-400">Lambda L</div>
              <div className="text-xs text-slate-500">3GB</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-neumorph-base/80 shadow-neumorph-xs border border-white/[0.02]">
              <div className="text-lg font-bold text-cyan-400">1000+</div>
              <div className="text-xs text-slate-400">Clifford</div>
              <div className="text-xs text-slate-500">H,S,CNOT</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-neumorph-base/80 shadow-neumorph-xs border border-white/[0.02]">
              <div className="text-lg font-bold text-orange-400">30-100</div>
              <div className="text-xs text-slate-400">Tensor</div>
              <div className="text-xs text-slate-500">Low ent.</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-neumorph-base/80 shadow-neumorph-xs border border-white/[0.02]">
              <div className="text-lg font-bold text-yellow-400">28-54</div>
              <div className="text-xs text-slate-400">Cutting</div>
              <div className="text-xs text-slate-500">Parallel</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
