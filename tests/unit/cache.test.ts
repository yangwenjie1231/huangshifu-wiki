import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MemoryCache, EnhancedCache, apiCache, enhancedCache, CACHE_KEYS, CACHE_TTL } from '../../src/server/utils/cache';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new MemoryCache({ cleanupIntervalMs: 99999, maxSize: 100 });
  });

  afterEach(() => {
    cache.destroy();
    vi.useRealTimers();
  });

  describe('get / set', () => {
    it('returns undefined for missing key', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    it('sets and gets a value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('returns undefined for expired entries', () => {
      cache.set('temp', 'data', 1);
      vi.advanceTimersByTime(50);
      expect(cache.get('temp')).toBeUndefined();
    });

    it('preserves non-expired entries', () => {
      cache.set('stable', 'data', 100000);
      vi.advanceTimersByTime(50);
      expect(cache.get('stable')).toBe('data');
    });
  });

  describe('delete', () => {
    it('returns true when deleting existing key', () => {
      cache.set('key', 'val');
      expect(cache.delete('key')).toBe(true);
    });

    it('returns false for non-existent key', () => {
      expect(cache.delete('nope')).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all entries and resets stats', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.get('a');
      cache.get('c');
      cache.clear();
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(cache.get('a')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('returns true for existing non-expired key', () => {
      cache.set('exists', 'yes');
      expect(cache.has('exists')).toBe(true);
    });

    it('returns false for missing key', () => {
      expect(cache.has('missing')).toBe(false);
    });

    it('returns false for expired key', () => {
      cache.set('expired', 'data', 1);
      vi.advanceTimersByTime(50);
      expect(cache.has('expired')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('tracks hits and misses', () => {
      cache.set('x', 1);
      cache.get('x');
      cache.get('y');
      const s = cache.getStats();
      expect(s.hits).toBe(1);
      expect(s.misses).toBe(1);
    });

    it('calculates hitRate correctly', () => {
      cache.set('a', 1);
      cache.get('a');
      cache.get('a');
      cache.get('b');
      const s = cache.getStats();
      expect(s.hitRate).toBeCloseTo(2 / 3);
    });

    it('returns hitRate 0 when no requests made', () => {
      expect(cache.getStats().hitRate).toBe(0);
    });
  });

  describe('destroy', () => {
    it('clears interval and data', () => {
      cache.set('k', 'v');
      cache.destroy();
      expect(cache.get('k')).toBeUndefined();
    });
  });

  describe('maxSize eviction', () => {
    it('evicts oldest entry when at capacity', () => {
      const tiny = new MemoryCache({ cleanupIntervalMs: 99999, maxSize: 2 });
      try {
        tiny.set('first', 1);
        tiny.set('second', 2);
        tiny.set('third', 3);
        expect(tiny.get('first')).toBeUndefined();
        expect(tiny.get('second')).toBeDefined();
        expect(tiny.get('third')).toBe(3);
      } finally {
        tiny.destroy();
      }
    });
  });
});

describe('MemoryCache.generateKey', () => {
  it('joins prefix and parts with colon', () => {
    expect(MemoryCache.generateKey('wiki', 'page', 'slug')).toBe('wiki:page:slug');
  });

  it('filters out undefined parts', () => {
    expect(MemoryCache.generateKey('api', 'user', undefined, 'detail')).toBe('api:user:detail');
  });

  it('handles no extra parts', () => {
    expect(MemoryCache.generateKey('site')).toBe('site:');
  });
});

describe('EnhancedCache', () => {
  let cache: EnhancedCache;

  beforeEach(() => {
    cache = new EnhancedCache({ stdTTL: 10, maxKeys: 100, checkperiod: 99999 });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('get / set', () => {
    it('sets and gets values', () => {
      cache.set('k', 'v');
      expect(cache.get('k')).toBe('v');
    });

    it('returns undefined for missing keys', () => {
      expect(cache.get('nope')).toBeUndefined();
    });

    it('returns true on successful set', () => {
      expect(cache.set('k', 'v')).toBe(true);
    });
  });

  describe('delete', () => {
    it('deletes existing key', () => {
      cache.set('k', 'v');
      expect(cache.delete('k')).toBeGreaterThan(0);
    });
  });

  describe('has', () => {
    it('returns true for set key', () => {
      cache.set('k', 'v');
      expect(cache.has('k')).toBe(true);
    });

    it('returns false for unset key', () => {
      expect(cache.has('absent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('flushes all entries', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('tracks hits and misses', () => {
      cache.set('x', 1);
      cache.get('x');
      cache.get('y');
      const s = cache.getStats();
      expect(s.hits).toBe(1);
      expect(s.misses).toBe(1);
    });
  });

  describe('destroy', () => {
    it('closes the cache', () => {
      cache.destroy();
      expect(cache.get('anything')).toBeUndefined();
    });
  });
});

describe('EnhancedCache.generateKey', () => {
  it('generates key same as MemoryCache format', () => {
    expect(EnhancedCache.generateKey('auth', 'user', '123')).toBe('auth:user:123');
  });
});

describe('exported constants', () => {
  it('CACHE_KEYS has expected shape', () => {
    expect(CACHE_KEYS.WIKI_PAGE).toBe('wiki:page');
    expect(CACHE_KEYS.AUTH_USER).toBe('auth:user');
  });

  it('CACHE_TTL has expected values', () => {
    expect(CACHE_TTL.ANNOUNCEMENT).toBe(60000);
    expect(CACHE_TTL.WIKI_PAGE).toBe(180000);
  });
});
