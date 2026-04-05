import { apiGet, apiPost } from '../lib/apiClient';
import SparkMD5 from 'spark-md5';

export interface ImageMap {
  id: string;
  md5: string;
  localUrl: string;
  weiboUrl?: string;
  smmsUrl?: string;
  superbedUrl?: string;
  createdAt: any;
}

/**
 * Calculates the MD5 hash of a file.
 */
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

/**
 * Uploads an image to multiple CDNs and stores the mapping in Firestore.
 * Note: In a real implementation, you would call the respective CDN APIs here.
 * For this prototype, we'll simulate the upload by generating mock CDN URLs.
 */
export const uploadImageToCDNs = async (file: File): Promise<string> => {
  // 1. Calculate MD5 hash
  const md5 = await calculateMD5(file);

  // 2. Check if image with same MD5 already exists
  const listResponse = await apiGet<{ items: ImageMap[] }>('/api/image-maps', { md5 });
  const existingItems = listResponse.items || [];

  if (existingItems.length > 0) {
    // Image already exists, return the existing ID
    return existingItems[0].id;
  }

  // 3. Simulate local upload (using URL.createObjectURL for demo, in real app use Firebase Storage)
  const localUrl = URL.createObjectURL(file);
  const imageId = Math.random().toString(36).substring(7);

  // 4. Simulate uploading to multiple CDNs
  // In a real app, you'd use fetch() to call Weibo, SM.MS, and Superbed APIs.
  const weiboUrl = `https://wx1.sinaimg.cn/large/${imageId}.jpg`;
  const smmsUrl = `https://s2.loli.net/2024/03/23/${imageId}.jpg`;
  const superbedUrl = `https://pic.superbed.cn/item/${imageId}.jpg`;

  const imageMap: ImageMap = {
    id: imageId,
    md5,
    localUrl,
    weiboUrl,
    smmsUrl,
    superbedUrl,
    createdAt: new Date().toISOString(),
  };

  // 5. Store mapping via API
  await apiPost('/api/image-maps', {
    id: imageMap.id,
    md5: imageMap.md5,
    localUrl: imageMap.localUrl,
    weiboUrl: imageMap.weiboUrl,
    smmsUrl: imageMap.smmsUrl,
    superbedUrl: imageMap.superbedUrl,
  });

  return imageId;
};

/**
 * Fetches the best available URL for an image ID.
 */
export const getImageUrl = async (imageId: string): Promise<string[]> => {
  try {
    const response = await apiGet<{ item: ImageMap }>(`/api/image-maps/${imageId}`);
    const data = response.item;
    // Order of preference: Weibo -> SM.MS -> Superbed -> Local
    return [
      data.weiboUrl,
      data.smmsUrl,
      data.superbedUrl,
      data.localUrl,
    ].filter(Boolean) as string[];
  } catch (e) {
    console.error("Error fetching image map:", e);
  }
  return [];
};
