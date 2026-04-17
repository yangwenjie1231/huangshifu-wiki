import { useState, useEffect, useCallback } from 'react';
import {
  ImageMap,
  ImageUrlResult,
  getImagePreference,
  clearImagePreferenceCache,
  resolveImageUrl,
  ResolveImageUrlOptions,
} from '../services/imageService';

export interface UseImageUrlOptions extends ResolveImageUrlOptions {
  immediate?: boolean;
}

export interface UseImageUrlReturn {
  url: string;
  storageType: 'local' | 's3' | 'external';
  blurhash?: string;
  md5: string;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useImageUrl(
  image: ImageMap | string | null | undefined,
  options: UseImageUrlOptions = {}
): UseImageUrlReturn {
  const { forceType, immediate = true } = options;

  const [url, setUrl] = useState('');
  const [storageType, setStorageType] = useState<'local' | 's3' | 'external'>('local');
  const [blurhash, setBlurhash] = useState<string | undefined>();
  const [md5, setMd5] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [preference, setPreference] = useState<{ strategy: 'local' | 's3' | 'external'; fallback: boolean }>({
    strategy: 'local',
    fallback: true,
  });

  const resolve = useCallback(async () => {
    if (!image) {
      setUrl('');
      return;
    }

    if (typeof image === 'string') {
      setUrl(image);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const pref = await getImagePreference();
      setPreference(pref);

      const result = await resolveImageUrl(image, pref, { forceType });
      setUrl(result.url);
      setStorageType(result.storageType);
      setBlurhash(result.blurhash);
      setMd5(result.md5);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to resolve image URL'));
    } finally {
      setLoading(false);
    }
  }, [image, forceType]);

  useEffect(() => {
    if (immediate && image) {
      resolve();
    }
  }, [image, immediate, forceType]);

  return {
    url,
    storageType,
    blurhash,
    md5,
    loading,
    error,
    refresh: resolve,
  };
}