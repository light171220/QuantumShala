import type { Handler } from 'aws-lambda'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime'
import { env } from '$amplify/env/generate-certificate'
import type { Schema } from '../../data/resource'
import { randomBytes } from 'crypto'

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env)
Amplify.configure(resourceConfig, libraryOptions)

const client = generateClient<Schema>()
const s3Client = new S3Client({ region: process.env.AWS_REGION })

interface CertificateRequest {
  userId: string
  trackId: string
  recipientName: string
}

interface CertificateResponse {
  success: boolean
  certificateId?: string
  credentialId?: string
  verificationUrl?: string
  pdfKey?: string
  error?: string
}

function generateCredentialId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = randomBytes(8).toString('hex')
  return `QS-${timestamp}-${randomPart}`.toUpperCase()
}

function generateCertificateHTML(
  recipientName: string,
  trackName: string,
  credentialId: string,
  issuedDate: string
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Outfit', sans-serif;
      background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
    }
    
    .certificate {
      background: linear-gradient(180deg, #ffffff 0%, #f8f9ff 100%);
      border-radius: 24px;
      padding: 60px;
      max-width: 900px;
      width: 100%;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.3);
      position: relative;
      overflow: hidden;
    }
    
    .certificate::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 8px;
      background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7);
    }
    
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    
    .logo h1 {
      font-size: 32px;
      font-weight: 700;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .title {
      text-align: center;
      margin-bottom: 40px;
    }
    
    .title h2 {
      font-size: 42px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 10px;
    }
    
    .title p {
      font-size: 18px;
      color: #6b7280;
    }
    
    .recipient {
      text-align: center;
      margin-bottom: 40px;
    }
    
    .recipient p {
      font-size: 16px;
      color: #6b7280;
      margin-bottom: 10px;
    }
    
    .recipient h3 {
      font-size: 36px;
      font-weight: 600;
      color: #1a1a2e;
      border-bottom: 3px solid #6366f1;
      display: inline-block;
      padding-bottom: 8px;
    }
    
    .course {
      text-align: center;
      margin-bottom: 40px;
    }
    
    .course p {
      font-size: 16px;
      color: #6b7280;
      margin-bottom: 10px;
    }
    
    .course h4 {
      font-size: 28px;
      font-weight: 500;
      color: #4f46e5;
    }
    
    .details {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      padding: 20px;
      background: #f3f4f6;
      border-radius: 12px;
    }
    
    .detail-item {
      text-align: center;
    }
    
    .detail-item label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1px;
      display: block;
      margin-bottom: 4px;
    }
    
    .detail-item span {
      font-size: 16px;
      font-weight: 500;
      color: #1a1a2e;
    }
    
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    
    .signature {
      text-align: center;
    }
    
    .signature-line {
      width: 200px;
      height: 1px;
      background: #d1d5db;
      margin-bottom: 8px;
    }
    
    .signature p {
      font-size: 14px;
      color: #6b7280;
    }
    
    .qr-placeholder {
      width: 100px;
      height: 100px;
      background: #f3f4f6;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="logo">
      <h1>⚛️ QuantumShala</h1>
    </div>
    
    <div class="title">
      <h2>Certificate of Completion</h2>
      <p>This is to certify that</p>
    </div>
    
    <div class="recipient">
      <h3>${recipientName}</h3>
    </div>
    
    <div class="course">
      <p>has successfully completed the learning track</p>
      <h4>${trackName}</h4>
    </div>
    
    <div class="details">
      <div class="detail-item">
        <label>Date Issued</label>
        <span>${issuedDate}</span>
      </div>
      <div class="detail-item">
        <label>Credential ID</label>
        <span>${credentialId}</span>
      </div>
      <div class="detail-item">
        <label>Verify At</label>
        <span>quantumshala.com/verify</span>
      </div>
    </div>
    
    <div class="footer">
      <div class="signature">
        <div class="signature-line"></div>
        <p>QuantumShala Team</p>
      </div>
      <div class="qr-placeholder">
        QR Code
      </div>
    </div>
  </div>
</body>
</html>`
}

export const handler: Handler<CertificateRequest, CertificateResponse> = async (event) => {
  const { userId, trackId, recipientName } = event

  try {
    const { data: tracks } = await client.models.Track.list({
      filter: { id: { eq: trackId } },
    })

    if (!tracks || tracks.length === 0) {
      return { success: false, error: 'Track not found' }
    }

    const track = tracks[0]

    const { data: trackProgressList } = await client.models.TrackProgress.list({
      filter: {
        trackId: { eq: trackId },
        status: { eq: 'completed' },
      },
    })

    if (!trackProgressList || trackProgressList.length === 0) {
      return { success: false, error: 'Track not completed' }
    }

    const trackProgress = trackProgressList[0]

    const credentialId = generateCredentialId()
    const issuedAt = new Date()
    const issuedDateStr = issuedAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const certificateHTML = generateCertificateHTML(
      recipientName,
      track.name,
      credentialId,
      issuedDateStr
    )

    const htmlKey = `certificates/${userId}/${credentialId}.html`
    const bucketName = (env as Record<string, string>).STORAGE_BUCKET_NAME

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: htmlKey,
        Body: certificateHTML,
        ContentType: 'text/html',
      })
    )

    const verificationUrl = `https://quantumshala.com/verify/${credentialId}`

    const { data: certificate } = await client.models.Certificate.create({
      trackId,
      trackName: track.name,
      recipientName,
      issuedAt: issuedAt.toISOString(),
      credentialId,
      verificationUrl,
      pdfKey: htmlKey,
    })

    if (trackProgress.id) {
      await client.models.TrackProgress.update({
        id: trackProgress.id,
        certificateId: certificate?.id,
      })
    }

    await client.models.Notification.create({
      type: 'achievement_unlocked',
      title: '🎓 Certificate Earned!',
      body: `Congratulations! You've earned a certificate for completing ${track.name}!`,
      actionUrl: `/certificates/${certificate?.id}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    })

    return {
      success: true,
      certificateId: certificate?.id,
      credentialId,
      verificationUrl,
      pdfKey: htmlKey,
    }
  } catch (error) {
    console.error('Error generating certificate:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
