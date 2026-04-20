import { MLKEM } from '../kem/ml-kem'
import { sha3_256, shake256 } from '../core/hash'
import { randomBytes } from '../core/random'

export interface TLSHybridConfig {
  classicalAlgorithm: 'x25519' | 'p256'
  pqcAlgorithm: 'ml-kem-512' | 'ml-kem-768' | 'ml-kem-1024'
}

export interface ClientHello {
  random: Uint8Array
  sessionId: Uint8Array
  cipherSuites: string[]
  supportedVersions: string[]
  keyShareEntries: KeyShareEntry[]
  timestamp: number
}

export interface ServerHello {
  random: Uint8Array
  sessionId: Uint8Array
  cipherSuite: string
  selectedVersion: string
  keyShareEntry: KeyShareEntry
  timestamp: number
}

export interface KeyShareEntry {
  group: string
  keyExchange: Uint8Array
}

export interface HandshakeKeys {
  clientHandshakeKey: Uint8Array
  serverHandshakeKey: Uint8Array
  clientHandshakeIv: Uint8Array
  serverHandshakeIv: Uint8Array
}

export interface ApplicationKeys {
  clientKey: Uint8Array
  serverKey: Uint8Array
  clientIv: Uint8Array
  serverIv: Uint8Array
}

export interface TLSStep {
  id: string
  name: string
  sender: 'client' | 'server'
  description: string
  data?: Record<string, unknown>
  timestamp: number
}

function simulateX25519KeyGen(): { publicKey: Uint8Array; privateKey: Uint8Array } {
  const privateKey = randomBytes(32)
  const publicKey = sha3_256(privateKey)
  return { publicKey, privateKey }
}

function simulateX25519SharedSecret(privateKey: Uint8Array, peerPublicKey: Uint8Array): Uint8Array {
  const combined = new Uint8Array(privateKey.length + peerPublicKey.length)
  combined.set(privateKey)
  combined.set(peerPublicKey, privateKey.length)
  return sha3_256(combined)
}

function deriveHandshakeKeys(sharedSecret: Uint8Array, clientRandom: Uint8Array, serverRandom: Uint8Array): HandshakeKeys {
  const earlySecret = shake256(new Uint8Array([0]), 32)
  const derivedSecret = shake256(new Uint8Array([...earlySecret, ...sharedSecret]), 32)
  const handshakeSecret = shake256(new Uint8Array([...derivedSecret, ...clientRandom, ...serverRandom]), 64)

  return {
    clientHandshakeKey: handshakeSecret.slice(0, 16),
    serverHandshakeKey: handshakeSecret.slice(16, 32),
    clientHandshakeIv: handshakeSecret.slice(32, 44),
    serverHandshakeIv: handshakeSecret.slice(44, 56)
  }
}

function deriveApplicationKeys(handshakeSecret: Uint8Array, transcriptHash: Uint8Array): ApplicationKeys {
  const masterSecret = shake256(new Uint8Array([...handshakeSecret, ...transcriptHash]), 64)

  return {
    clientKey: masterSecret.slice(0, 16),
    serverKey: masterSecret.slice(16, 32),
    clientIv: masterSecret.slice(32, 44),
    serverIv: masterSecret.slice(44, 56)
  }
}

export class TLSHybridDemo {
  private config: TLSHybridConfig
  private steps: TLSStep[] = []
  private clientX25519: { publicKey: Uint8Array; privateKey: Uint8Array } | null = null
  private serverX25519: { publicKey: Uint8Array; privateKey: Uint8Array } | null = null
  private clientKEM: MLKEM | null = null
  private serverKEM: MLKEM | null = null
  private kemKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array } | null = null
  private kemCiphertext: Uint8Array | null = null
  private kemSharedSecret: Uint8Array | null = null
  private classicalSharedSecret: Uint8Array | null = null
  private clientRandom: Uint8Array | null = null
  private serverRandom: Uint8Array | null = null
  private handshakeKeys: HandshakeKeys | null = null
  private applicationKeys: ApplicationKeys | null = null

  constructor(config: TLSHybridConfig = { classicalAlgorithm: 'x25519', pqcAlgorithm: 'ml-kem-768' }) {
    this.config = config
    const kemVariant = config.pqcAlgorithm === 'ml-kem-512' ? 'ML-KEM-512' :
                       config.pqcAlgorithm === 'ml-kem-1024' ? 'ML-KEM-1024' : 'ML-KEM-768'
    this.clientKEM = new MLKEM(kemVariant)
    this.serverKEM = new MLKEM(kemVariant)
  }

  clientHello(): ClientHello {
    this.clientRandom = randomBytes(32)
    this.clientX25519 = simulateX25519KeyGen()
    this.kemKeyPair = this.clientKEM!.keyGen()

    const hello: ClientHello = {
      random: this.clientRandom,
      sessionId: randomBytes(32),
      cipherSuites: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_AES_128_GCM_SHA256',
        'TLS_CHACHA20_POLY1305_SHA256'
      ],
      supportedVersions: ['TLS 1.3'],
      keyShareEntries: [
        {
          group: this.config.classicalAlgorithm,
          keyExchange: this.clientX25519.publicKey
        },
        {
          group: this.config.pqcAlgorithm,
          keyExchange: this.kemKeyPair.publicKey
        }
      ],
      timestamp: Date.now()
    }

    this.steps.push({
      id: 'client-hello',
      name: 'ClientHello',
      sender: 'client',
      description: `Client sends ClientHello with ${this.config.classicalAlgorithm} and ${this.config.pqcAlgorithm} key shares`,
      data: {
        random: Array.from(hello.random.slice(0, 8)),
        cipherSuites: hello.cipherSuites,
        keyShares: [this.config.classicalAlgorithm, this.config.pqcAlgorithm]
      },
      timestamp: hello.timestamp
    })

    return hello
  }

  serverHello(clientHello: ClientHello): ServerHello {
    this.serverRandom = randomBytes(32)
    this.serverX25519 = simulateX25519KeyGen()

    const clientX25519Key = clientHello.keyShareEntries.find(e => e.group === this.config.classicalAlgorithm)
    const clientKEMKey = clientHello.keyShareEntries.find(e => e.group === this.config.pqcAlgorithm)

    if (clientX25519Key && this.serverX25519) {
      this.classicalSharedSecret = simulateX25519SharedSecret(
        this.serverX25519.privateKey,
        clientX25519Key.keyExchange
      )
    }

    if (clientKEMKey) {
      const encapsResult = this.serverKEM!.encaps(clientKEMKey.keyExchange)
      this.kemCiphertext = encapsResult.ciphertext
      this.kemSharedSecret = encapsResult.sharedSecret
    }

    const hybridKeyShare = new Uint8Array(
      this.serverX25519!.publicKey.length + (this.kemCiphertext?.length || 0)
    )
    hybridKeyShare.set(this.serverX25519!.publicKey)
    if (this.kemCiphertext) {
      hybridKeyShare.set(this.kemCiphertext, this.serverX25519!.publicKey.length)
    }

    const hello: ServerHello = {
      random: this.serverRandom,
      sessionId: clientHello.sessionId,
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
      selectedVersion: 'TLS 1.3',
      keyShareEntry: {
        group: `${this.config.classicalAlgorithm}+${this.config.pqcAlgorithm}`,
        keyExchange: hybridKeyShare
      },
      timestamp: Date.now()
    }

    this.steps.push({
      id: 'server-hello',
      name: 'ServerHello',
      sender: 'server',
      description: `Server sends ServerHello with hybrid ${this.config.classicalAlgorithm}+${this.config.pqcAlgorithm} key share`,
      data: {
        random: Array.from(hello.random.slice(0, 8)),
        cipherSuite: hello.cipherSuite,
        hybridKeyShare: true
      },
      timestamp: hello.timestamp
    })

    return hello
  }

  deriveKeys(): { clientKey: Uint8Array; serverKey: Uint8Array } {
    if (!this.classicalSharedSecret || !this.kemSharedSecret || !this.clientRandom || !this.serverRandom) {
      throw new Error('Handshake not complete')
    }

    const combinedSecret = new Uint8Array(
      this.classicalSharedSecret.length + this.kemSharedSecret.length
    )
    combinedSecret.set(this.classicalSharedSecret)
    combinedSecret.set(this.kemSharedSecret, this.classicalSharedSecret.length)

    const hybridSharedSecret = sha3_256(combinedSecret)

    this.steps.push({
      id: 'derive-hybrid',
      name: 'Hybrid Secret',
      sender: 'client',
      description: 'Client combines X25519 and ML-KEM shared secrets',
      data: {
        classicalSecretLength: this.classicalSharedSecret.length,
        pqcSecretLength: this.kemSharedSecret.length,
        combinedLength: hybridSharedSecret.length
      },
      timestamp: Date.now()
    })

    this.handshakeKeys = deriveHandshakeKeys(hybridSharedSecret, this.clientRandom, this.serverRandom)

    this.steps.push({
      id: 'handshake-keys',
      name: 'Handshake Keys',
      sender: 'client',
      description: 'Derive handshake traffic keys using HKDF',
      data: {
        clientKeyLength: this.handshakeKeys.clientHandshakeKey.length,
        serverKeyLength: this.handshakeKeys.serverHandshakeKey.length
      },
      timestamp: Date.now()
    })

    const transcriptHash = sha3_256(new Uint8Array([
      ...this.clientRandom,
      ...this.serverRandom,
      ...hybridSharedSecret
    ]))

    this.applicationKeys = deriveApplicationKeys(
      sha3_256(new Uint8Array([...this.handshakeKeys.clientHandshakeKey, ...this.handshakeKeys.serverHandshakeKey])),
      transcriptHash
    )

    this.steps.push({
      id: 'application-keys',
      name: 'Application Keys',
      sender: 'client',
      description: 'Derive application traffic keys',
      data: {
        clientKeyLength: this.applicationKeys.clientKey.length,
        serverKeyLength: this.applicationKeys.serverKey.length,
        ivLength: this.applicationKeys.clientIv.length
      },
      timestamp: Date.now()
    })

    this.steps.push({
      id: 'handshake-complete',
      name: 'Handshake Complete',
      sender: 'client',
      description: 'TLS 1.3 hybrid handshake complete - quantum-safe channel established',
      data: {
        securityLevel: 'Quantum-resistant',
        algorithms: [this.config.classicalAlgorithm, this.config.pqcAlgorithm]
      },
      timestamp: Date.now()
    })

    return {
      clientKey: this.applicationKeys.clientKey,
      serverKey: this.applicationKeys.serverKey
    }
  }

  getSteps(): TLSStep[] {
    return this.steps
  }

  getConfig(): TLSHybridConfig {
    return this.config
  }

  reset(): void {
    this.steps = []
    this.clientX25519 = null
    this.serverX25519 = null
    this.kemKeyPair = null
    this.kemCiphertext = null
    this.kemSharedSecret = null
    this.classicalSharedSecret = null
    this.clientRandom = null
    this.serverRandom = null
    this.handshakeKeys = null
    this.applicationKeys = null
  }
}

export function runFullHandshake(config?: TLSHybridConfig): {
  demo: TLSHybridDemo
  steps: TLSStep[]
  clientKey: Uint8Array
  serverKey: Uint8Array
} {
  const demo = new TLSHybridDemo(config)
  const clientHello = demo.clientHello()
  const serverHello = demo.serverHello(clientHello)
  const keys = demo.deriveKeys()

  return {
    demo,
    steps: demo.getSteps(),
    clientKey: keys.clientKey,
    serverKey: keys.serverKey
  }
}
