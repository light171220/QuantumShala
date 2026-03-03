'use client'

import { useState, useCallback, useMemo } from 'react'
import { cn } from '@/utils/cn'

// Types
interface ProofStep {
  id: string
  content: string
  justification: string
  isCorrect?: boolean
}

interface ProofBuilderProps {
  title?: string
  description?: string
  availableSteps: ProofStep[]
  correctOrder: string[]
  onComplete?: (isCorrect: boolean, attempts: number) => void
}

// ProofBuilder Component - Interactive proof construction with drag/drop
export default function ProofBuilder({
  title = 'Proof Builder',
  description = 'Arrange the proof steps in the correct order by dragging them.',
  availableSteps,
  correctOrder,
  onComplete,
}: ProofBuilderProps) {
  const [availablePool, setAvailablePool] = useState<ProofStep[]>(availableSteps)
  const [proofSequence, setProofSequence] = useState<ProofStep[]>([])
  const [draggedItem, setDraggedItem] = useState<ProofStep | null>(null)
  const [dragSource, setDragSource] = useState<'pool' | 'sequence' | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [showHint, setShowHint] = useState(false)

  // Handle drag start
  const handleDragStart = useCallback(
    (step: ProofStep, source: 'pool' | 'sequence') => {
      setDraggedItem(step)
      setDragSource(source)
    },
    []
  )

  // Handle drag over
  const handleDragOver = useCallback(
    (e: React.DragEvent, index?: number) => {
      e.preventDefault()
      if (index !== undefined) {
        setDropTargetIndex(index)
      }
    },
    []
  )

  // Handle drop into sequence
  const handleDropInSequence = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault()
      if (!draggedItem) return

      if (dragSource === 'pool') {
        // Remove from pool, add to sequence
        setAvailablePool((prev) => prev.filter((s) => s.id !== draggedItem.id))
        setProofSequence((prev) => {
          const newSequence = [...prev]
          newSequence.splice(targetIndex, 0, draggedItem)
          return newSequence
        })
      } else if (dragSource === 'sequence') {
        // Reorder within sequence
        setProofSequence((prev) => {
          const currentIndex = prev.findIndex((s) => s.id === draggedItem.id)
          if (currentIndex === -1) return prev
          const newSequence = [...prev]
          newSequence.splice(currentIndex, 1)
          const adjustedIndex = targetIndex > currentIndex ? targetIndex - 1 : targetIndex
          newSequence.splice(adjustedIndex, 0, draggedItem)
          return newSequence
        })
      }

      setDraggedItem(null)
      setDragSource(null)
      setDropTargetIndex(null)
      setIsVerified(false)
      setVerificationResult(null)
    },
    [draggedItem, dragSource]
  )

  // Handle drop back to pool
  const handleDropInPool = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!draggedItem || dragSource !== 'sequence') return

      setProofSequence((prev) => prev.filter((s) => s.id !== draggedItem.id))
      setAvailablePool((prev) => [...prev, draggedItem])
      setDraggedItem(null)
      setDragSource(null)
      setDropTargetIndex(null)
      setIsVerified(false)
      setVerificationResult(null)
    },
    [draggedItem, dragSource]
  )

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedItem(null)
    setDragSource(null)
    setDropTargetIndex(null)
  }, [])

  // Verify proof
  const verifyProof = useCallback(() => {
    const currentOrder = proofSequence.map((s) => s.id)
    const isCorrect =
      currentOrder.length === correctOrder.length &&
      currentOrder.every((id, index) => id === correctOrder[index])

    setIsVerified(true)
    setVerificationResult(isCorrect)
    setAttempts((prev) => prev + 1)

    if (onComplete) {
      onComplete(isCorrect, attempts + 1)
    }
  }, [proofSequence, correctOrder, onComplete, attempts])

  // Reset proof
  const resetProof = useCallback(() => {
    setAvailablePool(availableSteps)
    setProofSequence([])
    setIsVerified(false)
    setVerificationResult(null)
    setShowHint(false)
  }, [availableSteps])

  // Get hint (show first incorrect step)
  const hint = useMemo(() => {
    if (proofSequence.length === 0) {
      const firstStepId = correctOrder[0]
      const firstStep = availableSteps.find((s) => s.id === firstStepId)
      return `Start with: "${firstStep?.content.slice(0, 50)}..."`
    }

    for (let i = 0; i < proofSequence.length; i++) {
      if (proofSequence[i].id !== correctOrder[i]) {
        return `Step ${i + 1} is incorrect. Consider the logical flow from step ${i}.`
      }
    }

    if (proofSequence.length < correctOrder.length) {
      return `You need ${correctOrder.length - proofSequence.length} more step(s).`
    }

    return 'All steps appear to be in order!'
  }, [proofSequence, correctOrder, availableSteps])

  return (
    <div className="my-6 p-6 bg-neumorph-base border border-white/[0.02] shadow-neumorph-sm rounded-xl">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg
            className="w-5 h-5 text-purple-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          {title}
        </h3>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Steps Pool */}
        <div
          className={cn(
            'p-4 rounded-lg border-2 border-dashed transition-colors min-h-[200px]',
            dragSource === 'sequence'
              ? 'border-amber-500/50 bg-amber-500/5'
              : 'border-slate-600 bg-slate-800/30'
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropInPool}
        >
          <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            Available Steps
          </h4>
          <div className="space-y-2">
            {availablePool.map((step) => (
              <div
                key={step.id}
                draggable
                onDragStart={() => handleDragStart(step, 'pool')}
                onDragEnd={handleDragEnd}
                className={cn(
                  'p-3 rounded-lg cursor-grab active:cursor-grabbing transition-all',
                  'bg-slate-700/50 border border-slate-600 hover:border-purple-500/50',
                  'hover:bg-slate-700 hover:shadow-lg',
                  draggedItem?.id === step.id && 'opacity-50 scale-95'
                )}
              >
                <div className="text-sm text-white font-mono">{step.content}</div>
                <div className="text-xs text-slate-400 mt-1 italic">{step.justification}</div>
              </div>
            ))}
            {availablePool.length === 0 && (
              <div className="text-sm text-slate-500 italic text-center py-4">
                All steps have been placed. Drag steps here to remove them from the proof.
              </div>
            )}
          </div>
        </div>

        {/* Proof Sequence */}
        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-600 min-h-[200px]">
          <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
            Your Proof ({proofSequence.length}/{correctOrder.length} steps)
          </h4>
          <div className="space-y-2">
            {proofSequence.length === 0 && (
              <div
                className={cn(
                  'p-4 border-2 border-dashed rounded-lg text-center transition-colors',
                  dragSource === 'pool'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                    : 'border-slate-600 text-slate-500'
                )}
                onDragOver={(e) => handleDragOver(e, 0)}
                onDrop={(e) => handleDropInSequence(e, 0)}
              >
                Drag steps here to build your proof
              </div>
            )}
            {proofSequence.map((step, index) => (
              <div key={step.id}>
                {/* Drop zone before */}
                <div
                  className={cn(
                    'h-1 rounded transition-all',
                    dropTargetIndex === index && draggedItem?.id !== step.id
                      ? 'bg-purple-500 h-2'
                      : 'bg-transparent'
                  )}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDropInSequence(e, index)}
                />
                <div
                  draggable
                  onDragStart={() => handleDragStart(step, 'sequence')}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'p-3 rounded-lg cursor-grab active:cursor-grabbing transition-all',
                    'border hover:shadow-lg',
                    isVerified
                      ? step.id === correctOrder[index]
                        ? 'bg-green-500/20 border-green-500'
                        : 'bg-red-500/20 border-red-500'
                      : 'bg-purple-500/10 border-purple-500/50 hover:border-purple-400',
                    draggedItem?.id === step.id && 'opacity-50 scale-95'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                        isVerified
                          ? step.id === correctOrder[index]
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                          : 'bg-purple-500 text-white'
                      )}
                    >
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm text-white font-mono">{step.content}</div>
                      <div className="text-xs text-slate-400 mt-1 italic">{step.justification}</div>
                    </div>
                    {isVerified && (
                      <span className="flex-shrink-0">
                        {step.id === correctOrder[index] ? (
                          <svg
                            className="w-5 h-5 text-green-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5 text-red-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {proofSequence.length > 0 && (
              <div
                className={cn(
                  'h-8 rounded-lg border-2 border-dashed flex items-center justify-center text-xs transition-colors',
                  dropTargetIndex === proofSequence.length
                    ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                    : 'border-slate-700 text-slate-600'
                )}
                onDragOver={(e) => handleDragOver(e, proofSequence.length)}
                onDrop={(e) => handleDropInSequence(e, proofSequence.length)}
              >
                Drop here to add at end
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hint Section */}
      {showHint && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <div className="text-sm text-amber-300">{hint}</div>
          </div>
        </div>
      )}

      {/* Verification Result */}
      {isVerified && verificationResult !== null && (
        <div
          className={cn(
            'mt-4 p-4 rounded-lg border',
            verificationResult
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          )}
        >
          <div className="flex items-center gap-2">
            {verificationResult ? (
              <>
                <svg
                  className="w-6 h-6 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-green-400 font-medium">
                  Correct! Your proof is valid. Completed in {attempts} attempt(s).
                </span>
              </>
            ) : (
              <>
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-red-400 font-medium">
                  Not quite right. Check the highlighted steps and try again.
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={verifyProof}
          disabled={proofSequence.length === 0}
          className={cn(
            'px-4 py-2 rounded-lg font-medium text-sm transition-all',
            proofSequence.length > 0
              ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-400 hover:to-purple-500 shadow-lg shadow-purple-500/25'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          )}
        >
          Verify Proof
        </button>
        <button
          onClick={resetProof}
          className="px-4 py-2 rounded-lg font-medium text-sm bg-slate-700 text-white hover:bg-slate-600 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => setShowHint(!showHint)}
          className="px-4 py-2 rounded-lg font-medium text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
        >
          {showHint ? 'Hide Hint' : 'Show Hint'}
        </button>
        <div className="flex-1" />
        <span className="text-xs text-slate-500">Attempts: {attempts}</span>
      </div>
    </div>
  )
}
