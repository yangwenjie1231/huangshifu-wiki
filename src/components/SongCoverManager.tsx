import React, { useState } from 'react';
import { Loader2, Trash2, Star, Upload, X } from 'lucide-react';
import { clsx } from 'clsx';

import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/apiClient';
import { useToast } from './Toast';

type CoverItem = {
  id: string;
  url: string;
  isDefault: boolean;
  createdAt: string;
};

type CoversResponse = {
  covers: CoverItem[];
};

interface SongCoverManagerProps {
  songDocId: string;
  currentCover: string;
  onCoverUpdated?: (newCoverUrl: string) => void;
}

export const SongCoverManager = ({ songDocId, currentCover, onCoverUpdated }: SongCoverManagerProps) => {
  const [covers, setCovers] = useState<CoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { show } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchCovers = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiGet<CoversResponse>(`/api/music/${songDocId}/covers`);
      setCovers(response.covers || []);
    } catch (error) {
      console.error('Fetch covers failed:', error);
    } finally {
      setLoading(false);
    }
  }, [songDocId]);

  React.useEffect(() => {
    if (isOpen) {
      fetchCovers();
    }
  }, [isOpen, fetchCovers]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      show('请选择图片文件', { variant: 'error' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      show('图片大小不能超过 10MB', { variant: 'error' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/uploads`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = '上传失败';
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          try {
            const data = await response.json();
            errorMessage = (data as { error?: string })?.error || errorMessage;
          } catch {
            // JSON parse failed, use default errorMessage
          }
        } else {
          // Non-JSON response (likely HTML error page)
          const text = await response.text().catch(() => '');
          console.error('Upload error response:', text.slice(0, 500));
          if (response.status === 413) {
            errorMessage = '文件过大，请选择更小的图片';
          } else if (response.status === 401) {
            errorMessage = '请先登录';
          } else if (response.status === 403) {
            errorMessage = '没有上传权限';
          } else if (response.status === 400) {
            errorMessage = '图片格式不支持或文件损坏';
          }
        }
        throw new Error(errorMessage);
      }

      const uploadResult = await response.json() as { file: { assetId: string; url: string } };

      await apiPost(`/api/music/${songDocId}/covers`, {
        assetId: uploadResult.file.assetId,
      });

      show('封面上传成功');
      fetchCovers();
    } catch (error) {
      console.error('Upload cover failed:', error);
      show(error instanceof Error ? error.message : '上传封面失败', { variant: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSetDefault = async (coverId: string) => {
    setSettingDefault(coverId);
    try {
      await apiPatch(`/api/music/${songDocId}/covers/${coverId}/default`);
      setCovers((prev) =>
        prev.map((c) => ({
          ...c,
          isDefault: c.id === coverId,
        })),
      );
      const newDefaultCover = covers.find((c) => c.id === coverId);
      if (newDefaultCover && onCoverUpdated) {
        onCoverUpdated(newDefaultCover.url);
      }
      show('默认封面已更新');
    } catch (error) {
      console.error('Set default cover failed:', error);
      show('设置默认封面失败', { variant: 'error' });
    } finally {
      setSettingDefault(null);
    }
  };

  const handleDelete = async (coverId: string) => {
    if (!window.confirm('确定要删除这个封面吗？')) return;

    setDeleting(coverId);
    try {
      await apiDelete(`/api/music/${songDocId}/covers/${coverId}`);
      setCovers((prev) => prev.filter((c) => c.id !== coverId));
      show('封面已删除');
    } catch (error) {
      console.error('Delete cover failed:', error);
      show('删除封面失败', { variant: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 rounded-full border border-gray-200 text-sm text-gray-600 hover:text-brand-primary hover:border-brand-primary/40 transition-colors"
      >
        封面管理
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white rounded-[36px] shadow-2xl border border-gray-100 flex flex-col">
        <header className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-serif font-bold text-gray-900">歌曲封面管理</h3>
            <p className="text-xs text-gray-500 mt-1">上传、设置默认封面或删除现有封面</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          <div className="rounded-3xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-700">当前封面</span>
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100">
                <img src={currentCover} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full px-5 py-3 rounded-2xl bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? '上传中...' : '上传新封面'}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : covers.length > 0 ? (
            <div className="space-y-3">
              <span className="text-sm font-semibold text-gray-700">已上传的封面 ({covers.length})</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {covers.map((cover) => (
                  <div
                    key={cover.id}
                    className={clsx(
                      'relative rounded-2xl overflow-hidden border-2 transition-all',
                      cover.isDefault ? 'border-brand-primary ring-2 ring-brand-primary/20' : 'border-gray-100',
                    )}
                  >
                    <div className="aspect-square">
                      <img src={cover.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    {cover.isDefault && (
                      <div className="absolute top-2 left-2 px-2 py-1 bg-brand-primary text-gray-900 text-xs font-bold rounded-full flex items-center gap-1">
                        <Star size={10} /> 默认
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                      {!cover.isDefault && (
                        <button
                          onClick={() => handleSetDefault(cover.id)}
                          disabled={settingDefault === cover.id}
                          className="p-2 bg-white rounded-full text-gray-700 hover:text-brand-primary transition-colors disabled:opacity-50"
                          title="设为默认"
                        >
                          {settingDefault === cover.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Star size={16} />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(cover.id)}
                        disabled={deleting === cover.id || cover.isDefault}
                        className="p-2 bg-white rounded-full text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                        title="删除"
                      >
                        {deleting === cover.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">暂无额外封面</div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-white"
          >
            关闭
          </button>
        </footer>
      </div>
    </div>
  );
};
