interface CacheEntry<T> {
  data: T
  setAt: number
  expiresAt: number
}

/** Metadata about a cached entry including its timestamps and expiration status. */
export interface CacheMetadata {
  setAt: number
  expiresAt: number
  isExpired: boolean
}

/**
 * Generic TTL-based in-memory cache.
 * Stores values with configurable per-key or default expiration times.
 */
export class TTLCache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>()
  private readonly defaultTtlMs: number

  /** @param defaultTtlMs - Default time-to-live in milliseconds for cached entries */
  constructor(defaultTtlMs: number) {
    this.defaultTtlMs = defaultTtlMs
  }

  /**
   * Retrieves a cached value if it exists and has not expired.
   *
   * @param key - Cache key
   * @returns The cached value, or `undefined` if missing or expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }

    return entry.data
  }

  /**
   * Returns metadata about a cached entry without returning the value itself.
   *
   * @param key - Cache key
   * @returns Metadata with timestamps and expiration flag, or `undefined` if not found
   */
  getMetadata(key: string): CacheMetadata | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    return {
      setAt: entry.setAt,
      expiresAt: entry.expiresAt,
      isExpired: Date.now() >= entry.expiresAt,
    }
  }

  /**
   * Stores a value in the cache with an optional custom TTL.
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlMs - Optional TTL override in milliseconds (defaults to constructor value)
   */
  set(key: string, value: T, ttlMs?: number): void {
    const now = Date.now()
    this.cache.set(key, {
      data: value,
      setAt: now,
      expiresAt: now + (ttlMs ?? this.defaultTtlMs),
    })
  }

  /** Removes a single entry from the cache. */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /** Removes all entries from the cache. */
  clear(): void {
    this.cache.clear()
  }
}
