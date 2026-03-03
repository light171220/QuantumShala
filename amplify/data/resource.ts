import { a, defineData, type ClientSchema } from '@aws-amplify/backend'
import { postConfirmation } from '../auth/post-confirmation/resource'
import { vqeSmall } from '../functions/vqe/vqe-small/resource'
import { vqeMedium } from '../functions/vqe/vqe-medium/resource'
import { vqeLarge } from '../functions/vqe/vqe-large/resource'
import { vqeAdapt } from '../functions/vqe/vqe-adapt/resource'
import { simulatorSmall } from '../functions/simulators/simulator-small/resource'
import { simulatorMedium } from '../functions/simulators/simulator-medium/resource'
import { simulatorLarge } from '../functions/simulators/simulator-large/resource'
import { ragIndexer } from '../functions/rag-indexer/resource'
import { ragQuery } from '../functions/rag-query/resource'
import { aiTutor } from '../functions/ai-tutor/resource'
import { paperProcessor } from '../functions/research/paper-processor/resource'
import { paperSearch } from '../functions/research/paper-search/resource'
import { paperSummarizer } from '../functions/research/paper-summarizer/resource'
import { paperInsights } from '../functions/research/paper-insights/resource'
import { qmlEngine } from '../functions/qml/qml-engine/resource'
import { examProctoring } from '../functions/certification/exam-proctoring/resource'
import { certificateGenerator } from '../functions/certification/certificate-generator/resource'
import { hardwareSimulator } from '../functions/virtual-lab/hardware-simulator/resource'

const schema = a.schema({
  UserProfile: a
    .model({
      userId: a.id().required(),
      username: a.string().required(),
      displayName: a.string().required(),
      email: a.email().required(),
      avatar: a.string(),
      avatarKey: a.string(),
      bio: a.string(),
      website: a.string(),
      location: a.string(),
      organization: a.string(),
      level: a.integer().default(1),
      xp: a.integer().default(0),
      totalXp: a.integer().default(0),
      currentStreak: a.integer().default(0),
      longestStreak: a.integer().default(0),
      streakFreezesAvailable: a.integer().default(1),
      lessonsCompleted: a.integer().default(0),
      quizzesPassed: a.integer().default(0),
      circuitsCreated: a.integer().default(0),
      totalTimeMinutes: a.integer().default(0),
      lastActiveAt: a.datetime(),
      joinedAt: a.datetime().required(),
      isVerified: a.boolean().default(false),
      isPremium: a.boolean().default(false),
      isBanned: a.boolean().default(false),
      premiumExpiresAt: a.datetime(),
      preferences: a.json(),
      notificationSettings: a.json(),
      privacySettings: a.json(),
    })
    .identifier(['userId'])
    .secondaryIndexes((index) => [
      index('username'),
      index('totalXp'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
      allow.guest().to(['read']),
    ]),

  Follow: a
    .model({
      followerId: a.id().required(),
      followingId: a.id().required(),
      createdAt: a.datetime().required(),
    })
    .identifier(['followerId', 'followingId'])
    .secondaryIndexes((index) => [
      index('followingId'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
    ]),

  LearningProgress: a
    .model({
      id: a.id().required(),
      lessonId: a.string().required(),
      trackId: a.string().required(),
      moduleId: a.string().required(),
      status: a.enum(['not_started', 'in_progress', 'completed']),
      progressPercent: a.float().default(0),
      quizScore: a.float(),
      quizAttempts: a.integer().default(0),
      bestQuizScore: a.float(),
      lastQuizAt: a.datetime(),
      timeSpentMinutes: a.integer().default(0),
      sessionsCount: a.integer().default(0),
      bookmarkedAt: a.datetime(),
      notes: a.string(),
      startedAt: a.datetime(),
      completedAt: a.datetime(),
      lastAccessedAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index('trackId'),
      index('lessonId'),
      index('moduleId'),
    ])
    .authorization((allow) => [allow.owner()]),

  TrackProgress: a
    .model({
      id: a.id().required(),
      trackId: a.string().required(),
      status: a.enum(['not_started', 'in_progress', 'completed']),
      progressPercent: a.float().default(0),
      modulesCompleted: a.integer().default(0),
      lessonsCompleted: a.integer().default(0),
      totalTimeMinutes: a.integer().default(0),
      startedAt: a.datetime(),
      completedAt: a.datetime(),
      certificateId: a.string(),
    })
    .secondaryIndexes((index) => [
      index('trackId'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
    ]),

  Achievement: a
    .model({
      id: a.id().required(),
      achievementId: a.string().required(),
      unlockedAt: a.datetime().required(),
      progress: a.integer().default(0),
      progressMax: a.integer(),
      isNotified: a.boolean().default(false),
    })
    .secondaryIndexes((index) => [
      index('achievementId'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
    ]),

  DailyChallenge: a
    .model({
      id: a.id().required(),
      date: a.date().required(),
      challengeType: a.enum(['lesson', 'quiz', 'circuit', 'streak']),
      challengeConfig: a.json().required(),
      isCompleted: a.boolean().default(false),
      completedAt: a.datetime(),
      xpEarned: a.integer().default(0),
      bonusMultiplier: a.float().default(1.0),
    })
    .secondaryIndexes((index) => [
      index('date'),
    ])
    .authorization((allow) => [allow.owner()]),

  XPTransaction: a
    .model({
      id: a.id().required(),
      amount: a.integer().required(),
      type: a.enum(['lesson', 'quiz', 'circuit', 'achievement', 'streak', 'daily_bonus', 'referral', 'admin']),
      source: a.string().required(),
      sourceId: a.string(),
      multiplier: a.float().default(1.0),
      description: a.string(),
      balanceBefore: a.integer(),
      balanceAfter: a.integer(),
      timestamp: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('type'),
    ])
    .authorization((allow) => [allow.owner()]),

  LeaderboardEntry: a
    .model({
      userId: a.id().required(),
      period: a.string().required(),
      xp: a.integer().required(),
      rank: a.integer(),
      previousRank: a.integer(),
      rankChange: a.integer(),
      lessonsCompleted: a.integer().default(0),
      quizzesPassed: a.integer().default(0),
      streakDays: a.integer().default(0),
      updatedAt: a.datetime().required(),
    })
    .identifier(['userId', 'period'])
    .authorization((allow) => [allow.authenticated()]),

  Circuit: a
    .model({
      id: a.id().required(),
      name: a.string().required(),
      description: a.string(),
      numQubits: a.integer().required(),
      gates: a.json().required(),
      measurements: a.json(),
      isPublic: a.boolean().default(false),
      isTemplate: a.boolean().default(false),
      isFeatured: a.boolean().default(false),
      views: a.integer().default(0),
      likes: a.integer().default(0),
      forks: a.integer().default(0),
      tags: a.string().array(),
      category: a.enum(['educational', 'algorithm', 'experiment', 'challenge', 'other']),
      difficulty: a.enum(['beginner', 'intermediate', 'advanced']),
      version: a.integer().default(1),
      parentCircuitId: a.string(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('category'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
      allow.guest().to(['read']),
    ]),

  CircuitLike: a
    .model({
      circuitId: a.id().required(),
      likedAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('circuitId'),
    ])
    .authorization((allow) => [allow.owner()]),

  SimulationRun: a
    .model({
      id: a.id().required(),
      circuitId: a.id().required(),
      shots: a.integer().required(),
      backend: a.enum(['simulator_small', 'simulator_medium', 'simulator_large', 'clifford', 'tensor_network', 'circuit_cutting', 'cloud', 'ibm', 'aws_braket']),
      optimization: a.integer().default(1),
      status: a.enum(['pending', 'running', 'completed', 'failed']),
      results: a.json(),
      counts: a.json(),
      stateVector: a.json(),
      executionTimeMs: a.float(),
      queueTimeMs: a.float(),
      errorMessage: a.string(),
      createdAt: a.datetime().required(),
      completedAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index('circuitId'),
    ])
    .authorization((allow) => [allow.owner()]),

  CodeSnippet: a
    .model({
      id: a.id().required(),
      name: a.string().required(),
      description: a.string(),
      language: a.enum(['qiskit', 'cirq', 'pennylane', 'openqasm', 'python']),
      code: a.string().required(),
      isPublic: a.boolean().default(false),
      isTemplate: a.boolean().default(false),
      views: a.integer().default(0),
      likes: a.integer().default(0),
      forks: a.integer().default(0),
      tags: a.string().array(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('language'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
    ]),

  Comment: a
    .model({
      id: a.id().required(),
      targetType: a.enum(['circuit', 'code_snippet', 'lesson', 'discussion']),
      targetId: a.string().required(),
      parentId: a.string(),
      content: a.string().required(),
      likes: a.integer().default(0),
      isEdited: a.boolean().default(false),
      isPinned: a.boolean().default(false),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('targetId'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
    ]),

  Discussion: a
    .model({
      id: a.id().required(),
      title: a.string().required(),
      content: a.string().required(),
      category: a.enum(['question', 'discussion', 'tutorial', 'showcase', 'bug_report', 'feature_request']),
      tags: a.string().array(),
      isResolved: a.boolean().default(false),
      isPinned: a.boolean().default(false),
      isLocked: a.boolean().default(false),
      views: a.integer().default(0),
      likes: a.integer().default(0),
      commentsCount: a.integer().default(0),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      lastActivityAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index('category'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read', 'create']),
    ]),

  Notification: a
    .model({
      id: a.id().required(),
      type: a.enum([
        'achievement_unlocked',
        'level_up',
        'streak_milestone',
        'new_follower',
        'circuit_liked',
        'comment_received',
        'mention',
        'system_announcement',
        'daily_reminder',
      ]),
      title: a.string().required(),
      body: a.string(),
      imageUrl: a.string(),
      actionUrl: a.string(),
      actionData: a.json(),
      isRead: a.boolean().default(false),
      readAt: a.datetime(),
      createdAt: a.datetime().required(),
      expiresAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),

  Certificate: a
    .model({
      id: a.id().required(),
      trackId: a.string().required(),
      trackName: a.string().required(),
      recipientName: a.string().required(),
      issuedAt: a.datetime().required(),
      expiresAt: a.datetime(),
      credentialId: a.string().required(),
      verificationUrl: a.string(),
      pdfKey: a.string(),
    })
    .secondaryIndexes((index) => [
      index('credentialId'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.guest().to(['read']),
    ]),

  Certification: a
    .model({
      id: a.id().required(),
      userId: a.id().required(),
      tier: a.enum(['associate', 'professional', 'expert']),
      name: a.string().required(),
      issuedAt: a.datetime().required(),
      expiresAt: a.datetime(),
      certificateUrl: a.string(),
      score: a.float().required(),
      trackId: a.string().required(),
      credentialId: a.string().required(),
      verificationUrl: a.string(),
      skills: a.string().array(),
      examAttemptId: a.string(),
      status: a.enum(['active', 'expired', 'revoked']),
    })
    .secondaryIndexes((index) => [
      index('userId'),
      index('trackId'),
      index('credentialId'),
      index('tier'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
      allow.guest().to(['read']),
    ]),

  Exam: a
    .model({
      id: a.id().required(),
      certificationTier: a.enum(['associate', 'professional', 'expert']),
      title: a.string().required(),
      description: a.string(),
      duration: a.integer().required(),
      passingScore: a.integer().required(),
      questions: a.json().required(),
      trackId: a.string().required(),
      totalQuestions: a.integer().required(),
      maxAttempts: a.integer().default(3),
      cooldownHours: a.integer().default(24),
      shuffleQuestions: a.boolean().default(true),
      shuffleOptions: a.boolean().default(true),
      showResults: a.boolean().default(true),
      showCorrectAnswers: a.boolean().default(false),
      prerequisites: a.string().array(),
      topics: a.string().array(),
      difficulty: a.enum(['beginner', 'intermediate', 'advanced', 'expert']),
      isPublished: a.boolean().default(false),
      totalAttempts: a.integer().default(0),
      passRate: a.float(),
      averageScore: a.float(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('certificationTier'),
      index('trackId'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.groups(['admin']).to(['create', 'update', 'delete']),
    ]),

  ExamAttempt: a
    .model({
      id: a.id().required(),
      userId: a.id().required(),
      examId: a.id().required(),
      startedAt: a.datetime().required(),
      completedAt: a.datetime(),
      score: a.float(),
      maxScore: a.float(),
      percentageScore: a.float(),
      passed: a.boolean(),
      answers: a.json(),
      breakdown: a.json(),
      topicScores: a.json(),
      timeSpentSeconds: a.integer(),
      status: a.enum(['in_progress', 'submitted', 'expired', 'cancelled']),
      sessionId: a.string(),
      certificationId: a.string(),
      attemptNumber: a.integer().default(1),
      ipAddress: a.string(),
      userAgent: a.string(),
    })
    .secondaryIndexes((index) => [
      index('userId'),
      index('examId'),
      index('status'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.groups(['admin']).to(['read']),
    ]),

  CertificationBadge: a
    .model({
      id: a.id().required(),
      certificationId: a.id().required(),
      badgeType: a.enum(['completion', 'excellence', 'speedrun', 'perfect_score', 'first_attempt', 'streak', 'mentor', 'contributor']),
      name: a.string().required(),
      description: a.string(),
      imageUrl: a.string(),
      metadata: a.json(),
      earnedAt: a.datetime().required(),
      isDisplayed: a.boolean().default(true),
      displayOrder: a.integer().default(0),
    })
    .secondaryIndexes((index) => [
      index('certificationId'),
      index('badgeType'),
    ])
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
    ]),

  Track: a
    .model({
      id: a.id().required(),
      name: a.string().required(),
      slug: a.string().required(),
      description: a.string(),
      icon: a.string(),
      color: a.string(),
      coverImage: a.string(),
      difficulty: a.enum(['beginner', 'intermediate', 'advanced']),
      estimatedHours: a.integer().default(0),
      modulesCount: a.integer().default(0),
      lessonsCount: a.integer().default(0),
      prerequisites: a.string().array(),
      learningOutcomes: a.string().array(),
      tags: a.string().array(),
      isPublished: a.boolean().default(false),
      isFeatured: a.boolean().default(false),
      order: a.integer().default(0),
      enrolledCount: a.integer().default(0),
      completedCount: a.integer().default(0),
      averageRating: a.float(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      publishedAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index('slug'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.guest().to(['read']),
      allow.groups(['admin']).to(['create', 'update', 'delete']),
    ]),

  Module: a
    .model({
      id: a.id().required(),
      trackId: a.string().required(),
      name: a.string().required(),
      slug: a.string().required(),
      description: a.string(),
      order: a.integer().default(0),
      lessonsCount: a.integer().default(0),
      estimatedMinutes: a.integer().default(0),
      isPublished: a.boolean().default(false),
      isLocked: a.boolean().default(false),
      unlockRequirements: a.json(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('trackId'),
      index('slug'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.guest().to(['read']),
      allow.groups(['admin']).to(['create', 'update', 'delete']),
    ]),

  Lesson: a
    .model({
      id: a.id().required(),
      moduleId: a.string().required(),
      trackId: a.string().required(),
      name: a.string().required(),
      slug: a.string().required(),
      description: a.string(),
      content: a.string(),
      contentKey: a.string(),
      videoUrl: a.string(),
      videoProvider: a.enum(['youtube', 'vimeo', 'cloudflare', 'self_hosted']),
      thumbnailUrl: a.string(),
      order: a.integer().default(0),
      estimatedMinutes: a.integer().default(10),
      difficulty: a.enum(['beginner', 'intermediate', 'advanced']),
      hasQuiz: a.boolean().default(false),
      hasExercise: a.boolean().default(false),
      hasSimulator: a.boolean().default(false),
      isPublished: a.boolean().default(false),
      isFree: a.boolean().default(true),
      viewsCount: a.integer().default(0),
      completionsCount: a.integer().default(0),
      averageTimeMinutes: a.float(),
      prerequisites: a.string().array(),
      relatedLessons: a.string().array(),
      resources: a.json(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      publishedAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index('moduleId'),
      index('trackId'),
      index('slug'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.guest().to(['read']),
      allow.groups(['admin']).to(['create', 'update', 'delete']),
    ]),

  Quiz: a
    .model({
      id: a.id().required(),
      lessonId: a.string().required(),
      questions: a.json().required(),
      passingScore: a.integer().default(70),
      timeLimit: a.integer(),
      maxAttempts: a.integer(),
      shuffleQuestions: a.boolean().default(true),
      shuffleOptions: a.boolean().default(true),
      showCorrectAnswers: a.boolean().default(true),
      totalAttempts: a.integer().default(0),
      averageScore: a.float(),
      passRate: a.float(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('lessonId'),
    ])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.groups(['admin']).to(['create', 'update', 'delete']),
    ]),

  AdminAuditLog: a
    .model({
      id: a.id().required(),
      adminId: a.string().required(),
      action: a.enum([
        'content_create',
        'content_update',
        'content_delete',
        'content_publish',
        'content_unpublish',
        'user_ban',
        'user_unban',
        'user_premium_grant',
        'user_premium_revoke',
        'settings_change',
      ]),
      targetType: a.string(),
      targetId: a.string(),
      targetName: a.string(),
      changes: a.json(),
      metadata: a.json(),
      ipAddress: a.string(),
      userAgent: a.string(),
      createdAt: a.datetime().required(),
    })
    .authorization((allow) => [
      allow.groups(['admin']),
    ]),

  VQEJob: a
    .model({
      id: a.id().required(),
      moleculeId: a.string().required(),
      moleculeName: a.string(),
      config: a.json().required(),
      status: a.enum(['pending', 'running', 'completed', 'failed']),
      progress: a.integer().default(0),
      currentIteration: a.integer(),
      currentEnergy: a.float(),
      result: a.json(),
      errorMessage: a.string(),
      executionTimeMs: a.integer(),
      createdAt: a.datetime().required(),
      completedAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index('moleculeId'),
      index('status'),
    ])
    .authorization((allow) => [allow.owner()]),

  ResearchPaper: a
    .model({
      id: a.id().required(),
      title: a.string().required(),
      authors: a.string().array().required(),
      abstract: a.string(),
      doi: a.string(),
      arxivId: a.string(),
      pdfKey: a.string().required(),
      fullTextKey: a.string(),
      pageCount: a.integer(),
      wordCount: a.integer(),
      keywords: a.string().array(),
      summary: a.string(),
      summaryBullets: a.string().array(),
      quantumAlgorithms: a.string().array(),
      hamiltonians: a.string().array(),
      circuitDescriptions: a.string().array(),
      collectionIds: a.string().array(),
      tags: a.string().array(),
      rating: a.integer(),
      readStatus: a.enum(['unread', 'reading', 'read']),
      processingStatus: a.enum(['pending', 'processing', 'completed', 'failed']),
      processingError: a.string(),
      publishedDate: a.string(),
      journal: a.string(),
      venue: a.string(),
      citationCount: a.integer(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('doi'),
      index('arxivId'),
      index('processingStatus'),
    ])
    .authorization((allow) => [allow.owner()]),

  PaperCollection: a
    .model({
      id: a.id().required(),
      name: a.string().required(),
      description: a.string(),
      color: a.string().required(),
      icon: a.string().required(),
      paperCount: a.integer().default(0),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
    })
    .authorization((allow) => [allow.owner()]),

  SearchIndex: a
    .model({
      id: a.id().required(),
      indexType: a.enum(['bm25', 'tfidf', 'combined']),
      documentCount: a.integer().default(0),
      vocabularySize: a.integer().default(0),
      indexKey: a.string().required(),
      lastUpdated: a.datetime(),
      createdAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('indexType'),
    ])
    .authorization((allow) => [allow.owner()]),

  PaperCitation: a
    .model({
      id: a.id().required(),
      sourcePaperId: a.string().required(),
      targetDoi: a.string(),
      targetTitle: a.string().required(),
      targetAuthors: a.string().array(),
      citationContext: a.string(),
      citationPosition: a.integer(),
      createdAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('sourcePaperId'),
      index('targetDoi'),
    ])
    .authorization((allow) => [allow.owner()]),

  aiTutor: a
    .mutation()
    .arguments({
      action: a.enum(['chat', 'explain_concept', 'quiz_hint', 'analyze_circuit', 'explain_code']),
      message: a.string(),
      conversationHistory: a.json(),
      useRag: a.boolean(),
      ragOptions: a.json(),
      context: a.json(),
      conceptArgs: a.json(),
      quizArgs: a.json(),
      circuitArgs: a.json(),
      codeArgs: a.json(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(aiTutor)),

  runSimulatorSmall: a
    .mutation()
    .arguments({
      circuitId: a.string(),
      numQubits: a.integer().required(),
      gates: a.json().required(),
      shots: a.integer(),
      seed: a.integer(),
      measureQubits: a.integer().array(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(simulatorSmall)),

  runSimulatorMedium: a
    .mutation()
    .arguments({
      circuitId: a.string(),
      numQubits: a.integer().required(),
      gates: a.json().required(),
      shots: a.integer(),
      seed: a.integer(),
      measureQubits: a.integer().array(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(simulatorMedium)),

  runSimulatorLarge: a
    .mutation()
    .arguments({
      circuitId: a.string(),
      numQubits: a.integer().required(),
      gates: a.json().required(),
      shots: a.integer(),
      seed: a.integer(),
      measureQubits: a.integer().array(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(simulatorLarge)),

  runVqeSmall: a
    .mutation()
    .arguments({
      moleculeId: a.string().required(),
      moleculeName: a.string(),
      numQubits: a.integer().required(),
      numElectrons: a.integer().required(),
      hamiltonian: a.json(),
      basisSet: a.enum(['sto_3g', 'basis_6_31g', 'cc_pvdz']),
      qubitMapping: a.enum(['jordan_wigner', 'bravyi_kitaev', 'parity']),
      ansatzType: a.enum(['hea', 'uccsd', 'k_upccgsd', 'symmetry_preserved']),
      ansatzLayers: a.integer(),
      entanglement: a.enum(['linear', 'circular', 'full', 'pairwise', 'sca']),
      optimizerType: a.enum(['cobyla', 'nelder_mead', 'powell', 'adam', 'sgd', 'lbfgsb', 'slsqp', 'spsa', 'qn_spsa', 'qng', 'rotosolve']),
      maxIterations: a.integer(),
      tolerance: a.float(),
      learningRate: a.float(),
      zneEnabled: a.boolean(),
      zneScaleFactors: a.float().array(),
      readoutMitigationEnabled: a.boolean(),
      symmetryEnabled: a.boolean(),
      shots: a.integer(),
      useCache: a.boolean(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(vqeSmall)),

  runVqeMedium: a
    .mutation()
    .arguments({
      moleculeId: a.string().required(),
      moleculeName: a.string(),
      numQubits: a.integer().required(),
      numElectrons: a.integer().required(),
      hamiltonian: a.json(),
      basisSet: a.enum(['sto_3g', 'basis_6_31g', 'cc_pvdz']),
      qubitMapping: a.enum(['jordan_wigner', 'bravyi_kitaev', 'parity']),
      ansatzType: a.enum(['hea', 'uccsd', 'k_upccgsd', 'symmetry_preserved']),
      ansatzLayers: a.integer(),
      entanglement: a.enum(['linear', 'circular', 'full', 'pairwise', 'sca']),
      optimizerType: a.enum(['cobyla', 'nelder_mead', 'powell', 'adam', 'sgd', 'lbfgsb', 'slsqp', 'spsa', 'qn_spsa', 'qng', 'rotosolve']),
      maxIterations: a.integer(),
      tolerance: a.float(),
      learningRate: a.float(),
      zneEnabled: a.boolean(),
      zneScaleFactors: a.float().array(),
      readoutMitigationEnabled: a.boolean(),
      symmetryEnabled: a.boolean(),
      shots: a.integer(),
      useCache: a.boolean(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(vqeMedium)),

  runVqeLarge: a
    .mutation()
    .arguments({
      moleculeId: a.string().required(),
      moleculeName: a.string(),
      numQubits: a.integer().required(),
      numElectrons: a.integer().required(),
      hamiltonian: a.json(),
      basisSet: a.enum(['sto_3g', 'basis_6_31g', 'cc_pvdz']),
      qubitMapping: a.enum(['jordan_wigner', 'bravyi_kitaev', 'parity']),
      ansatzType: a.enum(['hea', 'uccsd', 'k_upccgsd', 'symmetry_preserved']),
      ansatzLayers: a.integer(),
      entanglement: a.enum(['linear', 'circular', 'full', 'pairwise', 'sca']),
      optimizerType: a.enum(['cobyla', 'nelder_mead', 'powell', 'adam', 'sgd', 'lbfgsb', 'slsqp', 'spsa', 'qn_spsa', 'qng', 'rotosolve']),
      maxIterations: a.integer(),
      tolerance: a.float(),
      learningRate: a.float(),
      zneEnabled: a.boolean(),
      zneScaleFactors: a.float().array(),
      readoutMitigationEnabled: a.boolean(),
      symmetryEnabled: a.boolean(),
      shots: a.integer(),
      useCache: a.boolean(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(vqeLarge)),

  runVqeAdapt: a
    .mutation()
    .arguments({
      moleculeId: a.string().required(),
      moleculeName: a.string(),
      numQubits: a.integer().required(),
      numElectrons: a.integer().required(),
      hamiltonian: a.json(),
      basisSet: a.enum(['sto_3g', 'basis_6_31g', 'cc_pvdz']),
      qubitMapping: a.enum(['jordan_wigner', 'bravyi_kitaev', 'parity']),
      ansatzType: a.enum(['adapt', 'qubit_adapt']),
      gradientThreshold: a.float(),
      maxOperators: a.integer(),
      optimizerType: a.enum(['cobyla', 'nelder_mead', 'powell', 'adam', 'sgd', 'lbfgsb', 'slsqp', 'spsa', 'qn_spsa', 'qng', 'rotosolve']),
      maxIterations: a.integer(),
      tolerance: a.float(),
      learningRate: a.float(),
      shots: a.integer(),
      useCache: a.boolean(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(vqeAdapt)),

  ragQuery: a
    .mutation()
    .arguments({
      query: a.string().required(),
      trackIds: a.string().array(),
      difficulty: a.string().array(),
      tags: a.string().array(),
      topK: a.integer(),
      includeContext: a.boolean(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(ragQuery)),

  ragIndex: a
    .mutation()
    .arguments({
      mode: a.enum(['full', 'incremental', 'single']),
      trackId: a.string(),
      moduleId: a.string(),
      lessonId: a.string(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.groups(['admin'])])
    .handler(a.handler.function(ragIndexer)),

  processPaper: a
    .mutation()
    .arguments({
      paperId: a.string().required(),
      pdfKey: a.string().required(),
      options: a.json(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(paperProcessor)),

  searchPapers: a
    .mutation()
    .arguments({
      query: a.string().required(),
      filters: a.json(),
      sortBy: a.enum(['relevance', 'date', 'citations', 'title']),
      sortOrder: a.enum(['asc', 'desc']),
      limit: a.integer(),
      offset: a.integer(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(paperSearch)),

  summarizePaper: a
    .mutation()
    .arguments({
      paperId: a.string().required(),
      fullTextKey: a.string().required(),
      options: a.json(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(paperSummarizer)),

  extractInsights: a
    .mutation()
    .arguments({
      paperId: a.string().required(),
      fullTextKey: a.string().required(),
      extractKeywords: a.boolean(),
      extractQuantum: a.boolean(),
      extractCitations: a.boolean(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(paperInsights)),

  runQml: a
    .mutation()
    .arguments({
      algorithm: a.string().required(),
      numQubits: a.integer().required(),
      datasetId: a.string(),
      customData: a.json(),
      trainTestSplit: a.float(),
      encoderType: a.string(),
      encoderConfig: a.json(),
      ansatzType: a.string(),
      ansatzConfig: a.json(),
      optimizerType: a.string(),
      optimizerConfig: a.json(),
      kernelType: a.string(),
      kernelConfig: a.json(),
      qaoaConfig: a.json(),
      qrlConfig: a.json(),
      qtransformerConfig: a.json(),
      qgnnConfig: a.json(),
      qreservoirConfig: a.json(),
      qautoencoderConfig: a.json(),
      qvaeConfig: a.json(),
      analysisOptions: a.json(),
      shots: a.integer(),
      seed: a.integer(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(qmlEngine)),

  examProctor: a
    .mutation()
    .arguments({
      action: a.enum(['start_exam', 'submit_exam', 'get_session', 'cancel_session']),
      startExamInput: a.json(),
      submitExamInput: a.json(),
      sessionId: a.string(),
      userId: a.string(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(examProctoring)),

  generateCertificate: a
    .mutation()
    .arguments({
      action: a.enum(['generate', 'verify', 'download']),
      certificateData: a.json(),
      certificationId: a.string(),
      credentialId: a.string(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(certificateGenerator)),

  simulateHardware: a
    .mutation()
    .arguments({
      action: a.enum(['t1_measurement', 't2_measurement', 'randomized_benchmarking', 'full_characterization', 'gate_calibration']),
      numQubits: a.integer(),
      qubitIds: a.integer().array(),
      gateTypes: a.string().array(),
      config: a.json(),
      seed: a.integer(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(hardwareSimulator)),
})
  .authorization((allow) => [
    allow.resource(postConfirmation),
    allow.resource(vqeSmall),
    allow.resource(vqeMedium),
    allow.resource(vqeLarge),
    allow.resource(vqeAdapt),
    allow.resource(simulatorSmall),
    allow.resource(simulatorMedium),
    allow.resource(simulatorLarge),
    allow.resource(ragIndexer),
    allow.resource(ragQuery),
    allow.resource(aiTutor),
    allow.resource(paperProcessor),
    allow.resource(paperSearch),
    allow.resource(paperSummarizer),
    allow.resource(paperInsights),
    allow.resource(qmlEngine),
    allow.resource(examProctoring),
    allow.resource(certificateGenerator),
    allow.resource(hardwareSimulator),
  ])

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
})
