interface CacheEntry<T> {
  data: T
  setAt: number
  expiresAt: number
}

export interface CacheMetadata {
  setAt: number
  expiresAt: number
  isExpired: boolean
}

export class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private defaultTtlMs: number

  constructor(defaultTtlMs: number) {
    this.defaultTtlMs = defaultTtlMs
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }

    return entry.data
  }

  getMetadata(key: string): CacheMetadata | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    return {
      setAt: entry.setAt,
      expiresAt: entry.expiresAt,
      isExpired: Date.now() >= entry.expiresAt,
    }
  }

  set(key: string, value: T, ttlMs?: number): void {
    const now = Date.now()
    this.cache.set(key, {
      data: value,
      setAt: now,
      expiresAt: now + (ttlMs ?? this.defaultTtlMs),
    })
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}
