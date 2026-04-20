import type { Handler } from 'aws-lambda'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import {
  createBM25Index,
  addDocument,
  buildIndex,
  serializeIndex,
  tokenize,
} from '../../shared/nlp'

const s3 = new S3Client({})
const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME

if (!BUCKET_NAME) {
  console.error('STORAGE_BUCKET_NAME environment variable is not set')
}

interface ProcessPaperInput {
  paperId: string
  pdfKey: string
  options?: {
    extractMetadata?: boolean
    buildIndex?: boolean
    skipIfProcessed?: boolean
  }
}

interface ProcessPaperResult {
  success: boolean
  paperId: string
  fullTextKey?: string
  wordCount?: number
  pageCount?: number
  metadata?: {
    title?: string
    authors?: string[]
    abstract?: string
  }
  indexKey?: string
  error?: string
}

async function extractTextFromPDF(buffer: Buffer): Promise<{
  text: string
  pageCount: number
  metadata?: { title?: string; authors?: string[] }
}> {
  const content = buffer.toString('utf-8', 0, Math.min(buffer.length, 1000000))

  let text = ''
  const textMatches = content.match(/BT[\s\S]*?ET/g) || []

  for (const match of textMatches) {
    const tjMatches = match.match(/\(([^)]*)\)\s*Tj/g) || []
    for (const tj of tjMatches) {
      const extracted = tj.match(/\(([^)]*)\)/)
      if (extracted) {
        text += extracted[1] + ' '
      }
    }
  }

  if (text.length < 100) {
    const asciiMatches = content.match(/[\x20-\x7E]{20,}/g) || []
    text = asciiMatches.join(' ')
  }

  text = text
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E\n]/g, '')
    .trim()

  const pageMatches = content.match(/\/Type\s*\/Page\b/g) || []
  const pageCount = Math.max(1, pageMatches.length)

  const lines = text.split(/\s{3,}/)
  const potentialTitle = lines.length > 0 ? lines[0].slice(0, 200) : undefined

  return {
    text,
    pageCount,
    metadata: {
      title: potentialTitle,
    },
  }
}

function extractMetadata(text: string): {
  title?: string
  authors?: string[]
  abstract?: string
} {
  const result: { title?: string; authors?: string[]; abstract?: string } = {}

  const abstractMatch = text.match(/abstract[:\s]*(.{100,1000}?)(?:\n\n|introduction|keywords)/i)
  if (abstractMatch) {
    result.abstract = abstractMatch[1].trim()
  }

  const lines = text.split('\n').filter(l => l.trim().length > 10)
  if (lines.length > 0) {
    const firstLine = lines[0].trim()
    if (firstLine.length < 200 && !firstLine.toLowerCase().includes('abstract')) {
      result.title = firstLine
    }
  }

  const authorSection = text.slice(0, 2000)
  const authorMatch = authorSection.match(/(?:by|authors?)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s*,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)*)/i)
  if (authorMatch) {
    result.authors = authorMatch[1].split(',').map(a => a.trim())
  }

  return result
}

function buildSearchIndex(paperId: string, text: string, metadata: { title?: string; abstract?: string }) {
  const index = createBM25Index()

  if (metadata.title) {
    addDocument(index, `${paperId}_title`, metadata.title.repeat(3))
  }

  if (metadata.abstract) {
    addDocument(index, `${paperId}_abstract`, metadata.abstract.repeat(2))
  }

  const chunkSize = 5000
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize)
    addDocument(index, `${paperId}_chunk_${Math.floor(i / chunkSize)}`, chunk)
  }

  buildIndex(index)

  return serializeIndex(index)
}

export const handler: Handler = async (event): Promise<ProcessPaperResult> => {
  console.log('Processing paper:', JSON.stringify(event))

  try {
    const input: ProcessPaperInput = typeof event === 'string' ? JSON.parse(event) : event.arguments || event

    const { paperId, pdfKey } = input
    let options = input.options || {}
    if (typeof options === 'string') {
      try {
        options = JSON.parse(options)
      } catch {
        options = {}
      }
    }

    if (!paperId || !pdfKey) {
      return {
        success: false,
        paperId: paperId || 'unknown',
        error: 'Missing required parameters: paperId and pdfKey',
      }
    }

    if (!BUCKET_NAME) {
      return {
        success: false,
        paperId,
        error: 'S3 bucket not configured',
      }
    }

    console.log(`Downloading PDF: ${pdfKey}`)
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: pdfKey,
    })

    const pdfResponse = await s3.send(getCommand)
    if (!pdfResponse.Body) {
      throw new Error('PDF file is empty or could not be retrieved from S3')
    }
    const pdfBuffer = Buffer.from(await pdfResponse.Body.transformToByteArray())

    console.log('Extracting text from PDF')
    const { text, pageCount, metadata: pdfMetadata } = await extractTextFromPDF(pdfBuffer)

    if (text.length < 100) {
      console.warn('Very little text extracted from PDF')
    }

    const extractedMetadata = options.extractMetadata !== false
      ? extractMetadata(text)
      : {}

    const metadata = {
      ...extractedMetadata,
      ...pdfMetadata,
    }

    const pdfPathParts = pdfKey.match(/^papers\/([^/]+)\/(.+)\.pdf$/i)
    const userId = pdfPathParts ? pdfPathParts[1] : 'unknown'
    const fileName = pdfPathParts ? pdfPathParts[2] : paperId

    const fullTextKey = `research/fulltext/${userId}/${fileName}.txt`
    console.log(`Storing full text: ${fullTextKey}`)

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fullTextKey,
      Body: text,
      ContentType: 'text/plain',
    }))

    let indexKey: string | undefined
    if (options.buildIndex !== false) {
      console.log('Building search index')
      const serializedIndex = buildSearchIndex(paperId, text, metadata)

      indexKey = `research/indexes/${userId}/${fileName}_index.json`

      await s3.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: indexKey,
        Body: JSON.stringify(serializedIndex),
        ContentType: 'application/json',
      }))
    }

    const tokens = tokenize(text)
    const wordCount = tokens.length

    console.log(`Processing complete: ${wordCount} words, ${pageCount} pages`)

    return {
      success: true,
      paperId,
      fullTextKey,
      wordCount,
      pageCount,
      metadata,
      indexKey,
    }
  } catch (error) {
    console.error('Error processing paper:', error)
    return {
      success: false,
      paperId: (event as ProcessPaperInput).paperId || 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
