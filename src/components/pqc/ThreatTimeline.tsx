import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Shield, CheckCircle, Clock, Zap, Calendar } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface TimelineEvent {
  year: number
  title: string
  description: string
  type: 'milestone' | 'threat' | 'standard' | 'deadline'
  importance: 'low' | 'medium' | 'high' | 'critical'
}

const TIMELINE_EVENTS: TimelineEvent[] = [
  { year: 1994, title: "Shor's Algorithm", description: 'Peter Shor publishes quantum algorithm for factoring', type: 'threat', importance: 'critical' },
  { year: 2016, title: 'NIST PQC Competition', description: 'NIST initiates Post-Quantum Cryptography standardization', type: 'milestone', importance: 'high' },
  { year: 2017, title: 'Round 1 Submissions', description: '69 candidate algorithms submitted to NIST', type: 'milestone', importance: 'medium' },
  { year: 2019, title: 'Round 2 Selection', description: '26 algorithms advance to second round', type: 'milestone', importance: 'medium' },
  { year: 2020, title: 'Round 3 Finalists', description: '7 finalists and 8 alternates announced', type: 'milestone', importance: 'high' },
  { year: 2022, title: 'Algorithm Selection', description: 'CRYSTALS-Kyber, CRYSTALS-Dilithium, Falcon, SPHINCS+ selected', type: 'standard', importance: 'critical' },
  { year: 2024, title: 'FIPS Standards', description: 'FIPS 203 (ML-KEM), 204 (ML-DSA), 205 (SLH-DSA) published', type: 'standard', importance: 'critical' },
  { year: 2025, title: 'Migration Begins', description: 'Organizations should begin PQC migration planning', type: 'deadline', importance: 'high' },
  { year: 2030, title: 'Migration Deadline', description: 'NSA deadline for PQC in national security systems', type: 'deadline', importance: 'critical' },
  { year: 2035, title: 'RSA/ECC Risk', description: 'Estimated earliest cryptographically relevant quantum computer', type: 'threat', importance: 'critical' }
]

const TYPE_ICONS = {
  milestone: CheckCircle,
  threat: AlertTriangle,
  standard: Shield,
  deadline: Clock
}

const TYPE_COLORS = {
  milestone: 'bg-blue-500',
  threat: 'bg-red-500',
  standard: 'bg-green-500',
  deadline: 'bg-amber-500'
}

interface ThreatTimelineProps {
  showMilestones?: boolean
  highlightYear?: number
}

export function ThreatTimeline({ showMilestones = true, highlightYear }: ThreatTimelineProps) {
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null)
  const currentYear = new Date().getFullYear()

  const filteredEvents = showMilestones
    ? TIMELINE_EVENTS
    : TIMELINE_EVENTS.filter(e => e.type !== 'milestone')

  const minYear = Math.min(...filteredEvents.map(e => e.year))
  const maxYear = Math.max(...filteredEvents.map(e => e.year))
  const totalYears = maxYear - minYear

  const getPosition = (year: number) => ((year - minYear) / totalYears) * 100

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-slate-400">Milestone</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-slate-400">Standard</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-slate-400">Threat</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-slate-400">Deadline</span>
        </div>
      </div>

      <Card variant="neumorph" className="p-4">
        <div className="relative h-32 mb-8">
          <div className="absolute left-0 right-0 top-1/2 h-1 bg-slate-700 rounded-full" />

          <div
            className="absolute top-1/2 h-1 bg-gradient-to-r from-green-500 to-slate-700 rounded-full"
            style={{
              left: 0,
              width: `${getPosition(currentYear)}%`,
              transform: 'translateY(-50%)'
            }}
          />

          <div
            className="absolute top-1/2 w-3 h-3 rounded-full bg-white border-2 border-green-500 z-10"
            style={{
              left: `${getPosition(currentYear)}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-green-400 whitespace-nowrap">
              Now ({currentYear})
            </div>
          </div>

          {filteredEvents.map((event, idx) => {
            const Icon = TYPE_ICONS[event.type]
            const isHighlighted = highlightYear === event.year
            const isFuture = event.year > currentYear
            const isPast = event.year < currentYear

            return (
              <motion.div
                key={idx}
                className="absolute"
                style={{
                  left: `${getPosition(event.year)}%`,
                  top: idx % 2 === 0 ? '0%' : '60%',
                  transform: 'translateX(-50%)'
                }}
                initial={{ opacity: 0, y: idx % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <button
                  onMouseEnter={() => setHoveredEvent(event)}
                  onMouseLeave={() => setHoveredEvent(null)}
                  className={`relative group ${isHighlighted ? 'scale-125' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full ${TYPE_COLORS[event.type]} ${
                      isFuture ? 'opacity-60' : ''
                    } flex items-center justify-center transition-transform hover:scale-110`}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className={`absolute ${idx % 2 === 0 ? 'top-10' : 'bottom-10'} left-1/2 -translate-x-1/2 text-[10px] text-slate-400 whitespace-nowrap`}>
                    {event.year}
                  </div>
                </button>
              </motion.div>
            )
          })}
        </div>

        {hoveredEvent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-lg ${
              hoveredEvent.type === 'threat' ? 'bg-red-500/10 border border-red-500/30' :
              hoveredEvent.type === 'deadline' ? 'bg-amber-500/10 border border-amber-500/30' :
              hoveredEvent.type === 'standard' ? 'bg-green-500/10 border border-green-500/30' :
              'bg-blue-500/10 border border-blue-500/30'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-white">{hoveredEvent.title}</span>
              <Badge variant={
                hoveredEvent.importance === 'critical' ? 'danger' :
                hoveredEvent.importance === 'high' ? 'warning' :
                'info'
              } size="sm">
                {hoveredEvent.year}
              </Badge>
            </div>
            <p className="text-sm text-slate-400">{hoveredEvent.description}</p>
          </motion.div>
        )}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card variant="neumorph" className="p-3 text-center">
          <Zap className="w-5 h-5 text-red-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">~2035</div>
          <div className="text-xs text-slate-400">Estimated Q-Day</div>
        </Card>
        <Card variant="neumorph" className="p-3 text-center">
          <Calendar className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">2030</div>
          <div className="text-xs text-slate-400">NSA Deadline</div>
        </Card>
        <Card variant="neumorph" className="p-3 text-center">
          <Shield className="w-5 h-5 text-green-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">2024</div>
          <div className="text-xs text-slate-400">FIPS Published</div>
        </Card>
        <Card variant="neumorph" className="p-3 text-center">
          <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{2030 - currentYear}</div>
          <div className="text-xs text-slate-400">Years to Migrate</div>
        </Card>
      </div>
    </div>
  )
}
