import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MemoryCache, { apiCache, CACHE_KEYS, CACHE_TTL } from '../../src/server/utils/cache';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache(1000); // 1秒清理间隔用于测试
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('基本操作', () => {
    it('应该能够设置和获取值', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('应该返回 undefined 对于不存在的键', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('应该能够删除值', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('应该能够清空所有值', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('应该能够检查键是否存在', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });
  });

  describe('TTL 功能', () => {
    it('应该在 TTL 后过期', async () => {
      cache.set('key1', 'value1', 50); // 50ms TTL
      expect(cache.get('key1')).toBe('value1');

      await new Promise(resolve => setTimeout(resolve, 60));
      expect(cache.get('key1')).toBeUndefined();
    });

    it('应该在 has() 检查时清理过期键', async () => {
      cache.set('key1', 'value1', 50);
      await new Promise(resolve => setTimeout(resolve, 60));
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('统计信息', () => {
    it('应该正确计算命中率', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('nonexistent'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(2 / 3);
      expect(stats.size).toBe(1);
    });

    it('应该在清空时重置统计', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('generateKey', () => {
    it('应该生成正确的缓存键', () => {
      const key = MemoryCache.generateKey('prefix', 'part1', 'part2');
      expect(key).toBe('prefix:part1:part2');
    });

    it('应该过滤 undefined 值', () => {
      const key = MemoryCache.generateKey('prefix', 'part1', undefined, 'part2');
      expect(key).toBe('prefix:part1:part2');
    });

    it('应该支持数字和布尔值', () => {
      const key = MemoryCache.generateKey('prefix', 123, true);
      expect(key).toBe('prefix:123:true');
    });
  });
});

describe('apiCache 全局实例', () => {
  beforeEach(() => {
    apiCache.clear();
  });

  it('应该作为单例工作', () => {
    apiCache.set('test', 'value');
    expect(apiCache.get('test')).toBe('value');
  });
});

describe('CACHE_KEYS 常量', () => {
  it('应该包含所有预期的键', () => {
    expect(CACHE_KEYS.ANNOUNCEMENT_LATEST).toBe('announcement:latest');
    expect(CACHE_KEYS.AUTH_USER).toBe('auth:user');
    expect(CACHE_KEYS.WIKI_LIST).toBe('wiki:list');
    expect(CACHE_KEYS.WIKI_PAGE).toBe('wiki:page');
    expect(CACHE_KEYS.WIKI_TIMELINE).toBe('wiki:timeline');
    expect(CACHE_KEYS.WIKI_RECOMMENDED).toBe('wiki:recommended');
  });
});

describe('CACHE_TTL 常量', () => {
  it('应该包含合理的 TTL 值', () => {
    expect(CACHE_TTL.ANNOUNCEMENT).toBe(60000); // 1分钟
    expect(CACHE_TTL.AUTH_USER).toBe(300000); // 5分钟
    expect(CACHE_TTL.WIKI_LIST).toBe(120000); // 2分钟
    expect(CACHE_TTL.WIKI_PAGE).toBe(180000); // 3分钟
    expect(CACHE_TTL.WIKI_TIMELINE).toBe(300000); // 5分钟
    expect(CACHE_TTL.WIKI_RECOMMENDED).toBe(60000); // 1分钟
  });
});
