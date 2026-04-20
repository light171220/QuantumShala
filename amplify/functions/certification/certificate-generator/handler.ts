import type { Handler } from 'aws-lambda'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'

const s3 = new S3Client({})
const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME

if (!BUCKET_NAME) {
  console.error('STORAGE_BUCKET_NAME environment variable is not set')
}

interface CertificateData {
  certificationId: string
  userId: string
  tier: 'associate' | 'professional' | 'expert'
  recipientName: string
  trackId: string
  trackName: string
  score: number
  issuedAt: string
  expiresAt?: string
  examTitle?: string
  skills?: string[]
}

interface GenerateCertificateInput {
  action: 'generate' | 'verify' | 'download'
  certificateData?: CertificateData
  certificationId?: string
  credentialId?: string
}

interface CertificateResponse {
  success: boolean
  certificateUrl?: string
  verificationUrl?: string
  pdfKey?: string
  credentialId?: string
  verified?: boolean
  certificateData?: CertificateData
  error?: {
    code: string
    message: string
  }
}

const TIER_COLORS: Record<string, { primary: string; secondary: string; accent: string }> = {
  associate: { primary: '#3B82F6', secondary: '#1E40AF', accent: '#60A5FA' },
  professional: { primary: '#8B5CF6', secondary: '#5B21B6', accent: '#A78BFA' },
  expert: { primary: '#F59E0B', secondary: '#B45309', accent: '#FCD34D' },
}

const TIER_TITLES: Record<string, string> = {
  associate: 'Quantum Computing Associate',
  professional: 'Quantum Computing Professional',
  expert: 'Quantum Computing Expert',
}

function generateCredentialId(certificationId: string): string {
  const prefix = 'QS'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = uuidv4().split('-')[0].toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function generateSVGCertificate(data: CertificateData, credentialId: string): string {
  const colors = TIER_COLORS[data.tier] || TIER_COLORS.associate
  const tierTitle = TIER_TITLES[data.tier] || 'Quantum Computing Certificate'

  const skills = data.skills?.slice(0, 6) || [
    'Quantum Mechanics',
    'Quantum Gates',
    'Quantum Circuits',
    'Quantum Algorithms',
    'Error Correction',
    'Quantum Machine Learning',
  ]

  const skillsHtml = skills
    .map((skill, idx) => {
      const x = (idx % 3) * 180 + 160
      const y = Math.floor(idx / 3) * 30 + 420
      return `<text x="${x}" y="${y}" font-size="11" fill="#4B5563">&#x2022; ${skill}</text>`
    })
    .join('\n')

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.primary}"/>
      <stop offset="100%" style="stop-color:${colors.secondary}"/>
    </linearGradient>
    <linearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.accent}"/>
      <stop offset="50%" style="stop-color:${colors.primary}"/>
      <stop offset="100%" style="stop-color:${colors.secondary}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.1"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="800" height="600" fill="#FAFAFA"/>

  <!-- Border -->
  <rect x="20" y="20" width="760" height="560" fill="none" stroke="url(#borderGradient)" stroke-width="3" rx="8"/>
  <rect x="30" y="30" width="740" height="540" fill="white" rx="6" filter="url(#shadow)"/>

  <!-- Header Background -->
  <rect x="30" y="30" width="740" height="100" fill="url(#headerGradient)" rx="6 6 0 0"/>

  <!-- QuantumShala Logo Area -->
  <circle cx="80" cy="80" r="30" fill="white" fill-opacity="0.2"/>
  <text x="80" y="88" font-family="Arial, sans-serif" font-size="28" fill="white" text-anchor="middle" font-weight="bold">Q</text>

  <!-- Header Title -->
  <text x="400" y="70" font-family="Arial, sans-serif" font-size="28" fill="white" text-anchor="middle" font-weight="bold">QuantumShala</text>
  <text x="400" y="100" font-family="Arial, sans-serif" font-size="14" fill="white" fill-opacity="0.9" text-anchor="middle">Certificate of Achievement</text>

  <!-- Tier Badge -->
  <circle cx="720" cy="80" r="30" fill="white" fill-opacity="0.2"/>
  <text x="720" y="75" font-family="Arial, sans-serif" font-size="10" fill="white" text-anchor="middle" font-weight="bold">${data.tier.toUpperCase()}</text>
  <text x="720" y="90" font-family="Arial, sans-serif" font-size="8" fill="white" fill-opacity="0.9" text-anchor="middle">CERTIFIED</text>

  <!-- Certificate Title -->
  <text x="400" y="175" font-family="Georgia, serif" font-size="24" fill="${colors.secondary}" text-anchor="middle" font-weight="bold">${tierTitle}</text>

  <!-- Presented To -->
  <text x="400" y="220" font-family="Arial, sans-serif" font-size="12" fill="#6B7280" text-anchor="middle">This is to certify that</text>

  <!-- Recipient Name -->
  <text x="400" y="265" font-family="Georgia, serif" font-size="32" fill="#111827" text-anchor="middle" font-weight="bold">${data.recipientName}</text>

  <!-- Decorative Line -->
  <line x1="200" y1="285" x2="600" y2="285" stroke="${colors.accent}" stroke-width="2"/>

  <!-- Achievement Text -->
  <text x="400" y="320" font-family="Arial, sans-serif" font-size="12" fill="#374151" text-anchor="middle">has successfully completed the</text>
  <text x="400" y="345" font-family="Georgia, serif" font-size="18" fill="${colors.primary}" text-anchor="middle" font-weight="bold">${data.trackName}</text>
  <text x="400" y="370" font-family="Arial, sans-serif" font-size="12" fill="#374151" text-anchor="middle">certification program with a score of ${data.score}%</text>

  <!-- Skills Section -->
  <text x="400" y="405" font-family="Arial, sans-serif" font-size="11" fill="#6B7280" text-anchor="middle">Demonstrated Competencies:</text>
  ${skillsHtml}

  <!-- Footer Info -->
  <line x1="100" y1="490" x2="700" y2="490" stroke="#E5E7EB" stroke-width="1"/>

  <!-- Issue Date -->
  <text x="150" y="520" font-family="Arial, sans-serif" font-size="10" fill="#6B7280" text-anchor="middle">Issued</text>
  <text x="150" y="540" font-family="Arial, sans-serif" font-size="12" fill="#374151" text-anchor="middle">${formatDate(data.issuedAt)}</text>

  <!-- Credential ID -->
  <text x="400" y="520" font-family="Arial, sans-serif" font-size="10" fill="#6B7280" text-anchor="middle">Credential ID</text>
  <text x="400" y="540" font-family="Courier New, monospace" font-size="12" fill="#374151" text-anchor="middle">${credentialId}</text>

  <!-- Expiry Date -->
  <text x="650" y="520" font-family="Arial, sans-serif" font-size="10" fill="#6B7280" text-anchor="middle">${data.expiresAt ? 'Valid Until' : 'No Expiration'}</text>
  <text x="650" y="540" font-family="Arial, sans-serif" font-size="12" fill="#374151" text-anchor="middle">${data.expiresAt ? formatDate(data.expiresAt) : 'Lifetime'}</text>

  <!-- Verification URL -->
  <text x="400" y="570" font-family="Arial, sans-serif" font-size="9" fill="#9CA3AF" text-anchor="middle">Verify at: quantumshala.com/verify/${credentialId}</text>
</svg>`

  return svg
}

async function generateCertificate(data: CertificateData): Promise<{
  certificateUrl: string
  verificationUrl: string
  pdfKey: string
  credentialId: string
}> {
  const credentialId = generateCredentialId(data.certificationId)

  const svg = generateSVGCertificate(data, credentialId)

  const pdfKey = `certificates/${data.userId}/${data.certificationId}.svg`

  if (BUCKET_NAME) {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: pdfKey,
      Body: svg,
      ContentType: 'image/svg+xml',
      Metadata: {
        certificationId: data.certificationId,
        credentialId,
        userId: data.userId,
        tier: data.tier,
        trackId: data.trackId,
        issuedAt: data.issuedAt,
      },
    }))

    const metadataKey = `certificates/${data.userId}/${data.certificationId}_metadata.json`
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: metadataKey,
      Body: JSON.stringify({
        ...data,
        credentialId,
        pdfKey,
        generatedAt: new Date().toISOString(),
      }),
      ContentType: 'application/json',
    }))
  }

  const certificateUrl = `certificates/${data.userId}/${data.certificationId}.svg`
  const verificationUrl = `https://quantumshala.com/verify/${credentialId}`

  console.log(`[CERT-GEN] Generated certificate for ${data.recipientName}`)
  console.log(`[CERT-GEN] Tier: ${data.tier}, Track: ${data.trackName}`)
  console.log(`[CERT-GEN] Credential ID: ${credentialId}`)

  return {
    certificateUrl,
    verificationUrl,
    pdfKey,
    credentialId,
  }
}

async function verifyCertificate(credentialId: string): Promise<{
  verified: boolean
  certificateData?: CertificateData
}> {
  if (!BUCKET_NAME) {
    return { verified: false }
  }

  try {
    const listCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `certificates/index/${credentialId}.json`,
    })

    const response = await s3.send(listCommand)
    if (!response.Body) {
      return { verified: false }
    }

    const metadata = JSON.parse(await response.Body.transformToString())

    return {
      verified: true,
      certificateData: metadata,
    }
  } catch (error) {
    console.log(`[CERT-GEN] Certificate not found: ${credentialId}`)
    return { verified: false }
  }
}

export const handler: Handler = async (event): Promise<CertificateResponse> => {
  console.log('[CERT-GEN] Received request')

  try {
    let input: GenerateCertificateInput

    if (typeof event === 'string') {
      input = JSON.parse(event)
    } else if (event.arguments) {
      input = event.arguments
    } else if (event.body) {
      input = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
    } else {
      input = event
    }

    const { action } = input

    console.log(`[CERT-GEN] Action: ${action}`)

    switch (action) {
      case 'generate': {
        if (!input.certificateData) {
          return {
            success: false,
            error: { code: 'INVALID_INPUT', message: 'certificateData is required' },
          }
        }

        const result = await generateCertificate(input.certificateData)

        return {
          success: true,
          ...result,
        }
      }

      case 'verify': {
        if (!input.credentialId) {
          return {
            success: false,
            error: { code: 'INVALID_INPUT', message: 'credentialId is required' },
          }
        }

        const result = await verifyCertificate(input.credentialId)

        return {
          success: true,
          ...result,
        }
      }

      case 'download': {
        if (!input.certificationId) {
          return {
            success: false,
            error: { code: 'INVALID_INPUT', message: 'certificationId is required' },
          }
        }

        return {
          success: true,
          certificateUrl: `certificates/${input.certificationId}.svg`,
        }
      }

      default:
        return {
          success: false,
          error: { code: 'INVALID_ACTION', message: `Unknown action: ${action}` },
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[CERT-GEN] Error:', message)

    return {
      success: false,
      error: { code: 'INTERNAL_ERROR', message },
    }
  }
}
