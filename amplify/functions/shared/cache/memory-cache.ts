import type { Hamiltonian, VQEResult } from '../types'

export interface CacheEntry<T> {
  value: T
  timestamp: number
  accessCount: number
}

export class MemoryCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private maxSize: number
  private defaultTTL: number

  constructor(maxSize: number = 1000, defaultTTLMs: number = 5 * 60 * 1000) {
    this.maxSize = maxSize
    this.defaultTTL = defaultTTLMs
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key)
      return undefined
    }

    entry.accessCount++
    return entry.value
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 1,
    })
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  private evictLRU(): void {
    let oldestKey: string | undefined
    let oldestTime = Infinity
    let lowestAccess = Infinity

    for (const [key, entry] of this.cache) {
      if (Date.now() - entry.timestamp > this.defaultTTL) {
        this.cache.delete(key)
        continue
      }

      const score = entry.accessCount * 1000 - (Date.now() - entry.timestamp)
      if (score < lowestAccess || (score === lowestAccess && entry.timestamp < oldestTime)) {
        oldestKey = key
        oldestTime = entry.timestamp
        lowestAccess = score
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0,
    }
  }
}

export const hamiltonianCache = new MemoryCache<Hamiltonian>(100, 30 * 60 * 1000)
export const circuitCache = new MemoryCache<any>(50, 10 * 60 * 1000)
export const gradientCache = new MemoryCache<number[]>(200, 60 * 1000)
export const vqeResultCache = new MemoryCache<VQEResult>(50, 60 * 60 * 1000)
