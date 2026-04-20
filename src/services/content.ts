const CDN_URL = 'https://d1q95cjsvt50nj.cloudfront.net'
const CONTENT_BASE_PATH = 'content/lessons'
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

async function fetchContent<T>(path: string): Promise<T | null> {
  const cacheKey = path
  const cached = getCached<T>(cacheKey)
  if (cached) return cached

  const fullPath = `${CONTENT_BASE_PATH}/${path}`
  const url = `${CDN_URL}/${fullPath}`

  try {
    console.log(`[CDN] Fetching: ${url}`)

    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const text = await response.text()
    let data: T

    if (path.endsWith('.json')) {
      data = JSON.parse(text) as T
    } else {
      data = text as unknown as T
    }

    console.log(`[CDN] Success: ${path}`,
      typeof data === 'object' && data !== null && 'tracks' in data
        ? `(${(data as {tracks: unknown[]}).tracks.length} tracks)`
        : ''
    )
    setCache(cacheKey, data)
    return data
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[CDN] Error fetching ${url}:`, message)
    return null
  }
}

export interface TrackIndex {
  tracks: TrackSummary[]
}

export interface TrackSummary {
  id: string
  title: string
  description: string
  order: number
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'specialized'
  estimatedMinutes: number
  modulesCount: number
  lessonsCount: number
  prerequisites: string[]
  tags: string[]
  modules: ModuleSummary[]
}

export interface ModuleSummary {
  id: string
  title: string
  order: number
  lessonsCount: number
  lessons: LessonSummary[]
}

export interface LessonSummary {
  id: string
  title: string
  order: number
  estimatedMinutes: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  hasQuiz: boolean
  hasExercises: boolean
}

export interface LessonMeta {
  id: string
  title: string
  description: string
  order: number
  estimatedMinutes: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  prerequisites: string[]
  learningObjectives: string[]
  tags: string[]
  hasQuiz: boolean
  hasExercises: boolean
}

export interface Quiz {
  quizId: string
  title: string
  description: string
  timeLimit: number
  passingScore: number
  totalPoints: number
  questions: QuizQuestion[]
}

export interface QuizQuestion {
  id: string
  type: 'multiple-choice' | 'true-false' | 'multiple-select'
  points: number
  question: string
  options: { id: string; text: string }[]
  correctAnswer: string | string[]
  explanation: string
}

export interface Exercise {
  id: string
  title: string
  type: 'coding' | 'calculation' | 'proof'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  points: number
  description: string
  starterCode?: string
  solution: string
  hints: string[]
  testCases?: { input: string; expected: string }[]
  language?: 'python' | 'qiskit' | 'cirq' | 'pennylane' | 'javascript'
}

export interface Exercises {
  exercisesId: string
  title: string
  description: string
  totalPoints: number
  exercises: Exercise[]
}

export async function getTracksIndex(): Promise<TrackIndex | null> {
  return fetchContent<TrackIndex>('index.json')
}

export async function getAllTracks(): Promise<TrackSummary[]> {
  console.log('[Content] getAllTracks() called')
  const index = await getTracksIndex()
  if (!index) {
    console.error('[Content] Failed to load tracks index - index is null')
    throw new Error('Failed to load learning content. Please check console for details.')
  }
  console.log(`[Content] Loaded ${index.tracks.length} tracks:`, index.tracks.map(t => t.id))
  if (index.tracks.length > 0) {
    console.log(`[Content] First track modules:`, index.tracks[0].modules?.length || 0)
  }
  return index.tracks
}

export async function getTrack(trackId: string): Promise<TrackSummary | null> {
  const tracks = await getAllTracks()
  return tracks.find(t => t.id === trackId) || null
}

export async function getModule(trackId: string, moduleId: string): Promise<ModuleSummary | null> {
  const track = await getTrack(trackId)
  return track?.modules.find(m => m.id === moduleId) || null
}

export async function getLessonMeta(
  trackId: string,
  moduleId: string,
  lessonId: string
): Promise<LessonMeta | null> {
  return fetchContent<LessonMeta>(`${trackId}/${moduleId}/${lessonId}/meta.json`)
}

export async function getLessonContent(
  trackId: string,
  moduleId: string,
  lessonId: string
): Promise<string | null> {
  return fetchContent<string>(`${trackId}/${moduleId}/${lessonId}/content.mdx`)
}

export async function getLessonQuiz(
  trackId: string,
  moduleId: string,
  lessonId: string
): Promise<Quiz | null> {
  return fetchContent<Quiz>(`${trackId}/${moduleId}/${lessonId}/quiz.json`)
}

export async function getLessonExercises(
  trackId: string,
  moduleId: string,
  lessonId: string
): Promise<Exercises | null> {
  return fetchContent<Exercises>(`${trackId}/${moduleId}/${lessonId}/exercises.json`)
}

export async function getFullLesson(
  trackId: string,
  moduleId: string,
  lessonId: string
): Promise<{
  meta: LessonMeta | null
  content: string | null
  quiz: Quiz | null
  exercises: Exercises | null
}> {
  const [meta, content, quiz, exercises] = await Promise.all([
    getLessonMeta(trackId, moduleId, lessonId),
    getLessonContent(trackId, moduleId, lessonId),
    getLessonQuiz(trackId, moduleId, lessonId),
    getLessonExercises(trackId, moduleId, lessonId),
  ])

  return { meta, content, quiz, exercises }
}

export async function preloadTrack(trackId: string): Promise<void> {
  const track = await getTrack(trackId)
  if (!track) return

  const promises: Promise<unknown>[] = []

  for (const module of track.modules) {
    for (const lesson of module.lessons) {
      promises.push(getLessonMeta(trackId, module.id, lesson.id))
      promises.push(getLessonContent(trackId, module.id, lesson.id))
    }
  }

  await Promise.allSettled(promises)
}

export function clearContentCache(): void {
  cache.clear()
}
