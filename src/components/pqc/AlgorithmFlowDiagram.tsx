import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, ChevronRight, Info } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface FlowStep {
  id: string
  title: string
  description: string
  details: string[]
  color: string
}

const ML_KEM_KEYGEN_STEPS: FlowStep[] = [
  { id: 'seed', title: 'Generate Seed', description: 'Create 32-byte random seed d', details: ['d = randomBytes(32)', 'Cryptographically secure random'], color: 'from-blue-500 to-cyan-500' },
  { id: 'expand', title: 'Expand Seed', description: 'Hash seed to get rho and sigma', details: ['(rho, sigma) = SHA3-512(d)', 'rho for matrix A, sigma for secrets'], color: 'from-cyan-500 to-teal-500' },
  { id: 'matrix', title: 'Generate Matrix A', description: 'Expand rho into k×k polynomial matrix', details: ['A[i][j] = SampleUniform(rho, i, j)', 'Each polynomial has 256 coefficients'], color: 'from-teal-500 to-green-500' },
  { id: 'secrets', title: 'Sample Secrets', description: 'Generate secret vectors s and e', details: ['s = CBD(sigma, eta1)', 'e = CBD(sigma, eta1)', 'Small coefficients from centered binomial'], color: 'from-green-500 to-emerald-500' },
  { id: 'ntt', title: 'NTT Transform', description: 'Transform s to NTT domain', details: ['s_ntt = NTT(s)', 'Enables fast polynomial multiplication'], color: 'from-emerald-500 to-lime-500' },
  { id: 'compute', title: 'Compute t = As + e', description: 'Matrix-vector multiplication plus error', details: ['t = A * s_ntt (in NTT)', 't = INTT(t) + e', 'Public key encodes t'], color: 'from-lime-500 to-yellow-500' },
  { id: 'encode', title: 'Encode Keys', description: 'Serialize public and secret keys', details: ['pk = encode(t) || rho', 'sk = encode(s) || pk || H(pk) || z'], color: 'from-yellow-500 to-orange-500' }
]

const ML_KEM_ENCAPS_STEPS: FlowStep[] = [
  { id: 'parse', title: 'Parse Public Key', description: 'Extract t and rho from pk', details: ['t = decode(pk[0:k*384])', 'rho = pk[k*384:]'], color: 'from-purple-500 to-violet-500' },
  { id: 'message', title: 'Generate Message', description: 'Create random 32-byte message m', details: ['m = randomBytes(32)', 'Will become shared secret'], color: 'from-violet-500 to-indigo-500' },
  { id: 'derive', title: 'Derive Coins', description: 'Hash m with pk for randomness', details: ['(K, r) = G(m || H(pk))', 'Deterministic encryption'], color: 'from-indigo-500 to-blue-500' },
  { id: 'sample', title: 'Sample Vectors', description: 'Generate r, e1, e2 from coins', details: ['r = CBD(coins)', 'e1, e2 = CBD(coins)', 'Encryption randomness'], color: 'from-blue-500 to-cyan-500' },
  { id: 'encrypt', title: 'Encrypt Message', description: 'Compute u = A^T*r + e1, v = t^T*r + e2 + m', details: ['u = A^T * r + e1', 'v = t^T * r + e2 + encode(m)', 'LWE encryption'], color: 'from-cyan-500 to-teal-500' },
  { id: 'compress', title: 'Compress Ciphertext', description: 'Reduce ciphertext size', details: ['c = compress(u, du) || compress(v, dv)', 'Lossy compression'], color: 'from-teal-500 to-green-500' },
  { id: 'output', title: 'Output', description: 'Return ciphertext and shared secret', details: ['ct = c', 'ss = KDF(K || H(ct))'], color: 'from-green-500 to-emerald-500' }
]

const ML_KEM_DECAPS_STEPS: FlowStep[] = [
  { id: 'parse_sk', title: 'Parse Secret Key', description: 'Extract s, pk, H(pk), z', details: ['s = decode(sk)', 'Recover all components'], color: 'from-red-500 to-orange-500' },
  { id: 'decompress', title: 'Decompress Ciphertext', description: 'Recover u and v from ct', details: ['u = decompress(ct, du)', 'v = decompress(ct, dv)'], color: 'from-orange-500 to-yellow-500' },
  { id: 'decrypt', title: 'Decrypt Message', description: 'Compute m = v - s^T*u', details: ['m_poly = v - s^T * u', 'm = decode(m_poly)', 'Recover original message'], color: 'from-yellow-500 to-lime-500' },
  { id: 'reencrypt', title: 'Re-encrypt', description: 'Verify by re-encrypting m', details: ['ct_prime = Encaps(pk, m)', 'Fujisaki-Okamoto transform'], color: 'from-lime-500 to-green-500' },
  { id: 'compare', title: 'Compare Ciphertexts', description: 'Check ct == ct_prime', details: ['if ct == ct_prime:', '  return KDF(K || H(ct))', 'else: return KDF(z || H(ct))'], color: 'from-green-500 to-teal-500' }
]

const ML_DSA_SIGN_STEPS: FlowStep[] = [
  { id: 'parse', title: 'Parse Secret Key', description: 'Extract rho, K, tr, s1, s2, t0', details: ['Components from sk', 'tr = H(pk) for binding'], color: 'from-purple-500 to-violet-500' },
  { id: 'hash', title: 'Hash Message', description: 'Compute mu = H(tr || M)', details: ['mu = SHA3-512(tr || M)', 'Message bound to key'], color: 'from-violet-500 to-indigo-500' },
  { id: 'mask', title: 'Generate Mask y', description: 'Sample masking vector', details: ['rho\'\' = H(K || mu)', 'y = ExpandMask(rho\'\')', 'Coefficients in [-gamma1, gamma1]'], color: 'from-indigo-500 to-blue-500' },
  { id: 'compute_w', title: 'Compute w = Ay', description: 'Matrix-vector product', details: ['w = A * y', 'w1 = HighBits(w)', 'Extract high-order bits'], color: 'from-blue-500 to-cyan-500' },
  { id: 'challenge', title: 'Compute Challenge', description: 'Hash w1 to get c', details: ['c_tilde = H(mu || w1)', 'c = SampleChallenge(c_tilde)', 'Sparse polynomial'], color: 'from-cyan-500 to-teal-500' },
  { id: 'response', title: 'Compute Response', description: 'z = y + c*s1', details: ['z = y + c * s1', 'Check ||z||_inf < gamma1 - beta', 'Rejection sampling'], color: 'from-teal-500 to-green-500' },
  { id: 'hints', title: 'Compute Hints', description: 'Hints for verification', details: ['r0 = LowBits(w - c*s2)', 'h = MakeHint(r0, c*t0)', 'Enable efficient verify'], color: 'from-green-500 to-emerald-500' },
  { id: 'output', title: 'Output Signature', description: 'Encode (c_tilde, z, h)', details: ['sig = encode(c_tilde, z, h)', 'Variable-length encoding'], color: 'from-emerald-500 to-lime-500' }
]

const ML_DSA_VERIFY_STEPS: FlowStep[] = [
  { id: 'parse', title: 'Parse Inputs', description: 'Decode pk, sig', details: ['(rho, t1) = decode(pk)', '(c_tilde, z, h) = decode(sig)'], color: 'from-blue-500 to-cyan-500' },
  { id: 'check_z', title: 'Check z Bounds', description: 'Verify ||z||_inf < gamma1 - beta', details: ['For each zi in z:', '  |zi| < gamma1 - beta', 'Prevents forgery'], color: 'from-cyan-500 to-teal-500' },
  { id: 'expand', title: 'Expand Matrix A', description: 'Regenerate A from rho', details: ['A = ExpandA(rho)', 'Same as key generation'], color: 'from-teal-500 to-green-500' },
  { id: 'challenge', title: 'Recover Challenge', description: 'c = SampleChallenge(c_tilde)', details: ['c from challenge hash', 'Same as signing'], color: 'from-green-500 to-emerald-500' },
  { id: 'compute', title: 'Compute w\'', description: 'w\' = Az - c*t1*2^d', details: ['Reconstruct w from sig', 'Using public t1'], color: 'from-emerald-500 to-lime-500' },
  { id: 'use_hints', title: 'Apply Hints', description: 'w1\' = UseHint(h, w\')', details: ['Recover high bits of w', 'From hints in signature'], color: 'from-lime-500 to-yellow-500' },
  { id: 'verify', title: 'Verify Challenge', description: 'c_tilde\' = H(mu || w1\')', details: ['Recompute challenge hash', 'Accept if c_tilde\' == c_tilde'], color: 'from-yellow-500 to-orange-500' }
]

const SLH_DSA_SIGN_STEPS: FlowStep[] = [
  { id: 'randomize', title: 'Generate Randomness', description: 'Create signature randomizer R', details: ['opt_rand = randomBytes(n)', 'R = PRF_msg(sk_prf, opt_rand, M)'], color: 'from-green-500 to-emerald-500' },
  { id: 'digest', title: 'Compute Digest', description: 'Hash message with R', details: ['digest = H_msg(R, pk, M)', 'Extract indices from digest'], color: 'from-emerald-500 to-teal-500' },
  { id: 'fors', title: 'FORS Signature', description: 'Few-time signature on digest', details: ['sig_fors = FORS_sign(md, sk, addr)', 'k trees of height a'], color: 'from-teal-500 to-cyan-500' },
  { id: 'fors_pk', title: 'FORS Public Key', description: 'Compute FORS pk for HT', details: ['pk_fors = FORS_pk_from_sig()', 'Root of FORS trees'], color: 'from-cyan-500 to-blue-500' },
  { id: 'ht', title: 'Hypertree Signature', description: 'Sign FORS pk with HT', details: ['For each layer 0 to d-1:', '  WOTS+ sign + auth path', 'sig_ht = concatenate all'], color: 'from-blue-500 to-indigo-500' },
  { id: 'output', title: 'Output Signature', description: 'Combine all components', details: ['sig = R || sig_fors || sig_ht', 'Large but quantum-safe'], color: 'from-indigo-500 to-violet-500' }
]

const SLH_DSA_VERIFY_STEPS: FlowStep[] = [
  { id: 'parse', title: 'Parse Signature', description: 'Extract R, FORS sig, HT sig', details: ['R = sig[0:n]', 'sig_fors, sig_ht = remainder'], color: 'from-violet-500 to-purple-500' },
  { id: 'digest', title: 'Recompute Digest', description: 'Same hash as signing', details: ['digest = H_msg(R, pk, M)', 'Must match signing digest'], color: 'from-purple-500 to-pink-500' },
  { id: 'fors_pk', title: 'Recover FORS pk', description: 'From FORS signature', details: ['pk_fors = FORS_pk_from_sig(sig_fors, md)', 'Reconstruct root'], color: 'from-pink-500 to-red-500' },
  { id: 'ht', title: 'Verify Hypertree', description: 'Check all HT layers', details: ['For each layer:', '  pk = xmss_pk_from_sig()', 'Verify WOTS+ and paths'], color: 'from-red-500 to-orange-500' },
  { id: 'check', title: 'Compare Root', description: 'Final root vs pk root', details: ['computed_root == pk_root?', 'Accept if equal'], color: 'from-orange-500 to-yellow-500' }
]

const ALGORITHM_FLOWS: Record<string, Record<string, FlowStep[]>> = {
  'ml-kem': {
    keygen: ML_KEM_KEYGEN_STEPS,
    encrypt: ML_KEM_ENCAPS_STEPS,
    decrypt: ML_KEM_DECAPS_STEPS
  },
  'ml-dsa': {
    keygen: ML_DSA_SIGN_STEPS.slice(0, 3),
    sign: ML_DSA_SIGN_STEPS,
    verify: ML_DSA_VERIFY_STEPS
  },
  'slh-dsa': {
    keygen: SLH_DSA_SIGN_STEPS.slice(0, 2),
    sign: SLH_DSA_SIGN_STEPS,
    verify: SLH_DSA_VERIFY_STEPS
  }
}

interface AlgorithmFlowDiagramProps {
  algorithm: 'ml-kem' | 'ml-dsa' | 'slh-dsa'
  operation: 'keygen' | 'encrypt' | 'decrypt' | 'sign' | 'verify'
  autoPlay?: boolean
  onStepChange?: (step: number) => void
}

export function AlgorithmFlowDiagram({ algorithm, operation, autoPlay = false, onStepChange }: AlgorithmFlowDiagramProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [showDetails, setShowDetails] = useState(false)

  const steps = ALGORITHM_FLOWS[algorithm]?.[operation] || []

  useEffect(() => {
    setCurrentStep(0)
    setIsPlaying(autoPlay)
  }, [algorithm, operation, autoPlay])

  useEffect(() => {
    if (!isPlaying || steps.length === 0) return
    const timer = setInterval(() => {
      setCurrentStep(prev => {
        const next = prev + 1
        if (next >= steps.length) {
          setIsPlaying(false)
          return prev
        }
        onStepChange?.(next)
        return next
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [isPlaying, steps.length, onStepChange])

  const handleReset = useCallback(() => {
    setCurrentStep(0)
    setIsPlaying(false)
    onStepChange?.(0)
  }, [onStepChange])

  const handleStepClick = useCallback((index: number) => {
    setCurrentStep(index)
    setIsPlaying(false)
    onStepChange?.(index)
  }, [onStepChange])

  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        No flow diagram available for this operation
      </div>
    )
  }

  const currentStepData = steps[currentStep]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" />
          </Button>
          <span className="text-sm text-slate-400">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)}>
          <Info className="w-4 h-4 mr-1" />
          {showDetails ? 'Hide' : 'Show'} Details
        </Button>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2">
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => handleStepClick(index)}
            className={`flex-shrink-0 h-2 rounded-full transition-all ${
              index === currentStep ? 'w-8' : 'w-2'
            } ${index <= currentStep ? `bg-gradient-to-r ${step.color}` : 'bg-slate-700'}`}
          />
        ))}
      </div>

      <div className="relative overflow-hidden rounded-xl bg-neumorph-base shadow-neumorph-sm border border-white/[0.02] p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${currentStepData.color} text-white mb-3`}>
              {currentStepData.title}
            </div>
            <p className="text-white text-sm mb-3">{currentStepData.description}</p>

            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1"
              >
                {currentStepData.details.map((detail, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-400 font-mono">
                    <ChevronRight className="w-3 h-3 mt-0.5 text-slate-500" />
                    {detail}
                  </div>
                ))}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => handleStepClick(index)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              index === currentStep
                ? `bg-gradient-to-r ${step.color} text-white`
                : index < currentStep
                  ? 'bg-slate-700/50 text-slate-300'
                  : 'bg-slate-800/50 text-slate-500'
            }`}
          >
            {index + 1}. {step.title}
          </button>
        ))}
      </div>
    </div>
  )
}
