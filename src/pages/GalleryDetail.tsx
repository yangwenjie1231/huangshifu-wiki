import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
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
import { Lightbox } from '../components/Lightbox';
import { useToast } from '../components/Toast';
import { copyToClipboard, toAbsoluteInternalUrl } from '../lib/copyLink';
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from '../lib/apiClient';
import { splitTagsInput } from '../lib/contentUtils';
import { formatDateTime, toDateValue } from '../lib/dateUtils';

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
  copyright?: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  images: GalleryImage[];
};

type EditableGalleryImage = GalleryImage & {
  clientId: string;
  pendingFile?: File;
  isPending?: boolean;
};

type GalleryDraft = {
  title: string;
  description: string;
  tagsText: string;
  copyrightText: string;
  published: boolean;
  images: EditableGalleryImage[];
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

type CommentItem = {
  id: string;
  galleryId: string | null;
  authorUid: string;
  authorName: string;
  authorPhoto: string | null;
  content: string;
  parentId: string | null;
  createdAt: string;
};

const toEditableImage = (image: GalleryImage): EditableGalleryImage => ({
  ...image,
  clientId: image.id,
});

const createPendingImage = (file: File): EditableGalleryImage => ({
  clientId: `pending-${Math.random().toString(36).slice(2, 10)}`,
  assetId: null,
  id: '',
  url: URL.createObjectURL(file),
  name: file.name,
  mimeType: file.type || null,
  sizeBytes: file.size,
  pendingFile: file,
  isPending: true,
});

const releasePendingImageUrls = (images: EditableGalleryImage[]) => {
  images.forEach((image) => {
    if (image.isPending) {
      URL.revokeObjectURL(image.url);
    }
  });
};

const createDraftFromGallery = (item: GalleryItem): GalleryDraft => ({
  title: item.title || '',
  description: item.description || '',
  tagsText: (item.tags || []).join(', '),
  copyrightText: item.copyright || '',
  published: item.published,
  images: item.images.map(toEditableImage),
});

const hasDraggedFiles = (event: Pick<React.DragEvent<HTMLElement>, 'dataTransfer'>) =>
  Array.from(event.dataTransfer?.types || []).includes('Files');

const GalleryDetail = () => {
  const { galleryId } = useParams();
  const navigate = useNavigate();
  const { user, profile, isBanned } = useAuth();
  const { show } = useToast();

  const [gallery, setGallery] = useState<GalleryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<GalleryDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [pageDragDepth, setPageDragDepth] = useState(0);

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [tripleStorage, setTripleStorage] = useState(false);

  const addImagesInputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<GalleryDraft | null>(null);

  const applyDraft = (updater: GalleryDraft | null | ((prev: GalleryDraft | null) => GalleryDraft | null)) => {
    const previous = draftRef.current;
    const next = typeof updater === 'function'
      ? (updater as (value: GalleryDraft | null) => GalleryDraft | null)(previous)
      : updater;
    draftRef.current = next;
    setDraft(next);
  };

  const fetchGallery = async () => {
    if (!galleryId) return;
    try {
      setLoading(true);
      const data = await apiGet<{ gallery: GalleryItem }>(`/api/galleries/${galleryId}`);
      setGallery(data.gallery);
      setActiveIndex(0);
      applyDraft((prev) => {
        if (prev) {
          releasePendingImageUrls(prev.images);
        }
        return null;
      });
      setEditing(false);
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

  const fetchComments = async () => {
    if (!galleryId) return;
    try {
      const data = await apiGet<{ comments: CommentItem[] }>(`/api/galleries/${galleryId}/comments`);
      setComments(data.comments || []);
    } catch (error) {
      console.error('Fetch gallery comments error:', error);
    }
  };

  useEffect(() => {
    if (gallery?.published && galleryId) {
      fetchComments();
    }
  }, [gallery?.published, galleryId]);

  useEffect(() => () => {
    if (draftRef.current) {
      releasePendingImageUrls(draftRef.current.images);
    }
  }, []);

  const images = useMemo<EditableGalleryImage[]>(
    () => (editing ? draft?.images || [] : (gallery?.images || []).map(toEditableImage)),
    [draft?.images, editing, gallery?.images],
  );
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

  const handleOpenLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
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

  const handleEnterEditMode = () => {
    if (!gallery || !canManage || saving || uploading) return;
    applyDraft((prev) => {
      if (prev) {
        releasePendingImageUrls(prev.images);
      }
      return createDraftFromGallery(gallery);
    });
    setEditing(true);
  };

  const handleCancelEdit = () => {
    applyDraft((prev) => {
      if (prev) {
        releasePendingImageUrls(prev.images);
      }
      return null;
    });
    setEditing(false);
    setPageDragDepth(0);
    setDraggingIndex(null);
    setActiveIndex((prev) => Math.min(prev, Math.max(0, (gallery?.images.length || 1) - 1)));
  };

  const handleSaveMeta = async () => {
    const currentDraft = draftRef.current;
    if (!gallery || !currentDraft || !canManage || saving || uploading) return;
    if (currentDraft.images.length === 0) {
      show('图集至少需要保留一张图片', { variant: 'error' });
      return;
    }
    try {
      setSaving(true);
      const pendingImages = currentDraft.images.filter((image) => image.isPending && image.pendingFile);
      let assetIdByClientId = new Map<string, string>();

      if (pendingImages.length) {
        setUploading(true);
        const sessionData = await apiPost<UploadSessionResponse>('/api/uploads/sessions', {
          maxFiles: pendingImages.length,
        });
        const sessionId = sessionData.session.id;
        const assetIds: string[] = [];

        for (const image of pendingImages) {
          const uploadResult = await uploadFileToSession(sessionId, image.pendingFile!, tripleStorage);
          assetIds.push(uploadResult.asset.id);
          assetIdByClientId.set(image.clientId, uploadResult.asset.id);
        }

        await apiPost(`/api/uploads/sessions/${sessionId}/finalize`);
      }

      const result = await apiPatch<{ gallery: GalleryItem }>(`/api/galleries/${gallery.id}`, {
        title: currentDraft.title,
        description: currentDraft.description,
        tags: splitTagsInput(currentDraft.tagsText),
        copyright: currentDraft.copyrightText.trim() || null,
        published: currentDraft.published,
        images: currentDraft.images.map((image) => (
          image.isPending
            ? { assetId: assetIdByClientId.get(image.clientId) }
            : { imageId: image.id }
        )),
      });
      releasePendingImageUrls(currentDraft.images);
      setGallery(result.gallery);
      applyDraft(null);
      setEditing(false);
      setActiveIndex((prev) => Math.min(prev, Math.max(0, result.gallery.images.length - 1)));
      show('图集修改已保存');
    } catch (error) {
      console.error('Save gallery meta error:', error);
      show('保存失败，请稍后重试', { variant: 'error' });
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!editing || !canManage || saving) return;
    applyDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        published: !prev.published,
      };
    });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galleryId || !user || !newComment.trim()) return;
    if (isBanned) {
      show('账号已被封禁，无法评论', { variant: 'error' });
      return;
    }
    if (!gallery?.published) {
      show('仅已发布内容可评论', { variant: 'error' });
      return;
    }

    try {
      setSubmittingComment(true);
      const data = await apiPost<{ comment: CommentItem }>(`/api/galleries/${galleryId}/comments`, {
        content: newComment,
        parentId: replyTo?.id || null,
      });

      if (data.comment) {
        setComments((prev) => [...prev, data.comment]);
      }

      setNewComment('');
      setReplyTo(null);
    } catch (error) {
      console.error('Error adding comment:', error);
      show('发表评论失败，请稍后重试', { variant: 'error' });
    } finally {
      setSubmittingComment(false);
    }
  };

  const uploadFileToSession = async (sessionId: string, file: File, useTripleStorage = false) => {
    const formData = new FormData();
    formData.append('file', file);

    // 构建 URL，可选启用三重存储模式
    const url = new URL(`/api/uploads/sessions/${sessionId}/files`, window.location.origin);
    if (useTripleStorage) {
      url.searchParams.set('tripleStorage', 'true');
    }

    const data = await apiUpload<UploadFileResponse>(url.toString(), formData);
    return data;
  };

  const appendPendingFiles = (fileList: FileList | File[]) => {
    if (!editing || !draftRef.current || !canManage || uploading) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    const maxSize = 10 * 1024 * 1024;
    const files = Array.from(fileList);
    const invalidFiles: string[] = [];
    const validImages: EditableGalleryImage[] = [];

    files.forEach((file) => {
      if (!allowedTypes.includes(file.type)) {
        invalidFiles.push(`${file.name} (不支持的文件类型)`);
        return;
      }
      if (file.size > maxSize) {
        invalidFiles.push(`${file.name} (文件过大，最大 10MB)`);
        return;
      }
      validImages.push(createPendingImage(file));
    });

    if (invalidFiles.length) {
      show(`以下文件无法加入：${invalidFiles.slice(0, 3).join(', ')}${invalidFiles.length > 3 ? '...' : ''}`, { variant: 'error' });
    }
    if (!validImages.length) return;

    applyDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        images: [...prev.images, ...validImages],
      };
    });
    show(`已加入 ${validImages.length} 张待上传图片`);
  };

  const handleAddImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    event.target.value = '';

    if (!fileList?.length) return;
    appendPendingFiles(fileList);
  };

  const handleDeleteImage = async (index: number) => {
    const currentDraft = draftRef.current;
    if (!editing || !currentDraft || !canManage) return;
    const image = currentDraft.images[index];
    if (!image?.clientId) {
      show('无法删除该图片', { variant: 'error' });
      return;
    }

    if (image.isPending) {
      URL.revokeObjectURL(image.url);
    }

    const nextImages = currentDraft.images.filter((_, currentIndex) => currentIndex !== index);
    applyDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        images: nextImages,
      };
    });
    setActiveIndex((prev) => Math.min(prev, Math.max(0, nextImages.length - 1)));
    show(image.isPending ? '已移除待上传图片' : '已加入待删除列表');
  };

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    const currentDraft = draftRef.current;
    if (!editing || !currentDraft || !canManage || fromIndex === toIndex) return;
    const next = [...currentDraft.images];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;
    next.splice(toIndex, 0, moved);

    applyDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        images: next,
      };
    });
    setActiveIndex(toIndex);
  };

  const onThumbDragStart = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    setDraggingIndex(index);
  };

  const onThumbDrop = async (targetIndex: number) => {
    if (draggingIndex === null) return;
    const sourceIndex = draggingIndex;
    setDraggingIndex(null);
    await handleReorder(sourceIndex, targetIndex);
  };

  const handlePageDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!editing || !canManage || !hasDraggedFiles(event)) return;
    event.preventDefault();
    setPageDragDepth((prev) => prev + 1);
  };

  const handlePageDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!editing || !canManage || !hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handlePageDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!editing || !canManage || !hasDraggedFiles(event)) return;
    event.preventDefault();
    setPageDragDepth((prev) => Math.max(0, prev - 1));
  };

  const handlePageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!editing || !canManage || !hasDraggedFiles(event)) return;
    event.preventDefault();
    setPageDragDepth(0);
    if (!event.dataTransfer.files?.length) return;
    appendPendingFiles(event.dataTransfer.files);
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
    <div
      className="relative min-h-screen"
      onDragEnter={handlePageDragEnter}
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      {editing && canManage && pageDragDepth > 0 ? (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center bg-brand-cream/70 px-4 text-brand-olive backdrop-blur-[2px]">
          <div className="w-full max-w-3xl rounded-[36px] border-2 border-dashed border-brand-olive bg-white/92 px-8 py-12 text-center shadow-lg">
            <p className="text-lg font-bold">松开鼠标即可加入待上传列表</p>
            <p className="mt-2 text-sm text-brand-olive/70">整个图集页面都可以拖入图片，保存时统一上传并生效</p>
          </div>
        </div>
      ) : null}
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-8">
      <div className="flex items-center justify-between gap-3">
        <Link to="/gallery" className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-olive transition-colors">
          <ArrowLeft size={18} /> 返回图集
        </Link>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={handleSaveMeta}
                  disabled={saving || uploading}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-brand-primary text-gray-900 disabled:opacity-50"
                >
                  <Save size={14} /> {saving || uploading ? '保存中...' : '保存修改'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving || uploading}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200 text-gray-600 hover:text-brand-olive hover:border-brand-olive/40 disabled:opacity-50"
                >
                  取消编辑
                </button>
              </>
            ) : (
              <button
                onClick={handleEnterEditMode}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200 text-gray-600 hover:text-brand-olive hover:border-brand-olive/40"
              >
                <Save size={14} /> 打开编辑模式
              </button>
            )}
            <button
              onClick={handleTogglePublish}
              disabled={!editing || saving || uploading}
              className={clsx(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-50',
                (editing ? draft?.published : gallery.published) ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700',
              )}
            >
              {(editing ? draft?.published : gallery.published) ? <Eye size={14} /> : <EyeOff size={14} />}
              {editing ? ((draft?.published ? '设为草稿' : '设为发布') as string) : (gallery.published ? '已发布' : '草稿中')}
            </button>
            {editing && (
              <button
                onClick={() => setTripleStorage(!tripleStorage)}
                disabled={saving || uploading}
                className={clsx(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold disabled:opacity-50',
                  tripleStorage
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-gray-50 text-gray-600 border border-gray-200',
                )}
                title="启用三重存储模式：同时上传到本地、S3 和外部图床"
              >
                <Cloud size={14} />
                {tripleStorage ? '三重存储: 开' : '三重存储: 关'}
              </button>
            )}
            <input ref={addImagesInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleAddImages} />
          </div>
        )}
      </div>

      <section className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="relative bg-black/5">
          <div className="aspect-[16/9] max-h-[70vh]">
            {activeImage ? (
              editing ? (
                <SmartImage src={activeImage.url} alt={activeImage.name || gallery.title} className="w-full h-full object-contain bg-black/80" />
              ) : (
                <button onClick={() => handleOpenLightbox(activeIndex)} className="w-full h-full">
                  <SmartImage src={activeImage.url} alt={activeImage.name || gallery.title} className="w-full h-full object-contain bg-black/80" />
                </button>
              )
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
              {editing && draft ? (
                <div className="space-y-3 max-w-2xl">
                  <div className="space-y-1.5">
                    <label htmlFor="gallery-title" className="block text-sm font-medium text-gray-600">
                      图集标题
                    </label>
                      <input
                        id="gallery-title"
                        type="text"
                        value={draft.title}
                        onChange={(event) => applyDraft((prev) => prev ? { ...prev, title: event.target.value } : prev)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-olive/20"
                        placeholder="图集标题"
                      />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="gallery-description" className="block text-sm font-medium text-gray-600">
                      图集描述
                    </label>
                      <textarea
                        id="gallery-description"
                        value={draft.description}
                        onChange={(event) => applyDraft((prev) => prev ? { ...prev, description: event.target.value } : prev)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-olive/20 resize-none"
                        rows={3}
                        placeholder="图集描述"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="gallery-tags" className="block text-sm font-medium text-gray-600">
                      标签
                    </label>
                      <input
                        id="gallery-tags"
                        type="text"
                        value={draft.tagsText}
                        onChange={(event) => applyDraft((prev) => prev ? { ...prev, tagsText: event.target.value } : prev)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-olive/20"
                        placeholder="标签，逗号分隔"
                      />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="gallery-copyright" className="block text-sm font-medium text-gray-600">
                      版权标识
                    </label>
                      <input
                        id="gallery-copyright"
                        type="text"
                        value={draft.copyrightText}
                        onChange={(event) => applyDraft((prev) => prev ? { ...prev, copyrightText: event.target.value } : prev)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-olive/20"
                        placeholder="版权信息，如：© 2024 作者名"
                      />
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-3xl sm:text-4xl font-serif font-bold text-gray-900 mb-2">{gallery.title}</h1>
                  <p className="text-gray-500 leading-relaxed">{gallery.description || '暂无描述'}</p>
                  {gallery.copyright && (
                    <p className="text-xs text-gray-400 mt-1">{gallery.copyright}</p>
                  )}
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
                (editing ? draft?.published : gallery.published) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
              )}
            >
              {(editing ? draft?.published : gallery.published) ? '已发布' : '草稿'}
            </span>
            {editing ? (
              <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-brand-cream text-brand-olive">
                编辑模式
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock size={12} /> {formatDateTime(gallery.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <UserIcon size={12} /> {gallery.authorName || gallery.authorUid?.slice(0, 8)}
            </span>
            {gallery.publishedAt ? <span>发布于 {formatDateTime(gallery.publishedAt)}</span> : null}
          </div>
        </div>
      </section>

      {(images.length > 1 || editing) && (
        <section className="bg-white rounded-[32px] border border-gray-100 p-4 sm:p-6">
          {editing ? (
            <p className="mb-3 text-xs text-gray-500">
              拖拽缩略图可调整顺序，点击删除只会先加入本地修改，保存后统一提交。也可以把图片拖到整个页面中加入待上传列表。
            </p>
          ) : null}
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-3">
            {images.map((image, index) => (
              <div
                key={image.clientId || image.id}
                draggable={editing && canManage}
                onDragStart={(event) => onThumbDragStart(event, index)}
                onDragOver={(event) => {
                  if (!editing || !canManage) return;
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  onThumbDrop(index);
                }}
                className={clsx(
                  'relative h-20 rounded-xl overflow-hidden',
                  index === activeIndex ? 'ring-2 ring-brand-olive' : 'ring-1 ring-transparent hover:ring-gray-200',
                  draggingIndex === index && 'opacity-60',
                )}
              >
                <button onClick={() => setActiveIndex(index)} className="w-full h-full">
                  <SmartImage src={image.url} alt={image.name || ''} className="w-full h-full object-cover" />
                </button>

                {editing && canManage && (
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-1 bg-black/35 text-white opacity-0 hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDeleteImage(index)}
                      className="p-1 rounded bg-black/40 hover:bg-red-500/80"
                      title="删除图片"
                    >
                      <Trash2 size={11} />
                    </button>
                    <div className="flex items-center gap-1">
                      {image.isPending ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-brand-primary/80 text-gray-900">
                          待上传
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-black/40">
                        <GripVertical size={10} /> 拖拽
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {editing && canManage ? (
              <button
                type="button"
                onClick={() => addImagesInputRef.current?.click()}
                disabled={uploading || saving}
                className="flex h-20 items-center justify-center rounded-xl border border-dashed border-brand-olive/35 bg-brand-cream/55 text-brand-olive transition-colors hover:border-brand-olive hover:bg-brand-cream disabled:opacity-50"
                title={uploading ? '上传中' : '加入图片'}
              >
                <Plus size={20} />
              </button>
            ) : null}
          </div>
        </section>
      )}

      {gallery.published && (
        <section className="bg-white rounded-[32px] border border-gray-100 p-6 sm:p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-6">评论</h2>

          {user && !isBanned && (
            <form onSubmit={handleAddComment} className="mb-8">
              {replyTo && (
                <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                  <span>回复给 {replyTo.authorName}</span>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="text-brand-primary hover:underline"
                  >
                    取消
                  </button>
                </div>
              )}
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden">
                  <img
                    src={user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`}
                    alt=""
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-grow">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="写下你的评论..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-olive/20 resize-none"
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={!newComment.trim() || submittingComment}
                      className="px-4 py-2 bg-brand-primary text-gray-900 text-sm font-bold rounded-full hover:bg-brand-olive disabled:opacity-50"
                    >
                      {submittingComment ? '发送中...' : '发送'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {user && isBanned && (
            <p className="text-center text-gray-400 italic mb-8">账号已被封禁，无法评论</p>
          )}

          {!user && (
            <p className="text-center text-gray-400 italic mb-8">登录后可参与评论</p>
          )}

          <div className="space-y-6">
            {comments.length > 0 ? comments.filter((c) => !c.parentId).map((comment) => (
              <div key={comment.id} className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden">
                    <img
                      src={comment.authorPhoto || `https://picsum.photos/seed/${comment.authorUid}/100/100`}
                      alt=""
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-gray-700">{comment.authorName || '匿名用户'}</span>
                      <span className="text-[10px] text-gray-400">{formatDateTime(comment.createdAt)}</span>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed mb-2">{comment.content}</p>
                    {user && !isBanned && (
                      <button
                        onClick={() => {
                          setReplyTo(comment);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-[10px] font-bold text-brand-primary hover:underline"
                      >
                        回复
                      </button>
                    )}
                  </div>
                </div>

                {comments.filter((c) => c.parentId === comment.id).length > 0 && (
                  <div className="ml-14 space-y-4 border-l-2 border-brand-primary/20 pl-6">
                    {comments.filter((c) => c.parentId === comment.id).map((reply) => (
                      <div key={reply.id} className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden">
                          <img
                            src={reply.authorPhoto || `https://picsum.photos/seed/${reply.authorUid}/100/100`}
                            alt=""
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-grow">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-gray-700">{reply.authorName || '匿名用户'}</span>
                            <span className="text-[10px] text-gray-400">{formatDateTime(reply.createdAt)}</span>
                          </div>
                          <p className="text-gray-600 text-xs leading-relaxed">{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )) : (
              <p className="text-center text-gray-400 italic py-8">暂无评论，快来抢沙发吧！</p>
            )}
          </div>
        </section>
      )}

      <div className="text-right">
        <button onClick={() => navigate('/gallery')} className="text-xs text-gray-400 hover:text-brand-olive">
          返回图集列表
        </button>
      </div>
      </div>

      {lightboxOpen && (
        <Lightbox
          images={images.map((img) => ({ id: img.clientId || img.id, url: img.url, name: img.name }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
};

export default GalleryDetail;
