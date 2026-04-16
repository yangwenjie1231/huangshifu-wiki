/**
 * 内存缓存工具 - 用于优化 API 响应时间
 * 支持 TTL、自动清理和统计信息
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(cleanupIntervalMs = 60000) {
    // 每分钟清理一次过期缓存
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  /**
   * 获取缓存值
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value as T;
  }

  /**
   * 设置缓存值
   * @param ttl 过期时间（毫秒），默认 5 分钟
   */
  set<T>(key: string, value: T, ttl = 300000): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 检查是否存在（未过期）
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 销毁缓存实例（清理定时器）
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }

  /**
   * 生成缓存键
   */
  static generateKey(prefix: string, ...parts: (string | number | boolean | undefined)[]): string {
    return `${prefix}:${parts.filter(p => p !== undefined).join(':')}`;
  }
}

// 全局缓存实例
export const apiCache = new MemoryCache();

// 缓存键前缀常量
export const CACHE_KEYS = {
  ANNOUNCEMENT_LATEST: 'announcement:latest',
  AUTH_USER: 'auth:user',
  WIKI_LIST: 'wiki:list',
  WIKI_PAGE: 'wiki:page',
  WIKI_TIMELINE: 'wiki:timeline',
  WIKI_RECOMMENDED: 'wiki:recommended',
} as const;

// 默认 TTL 配置（毫秒）
export const CACHE_TTL = {
  ANNOUNCEMENT: 60000,      // 1 分钟
  AUTH_USER: 300000,        // 5 分钟
  WIKI_LIST: 120000,        // 2 分钟
  WIKI_PAGE: 180000,        // 3 分钟
  WIKI_TIMELINE: 300000,    // 5 分钟
  WIKI_RECOMMENDED: 60000,  // 1 分钟
} as const;

export default MemoryCache;
