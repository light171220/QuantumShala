export interface PageRankConfig {
  damping: number
  maxIterations: number
  tolerance: number
}

export interface CitationNode {
  id: string
  paperId: string
  title: string
  authors: string[]
  year?: number
  citationCount: number
  pageRank: number
}

export interface CitationEdge {
  source: string
  target: string
  context?: string
}

export interface CitationCommunity {
  id: number
  members: string[]
  label?: string
  centralPaper?: string
}

export interface CitationNetwork {
  nodes: CitationNode[]
  edges: CitationEdge[]
  pageRanks: Map<string, number>
  communities: CitationCommunity[]
}

export interface GraphStats {
  nodeCount: number
  edgeCount: number
  avgDegree: number
  density: number
  avgPageRank: number
  maxPageRank: number
}

const DEFAULT_CONFIG: PageRankConfig = {
  damping: 0.85,
  maxIterations: 100,
  tolerance: 1e-6,
}

function buildAdjacencyList(
  nodes: string[],
  edges: CitationEdge[]
): { inbound: Map<string, string[]>; outbound: Map<string, string[]> } {
  const inbound = new Map<string, string[]>()
  const outbound = new Map<string, string[]>()

  for (const node of nodes) {
    inbound.set(node, [])
    outbound.set(node, [])
  }

  for (const edge of edges) {
    const outList = outbound.get(edge.source)
    const inList = inbound.get(edge.target)

    if (outList && inList) {
      outList.push(edge.target)
      inList.push(edge.source)
    }
  }

  return { inbound, outbound }
}

export function computePageRank(
  nodes: string[],
  edges: CitationEdge[],
  config: Partial<PageRankConfig> = {}
): Map<string, number> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const n = nodes.length

  if (n === 0) return new Map()

  const { inbound, outbound } = buildAdjacencyList(nodes, edges)

  let scores = new Map<string, number>()
  for (const node of nodes) {
    scores.set(node, 1 / n)
  }

  for (let iter = 0; iter < cfg.maxIterations; iter++) {
    const newScores = new Map<string, number>()
    let diff = 0

    let danglingSum = 0
    for (const node of nodes) {
      if (outbound.get(node)!.length === 0) {
        danglingSum += scores.get(node)!
      }
    }

    for (const node of nodes) {
      let sum = 0

      for (const inNode of inbound.get(node)!) {
        const outDegree = outbound.get(inNode)!.length
        if (outDegree > 0) {
          sum += scores.get(inNode)! / outDegree
        }
      }

      sum += danglingSum / n

      const newScore = (1 - cfg.damping) / n + cfg.damping * sum
      newScores.set(node, newScore)
      diff += Math.abs(newScore - scores.get(node)!)
    }

    scores = newScores

    if (diff < cfg.tolerance) {
      break
    }
  }

  return scores
}

export function detectCommunities(
  nodes: string[],
  edges: CitationEdge[]
): CitationCommunity[] {
  if (nodes.length === 0) return []

  const { inbound, outbound } = buildAdjacencyList(nodes, edges)

  const labels = new Map<string, number>()
  for (let i = 0; i < nodes.length; i++) {
    labels.set(nodes[i], i)
  }

  const neighbors = new Map<string, string[]>()
  for (const node of nodes) {
    const allNeighbors = new Set([
      ...inbound.get(node)!,
      ...outbound.get(node)!,
    ])
    neighbors.set(node, Array.from(allNeighbors))
  }

  const maxIterations = 50
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false

    const shuffled = [...nodes].sort(() => Math.random() - 0.5)

    for (const node of shuffled) {
      const nodeNeighbors = neighbors.get(node)!
      if (nodeNeighbors.length === 0) continue

      const labelCounts = new Map<number, number>()
      for (const neighbor of nodeNeighbors) {
        const label = labels.get(neighbor)!
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1)
      }

      let maxCount = 0
      let maxLabel = labels.get(node)!
      for (const [label, count] of labelCounts) {
        if (count > maxCount) {
          maxCount = count
          maxLabel = label
        }
      }

      if (maxLabel !== labels.get(node)) {
        labels.set(node, maxLabel)
        changed = true
      }
    }

    if (!changed) break
  }

  const communities = new Map<number, string[]>()
  for (const [node, label] of labels) {
    if (!communities.has(label)) {
      communities.set(label, [])
    }
    communities.get(label)!.push(node)
  }

  const result: CitationCommunity[] = []
  let communityId = 0
  for (const members of communities.values()) {
    if (members.length > 1) {
      result.push({
        id: communityId++,
        members,
      })
    }
  }

  return result
}

export function findCentralPaper(
  community: CitationCommunity,
  pageRanks: Map<string, number>
): string | undefined {
  let maxRank = -1
  let centralPaper: string | undefined

  for (const member of community.members) {
    const rank = pageRanks.get(member) || 0
    if (rank > maxRank) {
      maxRank = rank
      centralPaper = member
    }
  }

  return centralPaper
}

export function buildCitationNetwork(
  papers: Array<{
    id: string
    title: string
    authors: string[]
    year?: number
    citationCount?: number
  }>,
  citations: Array<{
    sourceId: string
    targetId: string
    context?: string
  }>,
  config: Partial<PageRankConfig> = {}
): CitationNetwork {
  const nodeIds = papers.map(p => p.id)
  const edges: CitationEdge[] = citations.map(c => ({
    source: c.sourceId,
    target: c.targetId,
    context: c.context,
  }))

  const pageRanks = computePageRank(nodeIds, edges, config)

  const communities = detectCommunities(nodeIds, edges)

  for (const community of communities) {
    community.centralPaper = findCentralPaper(community, pageRanks)
  }

  const nodes: CitationNode[] = papers.map(p => ({
    id: p.id,
    paperId: p.id,
    title: p.title,
    authors: p.authors,
    year: p.year,
    citationCount: p.citationCount || 0,
    pageRank: pageRanks.get(p.id) || 0,
  }))

  return {
    nodes,
    edges,
    pageRanks,
    communities,
  }
}

export function getTopPapers(
  network: CitationNetwork,
  limit = 10
): CitationNode[] {
  const sorted = [...network.nodes].sort((a, b) => b.pageRank - a.pageRank)
  return sorted.slice(0, limit)
}

export function getCommunityPapers(
  network: CitationNetwork,
  communityId: number
): CitationNode[] {
  const community = network.communities.find(c => c.id === communityId)
  if (!community) return []

  const memberSet = new Set(community.members)
  return network.nodes.filter(n => memberSet.has(n.id))
}

export function findCitingPapers(
  network: CitationNetwork,
  paperId: string
): CitationNode[] {
  const citingIds = new Set<string>()

  for (const edge of network.edges) {
    if (edge.target === paperId) {
      citingIds.add(edge.source)
    }
  }

  return network.nodes.filter(n => citingIds.has(n.id))
}

export function findCitedPapers(
  network: CitationNetwork,
  paperId: string
): CitationNode[] {
  const citedIds = new Set<string>()

  for (const edge of network.edges) {
    if (edge.source === paperId) {
      citedIds.add(edge.target)
    }
  }

  return network.nodes.filter(n => citedIds.has(n.id))
}

export function getNetworkStats(network: CitationNetwork): GraphStats {
  const nodeCount = network.nodes.length
  const edgeCount = network.edges.length

  if (nodeCount === 0) {
    return {
      nodeCount: 0,
      edgeCount: 0,
      avgDegree: 0,
      density: 0,
      avgPageRank: 0,
      maxPageRank: 0,
    }
  }

  const avgDegree = (2 * edgeCount) / nodeCount
  const density = edgeCount / (nodeCount * (nodeCount - 1))

  let sumPageRank = 0
  let maxPageRank = 0
  for (const node of network.nodes) {
    sumPageRank += node.pageRank
    maxPageRank = Math.max(maxPageRank, node.pageRank)
  }

  return {
    nodeCount,
    edgeCount,
    avgDegree,
    density,
    avgPageRank: sumPageRank / nodeCount,
    maxPageRank,
  }
}

export function findBridgingPapers(
  network: CitationNetwork
): CitationNode[] {
  const paperCommunities = new Map<string, Set<number>>()

  for (const community of network.communities) {
    for (const member of community.members) {
      if (!paperCommunities.has(member)) {
        paperCommunities.set(member, new Set())
      }
      paperCommunities.get(member)!.add(community.id)
    }
  }

  const bridgingScores = new Map<string, number>()

  for (const edge of network.edges) {
    const sourceCommunities = paperCommunities.get(edge.source)
    const targetCommunities = paperCommunities.get(edge.target)

    if (sourceCommunities && targetCommunities) {
      let bridging = true
      for (const sc of sourceCommunities) {
        if (targetCommunities.has(sc)) {
          bridging = false
          break
        }
      }

      if (bridging) {
        bridgingScores.set(edge.source, (bridgingScores.get(edge.source) || 0) + 1)
        bridgingScores.set(edge.target, (bridgingScores.get(edge.target) || 0) + 1)
      }
    }
  }

  const bridgingPapers = network.nodes
    .filter(n => bridgingScores.has(n.id))
    .map(n => ({
      ...n,
      bridgingScore: bridgingScores.get(n.id)!,
    }))
    .sort((a, b) => b.bridgingScore - a.bridgingScore)

  return bridgingPapers.slice(0, 10)
}
