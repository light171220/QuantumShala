import { cn } from '@/utils/cn'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

const sizeMap = {
  sm: { icon: 24, text: 'text-sm' },
  md: { icon: 32, text: 'text-base' },
  lg: { icon: 40, text: 'text-lg' },
  xl: { icon: 48, text: 'text-xl' },
}

export default function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const { icon, text } = sizeMap[size]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <LogoIcon size={icon} />
      {showText && (
        <span className={cn('font-display font-bold gradient-text', text)}>
          QuantumShala
        </span>
      )}
    </div>
  )
}

export function LogoIcon({ size = 32, className }: { size?: number; className?: string }) {
  const id = `logo-${Math.random().toString(36).substr(2, 9)}`

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn('flex-shrink-0', className)}
    >
      <defs>
        <linearGradient id={`${id}-core`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>

        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={`${id}-orbit1`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.1" />
          <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
        </linearGradient>

        <linearGradient id={`${id}-orbit2`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.1" />
          <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
        </linearGradient>

        <linearGradient id={`${id}-orbit3`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ec4899" stopOpacity="0.1" />
          <stop offset="50%" stopColor="#ec4899" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ec4899" stopOpacity="0.1" />
        </linearGradient>

        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#8b5cf6" floodOpacity="0.3"/>
        </filter>
      </defs>

      <circle cx="50" cy="50" r="45" fill={`url(#${id}-glow)`} />

      <circle
        cx="50"
        cy="50"
        r="42"
        fill="none"
        stroke="url(#${id}-core)"
        strokeWidth="1.5"
        strokeOpacity="0.3"
      />

      <ellipse
        cx="50"
        cy="50"
        rx="38"
        ry="14"
        fill="none"
        stroke={`url(#${id}-orbit1)`}
        strokeWidth="1.5"
        transform="rotate(-30, 50, 50)"
      />
      <ellipse
        cx="50"
        cy="50"
        rx="38"
        ry="14"
        fill="none"
        stroke={`url(#${id}-orbit2)`}
        strokeWidth="1.5"
        transform="rotate(30, 50, 50)"
      />
      <ellipse
        cx="50"
        cy="50"
        rx="38"
        ry="14"
        fill="none"
        stroke={`url(#${id}-orbit3)`}
        strokeWidth="1.5"
        transform="rotate(90, 50, 50)"
      />

      <circle
        cx="50"
        cy="50"
        r="18"
        fill={`url(#${id}-core)`}
        filter={`url(#${id}-shadow)`}
      />

      <circle
        cx="50"
        cy="50"
        r="14"
        fill="none"
        stroke="white"
        strokeWidth="1"
        strokeOpacity="0.25"
      />

      <g transform="translate(50, 50)">
        <line x1="0" y1="-8" x2="0" y2="8" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="-5" y1="-6" x2="0" y2="-8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="5" y1="-6" x2="0" y2="-8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="-6" y1="8" x2="6" y2="8" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </g>

      <circle cx="88" cy="50" r="4" fill="#06b6d4">
        <animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="50" cy="12" r="3.5" fill="#8b5cf6">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="22" cy="75" r="3" fill="#ec4899">
        <animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

export function LogoFull({ className }: { className?: string }) {
  const id = `logo-full-${Math.random().toString(36).substr(2, 9)}`

  return (
    <svg
      viewBox="0 0 320 80"
      className={cn('h-10', className)}
    >
      <defs>
        <linearGradient id={`${id}-text`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id={`${id}-core`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id={`${id}-orbit`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      <g transform="translate(10, 10)">
        <ellipse cx="30" cy="30" rx="25" ry="9" fill="none" stroke={`url(#${id}-orbit)`} strokeWidth="1.2" transform="rotate(-30, 30, 30)" />
        <ellipse cx="30" cy="30" rx="25" ry="9" fill="none" stroke={`url(#${id}-orbit)`} strokeWidth="1.2" transform="rotate(30, 30, 30)" />
        <ellipse cx="30" cy="30" rx="25" ry="9" fill="none" stroke={`url(#${id}-orbit)`} strokeWidth="1.2" transform="rotate(90, 30, 30)" />
        <circle cx="30" cy="30" r="12" fill={`url(#${id}-core)`} />
        <circle cx="30" cy="30" r="9" fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.3" />
        <g transform="translate(30, 30)">
          <line x1="0" y1="-5" x2="0" y2="5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="-3" y1="-4" x2="0" y2="-5" stroke="white" strokeWidth="1" strokeLinecap="round" />
          <line x1="3" y1="-4" x2="0" y2="-5" stroke="white" strokeWidth="1" strokeLinecap="round" />
          <line x1="-4" y1="5" x2="4" y2="5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </g>
        <circle cx="55" cy="30" r="2.5" fill="#06b6d4" />
        <circle cx="30" cy="5" r="2" fill="#8b5cf6" />
        <circle cx="12" cy="48" r="2" fill="#ec4899" />
      </g>

      <text x="80" y="48" fontFamily="system-ui, -apple-system, sans-serif" fontSize="28" fontWeight="700" fill={`url(#${id}-text)`}>
        Quantum
      </text>
      <text x="212" y="48" fontFamily="system-ui, -apple-system, sans-serif" fontSize="28" fontWeight="700" fill="white">
        Shala
      </text>
    </svg>
  )
}
