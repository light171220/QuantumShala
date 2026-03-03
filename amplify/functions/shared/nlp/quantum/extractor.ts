export interface QuantumAlgorithm {
  name: string
  type: 'variational' | 'gate-based' | 'adiabatic' | 'annealing' | 'error-correction' | 'other'
  context: string
  position: number
}

export interface HamiltonianReference {
  type: string
  description: string
  formula?: string
  context: string
}

export interface CircuitDescription {
  description: string
  numQubits?: number
  gates?: string[]
  depth?: number
  context: string
}

export interface QuantumMetric {
  name: string
  value?: string
  context: string
}

export interface QuantumInsights {
  isQuantumRelated: boolean
  algorithms: QuantumAlgorithm[]
  hamiltonians: HamiltonianReference[]
  circuits: CircuitDescription[]
  gates: string[]
  metrics: QuantumMetric[]
  quantumTermDensity: number
  primaryFocus: string | null
}

const ALGORITHM_PATTERNS: Array<{
  pattern: RegExp
  name: string
  type: QuantumAlgorithm['type']
}> = [
  { pattern: /\b(VQE|variational\s+quantum\s+eigensolver)\b/gi, name: 'VQE', type: 'variational' },
  { pattern: /\bQAOA\b/gi, name: 'QAOA', type: 'variational' },
  { pattern: /\b(VQC|variational\s+quantum\s+classifier)\b/gi, name: 'VQC', type: 'variational' },
  { pattern: /\b(QNN|quantum\s+neural\s+network)/gi, name: 'Quantum Neural Network', type: 'variational' },
  { pattern: /\bADAP?T[- ]?VQE\b/gi, name: 'ADAPT-VQE', type: 'variational' },
  { pattern: /\bUCCSD?\b/gi, name: 'UCCSD', type: 'variational' },
  { pattern: /\bGrover['']?s?\s+(algorithm|search)\b/gi, name: 'Grover\'s Algorithm', type: 'gate-based' },
  { pattern: /\bShor['']?s?\s+(algorithm|factoring)\b/gi, name: 'Shor\'s Algorithm', type: 'gate-based' },
  { pattern: /\b(QFT|quantum\s+Fourier\s+transform)\b/gi, name: 'Quantum Fourier Transform', type: 'gate-based' },
  { pattern: /\b(QPE|quantum\s+phase\s+estimation)\b/gi, name: 'Quantum Phase Estimation', type: 'gate-based' },
  { pattern: /\bHHL\s+algorithm\b/gi, name: 'HHL Algorithm', type: 'gate-based' },
  { pattern: /\bBernstein[- ]?Vazirani\b/gi, name: 'Bernstein-Vazirani', type: 'gate-based' },
  { pattern: /\bDeutsch[- ]?Jozsa\b/gi, name: 'Deutsch-Jozsa', type: 'gate-based' },
  { pattern: /\bSimon['']?s?\s+algorithm\b/gi, name: 'Simon\'s Algorithm', type: 'gate-based' },
  { pattern: /\bquantum\s+annealing\b/gi, name: 'Quantum Annealing', type: 'annealing' },
  { pattern: /\badiabatic\s+quantum\s+computation\b/gi, name: 'Adiabatic Quantum Computation', type: 'adiabatic' },
  { pattern: /\bAQC\b/gi, name: 'Adiabatic Quantum Computation', type: 'adiabatic' },
  { pattern: /\b(surface\s+code|toric\s+code)\b/gi, name: 'Surface Code', type: 'error-correction' },
  { pattern: /\bSteane\s+code\b/gi, name: 'Steane Code', type: 'error-correction' },
  { pattern: /\bShor\s+code\b/gi, name: 'Shor Code', type: 'error-correction' },
  { pattern: /\b(QECC|quantum\s+error\s+correction)\b/gi, name: 'Quantum Error Correction', type: 'error-correction' },
  { pattern: /\bmagic\s+state\s+distillation\b/gi, name: 'Magic State Distillation', type: 'error-correction' },
  { pattern: /\bquantum\s+walk\b/gi, name: 'Quantum Walk', type: 'other' },
  { pattern: /\bquantum\s+simulation\b/gi, name: 'Quantum Simulation', type: 'other' },
  { pattern: /\bquantum\s+machine\s+learning\b/gi, name: 'Quantum Machine Learning', type: 'other' },
  { pattern: /\bQML\b/gi, name: 'Quantum Machine Learning', type: 'other' },
]

const HAMILTONIAN_PATTERNS: Array<{
  pattern: RegExp
  type: string
  description: string
}> = [
  { pattern: /\bIsing\s+(model|Hamiltonian)\b/gi, type: 'Ising', description: 'Ising model Hamiltonian' },
  { pattern: /\bHeisenberg\s+(model|Hamiltonian)\b/gi, type: 'Heisenberg', description: 'Heisenberg model Hamiltonian' },
  { pattern: /\bHubbard\s+(model|Hamiltonian)\b/gi, type: 'Hubbard', description: 'Hubbard model Hamiltonian' },
  { pattern: /\bmolecular\s+Hamiltonian\b/gi, type: 'Molecular', description: 'Molecular electronic structure Hamiltonian' },
  { pattern: /\belectronic\s+structure\s+Hamiltonian\b/gi, type: 'Electronic Structure', description: 'Electronic structure Hamiltonian' },
  { pattern: /\bspin\s+Hamiltonian\b/gi, type: 'Spin', description: 'Spin system Hamiltonian' },
  { pattern: /\bqubit\s+Hamiltonian\b/gi, type: 'Qubit', description: 'Qubit-mapped Hamiltonian' },
  { pattern: /\bfermion(ic)?\s+Hamiltonian\b/gi, type: 'Fermionic', description: 'Fermionic Hamiltonian' },
  { pattern: /\bJordan[- ]?Wigner\b/gi, type: 'Jordan-Wigner', description: 'Jordan-Wigner transformation' },
  { pattern: /\bBravyi[- ]?Kitaev\b/gi, type: 'Bravyi-Kitaev', description: 'Bravyi-Kitaev transformation' },
  { pattern: /\bparity\s+mapping\b/gi, type: 'Parity', description: 'Parity mapping transformation' },
]

const GATE_PATTERNS: RegExp[] = [
  /\b(Pauli[- ]?[XYZ]|[XYZ]\s+gate)\b/gi,
  /\b(Hadamard|H\s+gate)\b/gi,
  /\b(CNOT|CX|controlled[- ]?NOT)\b/gi,
  /\b(CZ|controlled[- ]?Z)\b/gi,
  /\b(SWAP|swap\s+gate)\b/gi,
  /\b(Toffoli|CCX|CCNOT)\b/gi,
  /\b(T\s+gate|π\/8\s+gate)\b/gi,
  /\b(S\s+gate|phase\s+gate)\b/gi,
  /\b(R[xyz]|rotation\s+gate)\b/gi,
  /\bCR[xyz]\b/gi,
  /\bU[123]?\s+gate\b/gi,
  /\biSWAP\b/gi,
  /\bfSim\b/gi,
  /\bSqrtX\b/gi,
  /\bSqrt[- ]?SWAP\b/gi,
]

const CIRCUIT_PATTERNS: Array<{
  pattern: RegExp
  extractor: (match: RegExpMatchArray, text: string) => Partial<CircuitDescription>
}> = [
  {
    pattern: /(\d+)[- ]?qubit\s+circuit/gi,
    extractor: (match) => ({ numQubits: parseInt(match[1]) }),
  },
  {
    pattern: /circuit\s+depth\s+(?:of\s+)?(\d+)/gi,
    extractor: (match) => ({ depth: parseInt(match[1]) }),
  },
  {
    pattern: /(\d+)\s+CNOT\s+gates?/gi,
    extractor: (match) => ({ gates: [`${match[1]} CNOT gates`] }),
  },
  {
    pattern: /ansatz\s+with\s+(\d+)\s+(?:layers?|parameters?)/gi,
    extractor: (match) => ({ description: `Ansatz with ${match[1]} layers/parameters` }),
  },
]

const METRIC_PATTERNS: Array<{
  pattern: RegExp
  name: string
}> = [
  { pattern: /\bfidelity\s*[:=]?\s*([\d.]+%?)/gi, name: 'Fidelity' },
  { pattern: /\bgate\s+error\s*[:=]?\s*([\d.e-]+)/gi, name: 'Gate Error' },
  { pattern: /\bcoherence\s+time\s*[:=]?\s*([\d.]+\s*[μµn]?s)/gi, name: 'Coherence Time' },
  { pattern: /\bT1\s*[:=]?\s*([\d.]+\s*[μµn]?s)/gi, name: 'T1 Time' },
  { pattern: /\bT2\s*[:=]?\s*([\d.]+\s*[μµn]?s)/gi, name: 'T2 Time' },
  { pattern: /\breadout\s+error\s*[:=]?\s*([\d.e-]+)/gi, name: 'Readout Error' },
  { pattern: /\bchemical\s+accuracy\s*[:=]?\s*([\d.]+\s*(?:m?Ha|kcal\/mol)?)/gi, name: 'Chemical Accuracy' },
  { pattern: /\bground\s+state\s+energy\s*[:=]?\s*([-\d.]+\s*Ha?)/gi, name: 'Ground State Energy' },
  { pattern: /\bentanglement\s+entropy\b/gi, name: 'Entanglement Entropy' },
  { pattern: /\bquantum\s+volume\s*[:=]?\s*(\d+)/gi, name: 'Quantum Volume' },
]

const QUANTUM_TERMS = new Set([
  'quantum', 'qubit', 'qubits', 'superposition', 'entanglement', 'entangled',
  'coherence', 'decoherence', 'gate', 'circuit', 'hamiltonian', 'unitary',
  'hermitian', 'eigenvalue', 'eigenvector', 'eigenstate', 'measurement',
  'amplitude', 'phase', 'interference', 'fidelity', 'error', 'noise',
  'variational', 'ansatz', 'optimization', 'vqe', 'qaoa', 'qft',
])

function getContext(text: string, matchIndex: number, contextLength = 100): string {
  const start = Math.max(0, matchIndex - contextLength)
  const end = Math.min(text.length, matchIndex + contextLength)
  let context = text.slice(start, end)

  if (start > 0) context = '...' + context
  if (end < text.length) context = context + '...'

  return context.replace(/\s+/g, ' ').trim()
}

export function isQuantumRelated(text: string): boolean {
  const lowerText = text.toLowerCase()
  let count = 0

  for (const term of QUANTUM_TERMS) {
    const matches = lowerText.match(new RegExp(`\\b${term}\\b`, 'gi'))
    if (matches) count += matches.length
  }

  return count >= 3
}

function calculateQuantumDensity(text: string): number {
  const words = text.toLowerCase().split(/\s+/)
  if (words.length === 0) return 0

  let quantumWords = 0
  for (const word of words) {
    if (QUANTUM_TERMS.has(word.replace(/[^a-z]/g, ''))) {
      quantumWords++
    }
  }

  return quantumWords / words.length
}

function extractAlgorithms(text: string): QuantumAlgorithm[] {
  const algorithms: QuantumAlgorithm[] = []
  const seen = new Set<string>()

  for (const { pattern, name, type } of ALGORITHM_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text)) !== null) {
      const key = `${name}-${Math.floor(match.index / 500)}`
      if (!seen.has(key)) {
        seen.add(key)
        algorithms.push({
          name,
          type,
          context: getContext(text, match.index),
          position: match.index,
        })
      }
    }
  }

  return algorithms
}

function extractHamiltonians(text: string): HamiltonianReference[] {
  const hamiltonians: HamiltonianReference[] = []
  const seen = new Set<string>()

  for (const { pattern, type, description } of HAMILTONIAN_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text)) !== null) {
      if (!seen.has(type)) {
        seen.add(type)
        hamiltonians.push({
          type,
          description,
          context: getContext(text, match.index),
        })
      }
    }
  }

  const formulaPattern = /H\s*=\s*[^.;]+/gi
  let match
  while ((match = formulaPattern.exec(text)) !== null) {
    if (match[0].length < 200) {
      hamiltonians.push({
        type: 'Formula',
        description: 'Explicit Hamiltonian expression',
        formula: match[0].trim(),
        context: getContext(text, match.index),
      })
    }
  }

  return hamiltonians
}

function extractCircuits(text: string): CircuitDescription[] {
  const circuits: CircuitDescription[] = []

  for (const { pattern, extractor } of CIRCUIT_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text)) !== null) {
      const extracted = extractor(match, text)
      circuits.push({
        description: match[0],
        context: getContext(text, match.index),
        ...extracted,
      })
    }
  }

  return circuits
}

function extractGates(text: string): string[] {
  const gates = new Set<string>()

  for (const pattern of GATE_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text)) !== null) {
      gates.add(match[0].toUpperCase())
    }
  }

  return Array.from(gates)
}

function extractMetrics(text: string): QuantumMetric[] {
  const metrics: QuantumMetric[] = []

  for (const { pattern, name } of METRIC_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text)) !== null) {
      metrics.push({
        name,
        value: match[1] || undefined,
        context: getContext(text, match.index),
      })
    }
  }

  return metrics
}

function determinePrimaryFocus(algorithms: QuantumAlgorithm[]): string | null {
  if (algorithms.length === 0) return null

  const typeCounts = new Map<string, number>()
  for (const algo of algorithms) {
    typeCounts.set(algo.type, (typeCounts.get(algo.type) || 0) + 1)
  }

  let maxCount = 0
  let dominant: string | null = null
  for (const [type, count] of typeCounts) {
    if (count > maxCount) {
      maxCount = count
      dominant = type
    }
  }

  if (dominant === 'variational') return 'Variational Quantum Algorithms'
  if (dominant === 'gate-based') return 'Gate-Based Quantum Computing'
  if (dominant === 'error-correction') return 'Quantum Error Correction'
  if (dominant === 'annealing' || dominant === 'adiabatic') return 'Quantum Annealing/Adiabatic'

  return 'Quantum Computing'
}

export function extractQuantumInsights(text: string): QuantumInsights {
  const isRelated = isQuantumRelated(text)
  const density = calculateQuantumDensity(text)

  if (!isRelated) {
    return {
      isQuantumRelated: false,
      algorithms: [],
      hamiltonians: [],
      circuits: [],
      gates: [],
      metrics: [],
      quantumTermDensity: density,
      primaryFocus: null,
    }
  }

  const algorithms = extractAlgorithms(text)
  const hamiltonians = extractHamiltonians(text)
  const circuits = extractCircuits(text)
  const gates = extractGates(text)
  const metrics = extractMetrics(text)
  const primaryFocus = determinePrimaryFocus(algorithms)

  return {
    isQuantumRelated: true,
    algorithms,
    hamiltonians,
    circuits,
    gates,
    metrics,
    quantumTermDensity: density,
    primaryFocus,
  }
}

export function getQuantumSummary(insights: QuantumInsights): string {
  if (!insights.isQuantumRelated) {
    return 'This paper does not appear to be quantum computing related.'
  }

  const parts: string[] = []

  if (insights.primaryFocus) {
    parts.push(`Primary focus: ${insights.primaryFocus}`)
  }

  if (insights.algorithms.length > 0) {
    const algoNames = [...new Set(insights.algorithms.map(a => a.name))].slice(0, 5)
    parts.push(`Algorithms: ${algoNames.join(', ')}`)
  }

  if (insights.hamiltonians.length > 0) {
    const hamTypes = [...new Set(insights.hamiltonians.map(h => h.type))].slice(0, 3)
    parts.push(`Hamiltonians: ${hamTypes.join(', ')}`)
  }

  if (insights.gates.length > 0) {
    parts.push(`Gates used: ${insights.gates.slice(0, 5).join(', ')}`)
  }

  return parts.join('. ') + '.'
}
