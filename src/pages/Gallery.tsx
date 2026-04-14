import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Image as ImageIcon, Plus, Folder, X, Upload, Clock, User as UserIcon, Link2, Trash2 } from 'lucide-react';
import { useUserPreferences } from '../context/UserPreferencesContext';
import { ViewModeSelector } from '../components/ViewModeSelector';
import { VIEW_MODE_CONFIG } from '../lib/viewModes';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { SmartImage } from '../components/SmartImage';
import { useToast } from '../components/Toast';
import { copyToClipboard, toAbsoluteInternalUrl } from '../lib/copyLink';
import { apiDelete, apiGet, apiPost, apiUpload } from '../lib/apiClient';
import { toDateValue } from '../lib/dateUtils';
import { LocationTagInput } from '../components/LocationTagInput';
import Pagination from '../components/Pagination';
import { GallerySkeleton } from '../components/GallerySkeleton';
import type { GalleryItem } from '../types/entities';
import type { UploadSessionResponse, UploadFileResponse, GalleryCreateResponse } from '../types/api';

const DEFAULT_PAGE_SIZE = 24;

type LocalPreviewFile = {
  file: File;
  previewUrl: string;
};

interface GalleryCardProps {
  gallery: GalleryItem;
  viewMode: string;
  isAdmin: boolean;
  deletingGalleryId: string | null;
  onCopyLink: (event: React.MouseEvent<HTMLButtonElement>, galleryId: string) => void;
  onRequestDelete: (event: React.MouseEvent<HTMLButtonElement>, gallery: { id: string; title?: string | null }) => void;
}

const GalleryCard = React.memo(({ gallery, viewMode, isAdmin, deletingGalleryId, onCopyLink, onRequestDelete }: GalleryCardProps) => (
  <div className={clsx('relative group', viewMode === 'list' && 'flex')}>
    <Link
      to={`/gallery/${gallery.id}`}
      className={clsx(
        viewMode === 'list'
          ? 'flex gap-4 p-4 bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all w-full'
          : 'block bg-white rounded-[32px] border border-gray-100 overflow-hidden hover:shadow-xl transition-all'
      )}
    >
      {viewMode === 'list' ? (
        <>
          <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
            <SmartImage
              src={(Array.isArray(gallery.images) && gallery.images[0]?.url) || ''}
              alt={gallery.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-serif font-bold group-hover:text-brand-olive transition-colors truncate">{gallery.title}</h3>
              <span className="px-2 py-0.5 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold rounded-full flex-shrink-0">
                {Array.isArray(gallery.images) ? gallery.images.length : 0} 张
              </span>
            </div>
            <p className="text-gray-400 text-sm line-clamp-2">
              {gallery.description || '暂无描述'}
            </p>
            <p className="text-gray-300 text-xs mt-1">
              {(gallery.description || '').substring(0, 50)}...
            </p>
            <div className="flex items-center gap-3 text-gray-400 text-xs mt-2">
              <span className="flex items-center gap-1"><Clock size={10} /> {toDateValue(gallery.createdAt) ? format(toDateValue(gallery.createdAt)!, 'yyyy-MM-dd') : '刚刚'}</span>
              <span className="flex items-center gap-1"><UserIcon size={10} /> {gallery.authorUid?.substring(0, 6)}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={clsx('relative overflow-hidden', VIEW_MODE_CONFIG[viewMode].cardHeight)}>
            <SmartImage
              src={(Array.isArray(gallery.images) && gallery.images[0]?.url) || ''}
              alt={gallery.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute top-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold rounded-full">
              {Array.isArray(gallery.images) ? gallery.images.length : 0} 张
            </div>
          </div>
          <div className="p-6">
            <h3 className="text-xl font-serif font-bold mb-2 group-hover:text-brand-olive transition-colors">{gallery.title}</h3>
            <div className="flex flex-wrap gap-1 mb-4">
              {gallery.tags?.map((tag: string) => (
                <span key={tag} className="text-[10px] text-brand-olive bg-brand-cream px-2 py-0.5 rounded">#{tag}</span>
              ))}
            </div>
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span className="flex items-center gap-1"><Clock size={12} /> {toDateValue(gallery.createdAt) ? format(toDateValue(gallery.createdAt)!, 'yyyy-MM-dd') : '刚刚'}</span>
              <span className="flex items-center gap-1"><UserIcon size={12} /> {gallery.authorUid?.substring(0, 6)}</span>
            </div>
          </div>
        </>
      )}
    </Link>
    {isAdmin ? (
      <button
        onClick={(event) => onRequestDelete(event, gallery)}
        disabled={deletingGalleryId === gallery.id}
        className="absolute top-4 left-4 p-2 rounded-full border border-white/70 bg-white/85 text-gray-500 shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-red-500 transition-all disabled:cursor-not-allowed disabled:opacity-60"
        title="删除图集"
        aria-label="删除图集"
      >
        <Trash2 size={14} />
      </button>
    ) : null}
    <button
      onClick={(event) => onCopyLink(event, gallery.id)}
      className={clsx(
        'p-2 rounded-full border bg-white/85 text-gray-500 shadow-sm hover:text-brand-olive transition-all',
        viewMode === 'list' ? 'absolute top-4 right-4' : 'absolute bottom-4 right-4 sm:opacity-0 sm:group-hover:opacity-100'
      )}
      title="复制内链"
      aria-label="复制图集内链"
    >
      <Link2 size={14} />
    </button>
  </div>
));

const GalleryList = () => {
  const [galleries, setGalleries] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin, isBanned } = useAuth();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [galleryToDelete, setGalleryToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deletingGalleryId, setDeletingGalleryId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const { show } = useToast();
  const { preferences, setViewMode } = useUserPreferences();
  const viewMode = preferences.viewMode;

  const totalGalleryPages = Math.ceil(galleries.length / pageSize);
  const paginatedGalleries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return galleries.slice(start, start + pageSize);
  }, [galleries, page, pageSize]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  useEffect(() => {
    const fetchGalleries = async () => {
      setLoading(true);
      try {
        const data = await apiGet<{ galleries: GalleryItem[] }>('/api/galleries');
        setGalleries(data.galleries || []);
      } catch (error) {
        console.error('Fetch galleries error:', error);
        setGalleries([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGalleries();
  }, []);

  const handleCopyGalleryLink = async (event: React.MouseEvent<HTMLButtonElement>, galleryId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const copied = await copyToClipboard(toAbsoluteInternalUrl(`/gallery/${galleryId}`));
    if (copied) {
      show('图集内链已复制');
      return;
    }
    show('复制链接失败，请稍后重试', { variant: 'error' });
  };

  const handleRequestDeleteGallery = (
    event: React.MouseEvent<HTMLButtonElement>,
    gallery: { id: string; title?: string | null },
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setGalleryToDelete({
      id: gallery.id,
      title: gallery.title?.trim() || '未命名图集',
    });
  };

  const handleConfirmDeleteGallery = async () => {
    if (!galleryToDelete || deletingGalleryId) return;

    try {
      setDeletingGalleryId(galleryToDelete.id);
      await apiDelete(`/api/galleries/${galleryToDelete.id}`);
      setGalleries((prev) => prev.filter((gallery) => gallery.id !== galleryToDelete.id));
      show('图集已删除');
      setGalleryToDelete(null);
    } catch (error) {
      console.error('Delete gallery from list error:', error);
      show('删除图集失败', { variant: 'error' });
    } finally {
      setDeletingGalleryId(null);
    }
  };

  if (loading) {
    return <GallerySkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-5xl font-serif font-bold text-brand-olive mb-2">图集馆</h1>
          <p className="text-gray-500 italic">诗扶图集 · 记录每一帧绝色</p>
        </div>
        {user && !isBanned && (
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="px-6 py-3 bg-brand-olive text-white rounded-full font-medium hover:bg-brand-olive/90 transition-all flex items-center gap-2 shadow-md"
          >
            <Plus size={18} /> 上传图集
          </button>
        )}
        <ViewModeSelector value={viewMode} onChange={setViewMode} />
      </div>

      {loading ? (
        <div className={clsx('grid', VIEW_MODE_CONFIG[viewMode].gridCols, VIEW_MODE_CONFIG[viewMode].gap)}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className={clsx(
              viewMode === 'list' ? 'h-24' : VIEW_MODE_CONFIG[viewMode].cardHeight,
              'bg-white rounded-[32px] animate-pulse border border-gray-100'
            )}></div>
          ))}
        </div>
      ) : galleries.length > 0 ? (
        <>
          <div className={clsx('grid', VIEW_MODE_CONFIG[viewMode].gridCols, VIEW_MODE_CONFIG[viewMode].gap)}>
            {paginatedGalleries.map((gallery) => (
            <GalleryCard
              key={gallery.id}
              gallery={gallery}
              viewMode={viewMode}
              isAdmin={isAdmin}
              deletingGalleryId={deletingGalleryId}
              onCopyLink={handleCopyGalleryLink}
              onRequestDelete={handleRequestDeleteGallery}
            />
          ))}
          </div>
          {totalGalleryPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalGalleryPages}
              onPageChange={handlePageChange}
              pageSize={pageSize}
              onPageSizeChange={handlePageSizeChange}
              showPageSizeSelector
            />
          )}
        </>
      ) : (
        <div className="bg-white p-20 rounded-[40px] border border-gray-100 text-center">
          <ImageIcon size={48} className="mx-auto text-gray-200 mb-6" />
          <p className="text-gray-400 italic">暂无图集，快来上传吧！</p>
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <UploadModal onClose={() => setIsUploadModalOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {galleryToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-2xl font-serif font-bold text-gray-900 mb-4">确认删除</h3>
              <p className="text-gray-500 mb-8">
                您确定要删除图集《{galleryToDelete.title}》吗？此操作无法撤销。
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setGalleryToDelete(null)}
                  disabled={Boolean(deletingGalleryId)}
                  className="flex-grow px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmDeleteGallery}
                  disabled={Boolean(deletingGalleryId)}
                  className="flex-grow px-6 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingGalleryId ? '删除中...' : '确定删除'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const UploadModal = ({ onClose }: { onClose: () => void }) => {
  const { user, isAdmin, isBanned } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [locationName, setLocationName] = useState<string | null>(null);
  const [locationCode, setLocationCode] = useState<string | null>(null);
  const [files, setFiles] = useState<LocalPreviewFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<LocalPreviewFile[]>([]);
  const { show } = useToast();

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const handleClose = () => {
    files.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setFiles([]);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const maxSize = 10 * 1024 * 1024; // 10MB

      const validFiles: { file: File; previewUrl: string }[] = [];
      const invalidFiles: string[] = [];

      Array.from(e.target.files!).forEach((file) => {
        if (!allowedTypes.includes(file.type)) {
          invalidFiles.push(`${file.name} (不支持的文件类型)`);
        } else if (file.size > maxSize) {
          invalidFiles.push(`${file.name} (文件过大，最大 10MB)`);
        } else {
          validFiles.push({
            file,
            previewUrl: URL.createObjectURL(file),
          });
        }
      });

      if (invalidFiles.length > 0) {
        show(`以下文件无法上传：${invalidFiles.slice(0, 3).join(', ')}${invalidFiles.length > 3 ? '...' : ''}`, { variant: 'error' });
      }

      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles]);

        // If title is empty and we have a folder path, try to use the folder name
        if (!title && validFiles[0]?.file && (validFiles[0].file as any).webkitRelativePath) {
          const path = (validFiles[0].file as any).webkitRelativePath;
          const folderName = path.split('/')[0];
          if (folderName) setTitle(folderName);
        }
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadFileToSession = async (sessionId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload<UploadFileResponse>(
      `/api/uploads/sessions/${sessionId}/files`,
      formData
    );
  };

  const handleUpload = async () => {
    if (!user || files.length === 0) return show('请选择图片', { variant: 'error' });
    if (isBanned) return show('账号已被封禁，无法上传图集', { variant: 'error' });
    
    // Group files by folder if possible
    const groups: { [key: string]: File[] } = {};
    files.forEach((entry) => {
      const path = (entry.file as any).webkitRelativePath || '';
      const folderName = path.split('/')[0] || '默认图集';
      if (!groups[folderName]) groups[folderName] = [];
      groups[folderName].push(entry.file);
    });

    setUploading(true);
    setProgress(0);

    const MAX_CONCURRENT = 3;

    const uploadFilesWithConcurrency = async (
      sessionId: string,
      fileList: File[],
      onFileComplete: () => void
    ): Promise<string[]> => {
      const results: string[] = [];

      for (let i = 0; i < fileList.length; i += MAX_CONCURRENT) {
        const batch = fileList.slice(i, i + MAX_CONCURRENT);
        const batchResults = await Promise.all(
          batch.map(async (file) => {
            const uploadData = await uploadFileToSession(sessionId, file);
            onFileComplete();
            return uploadData.asset.id;
          })
        );
        results.push(...batchResults);
      }

      return results;
    };

    try {
      const groupNames = Object.keys(groups);
      const totalFiles = files.length;
      let uploadedCount = 0;

      for (const groupName of groupNames) {
        const groupFiles = groups[groupName];
        const sessionData = await apiPost<UploadSessionResponse>('/api/uploads/sessions', {
          maxFiles: groupFiles.length,
        });
        const sessionId = sessionData.session.id;

        const galleryTitle = groupNames.length === 1 && title ? title : groupName;

        const uploadedAssetIds = await uploadFilesWithConcurrency(
          sessionId,
          groupFiles,
          () => {
            uploadedCount++;
            setProgress(Math.round((uploadedCount / totalFiles) * 100));
          }
        );

        await apiPost(`/api/uploads/sessions/${sessionId}/finalize`);

        const galleryResponse = await apiPost<GalleryCreateResponse>('/api/galleries', {
          title: galleryTitle,
          description: description || `来自 ${groupName} 的图集`,
          uploadSessionId: sessionId,
          assetIds: uploadedAssetIds,
          tags: tags.split(',').map(t => t.trim()).filter(t => t),
          locationCode: locationCode,
        });

        // 跳转到刚创建的图集详情页
        if (galleryResponse.gallery?.id) {
          navigate(`/gallery/${galleryResponse.gallery.id}`);
        }
      }

      handleClose();
    } catch (e) {
      console.error("Error uploading gallery:", e);
      show('上传失败，请重试', { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white rounded-[40px] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-8 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-3xl font-serif font-bold text-brand-olive">上传新图集</h2>
          <button onClick={handleClose} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-8 space-y-8">
          <div className="space-y-2">
            <label htmlFor="gallery-create-title" className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">图集标题</label>
            <input
              id="gallery-create-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="例如：2024 Live 现场返图"
              className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-olive/20"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">标签 (逗号分隔)</label>
              <input 
                type="text" 
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="例如：Live, 绝色, 2024"
                className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-olive/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">地点</label>
              <LocationTagInput
                value={locationName}
                locationCode={locationCode}
                onChange={(name, code) => {
                  setLocationName(name);
                  setLocationCode(code);
                }}
                onClear={() => {
                  setLocationName(null);
                  setLocationCode(null);
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-brand-olive/60">描述 (可选)</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="简单介绍一下这个图集..."
              rows={3}
              className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-olive/20 resize-none"
            />
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 min-w-[200px] p-8 border-2 border-dashed border-gray-200 rounded-3xl hover:border-brand-olive hover:bg-brand-cream transition-all flex flex-col items-center justify-center gap-3 group"
              >
                <Upload size={32} className="text-gray-300 group-hover:text-brand-olive" />
                <span className="text-sm font-bold text-gray-400 group-hover:text-brand-olive">选择多张图片</span>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                />
              </button>

              <button 
                onClick={() => folderInputRef.current?.click()}
                className="flex-1 min-w-[200px] p-8 border-2 border-dashed border-gray-200 rounded-3xl hover:border-brand-olive hover:bg-brand-cream transition-all flex flex-col items-center justify-center gap-3 group"
              >
                <Folder size={32} className="text-gray-300 group-hover:text-brand-olive" />
                <span className="text-sm font-bold text-gray-400 group-hover:text-brand-olive">上传整个文件夹</span>
                <input 
                  type="file" 
                  // @ts-ignore
                  webkitdirectory="" 
                  directory="" 
                  multiple 
                  className="hidden" 
                  ref={folderInputRef} 
                  onChange={handleFileChange}
                />
              </button>
            </div>

            {files.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-4 p-4 bg-brand-cream rounded-3xl">
                {files.map((item, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
                    <img 
                      src={item.previewUrl}
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                    <button 
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-8 border-t border-gray-100 flex items-center justify-between">
          <div className="flex-grow mr-8">
            {uploading && (
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-olive transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}
          </div>
          <button 
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="px-12 py-4 bg-brand-olive text-white rounded-full font-bold hover:bg-brand-olive/90 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            {uploading ? `上传中 ${progress}%` : '开始上传'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default GalleryList;
