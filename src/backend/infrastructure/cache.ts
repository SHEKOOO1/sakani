interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/// WARNING: In-memory cache — NOT safe for multi-instance deployments.
/// Each process has its own isolated cache, leading to inconsistency.
/// Replace with Redis (or similar) for horizontal scaling.
export class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs = 30_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePattern(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export const permissionCache = new MemoryCache<boolean>(60_000);
export const userCache = new MemoryCache<any>(15_000);
export const tenantCache = new MemoryCache<any>(30_000);

// مسح كاش الصلاحيات والسكنات لمستخدم محدد فور تغيير دوره أو صلاحياته أو تعييناته
export function invalidateUserPermissionCache(userId: string): void {
  permissionCache.invalidatePattern(`perm:${userId}:`);
  userCache.invalidate(`user:${userId}`);
  userCache.invalidatePattern(`tenantIds:${userId}`);
  userCache.invalidatePattern(`assignment:${userId}:`);
  userCache.invalidatePattern(`bishop_tenant:${userId}:`);
}
