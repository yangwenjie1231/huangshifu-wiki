import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, User as UserIcon, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { SmartImage } from '../components/SmartImage';
import { apiGet } from '../lib/apiClient';
import { useToast } from '../components/Toast';
import { copyToClipboard, toAbsoluteInternalUrl } from '../lib/copyLink';

type GalleryImage = {
  url: string;
  name: string;
};

type GalleryItem = {
  id: string;
  title: string;
  description: string;
  authorUid: string;
  authorName: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  images: GalleryImage[];
};

const toDateValue = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const GalleryDetail = () => {
  const { galleryId } = useParams();
  const [gallery, setGallery] = useState<GalleryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const { show } = useToast();

  useEffect(() => {
    const fetchGallery = async () => {
      if (!galleryId) return;
      try {
        setLoading(true);
        const data = await apiGet<{ gallery: GalleryItem }>(`/api/galleries/${galleryId}`);
        setGallery(data.gallery);
        setActiveIndex(0);
      } catch (error) {
        console.error('Fetch gallery detail error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGallery();
  }, [galleryId]);

  const images = useMemo(() => gallery?.images || [], [gallery?.images]);
  const activeImage = images[activeIndex];

  const handlePrev = () => {
    if (!images.length) return;
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNext = () => {
    if (!images.length) return;
    setActiveIndex((prev) => (prev + 1) % images.length);
  };

  const handleCopyLink = async () => {
    if (!gallery?.id) return;
    const copied = await copyToClipboard(toAbsoluteInternalUrl(`/gallery/${gallery.id}`));
    if (copied) {
      show('图集内链已复制');
      return;
    }
    show('复制链接失败，请稍后重试', { variant: 'error' });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="h-[560px] bg-white rounded-[40px] border border-gray-100 animate-pulse" />
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-400 italic">图集不存在或已被删除</p>
        <Link to="/gallery" className="inline-flex items-center gap-2 mt-4 text-brand-olive hover:underline">
          <ArrowLeft size={16} /> 返回图集列表
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-8">
      <Link to="/gallery" className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-olive transition-colors">
        <ArrowLeft size={18} /> 返回图集
      </Link>

      <section className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="relative bg-black/5">
          <div className="aspect-[16/9] max-h-[70vh]">
            {activeImage ? (
              <SmartImage src={activeImage.url} alt={activeImage.name || gallery.title} className="w-full h-full object-contain bg-black/80" />
            ) : (
              <div className="w-full h-full bg-gray-100" />
            )}
          </div>
          {images.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/90 text-gray-700 hover:bg-white"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/90 text-gray-700 hover:bg-white"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        <div className="p-8 sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-gray-900 mb-2">{gallery.title}</h1>
              <p className="text-gray-500 leading-relaxed">{gallery.description || '暂无描述'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-black/5 text-gray-600 text-xs rounded-full font-bold">
                {activeIndex + 1} / {images.length}
              </span>
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-gray-200 text-gray-600 text-xs font-bold hover:text-brand-olive hover:border-brand-olive/40 transition-colors"
                title="复制内链"
                aria-label="复制图集内链"
              >
                <Link2 size={12} /> 复制内链
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {gallery.tags?.map((tag) => (
              <span key={tag} className="text-[11px] text-brand-olive bg-brand-cream px-2.5 py-1 rounded-full">#{tag}</span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Clock size={12} />
              {toDateValue(gallery.createdAt) ? format(toDateValue(gallery.createdAt)!, 'yyyy-MM-dd HH:mm') : '刚刚'}
            </span>
            <span className="flex items-center gap-1"><UserIcon size={12} /> {gallery.authorName || gallery.authorUid?.substring(0, 8)}</span>
          </div>
        </div>
      </section>

      {images.length > 1 && (
        <section className="bg-white rounded-[32px] border border-gray-100 p-4 sm:p-6">
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-3">
            {images.map((image, index) => (
              <button
                key={`${image.url}-${index}`}
                onClick={() => setActiveIndex(index)}
                className={
                  index === activeIndex
                    ? 'relative h-20 rounded-xl overflow-hidden ring-2 ring-brand-olive'
                    : 'relative h-20 rounded-xl overflow-hidden ring-1 ring-transparent hover:ring-gray-200'
                }
              >
                <SmartImage src={image.url} alt={image.name || ''} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default GalleryDetail;
