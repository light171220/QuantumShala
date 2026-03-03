'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { cn } from '@/utils/cn'

// Types
interface DerivationStep {
  id: string
  equation: string
  explanation: string
  annotation?: string
  highlight?: string[]
}

interface DerivationWalkthroughProps {
  title?: string
  description?: string
  steps: DerivationStep[]
  initialStep?: number
  showAllByDefault?: boolean
  enableAutoPlay?: boolean
  autoPlayInterval?: number
}

// DerivationWalkthrough Component - Step-by-step mathematical derivation
export default function DerivationWalkthrough({
  title = 'Derivation',
  description,
  steps,
  initialStep = 0,
  showAllByDefault = false,
  enableAutoPlay = true,
  autoPlayInterval = 3000,
}: DerivationWalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [revealedSteps, setRevealedSteps] = useState<Set<number>>(
    showAllByDefault ? new Set(steps.map((_, i) => i)) : new Set([0])
  )
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const [expandedAnnotations, setExpandedAnnotations] = useState<Set<number>>(new Set())
  const [highlightMode, setHighlightMode] = useState(true)

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlaying) return

    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        const next = prev + 1
        if (next >= steps.length) {
          setIsAutoPlaying(false)
          return prev
        }
        setRevealedSteps((revealed) => new Set([...revealed, next]))
        return next
      })
    }, autoPlayInterval)

    return () => clearInterval(timer)
  }, [isAutoPlaying, steps.length, autoPlayInterval])

  // Navigate to step
  const goToStep = useCallback(
    (stepIndex: number) => {
      if (stepIndex < 0 || stepIndex >= steps.length) return
      setCurrentStep(stepIndex)
      setRevealedSteps((prev) => new Set([...prev, stepIndex]))
    },
    [steps.length]
  )

  // Reveal next step
  const revealNext = useCallback(() => {
    const nextUnrevealed = [...Array(steps.length).keys()].find(
      (i) => !revealedSteps.has(i)
    )
    if (nextUnrevealed !== undefined) {
      setRevealedSteps((prev) => new Set([...prev, nextUnrevealed]))
      setCurrentStep(nextUnrevealed)
    }
  }, [steps.length, revealedSteps])

  // Reveal all steps
  const revealAll = useCallback(() => {
    setRevealedSteps(new Set(steps.map((_, i) => i)))
  }, [steps])

  // Hide all except first
  const hideAll = useCallback(() => {
    setRevealedSteps(new Set([0]))
    setCurrentStep(0)
  }, [])

  // Toggle annotation
  const toggleAnnotation = useCallback((index: number) => {
    setExpandedAnnotations((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  // Progress calculation
  const progress = useMemo(() => {
    return (revealedSteps.size / steps.length) * 100
  }, [revealedSteps.size, steps.length])

  // Check if all steps are revealed
  const allRevealed = revealedSteps.size === steps.length

  // Render equation with optional highlighting
  const renderEquation = useCallback(
    (equation: string, highlights?: string[], isCurrentStep?: boolean) => {
      if (!highlightMode || !highlights || highlights.length === 0) {
        return <span className="font-mono text-white">{equation}</span>
      }

      let result = equation
      let parts: (string | React.ReactNode)[] = [equation]

      highlights.forEach((term, index) => {
        const newParts: (string | React.ReactNode)[] = []
        parts.forEach((part) => {
          if (typeof part !== 'string') {
            newParts.push(part)
            return
          }

          const termRegex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g')
          const splitParts = part.split(termRegex)

          splitParts.forEach((splitPart, i) => {
            if (splitPart === term) {
              newParts.push(
                <span
                  key={`highlight-${index}-${i}`}
                  className={cn(
                    'px-1 py-0.5 rounded font-bold transition-all',
                    isCurrentStep
                      ? 'bg-cyan-500/30 text-cyan-300 ring-1 ring-cyan-400'
                      : 'bg-purple-500/20 text-purple-300'
                  )}
                >
                  {splitPart}
                </span>
              )
            } else if (splitPart) {
              newParts.push(splitPart)
            }
          })
        })
        parts = newParts
      })

      return <span className="font-mono text-white">{parts}</span>
    },
    [highlightMode]
  )

  return (
    <div className="my-6 p-6 bg-neumorph-base border border-white/[0.02] shadow-neumorph-sm rounded-xl">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg
              className="w-5 h-5 text-cyan-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            {title}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHighlightMode(!highlightMode)}
              className={cn(
                'p-1.5 rounded transition-colors',
                highlightMode
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              )}
              title="Toggle highlighting"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                />
              </svg>
            </button>
          </div>
        </div>
        {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>
            Step {currentStep + 1} of {steps.length}
          </span>
          <span>{Math.round(progress)}% revealed</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Derivation Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isRevealed = revealedSteps.has(index)
          const isCurrent = index === currentStep
          const hasAnnotation = !!step.annotation

          return (
            <div
              key={step.id}
              className={cn(
                'relative transition-all duration-300',
                !isRevealed && 'opacity-0 h-0 overflow-hidden'
              )}
            >
              {/* Connection line */}
              {index > 0 && isRevealed && (
                <div className="absolute left-6 -top-2 w-0.5 h-2 bg-slate-600" />
              )}

              <div
                onClick={() => goToStep(index)}
                className={cn(
                  'p-4 rounded-lg border cursor-pointer transition-all',
                  isCurrent
                    ? 'bg-slate-800/80 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-800/40 border-slate-700 hover:border-slate-600'
                )}
              >
                {/* Step Header */}
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                      isCurrent
                        ? 'bg-cyan-500 text-white'
                        : 'bg-slate-700 text-slate-300'
                    )}
                  >
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Equation */}
                    <div className="text-lg overflow-x-auto pb-2">
                      {renderEquation(step.equation, step.highlight, isCurrent)}
                    </div>

                    {/* Explanation */}
                    <div className="text-sm text-slate-400 mt-2">{step.explanation}</div>

                    {/* Annotation (expandable) */}
                    {hasAnnotation && (
                      <div className="mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleAnnotation(index)
                          }}
                          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                        >
                          <svg
                            className={cn(
                              'w-3 h-3 transition-transform',
                              expandedAnnotations.has(index) && 'rotate-90'
                            )}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                          {expandedAnnotations.has(index) ? 'Hide' : 'Show'} detailed annotation
                        </button>
                        {expandedAnnotations.has(index) && (
                          <div className="mt-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-sm text-purple-300">
                            {step.annotation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Arrow indicator */}
                  {index < steps.length - 1 && isRevealed && revealedSteps.has(index + 1) && (
                    <div className="absolute -bottom-3 left-6 text-slate-600">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 16l-6-6h12z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Hidden steps indicator */}
        {!allRevealed && (
          <div className="flex items-center justify-center py-4">
            <button
              onClick={revealNext}
              className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              Reveal Next Step ({steps.length - revealedSteps.size} remaining)
            </button>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="mt-6 pt-4 border-t border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Step Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToStep(currentStep - 1)}
              disabled={currentStep === 0}
              className={cn(
                'p-2 rounded-lg transition-colors',
                currentStep > 0
                  ? 'text-white hover:bg-slate-700'
                  : 'text-slate-600 cursor-not-allowed'
              )}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            {/* Step dots */}
            <div className="flex items-center gap-1">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToStep(index)}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all',
                    !revealedSteps.has(index)
                      ? 'bg-slate-700'
                      : index === currentStep
                      ? 'bg-cyan-400 w-4'
                      : 'bg-slate-500 hover:bg-slate-400'
                  )}
                />
              ))}
            </div>

            <button
              onClick={() => goToStep(currentStep + 1)}
              disabled={currentStep >= steps.length - 1 || !revealedSteps.has(currentStep + 1)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                currentStep < steps.length - 1 && revealedSteps.has(currentStep + 1)
                  ? 'text-white hover:bg-slate-700'
                  : 'text-slate-600 cursor-not-allowed'
              )}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {enableAutoPlay && !allRevealed && (
              <button
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                  isAutoPlaying
                    ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                )}
              >
                {isAutoPlaying ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                    Pause
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Auto-Play
                  </>
                )}
              </button>
            )}

            <button
              onClick={allRevealed ? hideAll : revealAll}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700 text-white hover:bg-slate-600 transition-colors"
            >
              {allRevealed ? 'Hide All' : 'Reveal All'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
