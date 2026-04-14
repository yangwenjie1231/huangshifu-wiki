import React, { useState, useCallback, useRef } from 'react';
import {
  ImageMap,
  ImageUrlResult,
  getImagePreference,
  resolveImageUrl,
  uploadImageWithStrategy,
  UploadImageOptions,
} from '../services/imageService';

export interface UseImageHandlerOptions {
  /** 是否立即解析图片 URL */
  immediate?: boolean;
  /** 强制使用的存储类型 */
  forceType?: 'local' | 's3' | 'external';
  /** 上传选项 */
  uploadOptions?: UploadImageOptions;
  /** 上传成功回调 */
  onUploadSuccess?: (result: ImageUrlResult) => void;
  /** 上传失败回调 */
  onUploadError?: (error: Error) => void;
}

export interface UseImageHandlerReturn {
  /** 图片 URL */
  imageUrl: string;
  /** 存储类型 */
  storageType: 'local' | 's3' | 'external';
  /** Blurhash 字符串 */
  blurhash?: string;
  /** 图片 MD5 */
  md5: string;
  /** 上传/加载中 */
  loading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 上传进度 (0-100) */
  progress: number;
  /** 图片对象 */
  image: ImageMap | null;
  /** 上传文件 */
  upload: (file: File, options?: UploadImageOptions) => Promise<ImageUrlResult>;
  /** 设置图片对象 */
  setImage: (image: ImageMap | string | null) => void;
  /** 刷新图片 URL */
  refresh: () => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

/**
 * 统一图片处理 Hook
 * 
 * 提供一站式图片上传、显示、预览、删除等功能
 * 支持所有图片场景：Markdown 图片、音乐封面、用户头像、图集图片
 * 
 * @param initialImage 初始图片对象或 URL
 * @param options 配置选项
 * @returns 图片处理方法和状态
 */
export function useImageHandler(
  initialImage?: ImageMap | string | null,
  options: UseImageHandlerOptions = {}
): UseImageHandlerReturn {
  const { immediate = true, forceType, uploadOptions, onUploadSuccess, onUploadError } = options;

  const [image, setImageState] = useState<ImageMap | null>(
    typeof initialImage === 'string' ? null : initialImage || null
  );
  const [imageUrl, setImageUrl] = useState('');
  const [storageType, setStorageType] = useState<'local' | 's3' | 'external'>('local');
  const [blurhash, setBlurhash] = useState<string | undefined>();
  const [md5, setMd5] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 解析图片 URL
   */
  const resolve = useCallback(async () => {
    if (!image) {
      setImageUrl('');
      setStorageType('local');
      setBlurhash(undefined);
      setMd5('');
      return;
    }

    if (typeof image === 'string') {
      setImageUrl(image);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const preference = await getImagePreference();
      const result = resolveImageUrl(image, preference, { forceType });
      
      setImageUrl(result.url);
      setStorageType(result.storageType);
      setBlurhash(result.blurhash);
      setMd5(result.md5);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to resolve image URL');
      setError(err);
      console.error('Failed to resolve image URL:', err);
    } finally {
      setLoading(false);
    }
  }, [image, forceType]);

  /**
   * 上传文件
   */
  const upload = useCallback(
    async (file: File, opts?: UploadImageOptions): Promise<ImageUrlResult> => {
      setLoading(true);
      setError(null);
      setProgress(0);

      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      try {
        // 验证文件
        if (!file.type.startsWith('image/')) {
          throw new Error('请选择图片文件');
        }

        const maxSize = 20 * 1024 * 1024; // 20MB
        if (file.size > maxSize) {
          throw new Error('图片大小不能超过 20MB');
        }

        // 使用统一上传函数
        const result = await uploadImageWithStrategy(file, {
          ...uploadOptions,
          ...opts,
          onProgress: (p) => {
            setProgress(p);
            opts?.onProgress?.(p);
          },
          signal,
        });

        // 创建 ImageMap 对象
        const imageMap: ImageMap = {
          id: result.assetId,
          md5: result.md5 || '',
          localUrl: result.localUrl || result.url,
          s3Url: result.s3Url,
          externalUrl: result.externalUrl,
          storageType: result.storageType,
          blurhash: result.blurhash,
          createdAt: new Date().toISOString(),
        };

        setImageState(imageMap);

        // 解析 URL
        const preference = await getImagePreference();
        const urlResult = resolveImageUrl(imageMap, preference, { forceType });

        setImageUrl(urlResult.url);
        setStorageType(urlResult.storageType);
        setBlurhash(urlResult.blurhash);
        setMd5(urlResult.md5);
        setProgress(100);

        onUploadSuccess?.(urlResult);

        return urlResult;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        if (err.message !== 'Upload aborted') {
          setError(err);
          console.error('Image upload failed:', err);
          onUploadError?.(err);
        }
        throw err;
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    [uploadOptions, forceType, onUploadSuccess, onUploadError]
  );

  /**
   * 设置图片
   */
  const setImage = useCallback((newImage: ImageMap | string | null) => {
    setImageState(typeof newImage === 'string' ? null : newImage);
    if (typeof newImage === 'string') {
      setImageUrl(newImage);
    }
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setImageState(null);
    setImageUrl('');
    setStorageType('local');
    setBlurhash(undefined);
    setMd5('');
    setLoading(false);
    setError(null);
    setProgress(0);
  }, []);

  // 初始化时解析图片 URL
  React.useEffect(() => {
    if (immediate && image) {
      resolve();
    }
  }, [image, immediate, resolve]);

  // 清理
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    imageUrl,
    storageType,
    blurhash,
    md5,
    loading,
    error,
    progress,
    image,
    upload,
    setImage,
    refresh: resolve,
    reset,
  };
}

export default useImageHandler;
