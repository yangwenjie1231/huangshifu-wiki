import React, { useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { apiPatch } from '../lib/apiClient';
import { useToast } from './Toast';

type SongFormData = {
  title: string;
  artist: string;
  album: string;
  lyric?: string | null;
};

type SongItem = {
  docId: string;
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  lyric?: string | null;
  primaryPlatform?: 'netease' | 'tencent' | 'kugou' | 'baidu' | 'kuwo' | null;
  favoritedByMe?: boolean;
};

interface SongEditModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  song: SongItem;
}

export const SongEditModal = ({ open, onClose, onSuccess, song }: SongEditModalProps) => {
  const [formData, setFormData] = useState<SongFormData>({
    title: song.title || '',
    artist: song.artist || '',
    album: song.album || '',
    lyric: song.lyric || '',
  });
  const [saving, setSaving] = useState(false);
  const { show } = useToast();

  React.useEffect(() => {
    if (song) {
      setFormData({
        title: song.title || '',
        artist: song.artist || '',
        album: song.album || '',
        lyric: song.lyric || '',
      });
    }
  }, [song, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      show('请输入歌曲标题', { variant: 'error' });
      return;
    }

    if (!formData.artist.trim()) {
      show('请输入艺术家名称', { variant: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiPatch(`/api/music/${song.docId}`, {
        title: formData.title.trim(),
        artist: formData.artist.trim(),
        album: formData.album.trim(),
        lyric: formData.lyric?.trim() || null,
      });
      show('歌曲已更新');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Update song failed:', error);
      show(error instanceof Error ? error.message : '保存失败', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-lg max-h-[90vh] overflow-hidden bg-white rounded-[36px] shadow-2xl border border-gray-100 flex flex-col">
        <header className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-serif font-bold text-gray-900">编辑歌曲</h3>
            <p className="text-xs text-gray-500 mt-1">修改歌曲基本信息</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">歌曲标题 *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="歌曲名称"
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">艺术家 *</label>
            <input
              type="text"
              value={formData.artist}
              onChange={(e) => setFormData((prev) => ({ ...prev, artist: e.target.value }))}
              placeholder="歌手名称"
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">专辑</label>
            <input
              type="text"
              value={formData.album}
              onChange={(e) => setFormData((prev) => ({ ...prev, album: e.target.value }))}
              placeholder="所属专辑（可选）"
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">歌词</label>
            <textarea
              value={formData.lyric || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, lyric: e.target.value }))}
              placeholder="歌词内容（可选，每行一句）"
              rows={6}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/25 resize-none font-mono text-sm"
            />
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="flex items-center gap-3">
              <img src={song.cover} alt="" className="w-12 h-12 rounded-xl object-cover" referrerPolicy="no-referrer" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{song.title}</p>
                <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                <p className="text-xs text-gray-400 mt-1">ID: {song.id}</p>
              </div>
            </div>
          </div>
        </form>

        <footer className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-white"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? '保存中...' : '保存'}
          </button>
        </footer>
      </div>
    </div>
  );
};