import { useState, useCallback, useRef } from 'react';
import { apiGet } from '../lib/apiClient';
import SparkMD5 from 'spark-md5';

export interface UploadOptions {
  key?: string;
  contentType?: string;
  onProgress?: (progress: number) => void;
  enableMd5Verification?: boolean;
}

export interface UseS3UploadReturn {
  upload: (file: File, options?: UploadOptions) => Promise<{ key: string; md5: string }>;
  uploading: boolean;
  progress: number;
  error: Error | null;
  reset: () => void;
}

interface PresignResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
  md5Required?: boolean;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function calculateFileMD5(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const binary = e.target?.result;
      if (binary) {
        const hash = SparkMD5.ArrayBuffer.hash(binary as ArrayBuffer);
        resolve(hash);
      } else {
        reject(new Error('Failed to read file for MD5 calculation'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsArrayBuffer(file);
  });
}

async function fetchPresignedUrl(
  filename: string,
  contentType: string,
  options?: {
    key?: string;
    contentMd5?: string;
    fileSize?: number;
  }
): Promise<PresignResponse> {
  const response = await apiGet<PresignResponse>('/api/s3/presign-upload', {
    filename,
    contentType,
    ...(options?.key && { key: options.key }),
    ...(options?.contentMd5 && { contentMd5: options.contentMd5 }),
    ...(options?.fileSize && { fileSize: options.fileSize }),
  });
  return response;
}

async function uploadToS3(
  uploadUrl: string,
  file: File,
  options: {
    onProgress?: (progress: number) => void;
    signal: AbortSignal;
    contentMd5?: string;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.error || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    options.signal.addEventListener('abort', () => {
      xhr.abort();
    });

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);

    if (options.contentMd5) {
      xhr.setRequestHeader('Content-MD5', options.contentMd5);
    }

    xhr.send(file);
  });
}

async function uploadWithRetry(
  uploadUrl: string,
  file: File,
  options: {
    onProgress?: (progress: number) => void;
    signal: AbortSignal;
    contentMd5?: string;
  }
): Promise<void> {
  let lastError: Error;
  const { signal } = options;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      await uploadToS3(uploadUrl, file, options);
      return;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));

      if (signal.aborted) {
        throw new Error('Upload aborted');
      }

      if (attempt <= MAX_RETRIES) {
        console.log(`[S3 Upload] Upload attempt ${attempt} failed, retrying in ${RETRY_DELAY * attempt}ms...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * attempt));
      }
    }
  }

  throw lastError!;
}

export function useS3Upload(): UseS3UploadReturn {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  const upload = useCallback(
    async (file: File, options: UploadOptions = {}): Promise<{ key: string; md5: string }> => {
      reset();
      setUploading(true);
      setError(null);

      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      try {
        const contentType = options.contentType ?? file.type;
        let contentMd5: string | undefined;

        if (options.enableMd5Verification !== false) {
          console.log('[S3 Upload] Calculating file MD5...');
          contentMd5 = await calculateFileMD5(file);
          console.log('[S3 Upload] File MD5 calculated:', contentMd5);
        }

        console.log('[S3 Upload] Fetching presigned URL...');
        const presignResponse = await fetchPresignedUrl(file.name, contentType, {
          key: options.key,
          contentMd5,
          fileSize: file.size,
        });
        console.log('[S3 Upload] Presigned URL received, MD5 required:', presignResponse.md5Required);

        console.log('[S3 Upload] Starting upload to S3...');
        await uploadWithRetry(presignResponse.uploadUrl, file, {
          onProgress: (p) => {
            setProgress(p);
            options.onProgress?.(p);
          },
          signal,
          contentMd5,
        });

        setProgress(100);
        console.log('[S3 Upload] Upload completed successfully');

        return {
          key: presignResponse.key,
          md5: contentMd5 || '',
        };
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        if (err.message !== 'Upload aborted') {
          console.error('[S3 Upload] Upload failed:', err.message);
          setError(err);
        }
        throw err;
      } finally {
        setUploading(false);
        abortControllerRef.current = null;
      }
    },
    [reset]
  );

  return {
    upload,
    uploading,
    progress,
    error,
    reset,
  };
}
