import { useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { Scale, Zap, Shield, HardDrive, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface AlgorithmData {
  name: string
  type: 'classical' | 'pqc-kem' | 'pqc-dsa'
  publicKeySize: number
  secretKeySize: number
  ciphertextOrSigSize: number
  keyGenSpeed: number
  encryptOrSignSpeed: number
  decryptOrVerifySpeed: number
  securityLevel: number
  quantumSafe: boolean
}

const ALGORITHMS: AlgorithmData[] = [
  { name: 'RSA-2048', type: 'classical', publicKeySize: 256, secretKeySize: 1190, ciphertextOrSigSize: 256, keyGenSpeed: 100, encryptOrSignSpeed: 95, decryptOrVerifySpeed: 90, securityLevel: 112, quantumSafe: false },
  { name: 'ECDSA P-256', type: 'classical', publicKeySize: 64, secretKeySize: 32, ciphertextOrSigSize: 64, keyGenSpeed: 95, encryptOrSignSpeed: 90, decryptOrVerifySpeed: 85, securityLevel: 128, quantumSafe: false },
  { name: 'X25519', type: 'classical', publicKeySize: 32, secretKeySize: 32, ciphertextOrSigSize: 32, keyGenSpeed: 98, encryptOrSignSpeed: 92, decryptOrVerifySpeed: 92, securityLevel: 128, quantumSafe: false },
  { name: 'ML-KEM-512', type: 'pqc-kem', publicKeySize: 800, secretKeySize: 1632, ciphertextOrSigSize: 768, keyGenSpeed: 70, encryptOrSignSpeed: 75, decryptOrVerifySpeed: 75, securityLevel: 128, quantumSafe: true },
  { name: 'ML-KEM-768', type: 'pqc-kem', publicKeySize: 1184, secretKeySize: 2400, ciphertextOrSigSize: 1088, keyGenSpeed: 60, encryptOrSignSpeed: 65, decryptOrVerifySpeed: 65, securityLevel: 192, quantumSafe: true },
  { name: 'ML-KEM-1024', type: 'pqc-kem', publicKeySize: 1568, secretKeySize: 3168, ciphertextOrSigSize: 1568, keyGenSpeed: 50, encryptOrSignSpeed: 55, decryptOrVerifySpeed: 55, securityLevel: 256, quantumSafe: true },
  { name: 'ML-DSA-44', type: 'pqc-dsa', publicKeySize: 1312, secretKeySize: 2560, ciphertextOrSigSize: 2420, keyGenSpeed: 55, encryptOrSignSpeed: 50, decryptOrVerifySpeed: 80, securityLevel: 128, quantumSafe: true },
  { name: 'ML-DSA-65', type: 'pqc-dsa', publicKeySize: 1952, secretKeySize: 4032, ciphertextOrSigSize: 3309, keyGenSpeed: 45, encryptOrSignSpeed: 40, decryptOrVerifySpeed: 70, securityLevel: 192, quantumSafe: true },
  { name: 'ML-DSA-87', type: 'pqc-dsa', publicKeySize: 2592, secretKeySize: 4896, ciphertextOrSigSize: 4627, keyGenSpeed: 35, encryptOrSignSpeed: 30, decryptOrVerifySpeed: 60, securityLevel: 256, quantumSafe: true },
  { name: 'SLH-DSA-128f', type: 'pqc-dsa', publicKeySize: 32, secretKeySize: 64, ciphertextOrSigSize: 17088, keyGenSpeed: 80, encryptOrSignSpeed: 10, decryptOrVerifySpeed: 15, securityLevel: 128, quantumSafe: true }
]

type ViewMode = 'sizes' | 'performance' | 'radar' | 'comparison'

export function ComparisonDashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>('sizes')
  const [selectedAlgorithms, setSelectedAlgorithms] = useState<string[]>(['RSA-2048', 'ML-KEM-768', 'ML-DSA-65'])

  const toggleAlgorithm = (name: string) => {
    setSelectedAlgorithms(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
    )
  }

  const filteredAlgorithms = ALGORITHMS.filter(a => selectedAlgorithms.includes(a.name))

  const sizeData = filteredAlgorithms.map(a => ({
    name: a.name,
    'Public Key': a.publicKeySize,
    'Secret Key': a.secretKeySize,
    'Ciphertext/Signature': a.ciphertextOrSigSize
  }))

  const performanceData = filteredAlgorithms.map(a => ({
    name: a.name,
    'Key Gen': a.keyGenSpeed,
    'Encrypt/Sign': a.encryptOrSignSpeed,
    'Decrypt/Verify': a.decryptOrVerifySpeed
  }))

  const radarData = filteredAlgorithms.map(a => ({
    algorithm: a.name,
    'Key Size': 100 - (Math.log(a.publicKeySize) / Math.log(10000)) * 100,
    'Speed': (a.keyGenSpeed + a.encryptOrSignSpeed + a.decryptOrVerifySpeed) / 3,
    'Security': (a.securityLevel / 256) * 100,
    'Quantum Safe': a.quantumSafe ? 100 : 0
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setViewMode('sizes')}
          className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === 'sizes' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}
        >
          <HardDrive className="w-4 h-4 inline mr-1" />
          Key Sizes
        </button>
        <button
          onClick={() => setViewMode('performance')}
          className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === 'performance' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}
        >
          <Zap className="w-4 h-4 inline mr-1" />
          Performance
        </button>
        <button
          onClick={() => setViewMode('radar')}
          className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === 'radar' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}
        >
          <Scale className="w-4 h-4 inline mr-1" />
          Overview
        </button>
        <button
          onClick={() => setViewMode('comparison')}
          className={`px-3 py-1.5 rounded-lg text-sm ${viewMode === 'comparison' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}
        >
          <Shield className="w-4 h-4 inline mr-1" />
          Details
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {ALGORITHMS.map(algo => (
          <button
            key={algo.name}
            onClick={() => toggleAlgorithm(algo.name)}
            className={`px-2 py-1 rounded text-xs transition-all ${
              selectedAlgorithms.includes(algo.name)
                ? algo.quantumSafe
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-red-500/20 text-red-400 border border-red-500/50'
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            {algo.name}
          </button>
        ))}
      </div>

      <Card variant="neumorph" className="p-4">
        {viewMode === 'sizes' && (
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Key and Ciphertext/Signature Sizes (bytes)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sizeData}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="Public Key" fill="#3b82f6" />
                <Bar dataKey="Secret Key" fill="#8b5cf6" />
                <Bar dataKey="Ciphertext/Signature" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {viewMode === 'performance' && (
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Relative Performance (higher = faster)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceData}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="Key Gen" fill="#f59e0b" />
                <Bar dataKey="Encrypt/Sign" fill="#ef4444" />
                <Bar dataKey="Decrypt/Verify" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {viewMode === 'radar' && (
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Algorithm Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={[
                { metric: 'Key Size', ...Object.fromEntries(radarData.map(d => [d.algorithm, d['Key Size']])) },
                { metric: 'Speed', ...Object.fromEntries(radarData.map(d => [d.algorithm, d.Speed])) },
                { metric: 'Security', ...Object.fromEntries(radarData.map(d => [d.algorithm, d.Security])) },
                { metric: 'Quantum Safe', ...Object.fromEntries(radarData.map(d => [d.algorithm, d['Quantum Safe']])) }
              ]}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 8 }} />
                {filteredAlgorithms.map((algo, idx) => (
                  <Radar
                    key={algo.name}
                    name={algo.name}
                    dataKey={algo.name}
                    stroke={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5]}
                    fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5]}
                    fillOpacity={0.2}
                  />
                ))}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {viewMode === 'comparison' && (
          <div className="overflow-x-auto">
            <h3 className="text-sm font-semibold text-white mb-4">Detailed Comparison</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left p-2 text-slate-400">Algorithm</th>
                  <th className="text-right p-2 text-slate-400">Type</th>
                  <th className="text-right p-2 text-slate-400">PK Size</th>
                  <th className="text-right p-2 text-slate-400">SK Size</th>
                  <th className="text-right p-2 text-slate-400">CT/Sig Size</th>
                  <th className="text-right p-2 text-slate-400">Security</th>
                  <th className="text-center p-2 text-slate-400">Quantum Safe</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlgorithms.map(algo => (
                  <tr key={algo.name} className="border-b border-slate-800">
                    <td className="p-2 text-white font-medium">{algo.name}</td>
                    <td className="p-2 text-right">
                      <Badge variant={algo.type === 'classical' ? 'danger' : 'success'} size="sm">
                        {algo.type}
                      </Badge>
                    </td>
                    <td className="p-2 text-right text-slate-300">{algo.publicKeySize} B</td>
                    <td className="p-2 text-right text-slate-300">{algo.secretKeySize} B</td>
                    <td className="p-2 text-right text-slate-300">{algo.ciphertextOrSigSize} B</td>
                    <td className="p-2 text-right text-slate-300">{algo.securityLevel} bits</td>
                    <td className="p-2 text-center">
                      {algo.quantumSafe ? (
                        <Shield className="w-4 h-4 text-green-400 mx-auto" />
                      ) : (
                        <Clock className="w-4 h-4 text-red-400 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
