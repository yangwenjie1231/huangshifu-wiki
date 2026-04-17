import React, { useCallback, useEffect, useRef, useState } from 'react';
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

const SWIPE_THRESHOLD_X = 30;
const SWIPE_THRESHOLD_Y = 50;

export const Lightbox = ({ images, initialIndex, onClose }: LightboxProps) => {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [transitioning, setTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  // Touch gesture state - use refs for touch tracking to avoid stale closures
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const [snapBack, setSnapBack] = useState(false);

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

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    touchDeltaRef.current = { dx: 0, dy: 0 };
    setSnapBack(false);
    setSwipeOffsetX(0);
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;

    const touch = event.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    touchDeltaRef.current = { dx, dy };

    // Only apply horizontal swipe gesture (ignore primarily vertical swipes)
    if (Math.abs(dx) > Math.abs(dy)) {
      event.preventDefault();
      setSwipeOffsetX(dx);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const touchStart = touchStartRef.current;
    const { dx, dy } = touchDeltaRef.current;

    touchStartRef.current = null;
    touchDeltaRef.current = { dx: 0, dy: 0 };

    if (!touchStart) return;

    // Check if vertical swipe down threshold met (close lightbox)
    if (dy > SWIPE_THRESHOLD_Y) {
      onClose();
      setSwipeOffsetX(0);
      return;
    }

    // Check if horizontal swipe threshold met
    if (Math.abs(dx) >= SWIPE_THRESHOLD_X) {
      if (dx < 0) {
        // Swipe left = next image
        handleNext();
      } else {
        // Swipe right = prev image
        handlePrev();
      }
      setSwipeOffsetX(0);
      return;
    }

    // Snap back with animation if threshold not met
    setSnapBack(true);
    setTimeout(() => {
      setSwipeOffsetX(0);
      setSnapBack(false);
    }, 200);
  }, [onClose, handleNext, handlePrev]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft' && hasPrev) {
        handlePrev();
      } else if (event.key === 'ArrowRight' && hasNext) {
        handleNext();
      } else if (event.key === 'Tab') {
        const focusableElements = containerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    },
    [onClose, handlePrev, handleNext, hasPrev, hasNext],
  );

  useEffect(() => {
    triggerElementRef.current = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      triggerElementRef.current?.focus();
    };
  }, [handleKeyDown]);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <button
        ref={closeButtonRef}
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
        className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        style={{
          transform: swipeOffsetX !== 0 ? `translateX(${swipeOffsetX}px)` : undefined,
          transition: snapBack ? 'transform 200ms ease-out' : undefined,
          opacity: transitioning ? 0 : 1,
        }}
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

      <div className="absolute pb-safe bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <span className="px-4 py-1.5 rounded-full bg-white/10 text-white text-sm font-medium">
          {activeIndex + 1} / {images.length}
        </span>
      </div>
    </div>
  );
};
