import { client } from '@/lib/amplify'

export interface AdminUser {
  id: string
  username: string
  email: string
  displayName: string
  avatar?: string
  level: number
  totalXp: number
  currentStreak: number
  lessonsCompleted: number
  quizzesPassed: number
  circuitsCreated: number
  totalTimeMinutes: number
  joinedAt: string
  lastActiveAt?: string
  isVerified: boolean
  isPremium: boolean
  isBanned: boolean
}

export interface UserActivity {
  id: string
  userId: string
  type: 'lesson_start' | 'lesson_complete' | 'quiz_submit' | 'circuit_create' | 'login' | 'signup'
  metadata: Record<string, unknown>
  timestamp: string
}

export async function getAllUsers(limit: number = 100): Promise<{
  users: AdminUser[]
  total: number
}> {
  try {
    const { data: profiles } = await client.models.UserProfile.list({
      limit,
    })

    const users: AdminUser[] = (profiles || []).map(p => ({
      id: p.userId,
      username: p.username,
      email: p.email || '',
      displayName: p.displayName,
      avatar: p.avatar ?? undefined,
      level: p.level || 1,
      totalXp: p.totalXp || 0,
      currentStreak: p.currentStreak || 0,
      lessonsCompleted: p.lessonsCompleted || 0,
      quizzesPassed: p.quizzesPassed || 0,
      circuitsCreated: p.circuitsCreated || 0,
      totalTimeMinutes: p.totalTimeMinutes || 0,
      joinedAt: p.joinedAt,
      lastActiveAt: p.lastActiveAt ?? undefined,
      isVerified: p.isVerified || false,
      isPremium: p.isPremium || false,
      isBanned: p.isBanned || false,
    }))

    return { users, total: users.length }
  } catch (error) {
    console.error('Error fetching users:', error)
    return { users: [], total: 0 }
  }
}

export async function getUserById(userId: string): Promise<AdminUser | null> {
  try {
    const { data: profiles } = await client.models.UserProfile.list({
      filter: { userId: { eq: userId } },
    })

    if (!profiles || profiles.length === 0) return null

    const p = profiles[0]
    return {
      id: p.userId,
      username: p.username,
      email: p.email || '',
      displayName: p.displayName,
      avatar: p.avatar ?? undefined,
      level: p.level || 1,
      totalXp: p.totalXp || 0,
      currentStreak: p.currentStreak || 0,
      lessonsCompleted: p.lessonsCompleted || 0,
      quizzesPassed: p.quizzesPassed || 0,
      circuitsCreated: p.circuitsCreated || 0,
      totalTimeMinutes: p.totalTimeMinutes || 0,
      joinedAt: p.joinedAt,
      lastActiveAt: p.lastActiveAt ?? undefined,
      isVerified: p.isVerified || false,
      isPremium: p.isPremium || false,
      isBanned: p.isBanned || false,
    }
  } catch (error) {
    console.error('Error fetching user:', error)
    return null
  }
}

export async function getUserActivity(userId: string, limit: number = 50): Promise<UserActivity[]> {
  try {
    const { data: progress } = await client.models.LearningProgress.list({
      filter: { owner: { eq: userId } },
      limit,
    })

    const activities: UserActivity[] = []

    for (const p of progress || []) {
      if (p.startedAt) {
        activities.push({
          id: `${p.lessonId}-start`,
          userId,
          type: 'lesson_start',
          metadata: { lessonId: p.lessonId, trackId: p.trackId, moduleId: p.moduleId },
          timestamp: p.startedAt,
        })
      }
      if (p.completedAt) {
        activities.push({
          id: `${p.lessonId}-complete`,
          userId,
          type: 'lesson_complete',
          metadata: { lessonId: p.lessonId, trackId: p.trackId, moduleId: p.moduleId },
          timestamp: p.completedAt,
        })
      }
      if (p.lastQuizAt) {
        activities.push({
          id: `${p.lessonId}-quiz`,
          userId,
          type: 'quiz_submit',
          metadata: { lessonId: p.lessonId, score: p.quizScore, attempts: p.quizAttempts },
          timestamp: p.lastQuizAt,
        })
      }
    }

    return activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  } catch (error) {
    console.error('Error fetching user activity:', error)
    return []
  }
}

export async function banUser(userId: string, banned: boolean): Promise<boolean> {
  try {
    const { data: profiles } = await client.models.UserProfile.list({
      filter: { userId: { eq: userId } },
    })

    if (profiles && profiles.length > 0) {
      await client.models.UserProfile.update({
        userId: profiles[0].userId,
        isBanned: banned,
      })
      return true
    }
    return false
  } catch (error) {
    console.error('Error banning user:', error)
    return false
  }
}

export async function updateUserPremium(userId: string, isPremium: boolean): Promise<boolean> {
  try {
    const { data: profiles } = await client.models.UserProfile.list({
      filter: { userId: { eq: userId } },
    })

    if (profiles && profiles.length > 0) {
      await client.models.UserProfile.update({
        userId: profiles[0].userId,
        isPremium,
      })
      return true
    }
    return false
  } catch (error) {
    console.error('Error updating user premium:', error)
    return false
  }
}

export interface PlatformStats {
  totalUsers: number
  activeUsersToday: number
  activeUsersWeek: number
  totalLessonsCompleted: number
  totalQuizzesPassed: number
  totalCircuitsCreated: number
  totalTimeMinutes: number
  averageStreak: number
  newUsersToday: number
  newUsersWeek: number
}

export async function getPlatformStats(): Promise<PlatformStats> {
  try {
    const { data: profiles } = await client.models.UserProfile.list({ limit: 1000 })
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    let totalUsers = 0
    let activeUsersToday = 0
    let activeUsersWeek = 0
    let totalLessonsCompleted = 0
    let totalQuizzesPassed = 0
    let totalCircuitsCreated = 0
    let totalTimeMinutes = 0
    let totalStreak = 0
    let newUsersToday = 0
    let newUsersWeek = 0

    for (const p of profiles || []) {
      totalUsers++
      totalLessonsCompleted += p.lessonsCompleted || 0
      totalQuizzesPassed += p.quizzesPassed || 0
      totalCircuitsCreated += p.circuitsCreated || 0
      totalTimeMinutes += p.totalTimeMinutes || 0
      totalStreak += p.currentStreak || 0

      if (p.lastActiveAt) {
        const lastActive = new Date(p.lastActiveAt)
        if (lastActive >= today) activeUsersToday++
        if (lastActive >= weekAgo) activeUsersWeek++
      }

      if (p.joinedAt) {
        const joined = new Date(p.joinedAt)
        if (joined >= today) newUsersToday++
        if (joined >= weekAgo) newUsersWeek++
      }
    }

    return {
      totalUsers,
      activeUsersToday,
      activeUsersWeek,
      totalLessonsCompleted,
      totalQuizzesPassed,
      totalCircuitsCreated,
      totalTimeMinutes,
      averageStreak: totalUsers > 0 ? Math.round(totalStreak / totalUsers) : 0,
      newUsersToday,
      newUsersWeek,
    }
  } catch (error) {
    console.error('Error fetching platform stats:', error)
    return {
      totalUsers: 0,
      activeUsersToday: 0,
      activeUsersWeek: 0,
      totalLessonsCompleted: 0,
      totalQuizzesPassed: 0,
      totalCircuitsCreated: 0,
      totalTimeMinutes: 0,
      averageStreak: 0,
      newUsersToday: 0,
      newUsersWeek: 0,
    }
  }
}

export interface ContentTrack {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  color: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedHours: number
  modulesCount: number
  lessonsCount: number
  isPublished: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export interface ContentModule {
  id: string
  trackId: string
  name: string
  slug: string
  description: string
  order: number
  lessonsCount: number
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export interface ContentLesson {
  id: string
  moduleId: string
  trackId: string
  name: string
  slug: string
  description: string
  content: string
  order: number
  estimatedMinutes: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  hasQuiz: boolean
  hasExercise: boolean
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export interface ContentQuiz {
  id: string
  lessonId: string
  questions: QuizQuestion[]
  passingScore: number
  timeLimit?: number
  createdAt: string
  updatedAt: string
}

export interface QuizQuestion {
  id: string
  type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'code'
  question: string
  options?: string[]
  correctAnswer: string | string[]
  explanation?: string
  points: number
}

export async function createTrack(data: Omit<ContentTrack, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
  try {
    const now = new Date().toISOString()
    const { data: track } = await client.models.Track.create({
      ...data,
      createdAt: now,
      updatedAt: now,
    })
    return (track as { id?: string } | null)?.id || null
  } catch (error) {
    console.error('Error creating track:', error)
    return null
  }
}

export async function updateTrack(id: string, data: Partial<ContentTrack>): Promise<boolean> {
  try {
    await client.models.Track.update({
      id,
      ...data,
      updatedAt: new Date().toISOString(),
    })
    return true
  } catch (error) {
    console.error('Error updating track:', error)
    return false
  }
}

export async function deleteTrack(id: string): Promise<boolean> {
  try {
    await client.models.Track.delete({ id })
    return true
  } catch (error) {
    console.error('Error deleting track:', error)
    return false
  }
}

export async function getAllTracks(): Promise<ContentTrack[]> {
  try {
    const { data: tracks } = await client.models.Track.list({})
    return (tracks || []).map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description || '',
      icon: t.icon || '📚',
      color: t.color || 'cyan',
      difficulty: (t.difficulty as ContentTrack['difficulty']) || 'beginner',
      estimatedHours: t.estimatedHours || 0,
      modulesCount: t.modulesCount || 0,
      lessonsCount: t.lessonsCount || 0,
      isPublished: t.isPublished || false,
      order: t.order || 0,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))
  } catch (error) {
    console.error('Error fetching tracks:', error)
    return []
  }
}

export async function createModule(data: Omit<ContentModule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
  try {
    const now = new Date().toISOString()
    const { data: module } = await client.models.Module.create({
      ...data,
      createdAt: now,
      updatedAt: now,
    })
    return (module as { id?: string } | null)?.id || null
  } catch (error) {
    console.error('Error creating module:', error)
    return null
  }
}

export async function updateModule(id: string, data: Partial<ContentModule>): Promise<boolean> {
  try {
    await client.models.Module.update({
      id,
      ...data,
      updatedAt: new Date().toISOString(),
    })
    return true
  } catch (error) {
    console.error('Error updating module:', error)
    return false
  }
}

export async function deleteModule(id: string): Promise<boolean> {
  try {
    await client.models.Module.delete({ id })
    return true
  } catch (error) {
    console.error('Error deleting module:', error)
    return false
  }
}

export async function getModulesByTrack(trackId: string): Promise<ContentModule[]> {
  try {
    const { data: modules } = await client.models.Module.list({
      filter: { trackId: { eq: trackId } },
    })
    return (modules || []).map(m => ({
      id: m.id,
      trackId: m.trackId,
      name: m.name,
      slug: m.slug,
      description: m.description || '',
      order: m.order || 0,
      lessonsCount: m.lessonsCount || 0,
      isPublished: m.isPublished || false,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    })).sort((a, b) => a.order - b.order)
  } catch (error) {
    console.error('Error fetching modules:', error)
    return []
  }
}

export async function createLesson(data: Omit<ContentLesson, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
  try {
    const now = new Date().toISOString()
    const { data: lesson } = await client.models.Lesson.create({
      ...data,
      createdAt: now,
      updatedAt: now,
    })
    return (lesson as { id?: string } | null)?.id || null
  } catch (error) {
    console.error('Error creating lesson:', error)
    return null
  }
}

export async function updateLesson(id: string, data: Partial<ContentLesson>): Promise<boolean> {
  try {
    await client.models.Lesson.update({
      id,
      ...data,
      updatedAt: new Date().toISOString(),
    })
    return true
  } catch (error) {
    console.error('Error updating lesson:', error)
    return false
  }
}

export async function deleteLesson(id: string): Promise<boolean> {
  try {
    await client.models.Lesson.delete({ id })
    return true
  } catch (error) {
    console.error('Error deleting lesson:', error)
    return false
  }
}

export async function getLessonsByModule(moduleId: string): Promise<ContentLesson[]> {
  try {
    const { data: lessons } = await client.models.Lesson.list({
      filter: { moduleId: { eq: moduleId } },
    })
    return (lessons || []).map(l => ({
      id: l.id,
      moduleId: l.moduleId,
      trackId: l.trackId,
      name: l.name,
      slug: l.slug,
      description: l.description || '',
      content: l.content || '',
      order: l.order || 0,
      estimatedMinutes: l.estimatedMinutes || 10,
      difficulty: (l.difficulty as ContentLesson['difficulty']) || 'beginner',
      hasQuiz: l.hasQuiz || false,
      hasExercise: l.hasExercise || false,
      isPublished: l.isPublished || false,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })).sort((a, b) => a.order - b.order)
  } catch (error) {
    console.error('Error fetching lessons:', error)
    return []
  }
}

export async function getLessonById(id: string): Promise<ContentLesson | null> {
  try {
    const { data } = await client.models.Lesson.get({ id })
    const lesson = data as unknown as Record<string, unknown> | null
    if (!lesson) return null

    return {
      id: lesson.id as string,
      moduleId: lesson.moduleId as string,
      trackId: lesson.trackId as string,
      name: lesson.name as string,
      slug: lesson.slug as string,
      description: (lesson.description as string) || '',
      content: (lesson.content as string) || '',
      order: (lesson.order as number) || 0,
      estimatedMinutes: (lesson.estimatedMinutes as number) || 10,
      difficulty: (lesson.difficulty as ContentLesson['difficulty']) || 'beginner',
      hasQuiz: (lesson.hasQuiz as boolean) || false,
      hasExercise: (lesson.hasExercise as boolean) || false,
      isPublished: (lesson.isPublished as boolean) || false,
      createdAt: lesson.createdAt as string,
      updatedAt: lesson.updatedAt as string,
    }
  } catch (error) {
    console.error('Error fetching lesson:', error)
    return null
  }
}

export async function saveQuiz(lessonId: string, questions: QuizQuestion[], passingScore: number = 70): Promise<boolean> {
  try {
    const { data: existing } = await client.models.Quiz.list({
      filter: { lessonId: { eq: lessonId } },
    })

    const now = new Date().toISOString()

    if (existing && existing.length > 0) {
      await client.models.Quiz.update({
        id: existing[0].id,
        questions: JSON.stringify(questions),
        passingScore,
        updatedAt: now,
      })
    } else {
      await client.models.Quiz.create({
        lessonId,
        questions: JSON.stringify(questions),
        passingScore,
        createdAt: now,
        updatedAt: now,
      })
    }
    return true
  } catch (error) {
    console.error('Error saving quiz:', error)
    return false
  }
}

export async function getQuiz(lessonId: string): Promise<ContentQuiz | null> {
  try {
    const { data: quizzes } = await client.models.Quiz.list({
      filter: { lessonId: { eq: lessonId } },
    })

    if (!quizzes || quizzes.length === 0) return null

    const q = quizzes[0]
    return {
      id: q.id,
      lessonId: q.lessonId,
      questions: JSON.parse(q.questions as string) as QuizQuestion[],
      passingScore: q.passingScore || 70,
      timeLimit: q.timeLimit ?? undefined,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    }
  } catch (error) {
    console.error('Error fetching quiz:', error)
    return null
  }
}

export interface ImportedContent {
  type: 'track' | 'module' | 'lesson'
  name: string
  path: string
  files: {
    name: string
    content: string
    type: 'markdown' | 'json' | 'yaml' | 'other'
  }[]
  children: ImportedContent[]
}

export function parseContentStructure(files: File[]): ImportedContent[] {
  const structure: Record<string, ImportedContent> = {}

  for (const file of files) {
    const pathParts = file.webkitRelativePath?.split('/') || [file.name]
    const fileName = pathParts[pathParts.length - 1]
    const dirPath = pathParts.slice(0, -1).join('/')

    let type: ImportedContent['type'] = 'lesson'
    if (pathParts.length === 2) type = 'track'
    else if (pathParts.length === 3) type = 'module'

    if (!structure[dirPath]) {
      structure[dirPath] = {
        type,
        name: pathParts[pathParts.length - 2] || pathParts[0],
        path: dirPath,
        files: [],
        children: [],
      }
    }

    let fileType: 'markdown' | 'json' | 'yaml' | 'other' = 'other'
    if (fileName.endsWith('.md')) fileType = 'markdown'
    else if (fileName.endsWith('.json')) fileType = 'json'
    else if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) fileType = 'yaml'

    structure[dirPath].files.push({
      name: fileName,
      content: '',
      type: fileType,
    })
  }

  const root: ImportedContent[] = []
  const paths = Object.keys(structure).sort((a, b) => a.length - b.length)

  for (const path of paths) {
    const item = structure[path]
    const parentPath = path.split('/').slice(0, -1).join('/')

    if (parentPath && structure[parentPath]) {
      structure[parentPath].children.push(item)
    } else {
      root.push(item)
    }
  }

  return root
}

export async function importContent(content: ImportedContent, parentId?: string): Promise<{
  success: boolean
  id?: string
  errors: string[]
}> {
  const errors: string[] = []
  let id: string | undefined

  try {
    const metaFile = content.files.find(f => 
      f.name === 'meta.json' || f.name === 'meta.yaml' || f.name === 'config.json'
    )
    const contentFile = content.files.find(f => 
      f.name === 'content.md' || f.name === 'README.md' || f.name === 'lesson.md'
    )

    let metadata: Record<string, unknown> = {}
    if (metaFile) {
      try {
        metadata = JSON.parse(metaFile.content)
      } catch {
        errors.push(`Failed to parse ${metaFile.name}`)
      }
    }

    const slug = content.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    switch (content.type) {
      case 'track': {
        id = await createTrack({
          name: (metadata.name as string) || content.name,
          slug,
          description: (metadata.description as string) || '',
          icon: (metadata.icon as string) || '📚',
          color: (metadata.color as string) || 'cyan',
          difficulty: (metadata.difficulty as ContentTrack['difficulty']) || 'beginner',
          estimatedHours: (metadata.estimatedHours as number) || 0,
          modulesCount: content.children.length,
          lessonsCount: 0,
          isPublished: false,
          order: (metadata.order as number) || 0,
        }) || undefined
        break
      }

      case 'module': {
        if (!parentId) {
          errors.push('Module requires a parent track ID')
          break
        }
        id = await createModule({
          trackId: parentId,
          name: (metadata.name as string) || content.name,
          slug,
          description: (metadata.description as string) || '',
          order: (metadata.order as number) || 0,
          lessonsCount: content.children.length,
          isPublished: false,
        }) || undefined
        break
      }

      case 'lesson': {
        if (!parentId) {
          errors.push('Lesson requires a parent module ID')
          break
        }
        const { data } = await client.models.Module.get({ id: parentId })
        const moduleData = data as unknown as Record<string, unknown> | null
        const trackId = moduleData?.trackId as string | undefined

        id = await createLesson({
          moduleId: parentId,
          trackId: trackId || '',
          name: (metadata.name as string) || content.name,
          slug,
          description: (metadata.description as string) || '',
          content: contentFile?.content || '',
          order: (metadata.order as number) || 0,
          estimatedMinutes: (metadata.estimatedMinutes as number) || 10,
          difficulty: (metadata.difficulty as ContentLesson['difficulty']) || 'beginner',
          hasQuiz: (metadata.hasQuiz as boolean) || false,
          hasExercise: (metadata.hasExercise as boolean) || false,
          isPublished: false,
        }) || undefined

        const quizFile = content.files.find(f => f.name === 'quiz.json')
        if (quizFile && id) {
          try {
            const quizData = JSON.parse(quizFile.content)
            await saveQuiz(id, quizData.questions || [], quizData.passingScore || 70)
          } catch {
            errors.push('Failed to import quiz')
          }
        }
        break
      }
    }

    if (id) {
      for (const child of content.children) {
        const result = await importContent(child, id)
        if (!result.success) {
          errors.push(...result.errors)
        }
      }
    }

    return { success: errors.length === 0, id, errors }
  } catch (error) {
    errors.push(`Import failed: ${error}`)
    return { success: false, errors }
  }
}
