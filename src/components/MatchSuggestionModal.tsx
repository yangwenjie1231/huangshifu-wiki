import React, { useState } from 'react';
import { ExternalLink, Loader2, Search, X, Check, AlertCircle } from 'lucide-react';

import { apiGet } from '../lib/apiClient';

type Platform = 'netease' | 'tencent' | 'kugou' | 'baidu' | 'kuwo';

type MatchSuggestion = {
  sourceId: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  sourceUrl: string;
  score: number;
  isAutoSelected: boolean;
  alreadyLinked: { docId: string; title: string } | null;
};

type MatchSuggestionsResponse = {
  suggestions: MatchSuggestion[];
  autoSelectedIndex: number | null;
};

interface MatchSuggestionModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  artist: string;
  targetPlatform: Platform;
  existingPlatformId?: string | null;
  onSelect: (sourceId: string) => void;
}

const platformLabels: Record<Platform, string> = {
  netease: '网易云音乐',
  tencent: 'QQ音乐',
  kugou: '酷狗音乐',
  baidu: '百度音乐',
  kuwo: '酷我音乐',
};

function buildPlatformSongUrl(platform: Platform, id: string): string {
  if (platform === 'netease') return `https://music.163.com/song?id=${id}`;
  if (platform === 'tencent') return `https://y.qq.com/n/ryqq/songDetail/${id}`;
  if (platform === 'kugou') return `https://www.kugou.com/song/#hash=${id}`;
  if (platform === 'baidu') return `https://music.baidu.com/song/${id}`;
  return `https://www.kuwo.cn/song_detail/${id}`;
}

export const MatchSuggestionModal = ({
  open,
  onClose,
  title,
  artist,
  targetPlatform,
  existingPlatformId,
  onSelect,
}: MatchSuggestionModalProps) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  React.useEffect(() => {
    if (open && !searched) {
      handleSearch();
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setSuggestions([]);
      setSearched(false);
      setError('');
      setSelectedIndex(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (searched && suggestions.length > 0) {
      const autoIdx = suggestions.findIndex((s) => s.isAutoSelected);
      if (autoIdx >= 0) {
        setSelectedIndex(autoIdx);
      }
    }
  }, [searched, suggestions]);

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    setSearched(false);

    try {
      const data = await apiGet<MatchSuggestionsResponse>('/api/music/match-suggestions', {
        platform: targetPlatform,
        title,
        artist,
      });
      setSuggestions(data.suggestions || []);
      setSearched(true);
      if (data.suggestions.length === 0) {
        setError(`在${platformLabels[targetPlatform]}未找到匹配歌曲`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
      setSuggestions([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedIndex === null) return;
    onSelect(suggestions[selectedIndex].sourceId);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-lg max-h-[90vh] overflow-hidden bg-white rounded-[36px] shadow-2xl border border-gray-100 flex flex-col">
        <header className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-serif font-bold text-gray-900">搜索匹配歌曲</h3>
            <p className="text-xs text-gray-500 mt-1">
              在{platformLabels[targetPlatform]}搜索：{title} - {artist}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-gray-400" />
              <span className="ml-3 text-gray-500">搜索中...</span>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 text-red-600">
              <AlertCircle size={20} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {searched && suggestions.length > 0 && !loading && (
            <div className="space-y-3">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.sourceId}
                  onClick={() => setSelectedIndex(index)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    selectedIndex === index
                      ? 'border-brand-primary bg-brand-primary/5 shadow-md'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedIndex === index
                          ? 'border-brand-primary bg-brand-primary'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedIndex === index && <Check size={14} className="text-white" />}
                    </div>
                    <img
                      src={suggestion.cover}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 truncate">{suggestion.title}</p>
                      <p className="text-xs text-gray-500 truncate">{suggestion.artist} · {suggestion.album}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            suggestion.score >= 80
                              ? 'bg-green-100 text-green-700'
                              : suggestion.score >= 60
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          匹配度 {suggestion.score}%
                        </span>
                        {suggestion.alreadyLinked && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            已关联
                          </span>
                        )}
                        {suggestion.isAutoSelected && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-brand-primary/20 text-brand-primary">
                            推荐
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href={buildPlatformSongUrl(targetPlatform, suggestion.sourceId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 text-gray-400 hover:text-brand-primary transition-colors shrink-0"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </button>
              ))}
            </div>
          )}

          {searched && suggestions.length === 0 && !loading && !error && (
            <div className="text-center py-12 text-gray-400">
              <Search size={48} className="mx-auto mb-3 opacity-50" />
              <p>未找到匹配歌曲</p>
            </div>
          )}

          {existingPlatformId && (
            <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-xs text-gray-500">
                该平台已有ID: <span className="font-mono font-bold">{existingPlatformId}</span>
              </p>
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-white"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIndex === null || loading}
            className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? '处理中...' : '确认'}
          </button>
        </footer>
      </div>
    </div>
  );
};