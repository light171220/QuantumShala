import type { Handler } from 'aws-lambda'
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const s3Client = new S3Client({})
const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' })

const BUCKET_NAME = process.env.STORAGE_BUCKET_NAME || ''
const EMBEDDING_MODEL_ID = 'amazon.titan-embed-text-v2:0'
const EMBEDDING_DIMENSIONS = 1024

interface IndexRequest {
  mode: 'full' | 'incremental' | 'single'
  trackId?: string
  moduleId?: string
  lessonId?: string
}

interface IndexResponse {
  success: boolean
  message: string
  stats?: {
    lessonsProcessed: number
    chunksCreated: number
    totalEmbeddings: number
    executionTimeMs: number
  }
  error?: string
}

interface ChunkDocument {
  id: string
  lessonId: string
  moduleId: string
  trackId: string
  text: string
  embedding: number[]
  chunkType: 'content' | 'definition' | 'formula' | 'example' | 'code' | 'quiz' | 'exercise'
  metadata: {
    lessonTitle: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    tags: string[]
    section: string
    codeLanguage?: string
  }
}

interface MasterIndexEntry {
  lessonId: string
  moduleId: string
  trackId: string
  lessonTitle: string
  difficulty: string
  chunkCount: number
  lastIndexed: string
}

interface MasterIndex {
  version: string
  lastUpdated: string
  totalChunks: number
  totalLessons: number
  entries: Record<string, MasterIndexEntry>
}

async function getEmbedding(text: string): Promise<number[]> {
  const payload = {
    inputText: text,
    dimensions: EMBEDDING_DIMENSIONS,
    normalize: true,
  }

  const command = new InvokeModelCommand({
    modelId: EMBEDDING_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  })

  const response = await bedrockClient.send(command)
  const responseBody = JSON.parse(new TextDecoder().decode(response.body))
  return responseBody.embedding
}

function extractMetadataFromMDX(content: string): {
  title: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
} {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
  const frontmatter = frontmatterMatch ? frontmatterMatch[1] : ''

  const titleMatch = frontmatter.match(/title:\s*["']?([^"'\n]+)["']?/)
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled'

  const difficultyMatch = frontmatter.match(/difficulty:\s*["']?(\w+)["']?/)
  const difficulty = (difficultyMatch ? difficultyMatch[1].toLowerCase() : 'beginner') as 'beginner' | 'intermediate' | 'advanced'

  const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/)
  const tags = tagsMatch
    ? tagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, ''))
    : []

  return { title, difficulty, tags }
}

function chunkMDXContent(
  content: string,
  lessonId: string,
  moduleId: string,
  trackId: string,
  metadata: { title: string; difficulty: 'beginner' | 'intermediate' | 'advanced'; tags: string[] }
): Omit<ChunkDocument, 'embedding'>[] {
  const chunks: Omit<ChunkDocument, 'embedding'>[] = []

  const contentWithoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '')

  const definitionRegex = /<Definition[^>]*term=["']([^"']+)["'][^>]*>([\s\S]*?)<\/Definition>/gi
  let match
  let defIndex = 0
  while ((match = definitionRegex.exec(contentWithoutFrontmatter)) !== null) {
    const term = match[1]
    const definition = match[2].trim()
    chunks.push({
      id: `${lessonId}-definition-${defIndex++}`,
      lessonId,
      moduleId,
      trackId,
      text: `Definition of ${term}: ${definition}`,
      chunkType: 'definition',
      metadata: {
        lessonTitle: metadata.title,
        difficulty: metadata.difficulty,
        tags: [...metadata.tags, term.toLowerCase()],
        section: 'Definitions',
      },
    })
  }

  const formulaRegex = /<Formula[^>]*>([\s\S]*?)<\/Formula>/gi
  let formulaIndex = 0
  while ((match = formulaRegex.exec(contentWithoutFrontmatter)) !== null) {
    const formula = match[1].trim()
    chunks.push({
      id: `${lessonId}-formula-${formulaIndex++}`,
      lessonId,
      moduleId,
      trackId,
      text: formula,
      chunkType: 'formula',
      metadata: {
        lessonTitle: metadata.title,
        difficulty: metadata.difficulty,
        tags: metadata.tags,
        section: 'Formulas',
      },
    })
  }

  const exampleRegex = /<Example[^>]*>([\s\S]*?)<\/Example>/gi
  let exampleIndex = 0
  while ((match = exampleRegex.exec(contentWithoutFrontmatter)) !== null) {
    const example = match[1].trim()
    chunks.push({
      id: `${lessonId}-example-${exampleIndex++}`,
      lessonId,
      moduleId,
      trackId,
      text: example,
      chunkType: 'example',
      metadata: {
        lessonTitle: metadata.title,
        difficulty: metadata.difficulty,
        tags: metadata.tags,
        section: 'Examples',
      },
    })
  }

  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  let codeIndex = 0
  while ((match = codeBlockRegex.exec(contentWithoutFrontmatter)) !== null) {
    const language = match[1] || 'plaintext'
    const code = match[2].trim()
    if (code.length > 50) {
      chunks.push({
        id: `${lessonId}-code-${codeIndex++}`,
        lessonId,
        moduleId,
        trackId,
        text: code,
        chunkType: 'code',
        metadata: {
          lessonTitle: metadata.title,
          difficulty: metadata.difficulty,
          tags: [...metadata.tags, language],
          section: 'Code',
          codeLanguage: language,
        },
      })
    }
  }

  let cleanContent = contentWithoutFrontmatter
    .replace(/<Definition[^>]*>[\s\S]*?<\/Definition>/gi, '')
    .replace(/<Formula[^>]*>[\s\S]*?<\/Formula>/gi, '')
    .replace(/<Example[^>]*>[\s\S]*?<\/Example>/gi, '')
    .replace(/<Tip[^>]*>[\s\S]*?<\/Tip>/gi, '')
    .replace(/<Warning[^>]*>[\s\S]*?<\/Warning>/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const sections = cleanContent.split(/(?=^##\s)/m)

  sections.forEach((section, sectionIndex) => {
    const sectionTitle = section.match(/^##\s+(.+)/)?.[1] || 'Introduction'
    const sectionContent = section.replace(/^##\s+.+\n/, '').trim()

    if (sectionContent.length < 100) return

    const paragraphs = sectionContent.split(/\n\n+/)
    let currentChunk = ''
    let chunkIndex = 0

    paragraphs.forEach(paragraph => {
      const trimmedPara = paragraph.trim()
      if (!trimmedPara) return

      if ((currentChunk + '\n\n' + trimmedPara).length > 1500) {
        if (currentChunk.length >= 200) {
          chunks.push({
            id: `${lessonId}-content-${sectionIndex}-${chunkIndex++}`,
            lessonId,
            moduleId,
            trackId,
            text: currentChunk.trim(),
            chunkType: 'content',
            metadata: {
              lessonTitle: metadata.title,
              difficulty: metadata.difficulty,
              tags: metadata.tags,
              section: sectionTitle,
            },
          })
        }
        currentChunk = trimmedPara
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + trimmedPara : trimmedPara
      }
    })

    if (currentChunk.length >= 200) {
      chunks.push({
        id: `${lessonId}-content-${sectionIndex}-${chunkIndex}`,
        lessonId,
        moduleId,
        trackId,
        text: currentChunk.trim(),
        chunkType: 'content',
        metadata: {
          lessonTitle: metadata.title,
          difficulty: metadata.difficulty,
          tags: metadata.tags,
          section: sectionTitle,
        },
      })
    }
  })

  return chunks
}

async function listLessons(prefix?: string): Promise<string[]> {
  const lessonKeys: string[] = []
  let continuationToken: string | undefined

  const basePrefix = prefix || 'content/lessons/'

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: basePrefix,
      ContinuationToken: continuationToken,
    })

    const response = await s3Client.send(command)

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key?.endsWith('.mdx')) {
          lessonKeys.push(obj.Key)
        }
      }
    }

    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  return lessonKeys
}

async function getLessonContent(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  const response = await s3Client.send(command)
  return await response.Body?.transformToString() || ''
}

async function saveChunksToS3(chunks: ChunkDocument[], trackId: string, moduleId: string, lessonId: string): Promise<void> {
  const key = `rag/embeddings/vectors/${trackId}/${moduleId}/${lessonId}.json`

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: JSON.stringify(chunks),
    ContentType: 'application/json',
  })

  await s3Client.send(command)
}

async function saveMasterIndex(index: MasterIndex): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: 'rag/embeddings/index.json',
    Body: JSON.stringify(index),
    ContentType: 'application/json',
  })

  await s3Client.send(command)
}

async function loadMasterIndex(): Promise<MasterIndex> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: 'rag/embeddings/index.json',
    })

    const response = await s3Client.send(command)
    const content = await response.Body?.transformToString() || '{}'
    return JSON.parse(content)
  } catch {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      totalChunks: 0,
      totalLessons: 0,
      entries: {},
    }
  }
}

async function saveManifest(stats: { lessonsProcessed: number; chunksCreated: number; executionTimeMs: number }): Promise<void> {
  const manifest = {
    version: '1.0.0',
    lastIndexed: new Date().toISOString(),
    stats,
    embeddingModel: EMBEDDING_MODEL_ID,
    dimensions: EMBEDDING_DIMENSIONS,
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: 'rag/embeddings/manifest.json',
    Body: JSON.stringify(manifest),
    ContentType: 'application/json',
  })

  await s3Client.send(command)
}

function parseKeyToIds(key: string): { trackId: string; moduleId: string; lessonId: string } | null {
  const match = key.match(/content\/lessons\/([^/]+)\/([^/]+)\/([^/]+)\.mdx$/)
  if (!match) return null
  return {
    trackId: match[1],
    moduleId: match[2],
    lessonId: match[3],
  }
}

export const handler: Handler<IndexRequest, IndexResponse> = async (event) => {
  const startTime = Date.now()
  const { mode, trackId, moduleId, lessonId } = event

  try {
    if (!BUCKET_NAME) {
      throw new Error('STORAGE_BUCKET_NAME environment variable not set')
    }

    let lessonKeys: string[] = []

    if (mode === 'single') {
      if (!trackId || !moduleId || !lessonId) {
        throw new Error('trackId, moduleId, and lessonId required for single mode')
      }
      lessonKeys = [`content/lessons/${trackId}/${moduleId}/${lessonId}.mdx`]
    } else if (mode === 'incremental' && trackId) {
      lessonKeys = await listLessons(`content/lessons/${trackId}/`)
    } else {
      lessonKeys = await listLessons()
    }

    const masterIndex = await loadMasterIndex()
    let totalChunks = 0
    let lessonsProcessed = 0

    for (const key of lessonKeys) {
      const ids = parseKeyToIds(key)
      if (!ids) continue

      try {
        const content = await getLessonContent(key)
        if (!content) continue

        const metadata = extractMetadataFromMDX(content)
        const rawChunks = chunkMDXContent(content, ids.lessonId, ids.moduleId, ids.trackId, metadata)

        const chunksWithEmbeddings: ChunkDocument[] = []

        for (const chunk of rawChunks) {
          const embedding = await getEmbedding(chunk.text)
          chunksWithEmbeddings.push({
            ...chunk,
            embedding,
          })
        }

        await saveChunksToS3(chunksWithEmbeddings, ids.trackId, ids.moduleId, ids.lessonId)

        masterIndex.entries[ids.lessonId] = {
          lessonId: ids.lessonId,
          moduleId: ids.moduleId,
          trackId: ids.trackId,
          lessonTitle: metadata.title,
          difficulty: metadata.difficulty,
          chunkCount: chunksWithEmbeddings.length,
          lastIndexed: new Date().toISOString(),
        }

        totalChunks += chunksWithEmbeddings.length
        lessonsProcessed++

        console.log(`Indexed ${ids.lessonId}: ${chunksWithEmbeddings.length} chunks`)
      } catch (lessonError) {
        console.error(`Failed to index ${key}:`, lessonError)
      }
    }

    masterIndex.totalChunks = Object.values(masterIndex.entries).reduce((sum, e) => sum + e.chunkCount, 0)
    masterIndex.totalLessons = Object.keys(masterIndex.entries).length
    masterIndex.lastUpdated = new Date().toISOString()

    await saveMasterIndex(masterIndex)

    const executionTimeMs = Date.now() - startTime

    await saveManifest({
      lessonsProcessed,
      chunksCreated: totalChunks,
      executionTimeMs,
    })

    return {
      success: true,
      message: `Successfully indexed ${lessonsProcessed} lessons with ${totalChunks} chunks`,
      stats: {
        lessonsProcessed,
        chunksCreated: totalChunks,
        totalEmbeddings: totalChunks,
        executionTimeMs,
      },
    }
  } catch (error) {
    console.error('Indexing failed:', error)
    return {
      success: false,
      message: 'Indexing failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
