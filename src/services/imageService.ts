import { apiGet, apiPost } from '../lib/apiClient';
import SparkMD5 from 'spark-md5';

export interface ImageMap {
  id: string;
  md5: string;
  localUrl: string;
  externalUrl?: string;
  s3Url?: string;
  storageType?: 'local' | 's3' | 'external';
  blurhash?: string;
  thumbhash?: string;
  createdAt: string;
}

export interface ImagePreference {
  strategy: 'local' | 's3' | 'external';
  fallback: boolean;
}

export interface ImageUrlResult {
  url: string;
  storageType: 'local' | 's3' | 'external';
  blurhash?: string;
  md5: string;
}

export interface ResolveImageUrlOptions {
  forceType?: 'local' | 's3' | 'external';
}

export interface UploadImageOptions {
  type?: 'general' | 'avatar' | 'cover' | 'gallery' | 'markdown';
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

export interface UploadImageResult {
  assetId: string;
  url: string;
  localUrl?: string;
  s3Url?: string;
  externalUrl?: string;
  storageType: 'local' | 's3' | 'external';
  md5?: string;
  blurhash?: string;
}

let cachedPreference: ImagePreference | null = null;

export const getImagePreference = async (): Promise<ImagePreference> => {
  if (cachedPreference) {
    return cachedPreference;
  }

  try {
    const response = await apiGet<ImagePreference>('/api/config/image-preference');
    cachedPreference = response;
    return response;
  } catch (error) {
    console.error('Failed to fetch image preference:', error);
    return { strategy: 'local', fallback: true };
  }
};

export const clearImagePreferenceCache = () => {
  cachedPreference = null;
};

const getUrlByPreference = (map: ImageMap, preference: ImagePreference): string | null => {
  const { strategy, fallback } = preference;

  const getPrimaryUrl = () => {
    switch (strategy) {
      case 'external':
        return map.externalUrl || null;
      case 's3':
        return map.s3Url || null;
      case 'local':
      default:
        return map.localUrl || null;
    }
  };

  const primaryUrl = getPrimaryUrl();
  if (primaryUrl) {
    return primaryUrl;
  }

  if (!fallback) {
    return null;
  }

  const fallbackUrls = [map.s3Url, map.externalUrl, map.localUrl].filter(
    Boolean,
  ) as string[];

  if (fallbackUrls.length > 0) {
    return fallbackUrls[0];
  }

  return null;
};

export const resolveImageUrl = (
  map: ImageMap,
  preference: ImagePreference,
  options: ResolveImageUrlOptions = {},
): ImageUrlResult => {
  const { forceType } = options;
  const strategy = forceType || preference.strategy;
  const { fallback } = preference;

  const getPrimaryUrl = (): { url: string | null; type: 'local' | 's3' | 'external' } => {
    switch (strategy) {
      case 'external':
        return { url: map.externalUrl || null, type: 'external' };
      case 's3':
        return { url: map.s3Url || null, type: 's3' };
      case 'local':
      default:
        return { url: map.localUrl || null, type: 'local' };
    }
  };

  const primary = getPrimaryUrl();
  if (primary.url) {
    return {
      url: primary.url,
      storageType: primary.type,
      blurhash: map.blurhash,
      md5: map.md5,
    };
  }

  if (!fallback) {
    return {
      url: '',
      storageType: 'local',
      blurhash: map.blurhash,
      md5: map.md5,
    };
  }

  const fallbackUrls = [
    { url: map.s3Url || '', type: 's3' as const },
    { url: map.externalUrl || '', type: 'external' as const },
    { url: map.localUrl || '', type: 'local' as const },
  ].filter((item) => item.url && item.url !== primary.url);

  if (fallbackUrls.length > 0) {
    const first = fallbackUrls[0];
    return {
      url: first.url,
      storageType: first.type,
      blurhash: map.blurhash,
      md5: map.md5,
    };
  }

  return {
    url: '',
    storageType: map.storageType || 'local',
    blurhash: map.blurhash,
    md5: map.md5,
  };
};

export const getImageUrlWithMeta = async (
  imageId: string,
  options: ResolveImageUrlOptions = {},
): Promise<ImageUrlResult | null> => {
  try {
    const response = await apiGet<{ item: ImageMap }>(`/api/image-maps/${imageId}`);
    const data = response.item;
    const preference = await getImagePreference();
    return resolveImageUrl(data, preference, options);
  } catch (e) {
    console.error('Error fetching image URL with meta:', e);
  }
  return null;
};

const calculateMD5 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const binary = e.target?.result;
      if (binary) {
        const hash = SparkMD5.ArrayBuffer.hash(binary as ArrayBuffer);
        resolve(hash);
      } else {
        reject(new Error("Failed to read file for MD5 calculation"));
      }
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsArrayBuffer(file);
  });
};

export const uploadImageToCDNs = async (file: File): Promise<string> => {
  const md5 = await calculateMD5(file);

  const listResponse = await apiGet<{ items: ImageMap[] }>('/api/image-maps', { md5 });
  const existingItems = listResponse.items || [];

  if (existingItems.length > 0) {
    return existingItems[0].id;
  }

  // Upload file to server first
  const formData = new FormData();
  formData.append('file', file);

  const uploadResponse = await fetch('/api/uploads', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload file to server');
  }

  const uploadData = await uploadResponse.json();
  const localUrl = uploadData?.file?.url;

  if (!localUrl) {
    throw new Error('Failed to get upload URL');
  }

  const imageId = Math.random().toString(36).substring(7);

  await apiPost('/api/image-maps', {
    id: imageId,
    md5,
    localUrl,
    storageType: 'local',
  });

  return imageId;
};

export const uploadToS3 = async (file: File): Promise<{ id: string; s3Url: string; key: string }> => {
  const md5 = await calculateMD5(file);

  const listResponse = await apiGet<{ items: ImageMap[] }>('/api/image-maps', { md5 });
  const existingItems = listResponse.items || [];

  if (existingItems.length > 0) {
    const existing = existingItems[0];
    if (existing.s3Url) {
      return {
        id: existing.id,
        s3Url: existing.s3Url,
        key: existing.s3Url.split('/').pop() || existing.id,
      };
    }
  }

  const filename = `${md5}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  
  const presignResponse = await apiGet<{
    uploadUrl: string;
    key: string;
    expiresIn: number;
  }>('/api/s3/presign-upload', {
    filename,
    contentType: file.type,
    bucket: 'private',
  });

  await fetch(presignResponse.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  const configResponse = await apiGet<{
    enabled: boolean;
    endpoint: string;
    bucket: string;
    publicDomain?: string;
    region: string;
  }>('/api/s3/config');

  let s3Url: string;
  if (configResponse.publicDomain) {
    s3Url = `${configResponse.publicDomain}/${presignResponse.key}`;
  } else {
    s3Url = `${configResponse.endpoint}/${configResponse.bucket}/${presignResponse.key}`;
  }

  const imageId = Math.random().toString(36).substring(7);

  if (existingItems.length > 0) {
    await apiPost('/api/image-maps', {
      id: existingItems[0].id,
      s3Url,
      storageType: 's3',
    });
    return {
      id: existingItems[0].id,
      s3Url,
      key: presignResponse.key,
    };
  }

  // Also upload to local server for backup
  const formData = new FormData();
  formData.append('file', file);

  const uploadResponse = await fetch('/api/uploads', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  let localUrl: string | undefined;
  if (uploadResponse.ok) {
    const uploadData = await uploadResponse.json();
    localUrl = uploadData?.file?.url;
  }

  await apiPost('/api/image-maps', {
    id: imageId,
    md5,
    ...(localUrl && { localUrl }),
    s3Url,
    storageType: 's3',
  });

  return {
    id: imageId,
    s3Url,
    key: presignResponse.key,
  };
};

export const uploadImage = async (
  file: File,
  preferredStorage?: 'local' | 's3',
): Promise<{ id: string; url: string; storageType: 'local' | 's3' }> => {
  try {
    if (preferredStorage === 's3' || preferredStorage === undefined) {
      try {
        const s3Result = await uploadToS3(file);
        return {
          id: s3Result.id,
          url: s3Result.s3Url,
          storageType: 's3',
        };
      } catch (s3Error) {
        console.error('S3 upload failed, falling back to local:', s3Error);
      }
    }

    const imageId = await uploadImageToCDNs(file);
    const urls = await getImageUrl(imageId);
    return {
      id: imageId,
      url: urls[0] || '',
      storageType: 'local',
    };
  } catch (error) {
    console.error('Image upload failed:', error);
    throw error;
  }
};

export const getImageUrl = async (imageId: string): Promise<string[]> => {
  try {
    const response = await apiGet<{ item: ImageMap }>(`/api/image-maps/${imageId}`);
    const data = response.item;
    const preference = await getImagePreference();

    const primaryUrl = getUrlByPreference(data, preference);
    if (!primaryUrl) {
      return [];
    }

    if (!preference.fallback) {
      return [primaryUrl];
    }

    const fallbackUrls = [data.s3Url, data.externalUrl, data.localUrl].filter(
      (url) => url && url !== primaryUrl,
    ) as string[];

    return [primaryUrl, ...fallbackUrls];
  } catch (e) {
    console.error("Error fetching image map:", e);
  }
  return [];
};

export const getPrimaryImageUrl = async (imageId: string): Promise<string | null> => {
  try {
    const response = await apiGet<{ item: ImageMap }>(`/api/image-maps/${imageId}`);
    const data = response.item;
    const preference = await getImagePreference();
    return getUrlByPreference(data, preference);
  } catch (e) {
    console.error("Error fetching primary image URL:", e);
  }
  return null;
};

export const uploadMarkdownImage = async (file: File): Promise<string> => {
  try {
    const result = await uploadImageWithStrategy(file, { type: 'markdown' });
    return result.url;
  } catch (error) {
    console.error('Markdown image upload failed:', error);
    throw error;
  }
};

/**
 * 统一图片上传函数（支持存储策略）
 * 
 * 根据当前存储策略自动选择上传方式：
 * - local: 上传到本地
 * - s3: 上传到 S3（同时本地备份）
 * - external: 上传到外部图床（同时本地和 S3 备份）
 * 
 * 返回包含 assetId 和根据策略选择的 URL，以及所有存储位置的 URL
 */
export const uploadImageWithStrategy = async (
  file: File,
  options: UploadImageOptions = {}
): Promise<UploadImageResult> => {
  const { type = 'general', onProgress, signal } = options;
  
  // 获取当前存储策略
  const preference = await getImagePreference();
  
  // 根据策略决定是否启用三重存储
  const useTripleStorage = preference.strategy === 's3' || preference.strategy === 'external';
  
  const formData = new FormData();
  formData.append('file', file);

  // 构建 URL，可选启用三重存储模式
  const url = new URL('/api/uploads', window.location.origin);
  if (useTripleStorage) {
    url.searchParams.set('tripleStorage', 'true');
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    credentials: 'include',
    body: formData,
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { error?: string })?.error || '上传失败');
  }

  const data = await response.json() as { 
    file: { assetId: string; url: string; md5?: string };
    tripleStorage?: { localUrl: string; s3Url?: string; externalUrl?: string };
  };
  
  // 如果启用了三重存储，返回所有 URL
  if (useTripleStorage && data.tripleStorage) {
    const { localUrl, s3Url, externalUrl } = data.tripleStorage;
    
    let selectedUrl: string;
    switch (preference.strategy) {
      case 'external':
        selectedUrl = externalUrl || s3Url || localUrl;
        break;
      case 's3':
        selectedUrl = s3Url || externalUrl || localUrl;
        break;
      case 'local':
      default:
        selectedUrl = localUrl;
        break;
    }
    
    return {
      assetId: data.file.assetId,
      url: selectedUrl,
      localUrl,
      s3Url,
      externalUrl,
      storageType: preference.strategy,
      md5: data.file.md5,
    };
  }
  
  // 否则返回默认 URL
  return {
    assetId: data.file.assetId,
    url: data.file.url,
    localUrl: data.file.url,
    storageType: 'local',
    md5: data.file.md5,
  };
};

/**
 * 上传头像（支持裁剪和存储策略）
 * 
 * @param blob 裁剪后的头像图片 Blob
 * @param options 上传选项
 * @returns 上传后的头像 URL 和完整结果
 */
export const uploadAvatar = async (
  blob: Blob,
  options?: UploadImageOptions
): Promise<UploadImageResult> => {
  const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
  return uploadImageWithStrategy(file, { ...options, type: 'avatar' });
};
