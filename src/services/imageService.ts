import { collection, doc, setDoc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface ImageMap {
  id: string;
  localUrl: string;
  weiboUrl?: string;
  smmsUrl?: string;
  superbedUrl?: string;
  createdAt: any;
}

/**
 * Uploads an image to multiple CDNs and stores the mapping in Firestore.
 * Note: In a real implementation, you would call the respective CDN APIs here.
 * For this prototype, we'll simulate the upload by generating mock CDN URLs.
 */
export const uploadImageToCDNs = async (file: File): Promise<string> => {
  // 1. Simulate local upload (using URL.createObjectURL for demo, in real app use Firebase Storage)
  const localUrl = URL.createObjectURL(file);
  const imageId = Math.random().toString(36).substring(7);

  // 2. Simulate uploading to multiple CDNs
  // In a real app, you'd use fetch() to call Weibo, SM.MS, and Superbed APIs.
  const weiboUrl = `https://wx1.sinaimg.cn/large/${imageId}.jpg`;
  const smmsUrl = `https://s2.loli.net/2024/03/23/${imageId}.jpg`;
  const superbedUrl = `https://pic.superbed.cn/item/${imageId}.jpg`;

  const imageMap: ImageMap = {
    id: imageId,
    localUrl,
    weiboUrl,
    smmsUrl,
    superbedUrl,
    createdAt: serverTimestamp()
  };

  // 3. Store mapping in Firestore
  await setDoc(doc(db, 'imageMaps', imageId), imageMap);

  return imageId;
};

/**
 * Fetches the best available URL for an image ID.
 */
export const getImageUrl = async (imageId: string): Promise<string[]> => {
  try {
    const docSnap = await getDoc(doc(db, 'imageMaps', imageId));
    if (docSnap.exists()) {
      const data = docSnap.data() as ImageMap;
      // Order of preference: Weibo -> SM.MS -> Superbed -> Local
      return [
        data.weiboUrl,
        data.smmsUrl,
        data.superbedUrl,
        data.localUrl
      ].filter(Boolean) as string[];
    }
  } catch (e) {
    console.error("Error fetching image map:", e);
  }
  return [];
};
