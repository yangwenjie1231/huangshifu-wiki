import React, { useState, useEffect } from 'react';
import { getImageUrl } from '../services/imageService';

interface SmartImageProps {
  imageId?: string;
  src?: string;
  alt?: string;
  className?: string;
}

/**
 * A component that tries multiple CDN URLs for an image ID.
 * If one fails, it automatically tries the next one in the list.
 */
export const SmartImage: React.FC<SmartImageProps> = ({ imageId, src, alt, className }) => {
  const [urls, setUrls] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUrls = async () => {
      if (imageId) {
        const fetchedUrls = await getImageUrl(imageId);
        setUrls(fetchedUrls);
      } else if (src) {
        setUrls([src]);
      }
      setLoading(false);
    };
    fetchUrls();
  }, [imageId, src]);

  const handleError = () => {
    if (currentIndex < urls.length - 1) {
      console.warn(`Image URL failed: ${urls[currentIndex]}. Trying next one...`);
      setCurrentIndex(prev => prev + 1);
    } else {
      console.error(`All image URLs failed for imageId: ${imageId}`);
    }
  };

  if (loading) {
    return <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`} />;
  }

  if (urls.length === 0) {
    return <div className={`bg-gray-50 flex items-center justify-center text-gray-300 ${className}`}>No Image</div>;
  }

  return (
    <img
      src={urls[currentIndex]}
      alt={alt}
      className={className}
      onError={handleError}
      referrerPolicy="no-referrer"
    />
  );
};
