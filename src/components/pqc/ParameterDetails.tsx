import { Shield, Key, Lock, FileText, Info, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface AlgorithmParams {
  name: string
  fullName: string
  standard: string
  type: 'kem' | 'dsa'
  securityLevel: number
  nistLevel: number
  publicKeySize: number
  secretKeySize: number
  ciphertextSize?: number
  signatureSize?: number
  sharedSecretSize?: number
  description: string
  pros: string[]
  cons: string[]
  useCases: string[]
  parameters?: Record<string, string | number>
}

const ALGORITHM_PARAMS: Record<string, AlgorithmParams> = {
  'ml-kem-512': {
    name: 'ML-KEM-512',
    fullName: 'Module-Lattice-Based Key Encapsulation Mechanism',
    standard: 'FIPS 203',
    type: 'kem',
    securityLevel: 128,
    nistLevel: 1,
    publicKeySize: 800,
    secretKeySize: 1632,
    ciphertextSize: 768,
    sharedSecretSize: 32,
    description: 'Smallest ML-KEM variant, suitable for constrained environments',
    pros: ['Smallest key sizes', 'Fastest operations', 'Good for IoT'],
    cons: ['Lowest security margin', 'Not recommended for long-term secrets'],
    useCases: ['IoT devices', 'Ephemeral sessions', 'Low-security applications'],
    parameters: { k: 2, eta1: 3, eta2: 2, du: 10, dv: 4 }
  },
  'ml-kem-768': {
    name: 'ML-KEM-768',
    fullName: 'Module-Lattice-Based Key Encapsulation Mechanism',
    standard: 'FIPS 203',
    type: 'kem',
    securityLevel: 192,
    nistLevel: 3,
    publicKeySize: 1184,
    secretKeySize: 2400,
    ciphertextSize: 1088,
    sharedSecretSize: 32,
    description: 'Recommended default variant balancing security and performance',
    pros: ['Good security margin', 'Balanced performance', 'NIST recommended'],
    cons: ['Larger than classical', 'Moderate overhead'],
    useCases: ['TLS key exchange', 'General secure communication', 'Most applications'],
    parameters: { k: 3, eta1: 2, eta2: 2, du: 10, dv: 4 }
  },
  'ml-kem-1024': {
    name: 'ML-KEM-1024',
    fullName: 'Module-Lattice-Based Key Encapsulation Mechanism',
    standard: 'FIPS 203',
    type: 'kem',
    securityLevel: 256,
    nistLevel: 5,
    publicKeySize: 1568,
    secretKeySize: 3168,
    ciphertextSize: 1568,
    sharedSecretSize: 32,
    description: 'Highest security variant for sensitive long-term data',
    pros: ['Maximum security', 'Future-proof', 'Best for sensitive data'],
    cons: ['Largest sizes', 'Slowest performance'],
    useCases: ['Government systems', 'Long-term secrets', 'Critical infrastructure'],
    parameters: { k: 4, eta1: 2, eta2: 2, du: 11, dv: 5 }
  },
  'ml-dsa-44': {
    name: 'ML-DSA-44',
    fullName: 'Module-Lattice-Based Digital Signature Algorithm',
    standard: 'FIPS 204',
    type: 'dsa',
    securityLevel: 128,
    nistLevel: 2,
    publicKeySize: 1312,
    secretKeySize: 2560,
    signatureSize: 2420,
    description: 'Smallest ML-DSA variant with acceptable security',
    pros: ['Smallest signatures', 'Fast verification', 'Good for constrained systems'],
    cons: ['Lower security margin', 'Slower signing'],
    useCases: ['Code signing', 'Document signing', 'Authentication'],
    parameters: { k: 4, l: 4, eta: 2, tau: 39, gamma1: '2^17', gamma2: '(q-1)/88' }
  },
  'ml-dsa-65': {
    name: 'ML-DSA-65',
    fullName: 'Module-Lattice-Based Digital Signature Algorithm',
    standard: 'FIPS 204',
    type: 'dsa',
    securityLevel: 192,
    nistLevel: 3,
    publicKeySize: 1952,
    secretKeySize: 4032,
    signatureSize: 3309,
    description: 'Recommended default signature variant',
    pros: ['Good security', 'Balanced performance', 'Recommended default'],
    cons: ['Large signatures', 'Signing slower than classical'],
    useCases: ['Certificate signing', 'TLS authentication', 'General signatures'],
    parameters: { k: 6, l: 5, eta: 4, tau: 49, gamma1: '2^19', gamma2: '(q-1)/32' }
  },
  'ml-dsa-87': {
    name: 'ML-DSA-87',
    fullName: 'Module-Lattice-Based Digital Signature Algorithm',
    standard: 'FIPS 204',
    type: 'dsa',
    securityLevel: 256,
    nistLevel: 5,
    publicKeySize: 2592,
    secretKeySize: 4896,
    signatureSize: 4627,
    description: 'Highest security signature variant',
    pros: ['Maximum security', 'Future-proof'],
    cons: ['Largest sizes', 'Slowest operations'],
    useCases: ['Root CA certificates', 'Critical signatures', 'Long-term validity'],
    parameters: { k: 8, l: 7, eta: 2, tau: 60, gamma1: '2^19', gamma2: '(q-1)/32' }
  },
  'slh-dsa-128f': {
    name: 'SLH-DSA-128f',
    fullName: 'Stateless Hash-Based Digital Signature Algorithm',
    standard: 'FIPS 205',
    type: 'dsa',
    securityLevel: 128,
    nistLevel: 1,
    publicKeySize: 32,
    secretKeySize: 64,
    signatureSize: 17088,
    description: 'Fast hash-based signatures with small keys but large signatures',
    pros: ['Tiny keys', 'Conservative security assumptions', 'Fast signing'],
    cons: ['Very large signatures', 'Not size-efficient'],
    useCases: ['Root CA certificates', 'Firmware signing', 'Infrequent signatures'],
    parameters: { n: 16, h: 66, d: 22, a: 6, k: 33, w: 16 }
  }
}

interface ParameterDetailsProps {
  algorithm: string
  variant: string
}

export function ParameterDetails({ algorithm, variant }: ParameterDetailsProps) {
  const key = variant.toLowerCase()
  const params = ALGORITHM_PARAMS[key]

  if (!params) {
    return (
      <Card variant="neumorph" className="p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Info className="w-5 h-5" />
          <span>Select an algorithm to view details</span>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card variant="neumorph" className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{params.name}</h3>
            <p className="text-sm text-slate-400">{params.fullName}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="success">{params.standard}</Badge>
            <Badge variant="info">Level {params.nistLevel}</Badge>
          </div>
        </div>

        <p className="text-sm text-slate-300 mb-4">{params.description}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-neumorph-base border border-white/[0.02] text-center">
            <Key className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-white">{params.publicKeySize}</div>
            <div className="text-xs text-slate-400">Public Key (B)</div>
          </div>
          <div className="p-3 rounded-lg bg-neumorph-base border border-white/[0.02] text-center">
            <Lock className="w-4 h-4 text-red-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-white">{params.secretKeySize}</div>
            <div className="text-xs text-slate-400">Secret Key (B)</div>
          </div>
          {params.ciphertextSize && (
            <div className="p-3 rounded-lg bg-neumorph-base border border-white/[0.02] text-center">
              <FileText className="w-4 h-4 text-purple-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">{params.ciphertextSize}</div>
              <div className="text-xs text-slate-400">Ciphertext (B)</div>
            </div>
          )}
          {params.signatureSize && (
            <div className="p-3 rounded-lg bg-neumorph-base border border-white/[0.02] text-center">
              <FileText className="w-4 h-4 text-purple-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">{params.signatureSize}</div>
              <div className="text-xs text-slate-400">Signature (B)</div>
            </div>
          )}
          <div className="p-3 rounded-lg bg-neumorph-base border border-white/[0.02] text-center">
            <Shield className="w-4 h-4 text-green-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-white">{params.securityLevel}</div>
            <div className="text-xs text-slate-400">Security (bits)</div>
          </div>
        </div>

        {params.parameters && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-white mb-2">Algorithm Parameters</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(params.parameters).map(([key, value]) => (
                <span key={key} className="px-2 py-1 rounded bg-slate-800 text-xs">
                  <span className="text-slate-400">{key}=</span>
                  <span className="text-white">{value}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card variant="neumorph" className="p-4">
          <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Pros
          </h4>
          <ul className="space-y-1">
            {params.pros.map((pro, idx) => (
              <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                <span className="text-green-400">+</span>
                {pro}
              </li>
            ))}
          </ul>
        </Card>

        <Card variant="neumorph" className="p-4">
          <h4 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Cons
          </h4>
          <ul className="space-y-1">
            {params.cons.map((con, idx) => (
              <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                <span className="text-amber-400">-</span>
                {con}
              </li>
            ))}
          </ul>
        </Card>

        <Card variant="neumorph" className="p-4">
          <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Use Cases
          </h4>
          <ul className="space-y-1">
            {params.useCases.map((useCase, idx) => (
              <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                <span className="text-blue-400">*</span>
                {useCase}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
