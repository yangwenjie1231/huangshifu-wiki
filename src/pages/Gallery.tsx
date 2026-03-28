import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Image as ImageIcon, Plus, Folder, X, Upload, Clock, User as UserIcon, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { SmartImage } from '../components/SmartImage';
import { useToast } from '../components/Toast';
import { copyToClipboard, toAbsoluteInternalUrl } from '../lib/copyLink';
import { apiPost } from '../lib/apiClient';
import { LocationTagInput } from '../components/LocationTagInput';

const toDateValue = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

type UploadSessionResponse = {
  session: {
    id: string;
    status: 'open' | 'finalized' | 'expired';
    maxFiles: number;
    uploadedFiles: number;
    expiresAt: string;
  };
};

type UploadFileResponse = {
  session: {
    id: string;
    status: 'open' | 'finalized' | 'expired';
    uploadedFiles: number;
    maxFiles: number;
  };
  asset: {
    id: string;
    url: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  };
};

type LocalPreviewFile = {
  file: File;
  previewUrl: string;
};

type GalleryCreateResponse = {
  gallery: {
    id: string;
  };
};

const GalleryList = () => {
  const [galleries, setGalleries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isBanned } = useAuth();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const { show } = useToast();

  useEffect(() => {
    const q = query(collection(db, 'galleries'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGalleries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
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
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-64 bg-white rounded-[32px] animate-pulse border border-gray-100"></div>
          ))}
        </div>
      ) : galleries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {galleries.map((gallery) => (
            <div key={gallery.id} className="relative group">
              <Link
                to={`/gallery/${gallery.id}`}
                className="block bg-white rounded-[32px] border border-gray-100 overflow-hidden hover:shadow-xl transition-all"
              >
                <div className="relative h-48 overflow-hidden">
                  <SmartImage 
                    src={gallery.images[0]?.url} 
                    alt={gallery.title} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold rounded-full">
                    {gallery.images.length} 张
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
              </Link>
              <button
                onClick={(event) => handleCopyGalleryLink(event, gallery.id)}
                className="absolute bottom-4 right-4 p-2 rounded-full border border-white/70 bg-white/85 text-gray-500 shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-brand-olive transition-all"
                title="复制内链"
                aria-label="复制图集内链"
              >
                <Link2 size={14} />
              </button>
            </div>
          ))}
        </div>
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
    </div>
  );
};

const UploadModal = ({ onClose }: { onClose: () => void }) => {
  const { user, isBanned } = useAuth();
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

    const response = await fetch(`/api/uploads/sessions/${sessionId}/files`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof data === 'object' && data && 'error' in data
        ? String((data as Record<string, unknown>).error)
        : '上传图片失败';
      throw new Error(message);
    }

    return data as UploadFileResponse;
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
        const uploadedAssetIds: string[] = [];
        
        // Use user-provided title for the first/only group if it's not a folder upload
        // or if it's a single folder. If multiple folders, use folder names.
        const galleryTitle = groupNames.length === 1 && title ? title : groupName;

        for (const file of groupFiles) {
          const uploadData = await uploadFileToSession(sessionId, file);
          uploadedAssetIds.push(uploadData.asset.id);
          
          uploadedCount++;
          setProgress(Math.round((uploadedCount / totalFiles) * 100));
        }

        await apiPost(`/api/uploads/sessions/${sessionId}/finalize`);

        await apiPost<GalleryCreateResponse>('/api/galleries', {
          title: galleryTitle,
          description: description || `来自 ${groupName} 的图集`,
          uploadSessionId: sessionId,
          assetIds: uploadedAssetIds,
          tags: tags.split(',').map(t => t.trim()).filter(t => t),
          locationCode: locationCode,
        });
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
