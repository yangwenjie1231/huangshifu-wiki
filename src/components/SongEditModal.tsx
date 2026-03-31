import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { clsx } from 'clsx';

import { apiGet, apiPatch } from '../lib/apiClient';
import { useToast } from './Toast';
import { MatchSuggestionModal } from './MatchSuggestionModal';

type Platform = 'netease' | 'tencent' | 'kugou' | 'baidu' | 'kuwo';

type PlatformIds = {
  neteaseId?: string | null;
  tencentId?: string | null;
  kugouId?: string | null;
  baiduId?: string | null;
  kuwoId?: string | null;
};

type CustomPlatformConfig = {
  key: string;
  label: string;
  urlPattern: string;
  color: string;
  bgColor: string;
};

type SongFormData = {
  title: string;
  artist: string;
  album: string;
  lyric?: string | null;
  description?: string | null;
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
  description?: string | null;
  primaryPlatform?: Platform | null;
  favoritedByMe?: boolean;
  platformIds?: PlatformIds;
  customPlatformIds?: Record<string, string>;
};

interface SongEditModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  song: SongItem;
}

const platformFields: Array<{ key: keyof PlatformIds; label: string; urlPattern: (id: string) => string }> = [
  { key: 'neteaseId', label: '网易云音乐', urlPattern: (id) => `https://music.163.com/song?id=${id}` },
  { key: 'tencentId', label: 'QQ音乐', urlPattern: (id) => `https://y.qq.com/n/ryqq/songDetail/${id}` },
  { key: 'kugouId', label: '酷狗音乐', urlPattern: (id) => `https://www.kugou.com/song/#hash=${id}` },
  { key: 'baiduId', label: '百度音乐', urlPattern: (id) => `https://music.baidu.com/song/${id}` },
  { key: 'kuwoId', label: '酷我音乐', urlPattern: (id) => `https://www.kuwo.cn/song_detail/${id}` },
];

export const SongEditModal = ({ open, onClose, onSuccess, song }: SongEditModalProps) => {
  const [formData, setFormData] = useState<SongFormData>({
    title: song.title || '',
    artist: song.artist || '',
    album: song.album || '',
    lyric: song.lyric || '',
    description: song.description || '',
  });
  const [platformIds, setPlatformIds] = useState<PlatformIds>({
    neteaseId: song.platformIds?.neteaseId || '',
    tencentId: song.platformIds?.tencentId || '',
    kugouId: song.platformIds?.kugouId || '',
    baiduId: song.platformIds?.baiduId || '',
    kuwoId: song.platformIds?.kuwoId || '',
  });
  const [customPlatformIds, setCustomPlatformIds] = useState<Record<string, string>>(song.customPlatformIds || {});
  const [customPlatforms, setCustomPlatforms] = useState<CustomPlatformConfig[]>([]);
  const [platformExpanded, setPlatformExpanded] = useState(false);
  const [customPlatformExpanded, setCustomPlatformExpanded] = useState(false);
  const [matchingPlatform, setMatchingPlatform] = useState<Platform | null>(null);
  const [saving, setSaving] = useState(false);
  const { show } = useToast();

  useEffect(() => {
    if (open) {
      apiGet<{ platforms: CustomPlatformConfig[] }>('/api/music-platforms')
        .then(data => {
          setCustomPlatforms(data.platforms || []);
        })
        .catch(() => {
          setCustomPlatforms([]);
        });
    }
  }, [open]);

  useEffect(() => {
    if (song) {
      setFormData({
        title: song.title || '',
        artist: song.artist || '',
        album: song.album || '',
        lyric: song.lyric || '',
        description: song.description || '',
      });
      setPlatformIds({
        neteaseId: song.platformIds?.neteaseId || '',
        tencentId: song.platformIds?.tencentId || '',
        kugouId: song.platformIds?.kugouId || '',
        baiduId: song.platformIds?.baiduId || '',
        kuwoId: song.platformIds?.kuwoId || '',
      });
      setCustomPlatformIds(song.customPlatformIds || {});
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
      const result = await apiPatch<{ song: SongItem; error?: string; conflict?: boolean; conflictingSong?: { docId: string; title: string; artist: string } }>(`/api/music/${song.docId}`, {
        title: formData.title.trim(),
        artist: formData.artist.trim(),
        album: formData.album.trim(),
        lyric: formData.lyric?.trim() || null,
        description: formData.description?.trim() || null,
        neteaseId: platformIds.neteaseId || null,
        tencentId: platformIds.tencentId || null,
        kugouId: platformIds.kugouId || null,
        baiduId: platformIds.baiduId || null,
        kuwoId: platformIds.kuwoId || null,
        customPlatformIds: customPlatformIds,
      });
      show('歌曲已更新');
      onSuccess();
      onClose();
    } catch (error) {
      const err = error as { conflict?: boolean; conflictingSong?: { docId: string; title: string; artist: string }; message?: string };
      if (err.conflict && err.conflictingSong) {
        show(`该平台ID已被歌曲「${err.conflictingSong.title}」使用`, { variant: 'error' });
      } else {
        show(error instanceof Error ? error.message : '保存失败', { variant: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePlatformIdChange = (key: keyof PlatformIds, value: string) => {
    setPlatformIds((prev) => ({ ...prev, [key]: value }));
  };

  const handleMatchSelect = (platform: Platform, sourceId: string) => {
    handlePlatformIdChange(`${platform}Id` as keyof PlatformIds, sourceId);
    setMatchingPlatform(null);
  };

  const linkedPlatforms = platformFields.filter((p) => platformIds[p.key]);

  return (
    <>
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

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">歌曲描述</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="创作者的话、创作背景等（可选，支持 Markdown）"
                rows={3}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/25 resize-none text-sm"
              />
            </div>

            <button
              type="button"
              onClick={() => setPlatformExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/60 hover:bg-gray-100/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">关联平台</span>
                {linkedPlatforms.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-primary/20 text-brand-primary font-bold">
                    已关联 {linkedPlatforms.length} 个
                  </span>
                )}
              </div>
              {platformExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </button>

            {platformExpanded && (
              <div className="space-y-3">
                {platformFields.map((platform) => {
                  const currentId = platformIds[platform.key] || '';
                  const isLinked = Boolean(currentId);
                  return (
                    <div key={platform.key} className="flex items-center gap-3">
                      <span className="w-24 text-sm text-gray-600 shrink-0">{platform.label}</span>
                      <input
                        type="text"
                        value={currentId}
                        onChange={(e) => handlePlatformIdChange(platform.key, e.target.value)}
                        placeholder={isLinked ? '已关联' : '输入平台歌曲ID'}
                        className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/25 text-sm font-mono"
                      />
                      {isLinked && (
                        <a
                          href={platform.urlPattern(currentId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-brand-primary transition-colors"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setMatchingPlatform(platform.key.replace('Id', '') as Platform)}
                        className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:text-brand-primary hover:border-brand-primary/40 transition-colors flex items-center gap-1"
                      >
                        <Search size={14} />
                        匹配
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {customPlatforms.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setCustomPlatformExpanded((prev) => !prev)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/60 hover:bg-gray-100/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">自定义平台</span>
                    {Object.keys(customPlatformIds).length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">
                        已添加 {Object.keys(customPlatformIds).length} 个
                      </span>
                    )}
                  </div>
                  {customPlatformExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </button>

                {customPlatformExpanded && (
                  <div className="space-y-3">
                    {customPlatforms.map((platform) => {
                      const currentId = customPlatformIds[platform.key] || '';
                      const isLinked = Boolean(currentId);
                      const buildUrl = (id: string) => {
                        return platform.urlPattern.replace('{id}', id);
                      };
                      return (
                        <div key={platform.key} className="flex items-center gap-3">
                          <span className={clsx(
                            'w-20 text-xs px-2 py-1 rounded-full text-center shrink-0',
                            platform.bgColor,
                            platform.color
                          )}>
                            {platform.label}
                          </span>
                          <input
                            type="text"
                            value={currentId}
                            onChange={(e) => setCustomPlatformIds((prev) => ({
                              ...prev,
                              [platform.key]: e.target.value,
                            }))}
                            placeholder={isLinked ? '已添加' : '输入平台ID'}
                            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/25 text-sm font-mono"
                          />
                          {isLinked && (
                            <a
                              href={buildUrl(currentId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-brand-primary transition-colors"
                            >
                              <ExternalLink size={16} />
                            </a>
                          )}
                          {isLinked && (
                            <button
                              type="button"
                              onClick={() => setCustomPlatformIds((prev) => {
                                const next = { ...prev };
                                delete next[platform.key];
                                return next;
                              })}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                              title="移除"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

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

      {matchingPlatform && (
        <MatchSuggestionModal
          open={true}
          onClose={() => setMatchingPlatform(null)}
          title={formData.title}
          artist={formData.artist}
          targetPlatform={matchingPlatform}
          existingPlatformId={platformIds[`${matchingPlatform}Id` as keyof PlatformIds]}
          onSelect={(sourceId) => handleMatchSelect(matchingPlatform, sourceId)}
        />
      )}
    </>
  );
};