import React, { useState, useEffect, useMemo } from 'react';
import { decodeBlurhashToDataURL } from '../hooks/useBlurhash';
import { ImageMap, getImagePreference, resolveImageUrl } from '../services/imageService';

export interface SmartImageProps {
  image?: ImageMap | string | null | undefined;
  src?: string | null;
  alt?: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: (error: Error) => void;
  fallback?: React.ReactNode;
  decodeOptions?: {
    width?: number;
    height?: number;
    punch?: number;
  };
  transitionDuration?: number;
}

export const SmartImage: React.FC<SmartImageProps> = ({
  image,
  src,
  alt = '',
  width,
  height,
  className = '',
  style = {},
  loading = 'lazy',
  onLoad,
  onError,
  fallback,
  decodeOptions = {},
  transitionDuration = 300,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [blurhashDataUrl, setBlurhashDataUrl] = useState<string | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState('');

  const imageInput = image || src;

  const blurhash = useMemo(() => {
    if (!imageInput || typeof imageInput === 'string') return undefined;
    return imageInput.blurhash;
  }, [imageInput]);

  useEffect(() => {
    const resolveUrl = async () => {
      if (!imageInput) {
        setResolvedUrl('');
        return;
      }
      
      if (typeof imageInput === 'string') {
        setResolvedUrl(imageInput);
        return;
      }

      // Use resolveImageUrl to respect user preference
      try {
        const preference = await getImagePreference();
        const result = resolveImageUrl(imageInput, preference);
        setResolvedUrl(result.url);
      } catch (error) {
        console.error('Failed to resolve image URL:', error);
        // Fallback to simple logic if preference fetch fails
        setResolvedUrl(imageInput.localUrl || imageInput.s3Url || imageInput.externalUrl || '');
      }
    };

    resolveUrl();
  }, [imageInput]);

  useEffect(() => {
    if (blurhash && blurhash.length > 0) {
      const dataUrl = decodeBlurhashToDataURL(
        blurhash,
        decodeOptions.width || 32,
        decodeOptions.height || 32,
        decodeOptions.punch
      );
      setBlurhashDataUrl(dataUrl);
    } else {
      setBlurhashDataUrl(null);
    }
  }, [blurhash, decodeOptions.width, decodeOptions.height, decodeOptions.punch]);

  useEffect(() => {
    if (!imageInput) return;
    setImageLoaded(false);
    setImageError(false);
  }, [imageInput]);

  const handleLoad = () => {
    setImageLoaded(true);
    setImageError(false);
    onLoad?.();
  };

  const handleError = (error: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setImageError(true);
    setImageLoaded(false);
    const err = error instanceof Error ? error : new Error('Image load failed');
    onError?.(err);
  };

  const showPlaceholder = blurhashDataUrl && !imageLoaded && !imageError;
  const showImage = resolvedUrl && !imageError;

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    width: width || 'auto',
    height: height || 'auto',
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    ...style,
  };

  const placeholderStyleFinal: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: `opacity ${transitionDuration}ms ease-in-out`,
    opacity: showPlaceholder ? 1 : 0,
  };

  const imageStyleFinal: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: `opacity ${transitionDuration}ms ease-in-out`,
    opacity: imageLoaded ? 1 : 0,
  };

  if (!imageInput) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: width || '100%',
          height: height || '100%',
          backgroundColor: '#f0f0f0',
          color: '#999',
          fontSize: '14px',
          ...containerStyle,
        }}
      >
        无图片
      </div>
    );
  }

  return (
    <div className={`smart-image-container ${className}`} style={containerStyle}>
      {blurhashDataUrl && (
        <img
          src={blurhashDataUrl}
          alt=""
          style={placeholderStyleFinal}
          aria-hidden="true"
        />
      )}

      {showImage && (
        <img
          src={resolvedUrl}
          alt={alt}
          loading={loading}
          onLoad={handleLoad}
          onError={handleError}
          style={imageStyleFinal}
        />
      )}

      {imageError && !blurhashDataUrl && (
        fallback || (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              backgroundColor: '#f0f0f0',
              color: '#999',
              fontSize: '14px',
            }}
          >
            图片加载失败
          </div>
        )
      )}
    </div>
  );
};
