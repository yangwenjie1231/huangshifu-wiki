'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface WikiLinkPreviewProps {
  slug: string;
  children: React.ReactNode;
}

interface WikiPageSummary {
  title: string;
  content: string;
  category: string;
  updatedAt: string;
}

export default function WikiLinkPreview({ slug, children }: WikiLinkPreviewProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [preview, setPreview] = useState<WikiPageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<'bottom' | 'top'>('bottom');

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPreview = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    try {
      const response = await fetch(`/api/wiki/${slug}`, {
        signal: abortControllerRef.current.signal,
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setPreview({
        title: data.page.title,
        content: data.page.content || '',
        category: data.page.category,
        updatedAt: data.page.updatedAt,
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setPreview(null);
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const handleMouseEnter = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      fetchPreview();
    }, 300);
  }, [fetchPreview]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isVisible || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setPosition(spaceBelow < 200 ? 'top' : 'bottom');
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const getExcerpt = (content: string, maxLength = 150) => {
    const cleaned = content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, p1, p2) => p2 || p1);
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.slice(0, maxLength).trim() + '...';
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div
          className={`absolute z-50 left-0 w-72 p-4 bg-white rounded-xl shadow-lg border border-gray-100 text-sm text-gray-700 ${
            position === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
          }`}
        >
          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-brand-olive border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && preview && (
            <>
              <h4 className="font-bold text-brand-olive mb-2 line-clamp-1">{preview.title}</h4>
              <p className="text-gray-600 text-xs leading-relaxed line-clamp-3">{getExcerpt(preview.content)}</p>
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                <span className="px-1.5 py-0.5 bg-brand-cream rounded text-brand-olive">{preview.category}</span>
              </div>
            </>
          )}
          {!loading && !preview && (
            <p className="text-gray-400 text-center py-2">无法加载预览</p>
          )}
        </div>
      )}
    </div>
  );
}
