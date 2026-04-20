import { useState, useMemo } from 'react'
import {
  Atom,
  Sparkles,
  Tag,
  Network,
  BarChart3,
  TrendingUp,
  Zap,
  BookOpen,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useResearchStore, selectQuantumPapers, selectProcessedPapers } from '@/stores/researchStore'

export function InsightsTab() {
  const { papers, isLoading } = useResearchStore()
  const quantumPapers = useMemo(() => selectQuantumPapers({ papers } as any), [papers])
  const processedPapers = useMemo(() => selectProcessedPapers({ papers } as any), [papers])

  // Aggregate quantum algorithms across all papers
  const algorithmCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const paper of papers) {
      for (const algo of paper.quantumAlgorithms || []) {
        counts.set(algo, (counts.get(algo) || 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [papers])

  // Aggregate keywords across all papers
  const keywordCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const paper of papers) {
      for (const keyword of paper.keywords || []) {
        counts.set(keyword, (counts.get(keyword) || 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
  }, [papers])

  // Aggregate Hamiltonians
  const hamiltonianCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const paper of papers) {
      for (const ham of paper.hamiltonians || []) {
        counts.set(ham, (counts.get(ham) || 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [papers])

  const stats = useMemo(() => ({
    totalPapers: papers.length,
    processedPapers: processedPapers.length,
    quantumPapers: quantumPapers.length,
    totalKeywords: keywordCounts.length,
    totalAlgorithms: algorithmCounts.length,
  }), [papers, processedPapers, quantumPapers, keywordCounts, algorithmCounts])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Research Insights</h2>
          <p className="text-sm text-slate-400">
            Aggregated analysis across your paper library
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-neumorph-darker border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <BookOpen className="w-4 h-4" />
            <span className="text-xs">Total Papers</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalPapers}</p>
        </div>

        <div className="bg-neumorph-darker border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Zap className="w-4 h-4" />
            <span className="text-xs">Processed</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{stats.processedPapers}</p>
        </div>

        <div className="bg-neumorph-darker border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Atom className="w-4 h-4" />
            <span className="text-xs">Quantum Papers</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">{stats.quantumPapers}</p>
        </div>

        <div className="bg-neumorph-darker border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Tag className="w-4 h-4" />
            <span className="text-xs">Keywords</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{stats.totalKeywords}</p>
        </div>

        <div className="bg-neumorph-darker border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Network className="w-4 h-4" />
            <span className="text-xs">Algorithms</span>
          </div>
          <p className="text-2xl font-bold text-orange-400">{stats.totalAlgorithms}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quantum Algorithms */}
        <div className="bg-neumorph-darker border border-white/5 rounded-xl p-4">
          <h3 className="text-white font-medium flex items-center gap-2 mb-4">
            <Atom className="w-4 h-4 text-purple-400" />
            Quantum Algorithms
          </h3>
          {algorithmCounts.length > 0 ? (
            <div className="space-y-3">
              {algorithmCounts.map(([algo, count]) => (
                <div key={algo} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white">{algo}</span>
                      <span className="text-xs text-slate-400">{count} papers</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                        style={{ width: `${(count / algorithmCounts[0][1]) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No quantum algorithms detected yet. Process papers to extract insights.
            </p>
          )}
        </div>

        {/* Top Keywords */}
        <div className="bg-neumorph-darker border border-white/5 rounded-xl p-4">
          <h3 className="text-white font-medium flex items-center gap-2 mb-4">
            <Tag className="w-4 h-4 text-blue-400" />
            Top Keywords
          </h3>
          {keywordCounts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {keywordCounts.map(([keyword, count], idx) => {
                // Size based on frequency
                const maxCount = keywordCounts[0][1]
                const size = Math.max(0.7, count / maxCount)
                return (
                  <span
                    key={keyword}
                    className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-slate-300"
                    style={{
                      fontSize: `${0.75 + size * 0.25}rem`,
                      opacity: 0.5 + size * 0.5,
                    }}
                  >
                    {keyword}
                    <span className="ml-1 text-xs text-slate-500">({count})</span>
                  </span>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No keywords extracted yet. Summarize papers to extract keywords.
            </p>
          )}
        </div>

        {/* Hamiltonians */}
        <div className="bg-neumorph-darker border border-white/5 rounded-xl p-4">
          <h3 className="text-white font-medium flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-orange-400" />
            Hamiltonian Types
          </h3>
          {hamiltonianCounts.length > 0 ? (
            <div className="space-y-2">
              {hamiltonianCounts.map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                >
                  <span className="text-sm text-white">{type}</span>
                  <Badge variant="secondary" size="sm">{count}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No Hamiltonians detected yet. Extract insights from quantum papers.
            </p>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
          <h3 className="text-white font-medium flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-purple-400" />
            How It Works
          </h3>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-400 flex-shrink-0">1</span>
              <p>Upload research papers to your library</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-400 flex-shrink-0">2</span>
              <p>Papers are automatically processed and indexed</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-400 flex-shrink-0">3</span>
              <p>Generate summaries using LexRank algorithm</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-400 flex-shrink-0">4</span>
              <p>Extract quantum algorithms, Hamiltonians, and keywords</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-400 flex-shrink-0">5</span>
              <p>View aggregated insights across your entire library</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-slate-400">
              All processing is done using custom algorithms - no AI API costs!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
