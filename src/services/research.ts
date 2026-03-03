/**
 * Research Paper Intelligence Service
 * GraphQL client wrapper for research operations
 */

import { generateClient } from 'aws-amplify/data'
import { uploadData, getUrl, remove } from 'aws-amplify/storage'
import { fetchAuthSession } from 'aws-amplify/auth'
import type {
  ResearchPaper,
  PaperCollection,
  SearchIndex,
  PaperCitation,
  SearchResult,
  SearchQuery,
  PaperSummary,
  KeywordExtraction,
  QuantumInsights,
  PaperUpload,
  UploadProgress,
} from '@/types/research'

let _client: ReturnType<typeof generateClient<any>> | null = null

function getClient() {
  if (!_client) {
    _client = generateClient<any>()
  }
  return _client
}

// Paper Operations

export async function createPaper(
  paper: Omit<ResearchPaper, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ResearchPaper> {
  const client = getClient()
  const now = new Date().toISOString()

  const result = await client.models.ResearchPaper.create({
    ...paper,
    createdAt: now,
    updatedAt: now,
  })

  if (result.errors || !result.data) {
    throw new Error(result.errors?.[0]?.message || 'Failed to create paper')
  }

  return result.data as unknown as ResearchPaper
}

export async function getPaper(paperId: string): Promise<ResearchPaper | null> {
  const client = getClient()
  const result = await client.models.ResearchPaper.get({ id: paperId })

  if (result.errors || !result.data) {
    return null
  }

  return result.data as unknown as ResearchPaper
}

export async function listPapers(limit = 50): Promise<ResearchPaper[]> {
  const client = getClient()
  const result = await client.models.ResearchPaper.list({ limit })

  if (result.errors || !result.data) {
    return []
  }

  return result.data as unknown as ResearchPaper[]
}

export async function updatePaper(
  paperId: string,
  updates: Partial<ResearchPaper>
): Promise<ResearchPaper> {
  const client = getClient()

  const result = await client.models.ResearchPaper.update({
    id: paperId,
    ...updates,
    updatedAt: new Date().toISOString(),
  })

  if (result.errors || !result.data) {
    throw new Error(result.errors?.[0]?.message || 'Failed to update paper')
  }

  return result.data as unknown as ResearchPaper
}

export async function deletePaper(paperId: string): Promise<void> {
  const client = getClient()

  // Get paper to find associated files
  const paper = await getPaper(paperId)

  // Delete from database
  const result = await client.models.ResearchPaper.delete({ id: paperId })

  if (result.errors) {
    throw new Error(result.errors[0]?.message || 'Failed to delete paper')
  }

  // Delete associated files from S3
  if (paper?.pdfKey) {
    try {
      await remove({ path: paper.pdfKey })
    } catch (e) {
      console.warn('Failed to delete PDF:', e)
    }
  }

  if (paper?.fullTextKey) {
    try {
      await remove({ path: paper.fullTextKey })
    } catch (e) {
      console.warn('Failed to delete full text:', e)
    }
  }
}

// Upload Operations

export async function uploadPaper(
  upload: PaperUpload,
  onProgress?: (progress: UploadProgress) => void
): Promise<ResearchPaper> {
  const { file, title, authors, doi, arxivId, tags, collectionIds } = upload

  const session = await fetchAuthSession()
  const identityId = session.identityId
  if (!identityId) {
    throw new Error('User not authenticated')
  }

  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const pdfKey = `papers/${identityId}/${timestamp}_${sanitizedName}`

  onProgress?.({
    stage: 'uploading',
    progress: 0,
    message: 'Uploading PDF...',
  })

  // Upload to S3
  await uploadData({
    path: pdfKey,
    data: file,
    options: {
      contentType: 'application/pdf',
      onProgress: (event) => {
        const percent = event.transferredBytes / (event.totalBytes || 1)
        onProgress?.({
          stage: 'uploading',
          progress: percent * 50,
          message: `Uploading PDF... ${Math.round(percent * 100)}%`,
        })
      },
    },
  }).result

  onProgress?.({
    stage: 'processing',
    progress: 50,
    message: 'Creating paper record...',
  })

  // Create paper record
  const paper = await createPaper({
    title: title || file.name.replace(/\.pdf$/i, ''),
    authors: authors || [],
    abstract: '',
    doi,
    arxivId,
    pdfKey,
    keywords: [],
    collectionIds: collectionIds || [],
    tags: tags || [],
    readStatus: 'unread',
    processingStatus: 'pending',
  })

  onProgress?.({
    stage: 'processing',
    progress: 60,
    message: 'Processing paper...',
  })

  try {
    await processPaper(paper.id, pdfKey, onProgress)
    onProgress?.({
      stage: 'complete',
      progress: 100,
      message: 'Paper uploaded successfully!',
    })
  } catch (e) {
    console.error('Processing failed:', e)
    await updatePaper(paper.id, {
      processingStatus: 'failed',
      processingError: e instanceof Error ? e.message : 'Processing failed',
    })
    onProgress?.({
      stage: 'error',
      progress: 100,
      message: e instanceof Error ? e.message : 'Processing failed',
    })
  }

  const updatedPaper = await getPaper(paper.id)
  return updatedPaper || paper
}

export async function getPaperDownloadUrl(pdfKey: string): Promise<string> {
  const result = await getUrl({
    path: pdfKey,
    options: {
      expiresIn: 3600, // 1 hour
    },
  })

  return result.url.toString()
}

// Processing Operations

export async function processPaper(
  paperId: string,
  pdfKey: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<void> {
  const client = getClient()

  onProgress?.({
    stage: 'processing',
    progress: 65,
    message: 'Extracting text from PDF...',
  })

  const result = await client.mutations.processPaper({
    paperId,
    pdfKey,
    options: JSON.stringify({
      extractMetadata: true,
      buildIndex: true,
    }),
  }) as { data: any; errors?: any[] }

  if (result.errors && result.errors.length > 0) {
    const errorMessage = result.errors.map(e => e.message).join(', ')
    await updatePaper(paperId, {
      processingStatus: 'failed',
      processingError: errorMessage,
    })
    throw new Error(errorMessage)
  }

  if (!result.data?.success) {
    const errorMessage = result.data?.error || 'Processing failed'
    await updatePaper(paperId, {
      processingStatus: 'failed',
      processingError: errorMessage,
    })
    throw new Error(errorMessage)
  }

  onProgress?.({
    stage: 'indexing',
    progress: 85,
    message: 'Building search index...',
  })

  // Update paper with processing results
  await updatePaper(paperId, {
    fullTextKey: result.data.fullTextKey,
    pageCount: result.data.pageCount,
    wordCount: result.data.wordCount,
    title: result.data.metadata?.title || undefined,
    authors: result.data.metadata?.authors || undefined,
    abstract: result.data.metadata?.abstract || undefined,
    processingStatus: 'completed',
  })
}

// Search Operations

export async function searchPapers(query: SearchQuery): Promise<SearchResult[]> {
  const client = getClient()

  const result = await client.mutations.searchPapers({
    query: query.query,
    filters: query.filters ? JSON.stringify(query.filters) : undefined,
    sortBy: query.sortBy || 'relevance',
    sortOrder: query.sortOrder || 'desc',
    limit: query.limit || 20,
    offset: query.offset || 0,
  }) as { data: any; errors?: any[] }

  if (!result.data?.success) {
    throw new Error(result.data?.error || 'Search failed')
  }

  // Fetch full paper records for results
  const paperPromises = result.data.results.map(async (r: { paperId: string; score: number; highlights?: string[]; matchedTerms?: string[] }) => {
    const paper = await getPaper(r.paperId)
    return {
      paper: paper!,
      score: r.score,
      highlights: r.highlights || [],
      matchedFields: r.matchedTerms || [],
    }
  })

  const searchResults = await Promise.all(paperPromises)
  return searchResults.filter((r: { paper: ResearchPaper | null }) => r.paper !== null)
}

// Summarization Operations

export async function summarizePaper(paperId: string): Promise<PaperSummary> {
  const paper = await getPaper(paperId)

  if (!paper?.fullTextKey) {
    throw new Error('Paper has not been processed yet')
  }

  const client = getClient()

  const result = await client.mutations.summarizePaper({
    paperId,
    fullTextKey: paper.fullTextKey,
    options: {
      summaryLength: 'medium',
      bulletCount: 5,
      keywordCount: 10,
      includeQuantumKeywords: true,
    },
  }) as { data: any; errors?: any[] }

  if (!result.data?.success) {
    throw new Error(result.data?.error || 'Summarization failed')
  }

  // Update paper with summary
  await updatePaper(paperId, {
    summary: result.data.extractiveSummary,
    summaryBullets: result.data.bulletPoints,
    keywords: result.data.keywords?.map((k: { term: string }) => k.term) || [],
  })

  return {
    paperId,
    extractiveSummary: result.data.extractiveSummary,
    bulletPoints: result.data.bulletPoints,
    keyPhrases: result.data.keyphrases?.map((k: { term: string }) => k.term) || [],
    topSentences: result.data.topSentences || [],
  }
}

export async function extractKeywords(paperId: string): Promise<KeywordExtraction> {
  const paper = await getPaper(paperId)

  if (!paper?.fullTextKey) {
    throw new Error('Paper has not been processed yet')
  }

  const client = getClient()

  const result = await client.mutations.extractInsights({
    paperId,
    fullTextKey: paper.fullTextKey,
    extractKeywords: true,
    extractQuantum: false,
    extractCitations: false,
  }) as { data: any; errors?: any[] }

  if (!result.data?.success) {
    throw new Error(result.data?.error || 'Keyword extraction failed')
  }

  return {
    paperId,
    keywords: result.data.keywords || [],
    keyphrases: result.data.keyphrases || [],
  }
}

export async function extractQuantumInsights(paperId: string): Promise<QuantumInsights> {
  const paper = await getPaper(paperId)

  if (!paper?.fullTextKey) {
    throw new Error('Paper has not been processed yet')
  }

  const client = getClient()

  const result = await client.mutations.extractInsights({
    paperId,
    fullTextKey: paper.fullTextKey,
    extractKeywords: false,
    extractQuantum: true,
    extractCitations: true,
  }) as { data: any; errors?: any[] }

  if (!result.data?.success) {
    throw new Error(result.data?.error || 'Insight extraction failed')
  }

  const insights = result.data.quantumInsights

  // Update paper with quantum insights
  if (insights?.algorithms?.length > 0) {
    await updatePaper(paperId, {
      quantumAlgorithms: insights.algorithms.map((a: any) => a.name),
      hamiltonians: insights.hamiltonians?.map((h: any) => h.type) || [],
      circuitDescriptions: insights.circuits?.map((c: any) => c.description) || [],
    })
  }

  return {
    paperId,
    isQuantumRelated: insights?.isQuantumRelated || false,
    algorithms: insights?.algorithms || [],
    hamiltonians: insights?.hamiltonians || [],
    circuits: insights?.circuits || [],
    gates: insights?.gates || [],
    metrics: insights?.metrics || [],
  }
}

// Collection Operations

export async function createCollection(
  collection: Omit<PaperCollection, 'id' | 'owner' | 'paperCount' | 'createdAt' | 'updatedAt'>
): Promise<PaperCollection> {
  const client = getClient()
  const now = new Date().toISOString()

  const result = await client.models.PaperCollection.create({
    ...collection,
    paperCount: 0,
    createdAt: now,
    updatedAt: now,
  })

  if (result.errors || !result.data) {
    throw new Error(result.errors?.[0]?.message || 'Failed to create collection')
  }

  return result.data as unknown as PaperCollection
}

export async function listCollections(): Promise<PaperCollection[]> {
  const client = getClient()
  const result = await client.models.PaperCollection.list({ limit: 100 })

  if (result.errors || !result.data) {
    return []
  }

  return result.data as unknown as PaperCollection[]
}

export async function updateCollection(
  collectionId: string,
  updates: Partial<PaperCollection>
): Promise<PaperCollection> {
  const client = getClient()

  const result = await client.models.PaperCollection.update({
    id: collectionId,
    ...updates,
    updatedAt: new Date().toISOString(),
  })

  if (result.errors || !result.data) {
    throw new Error(result.errors?.[0]?.message || 'Failed to update collection')
  }

  return result.data as unknown as PaperCollection
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const client = getClient()

  // Remove collection from all papers first
  const papers = await listPapers(500)
  for (const paper of papers) {
    if (paper.collectionIds?.includes(collectionId)) {
      await updatePaper(paper.id, {
        collectionIds: paper.collectionIds.filter(id => id !== collectionId),
      })
    }
  }

  const result = await client.models.PaperCollection.delete({ id: collectionId })

  if (result.errors) {
    throw new Error(result.errors[0]?.message || 'Failed to delete collection')
  }
}

export async function addPaperToCollection(
  paperId: string,
  collectionId: string
): Promise<void> {
  const paper = await getPaper(paperId)
  if (!paper) throw new Error('Paper not found')

  const collectionIds = paper.collectionIds || []
  if (!collectionIds.includes(collectionId)) {
    await updatePaper(paperId, {
      collectionIds: [...collectionIds, collectionId],
    })

    // Update collection paper count
    const collections = await listCollections()
    const collection = collections.find(c => c.id === collectionId)
    if (collection) {
      await updateCollection(collectionId, {
        paperCount: (collection.paperCount || 0) + 1,
      })
    }
  }
}

export async function removePaperFromCollection(
  paperId: string,
  collectionId: string
): Promise<void> {
  const paper = await getPaper(paperId)
  if (!paper) throw new Error('Paper not found')

  const collectionIds = paper.collectionIds || []
  if (collectionIds.includes(collectionId)) {
    await updatePaper(paperId, {
      collectionIds: collectionIds.filter(id => id !== collectionId),
    })

    // Update collection paper count
    const collections = await listCollections()
    const collection = collections.find(c => c.id === collectionId)
    if (collection) {
      await updateCollection(collectionId, {
        paperCount: Math.max(0, (collection.paperCount || 0) - 1),
      })
    }
  }
}

// Citation Operations

export async function createCitation(
  citation: Omit<PaperCitation, 'id' | 'createdAt'>
): Promise<PaperCitation> {
  const client = getClient()

  const result = await client.models.PaperCitation.create({
    ...citation,
    createdAt: new Date().toISOString(),
  })

  if (result.errors || !result.data) {
    throw new Error(result.errors?.[0]?.message || 'Failed to create citation')
  }

  return result.data as unknown as PaperCitation
}

export async function listCitationsForPaper(paperId: string): Promise<PaperCitation[]> {
  const client = getClient()

  const result = await client.models.PaperCitation.list({
    filter: { sourcePaperId: { eq: paperId } },
  })

  if (result.errors || !result.data) {
    return []
  }

  return result.data as unknown as PaperCitation[]
}
