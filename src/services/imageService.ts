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

  const localUrl = URL.createObjectURL(file);
  const imageId = Math.random().toString(36).substring(7);

  const imageMap: ImageMap = {
    id: imageId,
    md5,
    localUrl,
    storageType: 'local',
    createdAt: new Date().toISOString(),
  };

  await apiPost('/api/image-maps', {
    id: imageMap.id,
    md5: imageMap.md5,
    localUrl: imageMap.localUrl,
    storageType: imageMap.storageType,
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

  const localUrl = URL.createObjectURL(file);

  await apiPost('/api/image-maps', {
    id: imageId,
    md5,
    localUrl,
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
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/uploads', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      const url = data?.file?.url;
      if (typeof url === 'string' && url) {
        return url;
      }
    }
  } catch (error) {
    console.error('Local markdown image upload failed, falling back to legacy image bed:', error);
  }

  const preference = await getImagePreference();
  
  if (preference.strategy === 's3') {
    try {
      const s3Result = await uploadToS3(file);
      return s3Result.s3Url;
    } catch (s3Error) {
      console.error('S3 upload failed:', s3Error);
    }
  }

  const imageId = await uploadImageToCDNs(file);
  const urls = await getImageUrl(imageId);
  return urls[0] || '';
};
