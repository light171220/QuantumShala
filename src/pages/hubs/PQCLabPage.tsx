import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Key,
  Lock,
  Unlock,
  FileCheck,
  AlertTriangle,
  CheckCircle,
  Play,
  BookOpen,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  Zap,
  Clock,
  Server,
  ArrowRight,
  FileText,
  BarChart3,
  XCircle,
  ExternalLink,
  ChevronRight,
  Lightbulb,
  Target,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { Modal } from '@/components/ui/Modal'
import { KeyViewer } from '@/components/pqc/KeyViewer'
import { BenchmarkChart } from '@/components/pqc/BenchmarkChart'
import { MLKEM, type MLKEMKeyPair } from '@/lib/pqc/kem/ml-kem'
import { MLDSA, type MLDSAKeyPair } from '@/lib/pqc/dsa/ml-dsa'
import { ShorSimulator, type ShorResourceEstimate } from '@/lib/pqc/attacks/shor-simulator'
import { GroverSimulator, type GroverResourceEstimate } from '@/lib/pqc/attacks/grover-simulator'
import { usePQCStore } from '@/stores/pqcStore'

const getKEMVariant = (variant: number): 'ML-KEM-512' | 'ML-KEM-768' | 'ML-KEM-1024' => {
  switch (variant) {
    case 512: return 'ML-KEM-512'
    case 768: return 'ML-KEM-768'
    case 1024: return 'ML-KEM-1024'
    default: return 'ML-KEM-768'
  }
}

const getDSAVariant = (variant: number): 'ML-DSA-44' | 'ML-DSA-65' | 'ML-DSA-87' => {
  switch (variant) {
    case 44: return 'ML-DSA-44'
    case 65: return 'ML-DSA-65'
    case 87: return 'ML-DSA-87'
    default: return 'ML-DSA-65'
  }
}

const PQC_ALGORITHMS = [
  {
    id: 'ml-kem-512',
    name: 'ML-KEM-512',
    fullName: 'Module-Lattice Key Encapsulation Mechanism',
    type: 'KEM' as const,
    standard: 'FIPS 203',
    family: 'Kyber',
    security: 'NIST Level 1',
    securityBits: 128,
    variant: 512,
  },
  {
    id: 'ml-kem-768',
    name: 'ML-KEM-768',
    fullName: 'Module-Lattice Key Encapsulation Mechanism',
    type: 'KEM' as const,
    standard: 'FIPS 203',
    family: 'Kyber',
    security: 'NIST Level 3',
    securityBits: 192,
    variant: 768,
  },
  {
    id: 'ml-kem-1024',
    name: 'ML-KEM-1024',
    fullName: 'Module-Lattice Key Encapsulation Mechanism',
    type: 'KEM' as const,
    standard: 'FIPS 203',
    family: 'Kyber',
    security: 'NIST Level 5',
    securityBits: 256,
    variant: 1024,
  },
  {
    id: 'ml-dsa-44',
    name: 'ML-DSA-44',
    fullName: 'Module-Lattice Digital Signature Algorithm',
    type: 'Signature' as const,
    standard: 'FIPS 204',
    family: 'Dilithium',
    security: 'NIST Level 2',
    securityBits: 128,
    variant: 44,
  },
  {
    id: 'ml-dsa-65',
    name: 'ML-DSA-65',
    fullName: 'Module-Lattice Digital Signature Algorithm',
    type: 'Signature' as const,
    standard: 'FIPS 204',
    family: 'Dilithium',
    security: 'NIST Level 3',
    securityBits: 192,
    variant: 65,
  },
  {
    id: 'ml-dsa-87',
    name: 'ML-DSA-87',
    fullName: 'Module-Lattice Digital Signature Algorithm',
    type: 'Signature' as const,
    standard: 'FIPS 204',
    family: 'Dilithium',
    security: 'NIST Level 5',
    securityBits: 256,
    variant: 87,
  },
]

const ATTACK_TARGETS = [
  { id: 'rsa-2048', name: 'RSA-2048', bits: 2048, type: 'factoring' as const },
  { id: 'rsa-4096', name: 'RSA-4096', bits: 4096, type: 'factoring' as const },
  { id: 'ecc-256', name: 'ECC P-256', bits: 256, type: 'discrete_log' as const },
  { id: 'aes-128', name: 'AES-128', bits: 128, type: 'symmetric' as const },
  { id: 'aes-256', name: 'AES-256', bits: 256, type: 'symmetric' as const },
]

const PQC_GUIDE_SECTIONS = [
  {
    icon: Key,
    title: 'Cryptographic Sandbox',
    color: 'from-green-500 to-emerald-500',
    description: 'Generate and test post-quantum cryptographic keys interactively.',
    features: [
      'ML-KEM (Kyber): Key encapsulation for secure key exchange',
      'ML-DSA (Dilithium): Digital signatures for authentication',
      'Multiple security levels (NIST Levels 1-5)',
      'Real key generation, encapsulation, and signing operations',
    ]
  },
  {
    icon: AlertTriangle,
    title: 'Attack Simulator',
    color: 'from-red-500 to-orange-500',
    description: 'Visualize how quantum computers threaten classical cryptography.',
    features: [
      "Shor's algorithm: Breaks RSA and ECC in polynomial time",
      "Grover's algorithm: Reduces symmetric key security by half",
      'Resource estimates for breaking different key sizes',
      'Timeline projections for cryptographically relevant quantum computers',
    ]
  },
  {
    icon: FileCheck,
    title: 'Migration Checklist',
    color: 'from-blue-500 to-cyan-500',
    description: 'Track your organization\'s progress toward quantum-safe cryptography.',
    features: [
      'Cryptographic inventory assessment',
      'Hybrid classical + PQC deployment strategy',
      'TLS 1.3 with post-quantum key exchange',
      'HSM and PKI migration planning',
    ]
  },
  {
    icon: BarChart3,
    title: 'Benchmarks',
    color: 'from-purple-500 to-pink-500',
    description: 'Measure real performance of post-quantum algorithms in your browser.',
    features: [
      'Key generation speed for all variants',
      'Encapsulation/decapsulation timing',
      'Signature creation and verification performance',
      'Comparison with classical cryptography overhead',
    ]
  },
]

const PQC_QUICK_START = [
  { step: 1, text: 'Select a post-quantum algorithm (ML-KEM or ML-DSA)' },
  { step: 2, text: 'Click "Generate Keys" to create a key pair' },
  { step: 3, text: 'For KEM: Encapsulate to create shared secret' },
  { step: 4, text: 'For DSA: Sign a message and verify the signature' },
]

const MIGRATION_CHECKLIST = [
  { id: 'inventory', name: 'Cryptographic Inventory', description: 'Catalog all crypto assets', status: 'pending' },
  { id: 'risk', name: 'Risk Assessment', description: 'Evaluate quantum threat timeline', status: 'pending' },
  { id: 'hybrid', name: 'Hybrid Deployment', description: 'Implement hybrid classical+PQC', status: 'pending' },
  { id: 'tls', name: 'TLS 1.3 + PQC', description: 'Enable PQC key exchange', status: 'pending' },
  { id: 'certs', name: 'Certificate Migration', description: 'Update PKI to PQC signatures', status: 'pending' },
  { id: 'hsm', name: 'HSM Updates', description: 'Hardware security module support', status: 'pending' },
  { id: 'testing', name: 'Interop Testing', description: 'Test with partners/vendors', status: 'pending' },
  { id: 'rollout', name: 'Production Rollout', description: 'Gradual production deployment', status: 'pending' },
]

function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr.slice(0, 32))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('') + '...'
}

export default function PQCLabPage() {
  const [selectedTab, setSelectedTab] = useState('sandbox')
  const [selectedAlgo, setSelectedAlgo] = useState(PQC_ALGORITHMS[1])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEncrypting, setIsEncrypting] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [kemKeyPair, setKemKeyPair] = useState<MLKEMKeyPair | null>(null)
  const [dsaKeyPair, setDsaKeyPair] = useState<MLDSAKeyPair | null>(null)
  const [ciphertext, setCiphertext] = useState<Uint8Array | null>(null)
  const [sharedSecret, setSharedSecret] = useState<Uint8Array | null>(null)
  const [signature, setSignature] = useState<Uint8Array | null>(null)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [plaintext, setPlaintext] = useState('Hello, Quantum World!')
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null)

  const [selectedAttackTarget, setSelectedAttackTarget] = useState(ATTACK_TARGETS[0])
  const [attackResult, setAttackResult] = useState<ShorResourceEstimate | GroverResourceEstimate | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [attackProgress, setAttackProgress] = useState(0)

  const [checklist, setChecklist] = useState(MIGRATION_CHECKLIST)
  const [benchmarkResults, setBenchmarkResults] = useState<{ algorithm: string; variant: string; operation: 'keygen' | 'encaps' | 'decaps' | 'sign' | 'verify'; timeMs: number; iterations: number }[]>([])
  const [showGuide, setShowGuide] = useState(false)

  const handleGenerateKeys = useCallback(async () => {
    setIsGenerating(true)
    setCiphertext(null)
    setSharedSecret(null)
    setSignature(null)
    setVerificationResult(null)

    await new Promise(r => setTimeout(r, 100))

    try {
      if (selectedAlgo.type === 'KEM') {
        const kem = new MLKEM(getKEMVariant(selectedAlgo.variant))
        const keyPair = kem.keyGen()
        setKemKeyPair(keyPair)
        setDsaKeyPair(null)
      } else {
        const dsa = new MLDSA(getDSAVariant(selectedAlgo.variant))
        const keyPair = dsa.keyGen()
        setDsaKeyPair(keyPair)
        setKemKeyPair(null)
      }
    } catch (error) {
      console.error('Key generation error:', error)
    }

    setIsGenerating(false)
  }, [selectedAlgo])

  const handleEncapsulate = useCallback(async () => {
    if (!kemKeyPair) return
    setIsEncrypting(true)

    await new Promise(r => setTimeout(r, 50))

    try {
      const kem = new MLKEM(getKEMVariant(selectedAlgo.variant))
      const { ciphertext: ct, sharedSecret: ss } = kem.encaps(kemKeyPair.publicKey)
      setCiphertext(ct)
      setSharedSecret(ss)
    } catch (error) {
      console.error('Encapsulation error:', error)
    }

    setIsEncrypting(false)
  }, [kemKeyPair, selectedAlgo])

  const handleDecapsulate = useCallback(async () => {
    if (!kemKeyPair || !ciphertext) return

    try {
      const kem = new MLKEM(getKEMVariant(selectedAlgo.variant))
      const ss = kem.decaps(ciphertext, kemKeyPair.secretKey)
      setSharedSecret(ss)
    } catch (error) {
      console.error('Decapsulation error:', error)
    }
  }, [kemKeyPair, ciphertext, selectedAlgo])

  const handleSign = useCallback(async () => {
    if (!dsaKeyPair) return
    setIsSigning(true)

    await new Promise(r => setTimeout(r, 50))

    try {
      const dsa = new MLDSA(getDSAVariant(selectedAlgo.variant))
      const message = new TextEncoder().encode(plaintext)
      const result = dsa.sign(message, dsaKeyPair.secretKey)
      setSignature(result.signature)
      setVerificationResult(null)
    } catch (error) {
      console.error('Signing error:', error)
    }

    setIsSigning(false)
  }, [dsaKeyPair, plaintext, selectedAlgo])

  const handleVerify = useCallback(async () => {
    if (!dsaKeyPair || !signature) return

    try {
      const dsa = new MLDSA(getDSAVariant(selectedAlgo.variant))
      const message = new TextEncoder().encode(plaintext)
      const valid = dsa.verify(message, signature, dsaKeyPair.publicKey)
      setVerificationResult(valid)
    } catch (error) {
      console.error('Verification error:', error)
      setVerificationResult(false)
    }
  }, [dsaKeyPair, signature, plaintext, selectedAlgo])

  const handleRunAttack = useCallback(async () => {
    setIsSimulating(true)
    setAttackProgress(0)
    setAttackResult(null)

    const target = selectedAttackTarget

    if (target.type === 'factoring' || target.type === 'discrete_log') {
      const result = ShorSimulator.getResourceEstimate(target.bits)

      for (let i = 0; i <= 100; i += 5) {
        await new Promise(r => setTimeout(r, 50))
        setAttackProgress(i)
      }

      setAttackResult(result)
    } else {
      const result = GroverSimulator.getResourceEstimate(target.bits)

      for (let i = 0; i <= 100; i += 5) {
        await new Promise(r => setTimeout(r, 50))
        setAttackProgress(i)
      }

      setAttackResult(result)
    }

    setIsSimulating(false)
  }, [selectedAttackTarget])

  const toggleChecklistItem = (id: string) => {
    setChecklist(prev => prev.map(item =>
      item.id === id
        ? { ...item, status: item.status === 'complete' ? 'pending' : 'complete' }
        : item
    ))
  }

  const handleRunBenchmarks = useCallback(async () => {
    const results: { algorithm: string; variant: string; operation: 'keygen' | 'encaps' | 'decaps' | 'sign' | 'verify'; timeMs: number; iterations: number }[] = []

    for (const algo of PQC_ALGORITHMS) {
      await new Promise(r => setTimeout(r, 100))

      if (algo.type === 'KEM') {
        const kem = new MLKEM(getKEMVariant(algo.variant))

        const keyGenStart = performance.now()
        const keyPair = kem.keyGen()
        const keyGenTime = performance.now() - keyGenStart

        const encapStart = performance.now()
        const { ciphertext: ct } = kem.encaps(keyPair.publicKey)
        const encapTime = performance.now() - encapStart

        const decapStart = performance.now()
        kem.decaps(ct, keyPair.secretKey)
        const decapTime = performance.now() - decapStart

        results.push({ algorithm: algo.type, variant: algo.name, operation: 'keygen', timeMs: keyGenTime, iterations: 1 })
        results.push({ algorithm: algo.type, variant: algo.name, operation: 'encaps', timeMs: encapTime, iterations: 1 })
        results.push({ algorithm: algo.type, variant: algo.name, operation: 'decaps', timeMs: decapTime, iterations: 1 })
      } else {
        const dsa = new MLDSA(getDSAVariant(algo.variant))

        const keyGenStart = performance.now()
        const keyPair = dsa.keyGen()
        const keyGenTime = performance.now() - keyGenStart

        const message = new TextEncoder().encode('Test message for benchmarking')

        const signStart = performance.now()
        const sigResult = dsa.sign(message, keyPair.secretKey)
        const signTime = performance.now() - signStart

        const verifyStart = performance.now()
        dsa.verify(message, sigResult.signature, keyPair.publicKey)
        const verifyTime = performance.now() - verifyStart

        results.push({ algorithm: algo.type, variant: algo.name, operation: 'keygen', timeMs: keyGenTime, iterations: 1 })
        results.push({ algorithm: algo.type, variant: algo.name, operation: 'sign', timeMs: signTime, iterations: 1 })
        results.push({ algorithm: algo.type, variant: algo.name, operation: 'verify', timeMs: verifyTime, iterations: 1 })
      }
    }

    setBenchmarkResults(results)
  }, [])

  const completedItems = checklist.filter(i => i.status === 'complete').length

  const currentKeyPair = selectedAlgo.type === 'KEM' ? kemKeyPair : dsaKeyPair

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold text-white">
              PQC Lab
            </h1>
            <p className="text-sm text-slate-400">
              Post-Quantum Cryptography with Real Algorithms
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" size="sm">FIPS Standards</Badge>
          <Button
            variant="secondary"
            leftIcon={<BookOpen className="w-4 h-4" />}
            size="sm"
            onClick={() => setShowGuide(true)}
          >
            <span className="hidden sm:inline">Guide</span>
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onChange={setSelectedTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="w-max md:w-auto">
            <TabsTrigger value="sandbox" className="text-xs md:text-sm">
              <Key className="w-4 h-4 mr-1" />
              Sandbox
            </TabsTrigger>
            <TabsTrigger value="attack" className="text-xs md:text-sm">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Attack Sim
            </TabsTrigger>
            <TabsTrigger value="migration" className="text-xs md:text-sm">
              <FileCheck className="w-4 h-4 mr-1" />
              Migration
            </TabsTrigger>
            <TabsTrigger value="benchmark" className="text-xs md:text-sm">
              <BarChart3 className="w-4 h-4 mr-1" />
              Benchmarks
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="sandbox" className="mt-4 md:mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            <div className="lg:col-span-4 order-2 lg:order-1">
              <Card variant="neumorph" className="p-4">
                <h3 className="font-semibold text-white mb-3 text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-400" />
                  Select Algorithm
                </h3>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {PQC_ALGORITHMS.map((algo) => (
                    <button
                      key={algo.id}
                      onClick={() => {
                        setSelectedAlgo(algo)
                        setKemKeyPair(null)
                        setDsaKeyPair(null)
                        setCiphertext(null)
                        setSharedSecret(null)
                        setSignature(null)
                        setVerificationResult(null)
                      }}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        selectedAlgo.id === algo.id
                          ? 'bg-green-500/20 border border-green-500'
                          : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] hover:bg-neumorph-base'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-white text-sm">{algo.name}</span>
                        <Badge variant="success" size="sm">{algo.standard}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className={`px-1.5 py-0.5 rounded ${
                          algo.type === 'KEM' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {algo.type}
                        </span>
                        <span>{algo.security}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            <div className="lg:col-span-8 space-y-4 order-1 lg:order-2">
              <Card variant="neumorph" className="p-4">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Key className="w-5 h-5 text-green-400" />
                      {selectedAlgo.name}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge variant={selectedAlgo.type === 'KEM' ? 'primary' : 'info'}>
                        {selectedAlgo.type}
                      </Badge>
                      <Badge variant="success">{selectedAlgo.securityBits}-bit</Badge>
                    </div>
                  </div>
                  <CardDescription className="text-xs">
                    {selectedAlgo.fullName} ({selectedAlgo.family} Family)
                  </CardDescription>
                </CardHeader>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Button onClick={handleGenerateKeys} isLoading={isGenerating} size="sm">
                    <Key className="w-4 h-4 mr-2" />
                    Generate Keys
                  </Button>
                  {selectedAlgo.type === 'KEM' ? (
                    <>
                      <Button
                        variant="secondary"
                        onClick={handleEncapsulate}
                        disabled={!kemKeyPair}
                        isLoading={isEncrypting}
                        size="sm"
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Encapsulate
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleDecapsulate}
                        disabled={!ciphertext}
                        size="sm"
                      >
                        <Unlock className="w-4 h-4 mr-2" />
                        Decapsulate
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        onClick={handleSign}
                        disabled={!dsaKeyPair}
                        isLoading={isSigning}
                        size="sm"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Sign
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleVerify}
                        disabled={!signature}
                        size="sm"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Verify
                      </Button>
                    </>
                  )}
                </div>

                {selectedAlgo.type === 'Signature' && (
                  <div className="mb-4">
                    <label className="text-xs text-slate-400 mb-1 block">Message to Sign</label>
                    <input
                      type="text"
                      value={plaintext}
                      onChange={(e) => setPlaintext(e.target.value)}
                      className="w-full px-3 py-2 bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg text-white text-sm"
                      placeholder="Enter message..."
                    />
                  </div>
                )}

                {currentKeyPair && (
                  <KeyViewer
                    keyPair={{
                      publicKey: currentKeyPair.publicKey,
                      secretKey: currentKeyPair.secretKey,
                      algorithm: selectedAlgo.type === 'KEM' ? 'ml-kem' : 'ml-dsa',
                      variant: selectedAlgo.name,
                      generatedAt: Date.now()
                    }}
                    isGenerating={isGenerating}
                    onGenerate={handleGenerateKeys}
                    onClear={() => {
                      setKemKeyPair(null)
                      setDsaKeyPair(null)
                      setCiphertext(null)
                      setSharedSecret(null)
                      setSignature(null)
                      setVerificationResult(null)
                    }}
                  />
                )}
              </Card>

              {currentKeyPair && (
                <Card variant="neumorph" className="p-4">
                  <h3 className="font-semibold text-white mb-3 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    Key Sizes (bytes)
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02]">
                      <div className="text-lg font-bold text-green-400">
                        {currentKeyPair.publicKey.length}
                      </div>
                      <div className="text-xs text-slate-400">Public Key</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02]">
                      <div className="text-lg font-bold text-red-400">
                        {currentKeyPair.secretKey.length}
                      </div>
                      <div className="text-xs text-slate-400">Secret Key</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02]">
                      <div className="text-lg font-bold text-blue-400">
                        {ciphertext?.length || signature?.length || '-'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {selectedAlgo.type === 'KEM' ? 'Ciphertext' : 'Signature'}
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="attack" className="mt-4 md:mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div>
              <Card variant="neumorph" className="p-4">
                <h3 className="font-semibold text-white mb-3 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Attack Targets
                </h3>
                <div className="space-y-2">
                  {ATTACK_TARGETS.map((target) => (
                    <button
                      key={target.id}
                      onClick={() => {
                        setSelectedAttackTarget(target)
                        setAttackResult(null)
                        setAttackProgress(0)
                      }}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        selectedAttackTarget.id === target.id
                          ? 'bg-red-500/20 border border-red-500'
                          : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] hover:bg-neumorph-base'
                      }`}
                    >
                      <div className="font-medium text-white text-sm">{target.name}</div>
                      <div className="text-xs text-slate-400">
                        {target.bits}-bit | {target.type === 'symmetric' ? "Grover's Search" : "Shor's Algorithm"}
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <Card variant="neumorph" className="p-4">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Zap className="w-5 h-5 text-red-400" />
                    {selectedAttackTarget.type === 'symmetric' ? "Grover's Search" : "Shor's Algorithm"} vs {selectedAttackTarget.name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {selectedAttackTarget.type === 'symmetric'
                      ? 'Quadratic speedup for brute-force key search'
                      : selectedAttackTarget.type === 'factoring'
                        ? 'Polynomial-time integer factorization'
                        : 'Discrete logarithm computation'}
                  </CardDescription>
                </CardHeader>

                <Button onClick={handleRunAttack} isLoading={isSimulating} className="w-full mb-4" size="sm">
                  <Play className="w-4 h-4 mr-2" />
                  Run Attack Simulation
                </Button>

                {(isSimulating || attackProgress > 0) && (
                  <div className="space-y-3">
                    <Progress value={attackProgress} showLabel label="Simulation Progress" />

                    {attackResult && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
                            <div className="text-lg font-bold text-blue-400">
                              {attackResult.qubitsRequired.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-400">Qubits Required</div>
                          </div>
                          <div className="p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
                            <div className="text-lg font-bold text-purple-400">
                              {attackResult.tGatesRequired.toExponential(1)}
                            </div>
                            <div className="text-xs text-slate-400">T-Gates</div>
                          </div>
                          <div className="p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
                            <div className="text-lg font-bold text-yellow-400">
                              {attackResult.circuitDepth.toExponential(1)}
                            </div>
                            <div className="text-xs text-slate-400">Circuit Depth</div>
                          </div>
                          <div className="p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
                            <div className="text-lg font-bold text-green-400">
                              {'estimatedTime' in attackResult ? attackResult.estimatedTime :
                               'speedup' in attackResult ? attackResult.speedup : 'N/A'}
                            </div>
                            <div className="text-xs text-slate-400">
                              {'estimatedTime' in attackResult ? 'Runtime' : 'Speedup'}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-5 h-5 text-yellow-400" />
                            <span className="font-medium text-white">
                              Classical cryptography vulnerable to quantum attacks
                            </span>
                          </div>
                          <p className="text-sm text-slate-400">
                            {'estimatedTime' in attackResult
                              ? `With a large enough quantum computer, this could be broken in ${attackResult.estimatedTime}. Consider migrating to post-quantum algorithms.`
                              : `Grover's algorithm provides a quadratic speedup, reducing effective security by half.`}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </Card>

              <Card variant="neumorph" className="p-4">
                <h3 className="font-semibold text-white mb-3 text-sm flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-400" />
                  Current Quantum Computer Capabilities (2024)
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
                    <div className="text-lg font-bold text-white">1,121</div>
                    <div className="text-xs text-slate-400">IBM Condor (qubits)</div>
                  </div>
                  <div className="p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
                    <div className="text-lg font-bold text-white">~1000</div>
                    <div className="text-xs text-slate-400">Physical Qubit Error Rate (1e-3)</div>
                  </div>
                  <div className="p-3 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] text-center">
                    <div className="text-lg font-bold text-white">0</div>
                    <div className="text-xs text-slate-400">Logical Qubits Available</div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  Cryptographically relevant quantum computers require millions of error-corrected qubits.
                </p>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="migration" className="mt-4 md:mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-2">
              <Card variant="neumorph" className="p-4">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-green-400" />
                      Migration Checklist
                    </CardTitle>
                    <Badge variant={completedItems === checklist.length ? 'success' : 'warning'}>
                      {completedItems}/{checklist.length} Complete
                    </Badge>
                  </div>
                </CardHeader>

                <Progress
                  value={(completedItems / checklist.length) * 100}
                  className="mb-4"
                  variant={completedItems === checklist.length ? 'success' : 'default'}
                />

                <div className="space-y-2">
                  {checklist.map((item, index) => (
                    <button
                      key={item.id}
                      onClick={() => toggleChecklistItem(item.id)}
                      className={`w-full p-3 rounded-lg text-left transition-all flex items-center gap-3 ${
                        item.status === 'complete'
                          ? 'bg-green-500/10 border border-green-500/30'
                          : 'bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] hover:bg-neumorph-base'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        item.status === 'complete' ? 'bg-green-500' : 'bg-slate-700'
                      }`}>
                        {item.status === 'complete' ? (
                          <CheckCircle className="w-4 h-4 text-white" />
                        ) : (
                          <span className="text-xs text-slate-400">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className={`font-medium text-sm ${item.status === 'complete' ? 'text-green-400' : 'text-white'}`}>
                          {item.name}
                        </div>
                        <div className="text-xs text-slate-400">{item.description}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500" />
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <Card variant="neumorph" className="p-4">
                <h3 className="font-semibold text-white mb-3 text-sm">Migration Score</h3>
                <div className="text-center py-4">
                  <div className="text-5xl font-bold text-green-400 mb-2">
                    {Math.round((completedItems / checklist.length) * 100)}%
                  </div>
                  <div className="text-sm text-slate-400">
                    {completedItems === checklist.length ? 'Quantum Ready!' : 'In Progress'}
                  </div>
                </div>
              </Card>

              <Card variant="neumorph" className="p-4">
                <h3 className="font-semibold text-white mb-3 text-sm">Resources</h3>
                <div className="space-y-2">
                  <a href="https://csrc.nist.gov/projects/post-quantum-cryptography" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded hover:bg-neumorph-base transition-colors">
                    <ExternalLink className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-slate-300">NIST PQC Standards</span>
                  </a>
                  <a href="https://openquantumsafe.org/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded hover:bg-neumorph-base transition-colors">
                    <ExternalLink className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-slate-300">Open Quantum Safe</span>
                  </a>
                  <a href="https://pq-crystals.org/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded hover:bg-neumorph-base transition-colors">
                    <ExternalLink className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-slate-300">CRYSTALS Project</span>
                  </a>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="benchmark" className="mt-4 md:mt-6">
          <Card variant="neumorph" className="p-4">
            <CardHeader className="p-0 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  Performance Benchmarks
                </CardTitle>
                <Button onClick={handleRunBenchmarks} size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Run Benchmarks
                </Button>
              </div>
              <CardDescription className="text-xs">
                Real performance measurements on your browser
              </CardDescription>
            </CardHeader>

            {benchmarkResults.length > 0 ? (
              <BenchmarkChart benchmarks={benchmarkResults} onRunBenchmark={handleRunBenchmarks} />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <BarChart3 className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">Click "Run Benchmarks" to measure algorithm performance</p>
              </div>
            )}

            <div className="mt-6 p-4 rounded-lg bg-neumorph-base shadow-neumorph-xs border border-white/[0.02]">
              <h4 className="font-medium text-white mb-2 text-sm">Comparison with Classical Crypto</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-green-400">~10x</div>
                  <div className="text-xs text-slate-400">Larger Keys</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-yellow-400">~2x</div>
                  <div className="text-xs text-slate-400">Slower Signing</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-400">~1.5x</div>
                  <div className="text-xs text-slate-400">Slower Encryption</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-purple-400">Quantum</div>
                  <div className="text-xs text-slate-400">Secure</div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Modal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        title="PQC Lab Guide"
        description="Learn about post-quantum cryptography and quantum-safe algorithms"
        size="full"
        variant="neumorph"
      >
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-400" />
              Quick Start
            </h3>
            <div className="space-y-2">
              {PQC_QUICK_START.map(({ step, text }) => (
                <div key={step} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-bold text-green-400">
                    {step}
                  </div>
                  <span className="text-sm text-slate-300">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PQC_GUIDE_SECTIONS.map((section) => (
              <div
                key={section.title}
                className="bg-neumorph-darker rounded-xl p-4 border border-white/5"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${section.color} flex items-center justify-center flex-shrink-0`}>
                    <section.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-semibold">{section.title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{section.description}</p>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {section.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                      <ChevronRight className="w-3 h-3 text-slate-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="bg-neumorph-darker rounded-xl p-4 border border-white/5">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              Why Post-Quantum Cryptography?
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              <span className="text-green-400 font-medium">Post-Quantum Cryptography (PQC)</span> refers to cryptographic algorithms that are secure against attacks by quantum computers. Shor's algorithm can break RSA and ECC, which protect most of today's internet. NIST has standardized ML-KEM (FIPS 203) and ML-DSA (FIPS 204) as quantum-resistant replacements.
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-blue-400" />
                <span className="text-slate-400">Start migrating now: "Harvest now, decrypt later" attacks</span>
              </div>
            </div>
          </div>

          <div className="bg-neumorph-darker rounded-xl p-4 border border-white/5">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-400" />
              NIST Standards
            </h3>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="p-3 rounded-lg bg-neumorph-base border border-white/5">
                <div className="text-green-400 font-semibold text-sm">FIPS 203</div>
                <div className="text-xs text-slate-400">ML-KEM (Kyber) - Key Encapsulation</div>
              </div>
              <div className="p-3 rounded-lg bg-neumorph-base border border-white/5">
                <div className="text-blue-400 font-semibold text-sm">FIPS 204</div>
                <div className="text-xs text-slate-400">ML-DSA (Dilithium) - Digital Signatures</div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
