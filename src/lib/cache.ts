interface CacheEntry<T> {
  data: T
  expiresAt: number
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

  set(key: string, value: T, ttlMs?: number): void {
    this.cache.set(key, {
      data: value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    })
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}
