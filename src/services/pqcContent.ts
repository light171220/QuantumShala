const CDN_URL = 'https://d1q95cjsvt50nj.cloudfront.net'
const PQC_BASE_PATH = 'content/pqc'
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

async function fetchPQCContent<T>(path: string): Promise<T | null> {
  const cacheKey = `pqc:${path}`
  const cached = getCached<T>(cacheKey)
  if (cached) return cached

  const fullPath = `${PQC_BASE_PATH}/${path}`
  const url = `${CDN_URL}/${fullPath}`

  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const text = await response.text()
    const data = JSON.parse(text) as T
    setCache(cacheKey, data)
    return data
  } catch {
    return null
  }
}

export interface ContentSummary {
  id: string
  title: string
  description: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  estimatedMinutes?: number
  file: string
  points?: number
}

export interface AlgorithmSummary {
  id: string
  name: string
  standard: string
  type: 'kem' | 'dsa'
  description: string
  securityLevels: number[]
}

export interface ChallengeSummary {
  id: string
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  points: number
  prerequisites?: string[]
}

export interface CaseStudySummary {
  id: string
  title: string
  organization: string
  description: string
  tags: string[]
  file: string
}

export interface PQCIndex {
  tutorials: ContentSummary[]
  guides: ContentSummary[]
  algorithms: AlgorithmSummary[]
  challenges: ChallengeSummary[]
  caseStudies: CaseStudySummary[]
  standards: ContentSummary[]
}

export interface ContentSection {
  id: string
  title: string
  content: string
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

export interface TutorialExercise {
  id: string
  title: string
  instructions: string
  hints: string[]
  solution?: string
}

export interface GuideContent {
  id: string
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  sections: ContentSection[]
}

export interface ChallengeContent {
  id: string
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  points: number
  objectives: string[]
  steps: ChallengeStep[]
  hints: string[]
  verification: ChallengeVerification
}

export interface ChallengeStep {
  id: string
  title: string
  description: string
  action: 'keygen' | 'encaps' | 'decaps' | 'sign' | 'verify' | 'compare'
  algorithm?: string
  expectedResult?: string
}

export interface ChallengeVerification {
  type: 'auto' | 'manual'
  criteria: string[]
}

const DEFAULT_INDEX: PQCIndex = {
  tutorials: [
    { id: 'intro-lattice', title: 'Introduction to Lattice Cryptography', description: 'Learn the mathematical foundations of lattice-based cryptography', difficulty: 'beginner', estimatedMinutes: 30, file: 'tutorials/intro-lattice.json' },
    { id: 'understanding-mlkem', title: 'Understanding ML-KEM', description: 'Deep dive into the Module Lattice Key Encapsulation Mechanism', difficulty: 'intermediate', estimatedMinutes: 45, file: 'tutorials/mlkem.json' },
    { id: 'mldsa-deep-dive', title: 'ML-DSA Deep Dive', description: 'Explore the Dilithium digital signature algorithm', difficulty: 'intermediate', estimatedMinutes: 45, file: 'tutorials/mldsa.json' },
    { id: 'hash-based-sigs', title: 'Hash-Based Signatures (SLH-DSA)', description: 'Learn about stateless hash-based signatures', difficulty: 'advanced', estimatedMinutes: 60, file: 'tutorials/slhdsa.json' },
    { id: 'migration-strategies', title: 'PQC Migration Strategies', description: 'Best practices for transitioning to quantum-safe cryptography', difficulty: 'intermediate', estimatedMinutes: 40, file: 'tutorials/migration.json' }
  ],
  guides: [
    { id: 'choosing-algorithm', title: 'Choosing the Right Algorithm', description: 'Decision guide for selecting PQC algorithms', difficulty: 'beginner', file: 'guides/choosing.json' },
    { id: 'security-levels', title: 'Security Level Comparison', description: 'Understanding NIST security levels', difficulty: 'beginner', file: 'guides/security-levels.json' },
    { id: 'implementation-best-practices', title: 'Implementation Best Practices', description: 'Guidelines for secure PQC implementation', difficulty: 'intermediate', file: 'guides/best-practices.json' },
    { id: 'hybrid-mode', title: 'Hybrid Classical + PQC Mode', description: 'Combining classical and post-quantum algorithms', difficulty: 'intermediate', file: 'guides/hybrid.json' }
  ],
  algorithms: [
    { id: 'ml-kem', name: 'ML-KEM (Kyber)', standard: 'FIPS 203', type: 'kem', description: 'Module Lattice-based Key Encapsulation', securityLevels: [1, 3, 5] },
    { id: 'ml-dsa', name: 'ML-DSA (Dilithium)', standard: 'FIPS 204', type: 'dsa', description: 'Module Lattice-based Digital Signatures', securityLevels: [2, 3, 5] },
    { id: 'slh-dsa', name: 'SLH-DSA (SPHINCS+)', standard: 'FIPS 205', type: 'dsa', description: 'Stateless Hash-based Digital Signatures', securityLevels: [1, 3, 5] }
  ],
  challenges: [
    { id: 'first-keypair', title: 'Generate Your First Key Pair', description: 'Create an ML-KEM key pair', difficulty: 'beginner', points: 10 },
    { id: 'secure-exchange', title: 'Secure Message Exchange', description: 'Use ML-KEM for key encapsulation', difficulty: 'beginner', points: 25 },
    { id: 'sign-verify', title: 'Sign and Verify', description: 'Create and verify an ML-DSA signature', difficulty: 'beginner', points: 25 },
    { id: 'break-rsa', title: 'Break RSA with Shor', description: 'Simulate Shor\'s algorithm attack', difficulty: 'intermediate', points: 50 },
    { id: 'hybrid-challenge', title: 'Hybrid Mode Challenge', description: 'Implement hybrid classical + PQC exchange', difficulty: 'advanced', points: 100 },
    { id: 'hash-based-sig', title: 'Hash-Based Signature', description: 'Create an SLH-DSA signature', difficulty: 'intermediate', points: 40 },
    { id: 'benchmark-all', title: 'Performance Analysis', description: 'Benchmark all algorithm variants', difficulty: 'intermediate', points: 35 }
  ],
  caseStudies: [
    { id: 'google-cecpq2', title: 'Google\'s CECPQ2 Experiment', organization: 'Google', description: 'Early hybrid PQC deployment in Chrome', tags: ['hybrid', 'tls', 'production'], file: 'cases/google-cecpq2.json' },
    { id: 'cloudflare-pqc', title: 'Cloudflare\'s PQC Deployment', organization: 'Cloudflare', description: 'Production-scale post-quantum TLS', tags: ['cdn', 'tls', 'production'], file: 'cases/cloudflare.json' },
    { id: 'signal-pqxdh', title: 'Signal\'s PQXDH Protocol', organization: 'Signal', description: 'Quantum-resistant key agreement for messaging', tags: ['messaging', 'e2ee', 'hybrid'], file: 'cases/signal-pqxdh.json' },
    { id: 'nist-timeline', title: 'NIST PQC Competition Timeline', organization: 'NIST', description: 'History of the standardization process', tags: ['standards', 'history'], file: 'cases/nist-timeline.json' }
  ],
  standards: [
    { id: 'fips-203', title: 'FIPS 203: ML-KEM', description: 'Module-Lattice-Based Key-Encapsulation Mechanism Standard', file: 'standards/fips-203.json' },
    { id: 'fips-204', title: 'FIPS 204: ML-DSA', description: 'Module-Lattice-Based Digital Signature Standard', file: 'standards/fips-204.json' },
    { id: 'fips-205', title: 'FIPS 205: SLH-DSA', description: 'Stateless Hash-Based Digital Signature Standard', file: 'standards/fips-205.json' }
  ]
}

const DEFAULT_TUTORIALS: Record<string, TutorialContent> = {
  'intro-lattice': {
    id: 'intro-lattice',
    title: 'Introduction to Lattice Cryptography',
    description: 'Learn the mathematical foundations of lattice-based cryptography',
    difficulty: 'beginner',
    estimatedMinutes: 30,
    prerequisites: [],
    learningObjectives: [
      'Understand what a mathematical lattice is',
      'Learn about the Shortest Vector Problem (SVP)',
      'Understand the Learning With Errors (LWE) problem',
      'See how these problems enable quantum-resistant cryptography'
    ],
    sections: [
      {
        id: 'what-is-lattice',
        title: 'What is a Lattice?',
        content: 'A lattice is a regular arrangement of points in n-dimensional space. Imagine an infinite grid of points that extends in all directions. Each point can be reached by taking integer combinations of a set of "basis vectors".\n\nFormally, given basis vectors b₁, b₂, ..., bₙ, a lattice L is the set of all points of the form:\n\nv = a₁b₁ + a₂b₂ + ... + aₙbₙ\n\nwhere a₁, a₂, ..., aₙ are integers.'
      },
      {
        id: 'svp',
        title: 'The Shortest Vector Problem',
        content: 'The Shortest Vector Problem (SVP) asks: given a lattice, find the shortest non-zero vector in it.\n\nThis sounds simple, but it becomes extremely hard in high dimensions. While we can easily find short vectors in 2D or 3D, in dimensions like 256 or 512 (used in cryptography), the best known algorithms take exponential time.\n\nEven quantum computers cannot solve SVP efficiently - this is why lattice cryptography is quantum-resistant!'
      },
      {
        id: 'lwe',
        title: 'Learning With Errors (LWE)',
        content: 'The Learning With Errors problem is the foundation of ML-KEM and ML-DSA.\n\nThe idea: given a secret vector s, we create "noisy" equations of the form:\n\nb = As + e\n\nwhere A is a public matrix and e is a small "error" vector.\n\nThe LWE assumption says: given many such equations, it\'s hard to recover s. The small errors make the problem intractable, even for quantum computers.\n\nML-KEM uses this to encrypt messages, and ML-DSA uses it for signatures.'
      },
      {
        id: 'why-quantum-safe',
        title: 'Why is This Quantum-Safe?',
        content: 'Classical cryptography (RSA, ECC) relies on integer factoring and discrete logarithms. Shor\'s algorithm can solve these in polynomial time on a quantum computer.\n\nLattice problems like SVP and LWE have no known efficient quantum algorithms. The best quantum attacks still require exponential time.\n\nThis makes lattices one of the most promising foundations for post-quantum cryptography, which is why NIST chose lattice-based algorithms (ML-KEM, ML-DSA) as the primary standards.'
      }
    ],
    exercises: [
      {
        id: 'visualize-lattice',
        title: 'Visualize a Lattice',
        instructions: 'Use the Lattice Visualizer to explore different lattice bases. Try randomizing the basis and observe how the shortest vector changes.',
        hints: ['Click "New Basis" to generate a random lattice', 'The orange dot marks the shortest vector', 'Try to find a basis where the shortest vector is hard to spot']
      },
      {
        id: 'understand-lwe',
        title: 'Understand LWE Errors',
        instructions: 'Enable "Show LWE Error" in the visualizer. Observe how adding small errors to lattice points makes it hard to determine which lattice point was originally used.',
        hints: ['The red dot shows a point plus error', 'Notice how the error could have come from multiple nearby lattice points', 'This ambiguity is what makes LWE hard']
      }
    ]
  },
  'understanding-mlkem': {
    id: 'understanding-mlkem',
    title: 'Understanding ML-KEM',
    description: 'Deep dive into the Module Lattice Key Encapsulation Mechanism',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    prerequisites: ['intro-lattice'],
    learningObjectives: [
      'Understand Key Encapsulation Mechanisms (KEMs)',
      'Learn the ML-KEM key generation process',
      'Understand encapsulation and decapsulation',
      'Compare ML-KEM variants and their security levels'
    ],
    sections: [
      {
        id: 'what-is-kem',
        title: 'What is a KEM?',
        content: 'A Key Encapsulation Mechanism (KEM) is a way to establish a shared secret between two parties. Unlike traditional public-key encryption, a KEM generates a random shared secret rather than encrypting arbitrary messages.\n\nML-KEM provides three operations:\n- KeyGen: Generate public/secret key pair\n- Encaps: Use public key to create ciphertext and shared secret\n- Decaps: Use secret key to recover shared secret from ciphertext\n\nThe shared secret can then be used with symmetric encryption (like AES) to encrypt actual messages.'
      },
      {
        id: 'keygen',
        title: 'Key Generation',
        content: 'ML-KEM key generation works as follows:\n\n1. Generate random seed d\n2. Expand d using SHA3-512 to get (ρ, σ)\n3. Use ρ to generate a random matrix A\n4. Sample secret vector s and error vector e from a centered binomial distribution\n5. Compute public key: t = As + e\n6. Public key = (t, ρ)\n7. Secret key = (s, public key, hash of public key, implicit rejection seed)\n\nThe security relies on the fact that recovering s from t (which equals As + e) is as hard as solving LWE.'
      },
      {
        id: 'encaps-decaps',
        title: 'Encapsulation and Decapsulation',
        content: 'Encapsulation (sender):\n1. Generate random message m\n2. Derive randomness from m and public key hash\n3. Encrypt m using LWE: u = Aᵀr + e₁, v = tᵀr + e₂ + encode(m)\n4. Ciphertext = (compress(u), compress(v))\n5. Shared secret = KDF(K || H(ciphertext))\n\nDecapsulation (receiver):\n1. Decrypt: m\' = decode(v - sᵀu)\n2. Re-encrypt m\' and compare ciphertexts\n3. If match: return shared secret\n4. If mismatch: return implicit rejection (prevents attacks)'
      },
      {
        id: 'variants',
        title: 'ML-KEM Variants',
        content: 'ML-KEM comes in three variants:\n\nML-KEM-512 (NIST Level 1):\n- Public key: 800 bytes\n- Secret key: 1,632 bytes\n- Ciphertext: 768 bytes\n- Security: ~128 bits (AES-128 equivalent)\n\nML-KEM-768 (NIST Level 3):\n- Public key: 1,184 bytes\n- Secret key: 2,400 bytes\n- Ciphertext: 1,088 bytes\n- Security: ~192 bits (AES-192 equivalent)\n\nML-KEM-1024 (NIST Level 5):\n- Public key: 1,568 bytes\n- Secret key: 3,168 bytes\n- Ciphertext: 1,568 bytes\n- Security: ~256 bits (AES-256 equivalent)'
      }
    ]
  }
}

const DEFAULT_CHALLENGES: Record<string, ChallengeContent> = {
  'first-keypair': {
    id: 'first-keypair',
    title: 'Generate Your First Key Pair',
    description: 'Create your first post-quantum cryptographic key pair',
    difficulty: 'beginner',
    points: 10,
    objectives: [
      'Understand what a key pair is',
      'Generate an ML-KEM key pair',
      'Observe the key sizes'
    ],
    steps: [
      { id: 'select', title: 'Select Algorithm', description: 'Choose ML-KEM-768 from the algorithm selector', action: 'keygen', algorithm: 'ml-kem-768' },
      { id: 'generate', title: 'Generate Keys', description: 'Click "Generate Keys" to create a new key pair', action: 'keygen' },
      { id: 'observe', title: 'Observe Results', description: 'Note the public key size (1,184 bytes) and secret key size (2,400 bytes)', action: 'compare' }
    ],
    hints: [
      'The public key can be shared with anyone',
      'The secret key must be kept private',
      'Post-quantum keys are larger than classical keys'
    ],
    verification: {
      type: 'auto',
      criteria: ['Key pair generated', 'Public key size verified', 'Secret key size verified']
    }
  },
  'secure-exchange': {
    id: 'secure-exchange',
    title: 'Secure Message Exchange',
    description: 'Use ML-KEM for quantum-safe key encapsulation',
    difficulty: 'beginner',
    points: 25,
    objectives: [
      'Perform key encapsulation',
      'Understand shared secrets',
      'Verify decapsulation works'
    ],
    steps: [
      { id: 'keygen', title: 'Generate Keys', description: 'Generate an ML-KEM key pair', action: 'keygen', algorithm: 'ml-kem-768' },
      { id: 'encaps', title: 'Encapsulate', description: 'Click "Encapsulate" to create a ciphertext and shared secret', action: 'encaps' },
      { id: 'decaps', title: 'Decapsulate', description: 'Click "Decapsulate" to recover the shared secret', action: 'decaps' },
      { id: 'verify', title: 'Verify', description: 'Confirm both parties have the same shared secret', action: 'verify' }
    ],
    hints: [
      'The ciphertext is what gets sent over the network',
      'The shared secret is derived, not transmitted',
      'Both parties end up with the same 32-byte secret'
    ],
    verification: {
      type: 'auto',
      criteria: ['Encapsulation performed', 'Decapsulation performed', 'Shared secrets match']
    }
  },
  'sign-verify': {
    id: 'sign-verify',
    title: 'Sign and Verify',
    description: 'Create and verify a quantum-safe digital signature',
    difficulty: 'beginner',
    points: 25,
    objectives: [
      'Create an ML-DSA signature',
      'Understand message binding',
      'Verify the signature'
    ],
    steps: [
      { id: 'select', title: 'Select ML-DSA', description: 'Choose ML-DSA-65 from the algorithm selector', action: 'keygen', algorithm: 'ml-dsa-65' },
      { id: 'keygen', title: 'Generate Keys', description: 'Generate an ML-DSA key pair', action: 'keygen' },
      { id: 'message', title: 'Enter Message', description: 'Type a message to sign', action: 'sign' },
      { id: 'sign', title: 'Sign', description: 'Click "Sign" to create a digital signature', action: 'sign' },
      { id: 'verify', title: 'Verify', description: 'Click "Verify" to check the signature', action: 'verify' }
    ],
    hints: [
      'Signatures prove the message came from the key holder',
      'Modifying the message will cause verification to fail',
      'ML-DSA signatures are larger than classical signatures'
    ],
    verification: {
      type: 'auto',
      criteria: ['Signature created', 'Verification successful']
    }
  }
}

export async function getPQCIndex(): Promise<PQCIndex> {
  const fetched = await fetchPQCContent<PQCIndex>('index.json')
  return fetched || DEFAULT_INDEX
}

export async function getPQCTutorial(tutorialId: string): Promise<TutorialContent | null> {
  const index = await getPQCIndex()
  const tutorial = index.tutorials.find(t => t.id === tutorialId)
  if (!tutorial) return DEFAULT_TUTORIALS[tutorialId] || null
  const fetched = await fetchPQCContent<TutorialContent>(tutorial.file)
  return fetched || DEFAULT_TUTORIALS[tutorialId] || null
}

export async function getPQCGuide(guideId: string): Promise<GuideContent | null> {
  const index = await getPQCIndex()
  const guide = index.guides.find(g => g.id === guideId)
  if (!guide) return null
  return fetchPQCContent<GuideContent>(guide.file)
}

export async function getPQCChallenge(challengeId: string): Promise<ChallengeContent | null> {
  const defaultChallenge = DEFAULT_CHALLENGES[challengeId]
  if (defaultChallenge) return defaultChallenge
  return null
}

export async function getAllTutorials(): Promise<ContentSummary[]> {
  const index = await getPQCIndex()
  return index.tutorials
}

export async function getAllGuides(): Promise<ContentSummary[]> {
  const index = await getPQCIndex()
  return index.guides
}

export async function getAllChallenges(): Promise<ChallengeSummary[]> {
  const index = await getPQCIndex()
  return index.challenges
}

export async function getAllCaseStudies(): Promise<CaseStudySummary[]> {
  const index = await getPQCIndex()
  return index.caseStudies
}

export async function getAllAlgorithms(): Promise<AlgorithmSummary[]> {
  const index = await getPQCIndex()
  return index.algorithms
}

export async function getAllStandards(): Promise<ContentSummary[]> {
  const index = await getPQCIndex()
  return index.standards
}

export function clearPQCCache(): void {
  for (const key of cache.keys()) {
    if (key.startsWith('pqc:')) {
      cache.delete(key)
    }
  }
}
