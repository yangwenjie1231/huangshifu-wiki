export interface BlurhashConfig {
  enabled: boolean;
  autoGenerate: boolean;
  componentsX: number;
  componentsY: number;
}

export interface BlurhashResult {
  blurhash?: string;
  thumbhash?: string;
}

const DEFAULT_BLURHASH_CONFIG: BlurhashConfig = {
  enabled: true,
  autoGenerate: true,
  componentsX: 4,
  componentsY: 3,
};

let cachedConfig: BlurhashConfig | null = null;

function getBlurhashConfig(): BlurhashConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const enabled = process.env.BLURHASH_ENABLED !== 'false';
  const autoGenerate = process.env.BLURHASH_AUTO_GENERATE !== 'false';
  const componentsX = parseInt(process.env.BLURHASH_COMPONENTS_X || '4', 10);
  const componentsY = parseInt(process.env.BLURHASH_COMPONENTS_Y || '3', 10);

  cachedConfig = {
    enabled,
    autoGenerate,
    componentsX: isNaN(componentsX) ? 4 : componentsX,
    componentsY: isNaN(componentsY) ? 3 : componentsY,
  };

  return cachedConfig;
}

export function isBlurhashEnabled(): boolean {
  return getBlurhashConfig().enabled;
}

export function shouldAutoGenerate(): boolean {
  return getBlurhashConfig().autoGenerate;
}

const blurhashCache = new Map<string, BlurhashResult>();
const BLURHASH_CACHE_TTL = 60 * 60 * 1000;

function getCachedBlurhash(key: string): BlurhashResult | null {
  const cached = blurhashCache.get(key);
  if (cached) {
    const timestamp = blurhashCache.get(`_timestamp_${key}`);
    if (timestamp && Date.now() - (timestamp as any) < BLURHASH_CACHE_TTL) {
      return cached;
    }
    blurhashCache.delete(key);
    blurhashCache.delete(`_timestamp_${key}`);
  }
  return null;
}

function setCachedBlurhash(key: string, result: BlurhashResult): void {
  blurhashCache.set(key, result);
  blurhashCache.set(`_timestamp_${key}`, Date.now() as any);
}

export async function fetchBlurhashFromS3(imageUrl: string): Promise<string | null> {
  if (!imageUrl) {
    console.warn('[Blurhash] Image URL is empty');
    return null;
  }

  const cacheKey = `blurhash_${imageUrl}`;
  const cached = getCachedBlurhash(cacheKey);
  if (cached?.blurhash) {
    console.log('[Blurhash] Using cached blurhash for:', imageUrl);
    return cached.blurhash;
  }

  try {
    const blurhashUrl = `${imageUrl}?fmt=blurhash`;
    console.log('[Blurhash] Fetching from:', blurhashUrl);

    const response = await fetch(blurhashUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain',
      },
    });

    if (!response.ok) {
      console.error(`[Blurhash] Failed to fetch blurhash: ${response.status} ${response.statusText}`);
      return null;
    }

    const blurhash = await response.text();

    if (!blurhash || blurhash.length < 10) {
      console.warn('[Blurhash] Invalid blurhash received:', blurhash);
      return null;
    }

    const result: BlurhashResult = { blurhash };
    setCachedBlurhash(cacheKey, result);

    console.log('[Blurhash] Successfully fetched blurhash:', blurhash.substring(0, 20) + '...');
    return blurhash;
  } catch (error) {
    console.error('[Blurhash] Error fetching blurhash:', error);
    return null;
  }
}

export async function fetchThumbhashFromS3(imageUrl: string): Promise<string | null> {
  if (!imageUrl) {
    console.warn('[Thumbhash] Image URL is empty');
    return null;
  }

  const cacheKey = `thumbhash_${imageUrl}`;
  const cached = getCachedBlurhash(cacheKey);
  if (cached?.thumbhash) {
    console.log('[Thumbhash] Using cached thumbhash for:', imageUrl);
    return cached.thumbhash;
  }

  try {
    const thumbhashUrl = `${imageUrl}?fmt=thumbhash`;
    console.log('[Thumbhash] Fetching from:', thumbhashUrl);

    const response = await fetch(thumbhashUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain',
      },
    });

    if (!response.ok) {
      console.error(`[Thumbhash] Failed to fetch thumbhash: ${response.status} ${response.statusText}`);
      return null;
    }

    const thumbhash = await response.text();

    if (!thumbhash || thumbhash.length < 10) {
      console.warn('[Thumbhash] Invalid thumbhash received:', thumbhash);
      return null;
    }

    const result: BlurhashResult = { thumbhash };
    setCachedBlurhash(cacheKey, result);

    console.log('[Thumbhash] Successfully fetched thumbhash:', thumbhash.substring(0, 20) + '...');
    return thumbhash;
  } catch (error) {
    console.error('[Thumbhash] Error fetching thumbhash:', error);
    return null;
  }
}

export async function generateImageHashes(imageUrl: string): Promise<BlurhashResult> {
  if (!isBlurhashEnabled()) {
    console.log('[Blurhash] Blurhash is disabled');
    return {};
  }

  const cacheKey = `hashes_${imageUrl}`;
  const cached = getCachedBlurhash(cacheKey);
  if (cached) {
    console.log('[Blurhash] Using cached hashes for:', imageUrl);
    return cached;
  }

  const config = getBlurhashConfig();
  const result: BlurhashResult = {};

  if (config.autoGenerate) {
    console.log('[Blurhash] Auto-generating hashes for:', imageUrl);

    const [blurhash, thumbhash] = await Promise.all([
      fetchBlurhashFromS3(imageUrl),
      fetchThumbhashFromS3(imageUrl),
    ]);

    if (blurhash) {
      result.blurhash = blurhash;
    }

    if (thumbhash) {
      result.thumbhash = thumbhash;
    }

    if (Object.keys(result).length > 0) {
      setCachedBlurhash(cacheKey, result);
    }
  }

  return result;
}

export async function refreshImageHashes(imageUrl: string): Promise<BlurhashResult> {
  const cacheKey = `hashes_${imageUrl}`;
  blurhashCache.delete(cacheKey);
  blurhashCache.delete(`blurhash_${imageUrl}`);
  blurhashCache.delete(`thumbhash_${imageUrl}`);

  return generateImageHashes(imageUrl);
}

export function clearBlurhashCache(): void {
  blurhashCache.clear();
  console.log('[Blurhash] Cache cleared');
}

export function getBlurhashCacheSize(): number {
  return Math.floor(blurhashCache.size / 2);
}
