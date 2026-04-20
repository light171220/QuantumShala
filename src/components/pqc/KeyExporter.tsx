import { useState, useCallback } from 'react'
import { Download, Copy, Check, Key, Lock, FileText, Code } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

type ExportFormat = 'pem' | 'der' | 'pkcs8' | 'raw-hex' | 'raw-base64'
type KeyType = 'public' | 'private'

interface KeyExporterProps {
  publicKey?: Uint8Array
  secretKey?: Uint8Array
  algorithm: string
  variant: string
}

const OID_MAP: Record<string, string> = {
  'ml-kem-512': '2.16.840.1.101.3.4.4.1',
  'ml-kem-768': '2.16.840.1.101.3.4.4.2',
  'ml-kem-1024': '2.16.840.1.101.3.4.4.3',
  'ml-dsa-44': '2.16.840.1.101.3.4.3.17',
  'ml-dsa-65': '2.16.840.1.101.3.4.3.18',
  'ml-dsa-87': '2.16.840.1.101.3.4.3.19',
  'slh-dsa-128f': '2.16.840.1.101.3.4.3.20',
  'slh-dsa-128s': '2.16.840.1.101.3.4.3.21',
  'slh-dsa-192f': '2.16.840.1.101.3.4.3.22',
  'slh-dsa-192s': '2.16.840.1.101.3.4.3.23',
  'slh-dsa-256f': '2.16.840.1.101.3.4.3.24',
  'slh-dsa-256s': '2.16.840.1.101.3.4.3.25'
}

function encodeLength(length: number): Uint8Array {
  if (length < 128) {
    return new Uint8Array([length])
  } else if (length < 256) {
    return new Uint8Array([0x81, length])
  } else if (length < 65536) {
    return new Uint8Array([0x82, (length >> 8) & 0xff, length & 0xff])
  } else {
    return new Uint8Array([0x83, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff])
  }
}

function encodeOID(oidString: string): Uint8Array {
  const parts = oidString.split('.').map(Number)
  const bytes: number[] = []

  bytes.push(parts[0] * 40 + parts[1])

  for (let i = 2; i < parts.length; i++) {
    let value = parts[i]
    if (value < 128) {
      bytes.push(value)
    } else {
      const encoded: number[] = []
      while (value > 0) {
        encoded.unshift(value & 0x7f)
        value = value >> 7
      }
      for (let j = 0; j < encoded.length - 1; j++) {
        encoded[j] |= 0x80
      }
      bytes.push(...encoded)
    }
  }

  return new Uint8Array([0x06, bytes.length, ...bytes])
}

function createSubjectPublicKeyInfo(key: Uint8Array, oid: string): Uint8Array {
  const oidBytes = encodeOID(oid)

  const algorithmIdentifier = new Uint8Array([
    0x30,
    ...encodeLength(oidBytes.length),
    ...oidBytes
  ])

  const bitString = new Uint8Array([
    0x03,
    ...encodeLength(key.length + 1),
    0x00,
    ...key
  ])

  const totalLength = algorithmIdentifier.length + bitString.length

  return new Uint8Array([
    0x30,
    ...encodeLength(totalLength),
    ...algorithmIdentifier,
    ...bitString
  ])
}

function createPKCS8PrivateKey(key: Uint8Array, oid: string): Uint8Array {
  const version = new Uint8Array([0x02, 0x01, 0x00])

  const oidBytes = encodeOID(oid)
  const algorithmIdentifier = new Uint8Array([
    0x30,
    ...encodeLength(oidBytes.length),
    ...oidBytes
  ])

  const privateKeyOctet = new Uint8Array([
    0x04,
    ...encodeLength(key.length),
    ...key
  ])

  const totalLength = version.length + algorithmIdentifier.length + privateKeyOctet.length

  return new Uint8Array([
    0x30,
    ...encodeLength(totalLength),
    ...version,
    ...algorithmIdentifier,
    ...privateKeyOctet
  ])
}

function arrayToBase64(arr: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i])
  }
  return btoa(binary)
}

function formatPEM(base64: string, label: string): string {
  const lines: string[] = []
  lines.push(`-----BEGIN ${label}-----`)

  for (let i = 0; i < base64.length; i += 64) {
    lines.push(base64.slice(i, i + 64))
  }

  lines.push(`-----END ${label}-----`)
  return lines.join('\n')
}

function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function KeyExporter({ publicKey, secretKey, algorithm, variant }: KeyExporterProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pem')
  const [selectedKeyType, setSelectedKeyType] = useState<KeyType>('public')
  const [copied, setCopied] = useState(false)

  const getOID = useCallback(() => {
    const key = variant.toLowerCase()
    return OID_MAP[key] || '1.2.3.4.5.6.7'
  }, [variant])

  const exportKey = useCallback(() => {
    const key = selectedKeyType === 'public' ? publicKey : secretKey
    if (!key) return ''

    const oid = getOID()

    switch (selectedFormat) {
      case 'pem': {
        if (selectedKeyType === 'public') {
          const spki = createSubjectPublicKeyInfo(key, oid)
          return formatPEM(arrayToBase64(spki), 'PUBLIC KEY')
        } else {
          const pkcs8 = createPKCS8PrivateKey(key, oid)
          return formatPEM(arrayToBase64(pkcs8), 'PRIVATE KEY')
        }
      }
      case 'der': {
        if (selectedKeyType === 'public') {
          return arrayToHex(createSubjectPublicKeyInfo(key, oid))
        } else {
          return arrayToHex(createPKCS8PrivateKey(key, oid))
        }
      }
      case 'pkcs8': {
        const pkcs8 = selectedKeyType === 'public'
          ? createSubjectPublicKeyInfo(key, oid)
          : createPKCS8PrivateKey(key, oid)
        return formatPEM(arrayToBase64(pkcs8), selectedKeyType === 'public' ? 'PUBLIC KEY' : 'PRIVATE KEY')
      }
      case 'raw-hex': {
        return arrayToHex(key)
      }
      case 'raw-base64': {
        return arrayToBase64(key)
      }
      default:
        return ''
    }
  }, [publicKey, secretKey, selectedFormat, selectedKeyType, getOID])

  const handleCopy = useCallback(async () => {
    const content = exportKey()
    if (content) {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [exportKey])

  const handleDownload = useCallback(() => {
    const content = exportKey()
    if (!content) return

    const extensions: Record<ExportFormat, string> = {
      'pem': 'pem',
      'der': 'der',
      'pkcs8': 'pem',
      'raw-hex': 'hex',
      'raw-base64': 'txt'
    }

    const mimeTypes: Record<ExportFormat, string> = {
      'pem': 'application/x-pem-file',
      'der': 'application/octet-stream',
      'pkcs8': 'application/x-pem-file',
      'raw-hex': 'text/plain',
      'raw-base64': 'text/plain'
    }

    const filename = `${variant.toLowerCase()}_${selectedKeyType}_key.${extensions[selectedFormat]}`
    const blob = new Blob([content], { type: mimeTypes[selectedFormat] })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [exportKey, selectedFormat, selectedKeyType, variant])

  const hasKey = selectedKeyType === 'public' ? !!publicKey : !!secretKey
  const exportedContent = hasKey ? exportKey() : ''

  return (
    <Card variant="neumorph" className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-semibold text-white">Key Export</h3>
        <Badge variant="info" size="sm">{variant.toUpperCase()}</Badge>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg overflow-hidden border border-white/[0.02]">
            <button
              onClick={() => setSelectedKeyType('public')}
              className={`px-3 py-1.5 text-xs flex items-center gap-1 ${
                selectedKeyType === 'public'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Key className="w-3 h-3" />
              Public
            </button>
            <button
              onClick={() => setSelectedKeyType('private')}
              className={`px-3 py-1.5 text-xs flex items-center gap-1 ${
                selectedKeyType === 'private'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Lock className="w-3 h-3" />
              Private
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['pem', 'der', 'pkcs8', 'raw-hex', 'raw-base64'] as ExportFormat[]).map(format => (
            <button
              key={format}
              onClick={() => setSelectedFormat(format)}
              className={`px-2 py-1 rounded text-xs ${
                selectedFormat === format
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {format.toUpperCase()}
            </button>
          ))}
        </div>

        {hasKey ? (
          <>
            <div className="relative">
              <pre className="p-3 rounded-lg bg-slate-900 text-xs font-mono text-slate-300 overflow-x-auto max-h-48 overflow-y-auto">
                {exportedContent.slice(0, 2000)}
                {exportedContent.length > 2000 && '\n... (truncated)'}
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCopy} size="sm" variant="secondary">
                <Copy className="w-4 h-4 mr-1" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button onClick={handleDownload} size="sm">
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2 rounded bg-slate-800/50">
                <span className="text-slate-400">Format:</span>
                <span className="text-white ml-2">{selectedFormat.toUpperCase()}</span>
              </div>
              <div className="p-2 rounded bg-slate-800/50">
                <span className="text-slate-400">Size:</span>
                <span className="text-white ml-2">
                  {(selectedKeyType === 'public' ? publicKey?.length : secretKey?.length) || 0} bytes
                </span>
              </div>
              <div className="p-2 rounded bg-slate-800/50 col-span-2">
                <span className="text-slate-400">OID:</span>
                <span className="text-white ml-2 font-mono">{getOID()}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-slate-400">
            <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <div className="text-sm">No {selectedKeyType} key available</div>
            <div className="text-xs mt-1">Generate a key pair first</div>
          </div>
        )}
      </div>
    </Card>
  )
}
