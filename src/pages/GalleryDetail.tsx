import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  GripVertical,
  Link2,
  Plus,
  Save,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';
import { SmartImage } from '../components/SmartImage';
import { useToast } from '../components/Toast';
import { copyToClipboard, toAbsoluteInternalUrl } from '../lib/copyLink';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/apiClient';

type GalleryImage = {
  id: string;
  assetId: string | null;
  url: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

type GalleryItem = {
  id: string;
  title: string;
  description: string;
  authorUid: string;
  authorName: string;
  tags: string[];
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  images: GalleryImage[];
};

type UploadSessionResponse = {
  session: {
    id: string;
  };
};

type UploadFileResponse = {
  asset: {
    id: string;
  };
};

const toDateValue = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value: string | null | undefined, fallback = '刚刚') => {
  const parsed = toDateValue(value);
  return parsed ? format(parsed, 'yyyy-MM-dd HH:mm') : fallback;
};

const splitTagsInput = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const GalleryDetail = () => {
  const { galleryId } = useParams();
  const navigate = useNavigate();
  const { user, profile, isBanned } = useAuth();
  const { show } = useToast();

  const [gallery, setGallery] = useState<GalleryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTagsText, setEditTagsText] = useState('');

  const addImagesInputRef = useRef<HTMLInputElement>(null);

  const fetchGallery = async () => {
    if (!galleryId) return;
    try {
      setLoading(true);
      const data = await apiGet<{ gallery: GalleryItem }>(`/api/galleries/${galleryId}`);
      setGallery(data.gallery);
      setActiveIndex(0);
      setEditTitle(data.gallery.title || '');
      setEditDescription(data.gallery.description || '');
      setEditTagsText((data.gallery.tags || []).join(', '));
    } catch (error) {
      console.error('Fetch gallery detail error:', error);
      setGallery(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGallery();
  }, [galleryId]);

  const images = useMemo(() => gallery?.images || [], [gallery?.images]);
  const activeImage = images[activeIndex] || null;

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const canManage = Boolean(user && gallery && !isBanned && (gallery.authorUid === user.uid || isAdmin));

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

  const handleSaveMeta = async () => {
    if (!gallery || !canManage || saving) return;
    try {
      setSaving(true);
      const result = await apiPatch<{ gallery: GalleryItem }>(`/api/galleries/${gallery.id}`, {
        title: editTitle,
        description: editDescription,
        tags: splitTagsInput(editTagsText),
      });
      setGallery(result.gallery);
      setEditTitle(result.gallery.title || '');
      setEditDescription(result.gallery.description || '');
      setEditTagsText((result.gallery.tags || []).join(', '));
      setEditing(false);
      show('图集信息已保存');
    } catch (error) {
      console.error('Save gallery meta error:', error);
      show('保存失败，请稍后重试', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!gallery || !canManage || saving) return;
    try {
      setSaving(true);
      const result = await apiPatch<{ gallery: GalleryItem }>(`/api/galleries/${gallery.id}/publish`, {
        published: !gallery.published,
      });
      setGallery(result.gallery);
      show(result.gallery.published ? '图集已发布' : '已切换为草稿');
    } catch (error) {
      console.error('Toggle gallery publish error:', error);
      show('切换发布状态失败', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const uploadFileToSession = async (sessionId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`/api/uploads/sessions/${sessionId}/files`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof data === 'object' && data && 'error' in data ? String((data as Record<string, unknown>).error) : '上传失败';
      throw new Error(message);
    }
    return data as UploadFileResponse;
  };

  const handleAddImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    event.target.value = '';

    if (!gallery || !canManage || !fileList?.length || uploading) return;
    const files = Array.from(fileList);

    try {
      setUploading(true);
      const sessionData = await apiPost<UploadSessionResponse>('/api/uploads/sessions', {
        maxFiles: files.length,
      });
      const sessionId = sessionData.session.id;
      const assetIds: string[] = [];

      for (const file of files) {
        const uploadResult = await uploadFileToSession(sessionId, file);
        assetIds.push(uploadResult.asset.id);
      }

      await apiPost(`/api/uploads/sessions/${sessionId}/finalize`);
      const result = await apiPost<{ gallery: GalleryItem }>(`/api/galleries/${gallery.id}/images`, {
        uploadSessionId: sessionId,
        assetIds,
      });

      setGallery(result.gallery);
      setActiveIndex((prev) => Math.min(prev, Math.max(0, result.gallery.images.length - 1)));
      show(`已追加 ${assetIds.length} 张图片`);
    } catch (error) {
      console.error('Add gallery images error:', error);
      show('追加图片失败，请稍后重试', { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (index: number) => {
    if (!gallery || !canManage) return;
    if (!window.confirm('确定删除这张图片吗？')) return;

    const image = gallery.images[index];
    if (!image?.id) {
      show('无法删除该图片', { variant: 'error' });
      return;
    }

    try {
      const result = await apiDelete<{ gallery: GalleryItem }>(`/api/galleries/${gallery.id}/images/${image.id}`);
      setGallery(result.gallery);
      setActiveIndex((prev) => {
        if (result.gallery.images.length === 0) return 0;
        return Math.min(prev, result.gallery.images.length - 1);
      });
      show('图片已删除');
    } catch (error) {
      console.error('Delete gallery image error:', error);
      show('删除图片失败', { variant: 'error' });
    }
  };

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    if (!gallery || !canManage || fromIndex === toIndex) return;
    const next = [...gallery.images];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;
    next.splice(toIndex, 0, moved);

    setGallery({ ...gallery, images: next });
    setActiveIndex(toIndex);

    try {
      const imageIds = next.map((image) => image.id).filter((id): id is string => Boolean(id));
      const result = await apiPatch<{ gallery: GalleryItem }>(`/api/galleries/${gallery.id}/images/reorder`, {
        imageIds,
      });
      setGallery(result.gallery);
    } catch (error) {
      console.error('Reorder gallery images error:', error);
      show('保存排序失败，已刷新原始顺序', { variant: 'error' });
      await fetchGallery();
    }
  };

  const onThumbDragStart = (index: number) => {
    setDraggingIndex(index);
  };

  const onThumbDrop = async (targetIndex: number) => {
    if (draggingIndex === null) return;
    const sourceIndex = draggingIndex;
    setDraggingIndex(null);
    await handleReorder(sourceIndex, targetIndex);
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
      <div className="flex items-center justify-between gap-3">
        <Link to="/gallery" className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-olive transition-colors">
          <ArrowLeft size={18} /> 返回图集
        </Link>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <button
                onClick={handleSaveMeta}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-brand-primary text-gray-900 disabled:opacity-50"
              >
                <Save size={14} /> {saving ? '保存中...' : '保存信息'}
              </button>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200 text-gray-600 hover:text-brand-olive hover:border-brand-olive/40"
              >
                <Save size={14} /> 编辑信息
              </button>
            )}
            <button
              onClick={handleTogglePublish}
              disabled={saving}
              className={clsx(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-50',
                gallery.published ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700',
              )}
            >
              {gallery.published ? <EyeOff size={14} /> : <Eye size={14} />}
              {saving ? '处理中...' : gallery.published ? '切换草稿' : '发布图集'}
            </button>
            <button
              onClick={() => addImagesInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-brand-olive text-white disabled:opacity-50"
            >
              <Plus size={14} /> {uploading ? '上传中...' : '追加图片'}
            </button>
            <input ref={addImagesInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleAddImages} />
          </div>
        )}
      </div>

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
              <button onClick={handlePrev} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/90 text-gray-700 hover:bg-white">
                <ChevronLeft size={20} />
              </button>
              <button onClick={handleNext} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/90 text-gray-700 hover:bg-white">
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        <div className="p-8 sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="space-y-3 max-w-2xl">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-olive/20"
                    placeholder="图集标题"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-olive/20 resize-none"
                    rows={3}
                    placeholder="图集描述"
                  />
                  <input
                    type="text"
                    value={editTagsText}
                    onChange={(event) => setEditTagsText(event.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-olive/20"
                    placeholder="标签，逗号分隔"
                  />
                </div>
              ) : (
                <>
                  <h1 className="text-3xl sm:text-4xl font-serif font-bold text-gray-900 mb-2">{gallery.title}</h1>
                  <p className="text-gray-500 leading-relaxed">{gallery.description || '暂无描述'}</p>
                </>
              )}
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
              <span key={tag} className="text-[11px] text-brand-olive bg-brand-cream px-2.5 py-1 rounded-full">
                #{tag}
              </span>
            ))}
            <span
              className={clsx(
                'text-[11px] px-2.5 py-1 rounded-full font-bold',
                gallery.published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
              )}
            >
              {gallery.published ? '已发布' : '草稿'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock size={12} /> {formatDateTime(gallery.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <UserIcon size={12} /> {gallery.authorName || gallery.authorUid?.slice(0, 8)}
            </span>
            {gallery.publishedAt && (
              <span className="flex items-center gap-1">
                <Eye size={12} /> 发布于 {formatDateTime(gallery.publishedAt)}
              </span>
            )}
          </div>
        </div>
      </section>

      {images.length > 1 && (
        <section className="bg-white rounded-[32px] border border-gray-100 p-4 sm:p-6">
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-3">
            {images.map((image, index) => (
              <div
                key={image.id}
                draggable={canManage}
                onDragStart={() => onThumbDragStart(index)}
                onDragOver={(event) => {
                  if (!canManage) return;
                  event.preventDefault();
                }}
                onDrop={() => onThumbDrop(index)}
                className={clsx(
                  'relative h-20 rounded-xl overflow-hidden',
                  index === activeIndex ? 'ring-2 ring-brand-olive' : 'ring-1 ring-transparent hover:ring-gray-200',
                  draggingIndex === index && 'opacity-60',
                )}
              >
                <button onClick={() => setActiveIndex(index)} className="w-full h-full">
                  <SmartImage src={image.url} alt={image.name || ''} className="w-full h-full object-cover" />
                </button>

                {canManage && (
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1 bg-black/35 text-white opacity-0 hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDeleteImage(index)}
                      className="p-1 rounded bg-black/40 hover:bg-red-500/80"
                      title="删除图片"
                    >
                      <Trash2 size={11} />
                    </button>
                    <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-black/40">
                      <GripVertical size={10} /> 拖拽
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="text-right">
        <button onClick={() => navigate('/gallery')} className="text-xs text-gray-400 hover:text-brand-olive">
          返回图集列表
        </button>
      </div>
    </div>
  );
};

export default GalleryDetail;
