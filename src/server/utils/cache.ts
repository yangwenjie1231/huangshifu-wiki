/**
 * 内存缓存工具 - 用于优化 API 响应时间
 * 支持 TTL、自动清理和统计信息
 */

import NodeCache from 'node-cache';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  hitRate: number;
}

/**
 * 基于 node-cache 的增强缓存类
 * 支持 TTL、最大键数量限制、命中率统计
 */
class EnhancedCache {
  private cache: NodeCache;
  private hits = 0;
  private misses = 0;
  private readonly maxKeys: number;

  constructor(options?: { stdTTL?: number; maxKeys?: number; checkperiod?: number }) {
    const stdTTL = typeof options === 'object' ? options.stdTTL ?? 300 : 300; // 默认 5 分钟（秒）
    this.maxKeys = typeof options === 'object' && options.maxKeys !== undefined ? options.maxKeys : 1000;
    const checkperiod = typeof options === 'object' ? options.checkperiod ?? 60 : 60;

    this.cache = new NodeCache({
      stdTTL,
      checkperiod,
      maxKeys: this.maxKeys,
      useClones: false,
    });

    this.cache.on('evict', (_key, _value) => {
      // 当达到 maxKeys 时，node-cache 会自动驱逐最老的键
    });
  }

  /**
   * 获取缓存值
   * @param key 缓存键
   */
  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);
    if (value === undefined) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    return value;
  }

  /**
   * 设置缓存值
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间（秒），默认使用构造时的 stdTTL
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    return ttl !== undefined ? this.cache.set(key, value, ttl) : this.cache.set(key, value);
  }

  /**
   * 删除缓存
   * @param key 缓存键
   */
  delete(key: string): number {
    return this.cache.del(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.flushAll();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 检查是否存在（未过期）
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.keys().length,
      maxSize: this.maxKeys,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * 获取 node-cache 原生统计（keys、hits、misses）
   */
  getNativeStats(): NodeCache.Stats {
    return this.cache.getStats();
  }

  /**
   * 销毁缓存实例
   */
  destroy(): void {
    this.cache.close();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 生成缓存键
   */
  static generateKey(prefix: string, ...parts: (string | number | boolean | undefined)[]): string {
    return `${prefix}:${parts.filter(p => p !== undefined).join(':')}`;
  }
}

// 全局增强缓存实例
export const enhancedCache = new EnhancedCache({
  stdTTL: 300, // 5 分钟
  maxKeys: 1000,
  checkperiod: 60,
});

// 缓存键前缀常量
export const CACHE_KEYS = {
  ANNOUNCEMENT_LATEST: 'announcement:latest',
  AUTH_USER: 'auth:user',
  WIKI_LIST: 'wiki:list',
  WIKI_PAGE: 'wiki:page',
  WIKI_TIMELINE: 'wiki:timeline',
  WIKI_RECOMMENDED: 'wiki:recommended',
  SITE_CONFIG: 'site:config',
  MUSIC_PLAY_URL: 'music:playUrl',
} as const;

export { EnhancedCache };

export const CACHE_TTL_SEC = {
  ANNOUNCEMENT: 60,
  AUTH_USER: 300,
  WIKI_LIST: 120,
  WIKI_PAGE: 180,
  WIKI_TIMELINE: 300,
  WIKI_RECOMMENDED: 60,
  SITE_CONFIG: 300,
  MUSIC_PLAY_URL: 600,
} as const;
