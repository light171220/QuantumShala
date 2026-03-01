import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  
  if (isToday(d)) {
    return `Today at ${format(d, 'h:mm a')}`
  }
  
  if (isYesterday(d)) {
    return `Yesterday at ${format(d, 'h:mm a')}`
  }
  
  return format(d, 'MMM d, yyyy')
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (mins === 0) {
    return `${hours}h`
  }
  
  return `${hours}h ${mins}m`
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  
  return num.toLocaleString()
}

export function formatPercentage(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`
}

export function formatXP(xp: number): string {
  return `${formatNumber(xp)} XP`
}

export function formatStreak(days: number): string {
  if (days === 0) {
    return 'No streak'
  }
  
  if (days === 1) {
    return '1 day'
  }
  
  return `${days} days`
}

export function formatComplexNumber(re: number, im: number, precision = 3): string {
  const reStr = re.toFixed(precision)
  const imAbs = Math.abs(im).toFixed(precision)
  
  if (Math.abs(im) < 0.0001) {
    return reStr
  }
  
  if (Math.abs(re) < 0.0001) {
    return im >= 0 ? `${imAbs}i` : `-${imAbs}i`
  }
  
  const sign = im >= 0 ? '+' : '-'
  return `${reStr} ${sign} ${imAbs}i`
}

export function formatProbability(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`
}
