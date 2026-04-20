import { useState } from 'react'
import type { KeyPair } from '@/stores/pqcStore'

interface KeyViewerProps {
  keyPair: KeyPair | null
  isGenerating?: boolean
  onGenerate: () => void
  onClear: () => void
}

export function KeyViewer({ keyPair, isGenerating, onGenerate, onClear }: KeyViewerProps) {
  const [showSecret, setShowSecret] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  const formatBytes = (bytes: Uint8Array, maxLength: number = 64): string => {
    const hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    if (hex.length > maxLength) {
      return hex.slice(0, maxLength) + '...'
    }
    return hex
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyFeedback(`${label} copied!`)
      setTimeout(() => setCopyFeedback(null), 2000)
    } catch {
      setCopyFeedback('Failed to copy')
    }
  }

  const getFullHex = (bytes: Uint8Array): string => {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  return (
    <div className="bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Key Pair</h3>
        <div className="flex gap-2">
          {keyPair && (
            <button
              onClick={onClear}
              className="px-3 py-1.5 text-sm bg-neumorph-base shadow-neumorph-xs border border-white/[0.02] hover:shadow-neumorph-sm text-white rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              'Generate Keys'
            )}
          </button>
        </div>
      </div>

      {copyFeedback && (
        <div className="mb-3 p-2 bg-green-600/20 border border-green-500 rounded-lg text-green-400 text-sm text-center">
          {copyFeedback}
        </div>
      )}

      {keyPair ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded">
              {keyPair.algorithm.toUpperCase()}
            </span>
            <span className="px-2 py-1 text-xs bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded">
              {keyPair.variant}
            </span>
            <span className="px-2 py-1 text-xs bg-neumorph-base shadow-neumorph-xs text-slate-300 border border-white/[0.02] rounded">
              Generated {new Date(keyPair.generatedAt).toLocaleTimeString()}
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <span className="text-green-400">🔓</span> Public Key
                <span className="text-xs text-slate-500">({keyPair.publicKey.length} bytes)</span>
              </h4>
              <button
                onClick={() => copyToClipboard(getFullHex(keyPair.publicKey), 'Public key')}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Copy
              </button>
            </div>
            <div className="bg-neumorph-base shadow-neumorph-inset-xs p-3 rounded-lg border border-white/[0.02] font-mono text-xs text-slate-300 break-all">
              {formatBytes(keyPair.publicKey, 128)}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <span className="text-red-400">🔐</span> Secret Key
                <span className="text-xs text-slate-500">({keyPair.secretKey.length} bytes)</span>
              </h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  {showSecret ? 'Hide' : 'Show'}
                </button>
                {showSecret && (
                  <button
                    onClick={() => copyToClipboard(getFullHex(keyPair.secretKey), 'Secret key')}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Copy
                  </button>
                )}
              </div>
            </div>
            <div className="bg-neumorph-base shadow-neumorph-inset-xs p-3 rounded-lg border border-red-600/30 font-mono text-xs text-slate-300 break-all">
              {showSecret ? (
                formatBytes(keyPair.secretKey, 128)
              ) : (
                <span className="text-slate-500">••••••••••••••••••••••••••••••••••••••••</span>
              )}
            </div>
            {showSecret && (
              <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
                <span>⚠️</span> Never share your secret key!
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/[0.06]">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{keyPair.publicKey.length}</p>
              <p className="text-xs text-slate-400">Public Key (bytes)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{keyPair.secretKey.length}</p>
              <p className="text-xs text-slate-400">Secret Key (bytes)</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400">
          <p className="text-4xl mb-4">🔑</p>
          <p>No keys generated yet.</p>
          <p className="text-sm mt-2">Click "Generate Keys" to create a new key pair.</p>
        </div>
      )}
    </div>
  )
}

export default KeyViewer
