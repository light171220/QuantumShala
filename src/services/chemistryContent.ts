const CDN_URL = 'https://d1q95cjsvt50nj.cloudfront.net'
const CHEMISTRY_BASE_PATH = 'content/chemistry'
const CACHE_TTL = 10 * 60 * 1000

const cache = new Map<string, { data: unknown; timestamp: number }>()

function getCached<T>(key: string): T | null {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T
  }
  cache.delete(key)
  return null
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() })
}

async function fetchChemistryContent<T>(path: string): Promise<T | null> {
  const cacheKey = `chemistry:${path}`
  const cached = getCached<T>(cacheKey)
  if (cached) return cached

  const fullPath = `${CHEMISTRY_BASE_PATH}/${path}`
  const url = `${CDN_URL}/${fullPath}`

  try {
    console.log(`[CDN] Fetching chemistry: ${url}`)

    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const text = await response.text()
    const data = JSON.parse(text) as T

    console.log(`[CDN] Chemistry success: ${path}`)
    setCache(cacheKey, data)
    return data
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[CDN] Chemistry error fetching ${url}:`, message)
    return null
  }
}

export interface ChemistryIndex {
  tutorials: ContentSummary[]
  guides: ContentSummary[]
  reference: ContentSummary[]
  molecules: ContentSummary[]
}

export interface ContentSummary {
  id: string
  title: string
  description: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  estimatedMinutes?: number
  file: string
}

export interface TutorialContent {
  id: string
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedMinutes: number
  prerequisites: string[]
  learningObjectives: string[]
  sections: ContentSection[]
  exercises?: TutorialExercise[]
}

export interface ContentSection {
  id: string
  title: string
  content: string
}

export interface TutorialExercise {
  id: string
  title: string
  instructions: string
  hints: string[]
}

export interface GuideContent {
  id: string
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  sections: ContentSection[]
}

export interface ReferenceContent {
  id: string
  title: string
  description: string
  sections: ContentSection[]
}

export async function getChemistryIndex(): Promise<ChemistryIndex | null> {
  return fetchChemistryContent<ChemistryIndex>('index.json')
}

export async function getTutorial(tutorialId: string): Promise<TutorialContent | null> {
  const index = await getChemistryIndex()
  if (!index) return null

  const tutorial = index.tutorials.find(t => t.id === tutorialId)
  if (!tutorial) return null

  return fetchChemistryContent<TutorialContent>(tutorial.file)
}

export async function getGuide(guideId: string): Promise<GuideContent | null> {
  const index = await getChemistryIndex()
  if (!index) return null

  const guide = index.guides.find(g => g.id === guideId)
  if (!guide) return null

  return fetchChemistryContent<GuideContent>(guide.file)
}

export async function getReference(referenceId: string): Promise<ReferenceContent | null> {
  const index = await getChemistryIndex()
  if (!index) return null

  const reference = index.reference.find(r => r.id === referenceId)
  if (!reference) return null

  return fetchChemistryContent<ReferenceContent>(reference.file)
}

export async function getAllTutorials(): Promise<ContentSummary[]> {
  const index = await getChemistryIndex()
  return index?.tutorials || []
}

export async function getAllGuides(): Promise<ContentSummary[]> {
  const index = await getChemistryIndex()
  return index?.guides || []
}

export async function getAllReferences(): Promise<ContentSummary[]> {
  const index = await getChemistryIndex()
  return index?.reference || []
}

export function clearChemistryCache(): void {
  for (const key of cache.keys()) {
    if (key.startsWith('chemistry:')) {
      cache.delete(key)
    }
  }
}
