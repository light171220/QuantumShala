import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { MLKEM } from '@/lib/pqc/kem/ml-kem'
import { MLDSA } from '@/lib/pqc/dsa/ml-dsa'
import { SLHDSA } from '@/lib/pqc/dsa/slh-dsa'

export type PQCAlgorithm = 'ml-kem' | 'ml-dsa' | 'slh-dsa'
export type KEMVariant = 'ml-kem-512' | 'ml-kem-768' | 'ml-kem-1024'
export type DSAVariant = 'ml-dsa-44' | 'ml-dsa-65' | 'ml-dsa-87'
export type SLHVariant = 'SLH-DSA-128f' | 'SLH-DSA-128s' | 'SLH-DSA-192f' | 'SLH-DSA-192s' | 'SLH-DSA-256f' | 'SLH-DSA-256s'

export interface KeyPair {
  publicKey: Uint8Array
  secretKey: Uint8Array
  algorithm: string
  variant: string
  generatedAt: number
}

// Benchmark result
export interface BenchmarkResult {
  algorithm: string
  variant: string
  operation: 'keygen' | 'encaps' | 'decaps' | 'sign' | 'verify'
  timeMs: number
  iterations: number
  bytesProcessed?: number
}

export interface AttackSimulation {
  type: 'shor' | 'grover'
  targetBits: number
  currentStep: number
  totalSteps: number
  isRunning: boolean
  qubitsRequired: number
  tGatesRequired: number
  estimatedTime: string
  progress: number
}

export interface MigrationItem {
  id: string
  category: 'cryptography' | 'infrastructure' | 'processes' | 'compliance'
  name: string
  status: 'not-started' | 'in-progress' | 'completed' | 'not-applicable'
  risk: 'low' | 'medium' | 'high' | 'critical'
  notes: string
}

export interface MigrationAssessment {
  score: number
  items: MigrationItem[]
  recommendations: string[]
}

export interface CryptoDemo {
  mode: 'kem' | 'dsa'
  message: string
  encryptedMessage?: Uint8Array
  sharedSecret?: Uint8Array
  signature?: Uint8Array
  ciphertext?: Uint8Array
  isValid?: boolean
}

interface PQCState {
  selectedAlgorithm: PQCAlgorithm
  selectedVariant: KEMVariant | DSAVariant | SLHVariant
  keyPair: KeyPair | null
  isGeneratingKeys: boolean
  demo: CryptoDemo
  benchmarks: BenchmarkResult[]
  isBenchmarking: boolean
  attackSimulation: AttackSimulation | null
  migration: MigrationAssessment
  activeTab: 'demo' | 'attack' | 'benchmark' | 'migration' | 'learn'
  showKeyDetails: boolean
  error: string | null
}

interface PQCActions {
  setAlgorithm: (algorithm: PQCAlgorithm) => void
  setVariant: (variant: KEMVariant | DSAVariant | SLHVariant) => void
  generateKeyPair: () => Promise<void>
  clearKeyPair: () => void
  setDemoMode: (mode: 'kem' | 'dsa') => void
  setMessage: (message: string) => void
  encapsulate: () => Promise<void>
  decapsulate: () => Promise<void>
  signMessage: () => Promise<void>
  verifySignature: () => Promise<void>
  clearDemo: () => void
  runBenchmark: (iterations?: number) => Promise<void>
  clearBenchmarks: () => void
  startAttackSimulation: (type: 'shor' | 'grover', targetBits: number) => void
  stepAttackSimulation: () => void
  stopAttackSimulation: () => void
  updateMigrationItem: (id: string, updates: Partial<MigrationItem>) => void
  calculateMigrationScore: () => void
  resetMigration: () => void
  setActiveTab: (tab: PQCState['activeTab']) => void
  toggleKeyDetails: () => void
  setError: (error: string | null) => void
  reset: () => void
}

const defaultMigrationItems: MigrationItem[] = [
  { id: 'crypto-1', category: 'cryptography', name: 'Inventory of cryptographic algorithms in use', status: 'not-started', risk: 'high', notes: '' },
  { id: 'crypto-2', category: 'cryptography', name: 'RSA key exchange replacement plan', status: 'not-started', risk: 'critical', notes: '' },
  { id: 'crypto-3', category: 'cryptography', name: 'ECDH/ECDSA replacement plan', status: 'not-started', risk: 'critical', notes: '' },
  { id: 'crypto-4', category: 'cryptography', name: 'TLS 1.3 with PQ hybrid mode support', status: 'not-started', risk: 'high', notes: '' },
  { id: 'crypto-5', category: 'cryptography', name: 'Certificate authority PQ readiness', status: 'not-started', risk: 'medium', notes: '' },
  { id: 'infra-1', category: 'infrastructure', name: 'HSM PQ algorithm support', status: 'not-started', risk: 'high', notes: '' },
  { id: 'infra-2', category: 'infrastructure', name: 'Key management system updates', status: 'not-started', risk: 'high', notes: '' },
  { id: 'infra-3', category: 'infrastructure', name: 'Network capacity for larger keys/signatures', status: 'not-started', risk: 'medium', notes: '' },
  { id: 'infra-4', category: 'infrastructure', name: 'Database storage for larger keys', status: 'not-started', risk: 'low', notes: '' },
  { id: 'proc-1', category: 'processes', name: 'Cryptographic agility in codebase', status: 'not-started', risk: 'high', notes: '' },
  { id: 'proc-2', category: 'processes', name: 'Key rotation procedures updated', status: 'not-started', risk: 'medium', notes: '' },
  { id: 'proc-3', category: 'processes', name: 'Incident response for crypto failures', status: 'not-started', risk: 'medium', notes: '' },
  { id: 'proc-4', category: 'processes', name: 'Developer training on PQC', status: 'not-started', risk: 'low', notes: '' },
  { id: 'comp-1', category: 'compliance', name: 'NIST FIPS 203/204/205 compliance plan', status: 'not-started', risk: 'high', notes: '' },
  { id: 'comp-2', category: 'compliance', name: 'Vendor PQ roadmap assessment', status: 'not-started', risk: 'medium', notes: '' },
  { id: 'comp-3', category: 'compliance', name: 'Regulatory timeline awareness', status: 'not-started', risk: 'medium', notes: '' }
]

const initialState: PQCState = {
  selectedAlgorithm: 'ml-kem',
  selectedVariant: 'ml-kem-768',
  keyPair: null,
  isGeneratingKeys: false,
  demo: {
    mode: 'kem',
    message: 'Hello, Quantum-Safe World!'
  },
  benchmarks: [],
  isBenchmarking: false,
  attackSimulation: null,
  migration: {
    score: 0,
    items: defaultMigrationItems,
    recommendations: []
  },
  activeTab: 'demo',
  showKeyDetails: false,
  error: null
}

export const usePQCStore = create<PQCState & PQCActions>()(
  immer((set, get) => ({
    ...initialState,

    setAlgorithm: (algorithm) =>
      set((state) => {
        state.selectedAlgorithm = algorithm
        state.keyPair = null
        switch (algorithm) {
          case 'ml-kem':
            state.selectedVariant = 'ml-kem-768'
            state.demo.mode = 'kem'
            break
          case 'ml-dsa':
            state.selectedVariant = 'ml-dsa-65'
            state.demo.mode = 'dsa'
            break
          case 'slh-dsa':
            state.selectedVariant = 'SLH-DSA-128f'
            state.demo.mode = 'dsa'
            break
        }
      }),

    setVariant: (variant) =>
      set((state) => {
        state.selectedVariant = variant
        state.keyPair = null
      }),

    generateKeyPair: async () => {
      const { selectedAlgorithm, selectedVariant } = get()
      set((state) => {
        state.isGeneratingKeys = true
        state.error = null
      })

      try {
        let publicKey: Uint8Array
        let secretKey: Uint8Array

        if (selectedAlgorithm === 'ml-kem') {
          const variantMap: Record<string, 'ML-KEM-512' | 'ML-KEM-768' | 'ML-KEM-1024'> = {
            'ml-kem-512': 'ML-KEM-512',
            'ml-kem-768': 'ML-KEM-768',
            'ml-kem-1024': 'ML-KEM-1024'
          }
          const kem = new MLKEM(variantMap[selectedVariant] || 'ML-KEM-768')
          const keys = kem.keyGen()
          publicKey = keys.publicKey
          secretKey = keys.secretKey
        } else if (selectedAlgorithm === 'ml-dsa') {
          const variantMap: Record<string, 'ML-DSA-44' | 'ML-DSA-65' | 'ML-DSA-87'> = {
            'ml-dsa-44': 'ML-DSA-44',
            'ml-dsa-65': 'ML-DSA-65',
            'ml-dsa-87': 'ML-DSA-87'
          }
          const dsa = new MLDSA(variantMap[selectedVariant] || 'ML-DSA-65')
          const keys = dsa.keyGen()
          publicKey = keys.publicKey
          secretKey = keys.secretKey
        } else if (selectedAlgorithm === 'slh-dsa') {
          const slhVariant = selectedVariant as SLHVariant
          const slh = new SLHDSA(slhVariant || 'SLH-DSA-128f')
          const keys = slh.keyGen()
          publicKey = keys.publicKey
          secretKey = keys.secretKey
        } else {
          throw new Error('Unknown algorithm')
        }

        const keyPair: KeyPair = {
          publicKey,
          secretKey,
          algorithm: selectedAlgorithm,
          variant: selectedVariant,
          generatedAt: Date.now()
        }

        set((state) => {
          state.keyPair = keyPair
          state.isGeneratingKeys = false
        })
      } catch (error) {
        set((state) => {
          state.isGeneratingKeys = false
          state.error = error instanceof Error ? error.message : 'Key generation failed'
        })
      }
    },

    clearKeyPair: () =>
      set((state) => {
        state.keyPair = null
      }),

    setDemoMode: (mode) =>
      set((state) => {
        state.demo.mode = mode
        state.demo.encryptedMessage = undefined
        state.demo.sharedSecret = undefined
        state.demo.signature = undefined
        state.demo.ciphertext = undefined
        state.demo.isValid = undefined
      }),

    setMessage: (message) =>
      set((state) => {
        state.demo.message = message
      }),

    encapsulate: async () => {
      const { keyPair, selectedVariant } = get()
      if (!keyPair) return

      try {
        const variantMap: Record<string, 'ML-KEM-512' | 'ML-KEM-768' | 'ML-KEM-1024'> = {
          'ml-kem-512': 'ML-KEM-512',
          'ml-kem-768': 'ML-KEM-768',
          'ml-kem-1024': 'ML-KEM-1024'
        }
        const kem = new MLKEM(variantMap[selectedVariant] || 'ML-KEM-768')
        const { ciphertext, sharedSecret } = kem.encaps(keyPair.publicKey)

        set((state) => {
          state.demo.sharedSecret = sharedSecret
          state.demo.ciphertext = ciphertext
        })
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Encapsulation failed'
        })
      }
    },

    decapsulate: async () => {
      const { keyPair, demo, selectedVariant } = get()
      if (!keyPair || !demo.ciphertext) return

      try {
        const variantMap: Record<string, 'ML-KEM-512' | 'ML-KEM-768' | 'ML-KEM-1024'> = {
          'ml-kem-512': 'ML-KEM-512',
          'ml-kem-768': 'ML-KEM-768',
          'ml-kem-1024': 'ML-KEM-1024'
        }
        const kem = new MLKEM(variantMap[selectedVariant] || 'ML-KEM-768')
        const decapsulatedSecret = kem.decaps(demo.ciphertext, keyPair.secretKey)

        // Compare the shared secrets
        const encapsSecret = demo.sharedSecret
        let isValid = true
        if (encapsSecret && decapsulatedSecret.length === encapsSecret.length) {
          for (let i = 0; i < decapsulatedSecret.length; i++) {
            if (decapsulatedSecret[i] !== encapsSecret[i]) {
              isValid = false
              break
            }
          }
        }

        set((state) => {
          state.demo.isValid = isValid
        })
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Decapsulation failed'
        })
      }
    },

    signMessage: async () => {
      const { keyPair, demo, selectedAlgorithm, selectedVariant } = get()
      if (!keyPair) return

      try {
        const messageBytes = new TextEncoder().encode(demo.message)
        let signature: Uint8Array

        if (selectedAlgorithm === 'ml-dsa') {
          const variantMap: Record<string, 'ML-DSA-44' | 'ML-DSA-65' | 'ML-DSA-87'> = {
            'ml-dsa-44': 'ML-DSA-44',
            'ml-dsa-65': 'ML-DSA-65',
            'ml-dsa-87': 'ML-DSA-87'
          }
          const dsa = new MLDSA(variantMap[selectedVariant] || 'ML-DSA-65')
          const result = dsa.sign(messageBytes, keyPair.secretKey)
          signature = result.signature
        } else if (selectedAlgorithm === 'slh-dsa') {
          const slhVariant = selectedVariant as SLHVariant
          const slh = new SLHDSA(slhVariant || 'SLH-DSA-128f')
          const result = slh.sign(messageBytes, keyPair.secretKey)
          signature = result.signature
        } else {
          throw new Error('Algorithm does not support signing')
        }

        set((state) => {
          state.demo.signature = signature
        })
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Signing failed'
        })
      }
    },

    verifySignature: async () => {
      const { keyPair, demo, selectedAlgorithm, selectedVariant } = get()
      if (!keyPair || !demo.signature) return

      try {
        const messageBytes = new TextEncoder().encode(demo.message)
        let isValid: boolean

        if (selectedAlgorithm === 'ml-dsa') {
          const variantMap: Record<string, 'ML-DSA-44' | 'ML-DSA-65' | 'ML-DSA-87'> = {
            'ml-dsa-44': 'ML-DSA-44',
            'ml-dsa-65': 'ML-DSA-65',
            'ml-dsa-87': 'ML-DSA-87'
          }
          const dsa = new MLDSA(variantMap[selectedVariant] || 'ML-DSA-65')
          isValid = dsa.verify(messageBytes, demo.signature, keyPair.publicKey)
        } else if (selectedAlgorithm === 'slh-dsa') {
          const slhVariant = selectedVariant as SLHVariant
          const slh = new SLHDSA(slhVariant || 'SLH-DSA-128f')
          isValid = slh.verify(messageBytes, demo.signature, keyPair.publicKey)
        } else {
          throw new Error('Algorithm does not support verification')
        }

        set((state) => {
          state.demo.isValid = isValid
        })
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Verification failed'
        })
      }
    },

    clearDemo: () =>
      set((state) => {
        state.demo = {
          mode: state.demo.mode,
          message: ''
        }
      }),

    runBenchmark: async (iterations = 10) => {
      const { selectedAlgorithm, selectedVariant } = get()
      set((state) => {
        state.isBenchmarking = true
        state.error = null
      })

      try {
        const results: BenchmarkResult[] = []

        if (selectedAlgorithm === 'ml-kem') {
          const variantMap: Record<string, 'ML-KEM-512' | 'ML-KEM-768' | 'ML-KEM-1024'> = {
            'ml-kem-512': 'ML-KEM-512',
            'ml-kem-768': 'ML-KEM-768',
            'ml-kem-1024': 'ML-KEM-1024'
          }
          const kem = new MLKEM(variantMap[selectedVariant] || 'ML-KEM-768')

          // Benchmark KeyGen
          const keygenStart = performance.now()
          let keyPair = kem.keyGen()
          for (let i = 1; i < iterations; i++) {
            keyPair = kem.keyGen()
          }
          const keygenTime = (performance.now() - keygenStart) / iterations

          results.push({
            algorithm: selectedAlgorithm,
            variant: selectedVariant,
            operation: 'keygen',
            timeMs: keygenTime,
            iterations,
            bytesProcessed: keyPair.publicKey.length + keyPair.secretKey.length
          })

          // Benchmark Encaps
          const encapsStart = performance.now()
          let encResult = kem.encaps(keyPair.publicKey)
          for (let i = 1; i < iterations; i++) {
            encResult = kem.encaps(keyPair.publicKey)
          }
          const encapsTime = (performance.now() - encapsStart) / iterations

          results.push({
            algorithm: selectedAlgorithm,
            variant: selectedVariant,
            operation: 'encaps',
            timeMs: encapsTime,
            iterations,
            bytesProcessed: encResult.ciphertext.length + encResult.sharedSecret.length
          })

          // Benchmark Decaps
          const decapsStart = performance.now()
          for (let i = 0; i < iterations; i++) {
            kem.decaps(encResult.ciphertext, keyPair.secretKey)
          }
          const decapsTime = (performance.now() - decapsStart) / iterations

          results.push({
            algorithm: selectedAlgorithm,
            variant: selectedVariant,
            operation: 'decaps',
            timeMs: decapsTime,
            iterations,
            bytesProcessed: encResult.ciphertext.length
          })
        } else if (selectedAlgorithm === 'ml-dsa') {
          const variantMap: Record<string, 'ML-DSA-44' | 'ML-DSA-65' | 'ML-DSA-87'> = {
            'ml-dsa-44': 'ML-DSA-44',
            'ml-dsa-65': 'ML-DSA-65',
            'ml-dsa-87': 'ML-DSA-87'
          }
          const dsa = new MLDSA(variantMap[selectedVariant] || 'ML-DSA-65')
          const testMessage = new TextEncoder().encode('Benchmark test message for PQC')

          // Benchmark KeyGen
          const keygenStart = performance.now()
          let keyPair = dsa.keyGen()
          for (let i = 1; i < iterations; i++) {
            keyPair = dsa.keyGen()
          }
          const keygenTime = (performance.now() - keygenStart) / iterations

          results.push({
            algorithm: selectedAlgorithm,
            variant: selectedVariant,
            operation: 'keygen',
            timeMs: keygenTime,
            iterations,
            bytesProcessed: keyPair.publicKey.length + keyPair.secretKey.length
          })

          // Benchmark Sign
          const signStart = performance.now()
          let sigResult = dsa.sign(testMessage, keyPair.secretKey)
          for (let i = 1; i < iterations; i++) {
            sigResult = dsa.sign(testMessage, keyPair.secretKey)
          }
          const signTime = (performance.now() - signStart) / iterations

          results.push({
            algorithm: selectedAlgorithm,
            variant: selectedVariant,
            operation: 'sign',
            timeMs: signTime,
            iterations,
            bytesProcessed: sigResult.signature.length
          })

          // Benchmark Verify
          const verifyStart = performance.now()
          for (let i = 0; i < iterations; i++) {
            dsa.verify(testMessage, sigResult.signature, keyPair.publicKey)
          }
          const verifyTime = (performance.now() - verifyStart) / iterations

          results.push({
            algorithm: selectedAlgorithm,
            variant: selectedVariant,
            operation: 'verify',
            timeMs: verifyTime,
            iterations,
            bytesProcessed: sigResult.signature.length + testMessage.length
          })
        } else if (selectedAlgorithm === 'slh-dsa') {
          const slhVariant = selectedVariant as SLHVariant
          const slh = new SLHDSA(slhVariant || 'SLH-DSA-128f')
          const testMessage = new TextEncoder().encode('Benchmark test message for PQC')

          const keygenStart = performance.now()
          let keyPair = slh.keyGen()
          for (let i = 1; i < iterations; i++) {
            keyPair = slh.keyGen()
          }
          const keygenTime = (performance.now() - keygenStart) / iterations

          results.push({
            algorithm: selectedAlgorithm,
            variant: selectedVariant,
            operation: 'keygen',
            timeMs: keygenTime,
            iterations,
            bytesProcessed: keyPair.publicKey.length + keyPair.secretKey.length
          })

          const signStart = performance.now()
          let sigResult = slh.sign(testMessage, keyPair.secretKey)
          for (let i = 1; i < iterations; i++) {
            sigResult = slh.sign(testMessage, keyPair.secretKey)
          }
          const signTime = (performance.now() - signStart) / iterations

          results.push({
            algorithm: selectedAlgorithm,
            variant: selectedVariant,
            operation: 'sign',
            timeMs: signTime,
            iterations,
            bytesProcessed: sigResult.signature.length
          })

          const verifyStart = performance.now()
          for (let i = 0; i < iterations; i++) {
            slh.verify(testMessage, sigResult.signature, keyPair.publicKey)
          }
          const verifyTime = (performance.now() - verifyStart) / iterations

          results.push({
            algorithm: selectedAlgorithm,
            variant: selectedVariant,
            operation: 'verify',
            timeMs: verifyTime,
            iterations,
            bytesProcessed: sigResult.signature.length + testMessage.length
          })
        } else {
          throw new Error('Unknown algorithm for benchmarking')
        }

        set((state) => {
          state.benchmarks.push(...results)
          state.isBenchmarking = false
        })
      } catch (error) {
        set((state) => {
          state.isBenchmarking = false
          state.error = error instanceof Error ? error.message : 'Benchmark failed'
        })
      }
    },

    clearBenchmarks: () =>
      set((state) => {
        state.benchmarks = []
      }),

    startAttackSimulation: (type, targetBits) =>
      set((state) => {
        let qubitsRequired: number
        let tGatesRequired: number
        let estimatedTime: string

        if (type === 'shor') {
          qubitsRequired = 2 * targetBits + 3
          tGatesRequired = Math.pow(targetBits, 3) * 72
          const years = Math.pow(10, targetBits / 100) // Very rough estimate
          estimatedTime = years > 1000 ? `${(years / 1000).toFixed(0)}k+ years` : `${years.toFixed(0)} years`
        } else {
          qubitsRequired = targetBits + 100
          tGatesRequired = Math.pow(2, targetBits / 2) * 1000
          const iterations = Math.pow(2, targetBits / 2)
          estimatedTime = iterations > 1e15 ? 'Centuries' : `${(iterations / 1e9).toFixed(0)}B iterations`
        }

        state.attackSimulation = {
          type,
          targetBits,
          currentStep: 0,
          totalSteps: 20,
          isRunning: true,
          qubitsRequired,
          tGatesRequired,
          estimatedTime,
          progress: 0
        }
      }),

    stepAttackSimulation: () =>
      set((state) => {
        if (!state.attackSimulation) return
        if (state.attackSimulation.currentStep >= state.attackSimulation.totalSteps) {
          state.attackSimulation.isRunning = false
          return
        }
        state.attackSimulation.currentStep++
        state.attackSimulation.progress =
          (state.attackSimulation.currentStep / state.attackSimulation.totalSteps) * 100
      }),

    stopAttackSimulation: () =>
      set((state) => {
        if (state.attackSimulation) {
          state.attackSimulation.isRunning = false
        }
      }),

    updateMigrationItem: (id, updates) =>
      set((state) => {
        const item = state.migration.items.find(i => i.id === id)
        if (item) {
          Object.assign(item, updates)
        }
      }),

    calculateMigrationScore: () =>
      set((state) => {
        const items = state.migration.items.filter(i => i.status !== 'not-applicable')
        const completed = items.filter(i => i.status === 'completed').length
        const inProgress = items.filter(i => i.status === 'in-progress').length

        state.migration.score = Math.round(
          ((completed * 1 + inProgress * 0.5) / items.length) * 100
        )

        const recommendations: string[] = []
        const criticalNotStarted = items.filter(
          i => i.risk === 'critical' && i.status === 'not-started'
        )
        if (criticalNotStarted.length > 0) {
          recommendations.push(
            `Priority: Address ${criticalNotStarted.length} critical items immediately`
          )
        }

        const highRisk = items.filter(
          i => i.risk === 'high' && i.status === 'not-started'
        )
        if (highRisk.length > 0) {
          recommendations.push(
            `Plan to address ${highRisk.length} high-risk items within 6 months`
          )
        }

        if (state.migration.score < 25) {
          recommendations.push('Start with a cryptographic inventory of your systems')
        } else if (state.migration.score < 50) {
          recommendations.push('Focus on infrastructure updates for PQ support')
        } else if (state.migration.score < 75) {
          recommendations.push('Begin pilot implementations with hybrid algorithms')
        } else {
          recommendations.push('Prepare for full migration to PQ-only algorithms')
        }

        state.migration.recommendations = recommendations
      }),

    resetMigration: () =>
      set((state) => {
        state.migration = {
          score: 0,
          items: defaultMigrationItems.map(item => ({ ...item, status: 'not-started', notes: '' })),
          recommendations: []
        }
      }),

    setActiveTab: (tab) =>
      set((state) => {
        state.activeTab = tab
      }),

    toggleKeyDetails: () =>
      set((state) => {
        state.showKeyDetails = !state.showKeyDetails
      }),

    setError: (error) =>
      set((state) => {
        state.error = error
      }),

    reset: () => set(() => initialState)
  }))
)

export const PQC_ALGORITHM_INFO = {
  'ml-kem': {
    name: 'ML-KEM (Kyber)',
    description: 'Module Lattice-based Key Encapsulation Mechanism',
    standard: 'FIPS 203',
    type: 'KEM',
    variants: {
      'ml-kem-512': { securityLevel: 1, publicKeySize: 800, secretKeySize: 1632, ciphertextSize: 768 },
      'ml-kem-768': { securityLevel: 3, publicKeySize: 1184, secretKeySize: 2400, ciphertextSize: 1088 },
      'ml-kem-1024': { securityLevel: 5, publicKeySize: 1568, secretKeySize: 3168, ciphertextSize: 1568 }
    }
  },
  'ml-dsa': {
    name: 'ML-DSA (Dilithium)',
    description: 'Module Lattice-based Digital Signature Algorithm',
    standard: 'FIPS 204',
    type: 'DSA',
    variants: {
      'ml-dsa-44': { securityLevel: 2, publicKeySize: 1312, secretKeySize: 2560, signatureSize: 2420 },
      'ml-dsa-65': { securityLevel: 3, publicKeySize: 1952, secretKeySize: 4032, signatureSize: 3309 },
      'ml-dsa-87': { securityLevel: 5, publicKeySize: 2592, secretKeySize: 4896, signatureSize: 4627 }
    }
  },
  'slh-dsa': {
    name: 'SLH-DSA (SPHINCS+)',
    description: 'Stateless Hash-based Digital Signature Algorithm',
    standard: 'FIPS 205',
    type: 'DSA',
    variants: {
      'slh-dsa-128f': { securityLevel: 1, publicKeySize: 32, secretKeySize: 64, signatureSize: 17088 },
      'slh-dsa-128s': { securityLevel: 1, publicKeySize: 32, secretKeySize: 64, signatureSize: 7856 },
      'slh-dsa-192f': { securityLevel: 3, publicKeySize: 48, secretKeySize: 96, signatureSize: 35664 },
      'slh-dsa-192s': { securityLevel: 3, publicKeySize: 48, secretKeySize: 96, signatureSize: 16224 }
    }
  }
}
