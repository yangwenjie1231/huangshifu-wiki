import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface LightboxImage {
  id: string;
  url: string;
  name?: string | null;
}

interface LightboxProps {
  images: LightboxImage[];
  initialIndex: number;
  onClose: () => void;
}

export const Lightbox = ({ images, initialIndex, onClose }: LightboxProps) => {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [transitioning, setTransitioning] = useState(false);

  const activeImage = images[activeIndex];
  const hasPrev = images.length > 1;
  const hasNext = images.length > 1;

  const handlePrev = useCallback(() => {
    if (transitioning) return;
    setTransitioning(true);
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
    setTimeout(() => setTransitioning(false), 200);
  }, [images.length, transitioning]);

  const handleNext = useCallback(() => {
    if (transitioning) return;
    setTransitioning(true);
    setActiveIndex((prev) => (prev + 1) % images.length);
    setTimeout(() => setTransitioning(false), 200);
  }, [images.length, transitioning]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft' && hasPrev) {
        handlePrev();
      } else if (event.key === 'ArrowRight' && hasNext) {
        handleNext();
      }
    },
    [onClose, handlePrev, handleNext, hasPrev, hasNext],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="关闭"
      >
        <X size={24} />
      </button>

      {images.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30"
            aria-label="上一张"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30"
            aria-label="下一张"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}

      <div
        className={`max-w-[90vw] max-h-[90vh] flex items-center justify-center transition-opacity duration-200 ${
          transitioning ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {activeImage && (
          <img
            src={activeImage.url}
            alt={activeImage.name || ''}
            className="max-w-full max-h-[90vh] object-contain"
            style={{ userSelect: 'none' }}
          />
        )}
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <span className="px-4 py-1.5 rounded-full bg-white/10 text-white text-sm font-medium">
          {activeIndex + 1} / {images.length}
        </span>
      </div>
    </div>
  );
};
