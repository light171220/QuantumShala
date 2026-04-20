import { MLDSA } from '../dsa/ml-dsa'
import { sha3_256 } from '../core/hash'
import { randomBytes } from '../core/random'

export type CertificateAlgorithm = 'ml-dsa-44' | 'ml-dsa-65' | 'ml-dsa-87'

export interface PQCCertificate {
  version: number
  serialNumber: Uint8Array
  subject: string
  issuer: string
  publicKey: Uint8Array
  signature: Uint8Array
  algorithm: CertificateAlgorithm
  validFrom: Date
  validTo: Date
  isCA: boolean
  extensions: CertificateExtension[]
}

export interface CertificateExtension {
  oid: string
  critical: boolean
  value: Uint8Array | string
}

export interface CertificateChainResult {
  chain: PQCCertificate[]
  isValid: boolean
  verificationSteps: VerificationStep[]
}

export interface VerificationStep {
  certificate: string
  action: string
  result: boolean
  details: string
}

function generateSerialNumber(): Uint8Array {
  return randomBytes(20)
}

function encodeCertificateForSigning(cert: Omit<PQCCertificate, 'signature'>): Uint8Array {
  const encoder = new TextEncoder()
  const data = JSON.stringify({
    version: cert.version,
    serialNumber: Array.from(cert.serialNumber),
    subject: cert.subject,
    issuer: cert.issuer,
    publicKey: Array.from(cert.publicKey),
    algorithm: cert.algorithm,
    validFrom: cert.validFrom.toISOString(),
    validTo: cert.validTo.toISOString(),
    isCA: cert.isCA,
    extensions: cert.extensions.map(e => ({
      oid: e.oid,
      critical: e.critical,
      value: typeof e.value === 'string' ? e.value : Array.from(e.value)
    }))
  })
  return encoder.encode(data)
}

function getDSAVariant(algorithm: CertificateAlgorithm): 'ML-DSA-44' | 'ML-DSA-65' | 'ML-DSA-87' {
  switch (algorithm) {
    case 'ml-dsa-44': return 'ML-DSA-44'
    case 'ml-dsa-87': return 'ML-DSA-87'
    default: return 'ML-DSA-65'
  }
}

export class CertificateAuthority {
  private algorithm: CertificateAlgorithm
  private dsa: MLDSA
  private keyPair: { publicKey: Uint8Array; secretKey: Uint8Array }
  private certificate: PQCCertificate | null = null

  constructor(subject: string, algorithm: CertificateAlgorithm = 'ml-dsa-65') {
    this.algorithm = algorithm
    this.dsa = new MLDSA(getDSAVariant(algorithm))
    this.keyPair = this.dsa.keyGen()

    const now = new Date()
    const validTo = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000)

    const certData: Omit<PQCCertificate, 'signature'> = {
      version: 3,
      serialNumber: generateSerialNumber(),
      subject,
      issuer: subject,
      publicKey: this.keyPair.publicKey,
      algorithm: this.algorithm,
      validFrom: now,
      validTo,
      isCA: true,
      extensions: [
        { oid: '2.5.29.19', critical: true, value: 'CA:TRUE' },
        { oid: '2.5.29.15', critical: true, value: 'keyCertSign, cRLSign' }
      ]
    }

    const tbsCertificate = encodeCertificateForSigning(certData)
    const signatureResult = this.dsa.sign(tbsCertificate, this.keyPair.secretKey)

    this.certificate = {
      ...certData,
      signature: signatureResult.signature
    }
  }

  getCertificate(): PQCCertificate {
    if (!this.certificate) throw new Error('CA not initialized')
    return this.certificate
  }

  getPublicKey(): Uint8Array {
    return this.keyPair.publicKey
  }

  signCertificate(cert: Omit<PQCCertificate, 'signature' | 'issuer'>): PQCCertificate {
    if (!this.certificate) throw new Error('CA not initialized')

    const certWithIssuer: Omit<PQCCertificate, 'signature'> = {
      ...cert,
      issuer: this.certificate.subject
    }

    const tbsCertificate = encodeCertificateForSigning(certWithIssuer)
    const signatureResult = this.dsa.sign(tbsCertificate, this.keyPair.secretKey)

    return {
      ...certWithIssuer,
      signature: signatureResult.signature
    }
  }
}

export class CertificateChain {
  private rootCA: CertificateAuthority
  private intermediateCA: CertificateAuthority | null = null
  private chain: PQCCertificate[] = []
  private algorithm: CertificateAlgorithm

  constructor(rootSubject: string, algorithm: CertificateAlgorithm = 'ml-dsa-65') {
    this.algorithm = algorithm
    this.rootCA = new CertificateAuthority(rootSubject, algorithm)
    this.chain.push(this.rootCA.getCertificate())
  }

  generateIntermediate(subject: string): PQCCertificate {
    const intDsa = new MLDSA(getDSAVariant(this.algorithm))
    const intKeyPair = intDsa.keyGen()

    const now = new Date()
    const validTo = new Date(now.getTime() + 5 * 365 * 24 * 60 * 60 * 1000)

    const certData: Omit<PQCCertificate, 'signature' | 'issuer'> = {
      version: 3,
      serialNumber: generateSerialNumber(),
      subject,
      publicKey: intKeyPair.publicKey,
      algorithm: this.algorithm,
      validFrom: now,
      validTo,
      isCA: true,
      extensions: [
        { oid: '2.5.29.19', critical: true, value: 'CA:TRUE, pathlen:0' },
        { oid: '2.5.29.15', critical: true, value: 'keyCertSign, cRLSign' }
      ]
    }

    const intCert = this.rootCA.signCertificate(certData)

    this.intermediateCA = new CertificateAuthority(subject, this.algorithm)
    Object.assign(this.intermediateCA, {
      keyPair: intKeyPair,
      certificate: intCert
    })

    this.chain.push(intCert)
    return intCert
  }

  generateEndEntity(subject: string, keyUsage: string = 'digitalSignature, keyEncipherment'): PQCCertificate {
    const issuer = this.intermediateCA || this.rootCA

    const entityDsa = new MLDSA(getDSAVariant(this.algorithm))
    const entityKeyPair = entityDsa.keyGen()

    const now = new Date()
    const validTo = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

    const certData: Omit<PQCCertificate, 'signature' | 'issuer'> = {
      version: 3,
      serialNumber: generateSerialNumber(),
      subject,
      publicKey: entityKeyPair.publicKey,
      algorithm: this.algorithm,
      validFrom: now,
      validTo,
      isCA: false,
      extensions: [
        { oid: '2.5.29.19', critical: true, value: 'CA:FALSE' },
        { oid: '2.5.29.15', critical: true, value: keyUsage },
        { oid: '2.5.29.17', critical: false, value: `DNS:${subject.toLowerCase().replace(/\s+/g, '.')}.example.com` }
      ]
    }

    const entityCert = issuer.signCertificate(certData)
    this.chain.push(entityCert)
    return entityCert
  }

  verifyChain(): CertificateChainResult {
    const steps: VerificationStep[] = []
    let isValid = true

    for (let i = this.chain.length - 1; i >= 0; i--) {
      const cert = this.chain[i]
      const issuerCert = i > 0 ? this.chain[i - 1] : cert

      const now = new Date()
      const validityCheck = now >= cert.validFrom && now <= cert.validTo
      steps.push({
        certificate: cert.subject,
        action: 'Check validity period',
        result: validityCheck,
        details: validityCheck
          ? `Valid from ${cert.validFrom.toISOString()} to ${cert.validTo.toISOString()}`
          : 'Certificate expired or not yet valid'
      })
      if (!validityCheck) isValid = false

      if (i > 0) {
        const dsa = new MLDSA(getDSAVariant(cert.algorithm))
        const tbsCertificate = encodeCertificateForSigning({
          version: cert.version,
          serialNumber: cert.serialNumber,
          subject: cert.subject,
          issuer: cert.issuer,
          publicKey: cert.publicKey,
          algorithm: cert.algorithm,
          validFrom: cert.validFrom,
          validTo: cert.validTo,
          isCA: cert.isCA,
          extensions: cert.extensions
        })

        const sigValid = dsa.verify(tbsCertificate, cert.signature, issuerCert.publicKey)
        steps.push({
          certificate: cert.subject,
          action: `Verify signature by ${issuerCert.subject}`,
          result: sigValid,
          details: sigValid
            ? `${cert.algorithm} signature verified successfully`
            : 'Signature verification failed'
        })
        if (!sigValid) isValid = false
      }

      if (i < this.chain.length - 1 && !cert.isCA) {
        steps.push({
          certificate: cert.subject,
          action: 'Check CA constraint',
          result: false,
          details: 'Non-CA certificate cannot sign other certificates'
        })
        isValid = false
      } else if (i < this.chain.length - 1) {
        steps.push({
          certificate: cert.subject,
          action: 'Check CA constraint',
          result: true,
          details: 'CA:TRUE - can sign certificates'
        })
      }
    }

    const rootCert = this.chain[0]
    steps.push({
      certificate: rootCert.subject,
      action: 'Verify root is self-signed',
      result: rootCert.subject === rootCert.issuer,
      details: rootCert.subject === rootCert.issuer
        ? 'Root certificate is self-signed (trust anchor)'
        : 'Root certificate is not self-signed'
    })

    return { chain: this.chain, isValid, verificationSteps: steps }
  }

  getChain(): PQCCertificate[] {
    return this.chain
  }

  getRootCA(): CertificateAuthority {
    return this.rootCA
  }
}

export function createFullChain(
  rootSubject: string,
  intermediateSubject: string,
  endEntitySubject: string,
  algorithm: CertificateAlgorithm = 'ml-dsa-65'
): CertificateChainResult {
  const chain = new CertificateChain(rootSubject, algorithm)
  chain.generateIntermediate(intermediateSubject)
  chain.generateEndEntity(endEntitySubject)
  return chain.verifyChain()
}
