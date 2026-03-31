import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Loader2, Plus, Search, Trash2, X } from 'lucide-react';

import { apiPatch } from '../lib/apiClient';
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

type SongFormData = {
  title: string;
  artist: string;
  album: string;
  lyric?: string | null;
};

type CustomPlatformLink = {
  label: string;
  url: string;
};

const normalizeCustomPlatformLinkUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const raw = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
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
  primaryPlatform?: Platform | null;
  favoritedByMe?: boolean;
  platformIds?: PlatformIds;
  customPlatformLinks?: CustomPlatformLink[];
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
  });
  const [platformIds, setPlatformIds] = useState<PlatformIds>({
    neteaseId: song.platformIds?.neteaseId || '',
    tencentId: song.platformIds?.tencentId || '',
    kugouId: song.platformIds?.kugouId || '',
    baiduId: song.platformIds?.baiduId || '',
    kuwoId: song.platformIds?.kuwoId || '',
  });
  const [customPlatformLinks, setCustomPlatformLinks] = useState<CustomPlatformLink[]>(song.customPlatformLinks || []);
  const [platformExpanded, setPlatformExpanded] = useState(false);
  const [matchingPlatform, setMatchingPlatform] = useState<Platform | null>(null);
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
      setPlatformIds({
        neteaseId: song.platformIds?.neteaseId || '',
        tencentId: song.platformIds?.tencentId || '',
        kugouId: song.platformIds?.kugouId || '',
        baiduId: song.platformIds?.baiduId || '',
        kuwoId: song.platformIds?.kuwoId || '',
      });
      setCustomPlatformLinks(song.customPlatformLinks || []);
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

    const normalizedCustomPlatformLinks = customPlatformLinks.map((link) => ({
      label: link.label.trim(),
      url: link.url.trim(),
    }));
    const hasIncompleteCustomPlatformLink = normalizedCustomPlatformLinks.some(
      (link) => (link.label || link.url) && (!link.label || !link.url),
    );

    if (hasIncompleteCustomPlatformLink) {
      show('自定义平台链接需要同时填写平台名称和地址', { variant: 'error' });
      return;
    }

    const hasInvalidCustomPlatformLink = normalizedCustomPlatformLinks.some(
      (link) => link.url && !normalizeCustomPlatformLinkUrl(link.url),
    );

    if (hasInvalidCustomPlatformLink) {
      show('自定义平台链接地址无效，请填写正确的 http/https 链接', { variant: 'error' });
      return;
    }

    setSaving(true);
    try {
      const result = await apiPatch<{ song: SongItem; error?: string; conflict?: boolean; conflictingSong?: { docId: string; title: string; artist: string } }>(`/api/music/${song.docId}`, {
        title: formData.title.trim(),
        artist: formData.artist.trim(),
        album: formData.album.trim(),
        lyric: formData.lyric?.trim() || null,
        neteaseId: platformIds.neteaseId || null,
        tencentId: platformIds.tencentId || null,
        kugouId: platformIds.kugouId || null,
        baiduId: platformIds.baiduId || null,
        kuwoId: platformIds.kuwoId || null,
        customPlatformLinks: normalizedCustomPlatformLinks.filter((link) => link.label && link.url),
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

  const handleCustomPlatformLinkChange = (index: number, key: keyof CustomPlatformLink, value: string) => {
    setCustomPlatformLinks((prev) => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [key]: value } : item
    )));
  };

  const handleAddCustomPlatformLink = () => {
    setCustomPlatformLinks((prev) => [...prev, { label: '', url: '' }]);
  };

  const handleRemoveCustomPlatformLink = (index: number) => {
    setCustomPlatformLinks((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
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

            <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700">自定义平台链接</p>
                  <p className="text-xs text-gray-500 mt-1">例如哔哩哔哩、5sing 或其他发布平台</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomPlatformLink}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:text-brand-primary hover:border-brand-primary/40 transition-colors"
                >
                  <Plus size={14} /> 添加链接
                </button>
              </div>

              {customPlatformLinks.length > 0 ? (
                <div className="space-y-3">
                  {customPlatformLinks.map((link, index) => {
                    const previewUrl = normalizeCustomPlatformLinkUrl(link.url);

                    return (
                      <div key={`${index}-${link.label}-${link.url}`} className="rounded-2xl border border-gray-200 bg-white p-3 space-y-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            value={link.label}
                            onChange={(e) => handleCustomPlatformLinkChange(index, 'label', e.target.value)}
                            placeholder="平台名称，例如 Bilibili"
                            className="w-40 px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/25 text-sm"
                          />
                          <input
                            type="text"
                            value={link.url}
                            onChange={(e) => handleCustomPlatformLinkChange(index, 'url', e.target.value)}
                            placeholder="链接地址，例如 https://www.bilibili.com/..."
                            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/25 text-sm"
                          />
                          {previewUrl ? (
                            <a
                              href={previewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-brand-primary transition-colors"
                            >
                              <ExternalLink size={16} />
                            </a>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomPlatformLink(index)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            aria-label="删除链接"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 px-4 py-6 text-sm text-gray-400 text-center">
                  暂无自定义平台链接
                </div>
              )}
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
