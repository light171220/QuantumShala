import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Sparkles, X } from 'lucide-react'
import { CIRCUIT_TEMPLATES, type CircuitTemplate } from '@/lib/quantum/circuit-templates'
import { Button } from '@/components/ui/Button'

interface TemplatesPanelProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: CircuitTemplate) => void
}

export function TemplatesPanel({ isOpen, onClose, onSelectTemplate }: TemplatesPanelProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('entanglement')

  const categories = [
    { id: 'basic', name: 'Basic Circuits', icon: '🔰' },
    { id: 'entanglement', name: 'Entanglement', icon: '🔗' },
    { id: 'algorithms', name: 'Algorithms', icon: '⚡' },
    { id: 'error-correction', name: 'Error Correction', icon: '🛡️' },
  ]

  const templatesByCategory = categories.reduce((acc, cat) => {
    acc[cat.id] = CIRCUIT_TEMPLATES.filter((t) => t.category === cat.id)
    return acc
  }, {} as Record<string, CircuitTemplate[]>)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-screen w-[400px] bg-slate-900 border-l border-white/10 shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-quantum-400" />
                <h2 className="font-semibold text-white">Circuit Templates</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="text-sm text-slate-400">
                Load a pre-built circuit template to get started quickly.
              </p>

              {categories.map((category) => (
                <div key={category.id} className="border border-white/5 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>{category.icon}</span>
                      <span className="font-medium text-white">{category.name}</span>
                      <span className="text-xs text-slate-500">
                        ({templatesByCategory[category.id].length})
                      </span>
                    </div>
                    {expandedCategory === category.id ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  <AnimatePresence>
                    {expandedCategory === category.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-2 space-y-2">
                          {templatesByCategory[category.id].map((template) => (
                            <button
                              key={template.id}
                              onClick={() => {
                                onSelectTemplate(template)
                                onClose()
                              }}
                              className="w-full p-3 bg-slate-800/30 hover:bg-slate-700/50 rounded-lg text-left transition-all border border-transparent hover:border-quantum-500/30"
                            >
                              <div className="flex items-start gap-3">
                                <span className="text-2xl">{template.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-white">{template.name}</div>
                                  <div className="text-xs text-slate-400 mt-0.5">
                                    {template.numQubits} qubits · {template.gates.length} gates
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                    {template.description}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-white/10 bg-slate-900/80">
              <p className="text-xs text-slate-500 text-center">
                Click a template to load it into the circuit builder
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
