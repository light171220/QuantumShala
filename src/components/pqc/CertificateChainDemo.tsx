import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileCheck, Shield, Building, User, ChevronDown, ChevronRight, CheckCircle, XCircle, RefreshCw, ArrowDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { createFullChain, type PQCCertificate, type CertificateChainResult, type CertificateAlgorithm, type VerificationStep } from '@/lib/pqc/protocols/certificates'

interface CertificateChainDemoProps {
  algorithm?: CertificateAlgorithm
  rootSubject?: string
  intermediateSubject?: string
  endEntitySubject?: string
}

function CertificateCard({
  cert,
  type,
  isExpanded,
  onToggle
}: {
  cert: PQCCertificate
  type: 'root' | 'intermediate' | 'end-entity'
  isExpanded: boolean
  onToggle: () => void
}) {
  const icons = {
    'root': Shield,
    'intermediate': Building,
    'end-entity': User
  }
  const colors = {
    'root': 'from-green-500 to-emerald-500',
    'intermediate': 'from-blue-500 to-cyan-500',
    'end-entity': 'from-purple-500 to-violet-500'
  }
  const labels = {
    'root': 'Root CA',
    'intermediate': 'Intermediate CA',
    'end-entity': 'End Entity'
  }

  const Icon = icons[type]

  return (
    <motion.div
      layout
      className="rounded-xl bg-neumorph-base shadow-neumorph-sm border border-white/[0.02] overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-3 text-left"
      >
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[type]} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white truncate">{cert.subject}</span>
            <Badge variant={cert.isCA ? 'warning' : 'info'} size="sm">
              {labels[type]}
            </Badge>
          </div>
          <div className="text-xs text-slate-400 truncate">
            Signed by: {cert.issuer}
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/[0.02]"
          >
            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400">Algorithm</span>
                  <div className="text-white font-mono">{cert.algorithm.toUpperCase()}</div>
                </div>
                <div>
                  <span className="text-slate-400">Version</span>
                  <div className="text-white">X.509 v{cert.version}</div>
                </div>
                <div>
                  <span className="text-slate-400">Valid From</span>
                  <div className="text-white">{cert.validFrom.toLocaleDateString()}</div>
                </div>
                <div>
                  <span className="text-slate-400">Valid To</span>
                  <div className="text-white">{cert.validTo.toLocaleDateString()}</div>
                </div>
              </div>

              <div>
                <span className="text-slate-400">Serial Number</span>
                <div className="text-white font-mono break-all">
                  {Array.from(cert.serialNumber.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(':')}...
                </div>
              </div>

              <div>
                <span className="text-slate-400">Public Key ({cert.publicKey.length} bytes)</span>
                <div className="text-white font-mono break-all text-[10px] bg-slate-800/50 p-2 rounded mt-1">
                  {Array.from(cert.publicKey.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join('')}...
                </div>
              </div>

              <div>
                <span className="text-slate-400">Signature ({cert.signature.length} bytes)</span>
                <div className="text-white font-mono break-all text-[10px] bg-slate-800/50 p-2 rounded mt-1">
                  {Array.from(cert.signature.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join('')}...
                </div>
              </div>

              {cert.extensions.length > 0 && (
                <div>
                  <span className="text-slate-400">Extensions</span>
                  <div className="space-y-1 mt-1">
                    {cert.extensions.map((ext, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {ext.critical && <Badge variant="danger" size="sm">Critical</Badge>}
                        <span className="text-slate-300">
                          {typeof ext.value === 'string' ? ext.value : 'Binary data'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function VerificationResults({ steps }: { steps: VerificationStep[] }) {
  return (
    <Card variant="neumorph" className="p-4">
      <div className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <FileCheck className="w-4 h-4 text-blue-400" />
        Verification Steps
      </div>
      <div className="space-y-2">
        {steps.map((step, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`p-3 rounded-lg text-xs ${
              step.result
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-red-500/10 border border-red-500/30'
            }`}
          >
            <div className="flex items-start gap-2">
              {step.result ? (
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white">{step.action}</span>
                  <Badge variant="info" size="sm">{step.certificate}</Badge>
                </div>
                <div className="text-slate-400">{step.details}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  )
}

export function CertificateChainDemo({
  algorithm = 'ml-dsa-65',
  rootSubject = 'QuantumShala Root CA',
  intermediateSubject = 'QuantumShala Intermediate CA',
  endEntitySubject = 'secure.quantumshala.example.com'
}: CertificateChainDemoProps) {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<CertificateAlgorithm>(algorithm)
  const [chainResult, setChainResult] = useState<CertificateChainResult | null>(null)
  const [expandedCert, setExpandedCert] = useState<number | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const generateChain = useCallback(async () => {
    setIsGenerating(true)
    setChainResult(null)
    setExpandedCert(null)

    await new Promise(r => setTimeout(r, 500))

    const result = createFullChain(
      rootSubject,
      intermediateSubject,
      endEntitySubject,
      selectedAlgorithm
    )

    setChainResult(result)
    setIsGenerating(false)
  }, [selectedAlgorithm, rootSubject, intermediateSubject, endEntitySubject])

  const handleToggleCert = (index: number) => {
    setExpandedCert(expandedCert === index ? null : index)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedAlgorithm}
          onChange={(e) => setSelectedAlgorithm(e.target.value as CertificateAlgorithm)}
          className="px-3 py-2 rounded-lg bg-neumorph-base border border-white/[0.02] text-white text-sm"
          disabled={isGenerating}
        >
          <option value="ml-dsa-44">ML-DSA-44 (Level 2)</option>
          <option value="ml-dsa-65">ML-DSA-65 (Level 3)</option>
          <option value="ml-dsa-87">ML-DSA-87 (Level 5)</option>
        </select>
        <Button onClick={generateChain} disabled={isGenerating} size="sm">
          <RefreshCw className={`w-4 h-4 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Generating...' : 'Generate Chain'}
        </Button>
      </div>

      {chainResult && (
        <>
          <div className="flex items-center justify-center">
            <Badge variant={chainResult.isValid ? 'success' : 'danger'}>
              {chainResult.isValid ? 'Chain Valid' : 'Chain Invalid'}
            </Badge>
          </div>

          <div className="space-y-2">
            {chainResult.chain.map((cert, idx) => (
              <div key={idx}>
                <CertificateCard
                  cert={cert}
                  type={idx === 0 ? 'root' : idx === chainResult.chain.length - 1 ? 'end-entity' : 'intermediate'}
                  isExpanded={expandedCert === idx}
                  onToggle={() => handleToggleCert(idx)}
                />
                {idx < chainResult.chain.length - 1 && (
                  <div className="flex justify-center py-2">
                    <ArrowDown className="w-5 h-5 text-slate-500" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <VerificationResults steps={chainResult.verificationSteps} />
        </>
      )}

      {!chainResult && !isGenerating && (
        <Card variant="neumorph" className="p-8 text-center">
          <Shield className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <div className="text-slate-400 text-sm">
            Click "Generate Chain" to create a PQC certificate chain
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Root CA → Intermediate CA → End Entity Certificate
          </div>
        </Card>
      )}
    </div>
  )
}
