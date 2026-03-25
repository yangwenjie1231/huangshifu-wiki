import { apiUpload } from '../apiClient';

type StorageReference = {
  path: string;
};

export const storage = {
  kind: 'local-storage',
};

export function ref(_storage: unknown, path: string): StorageReference {
  return { path };
}

export async function uploadBytes(storageRef: StorageReference, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiUpload<{ file: { assetId?: string; url: string; name: string; mimeType?: string; sizeBytes?: number } }>(
    '/api/uploads',
    formData,
  );

  const uploaded = response.file;
  if (!uploaded?.url) {
    throw new Error('上传图片失败，未返回可用地址');
  }

  return {
    metadata: {
      fullPath: storageRef.path,
    },
    assetId: uploaded.assetId,
    mimeType: uploaded.mimeType,
    sizeBytes: uploaded.sizeBytes,
    url: uploaded.url,
  };
}

export async function getDownloadURL(uploadResult: { url: string }) {
  return uploadResult.url;
}
