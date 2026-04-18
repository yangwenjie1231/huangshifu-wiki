import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Link2, X } from 'lucide-react';
import { clsx } from 'clsx';

import { apiPost } from '../lib/apiClient';

type Platform = 'netease' | 'tencent' | 'kugou' | 'baidu' | 'kuwo';
type ResourceType = 'song' | 'album' | 'playlist';

type PreviewSong = {
  sourceId: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  sourceUrl: string;
};

type ParsedResource = {
  platform: Platform;
  type: ResourceType;
  id: string;
  title: string;
  artist: string;
  cover: string;
  description: string;
  platformUrl: string;
  songs: PreviewSong[];
  totalSongs: number;
};

type ParseUrlResponse = {
  resource: ParsedResource;
};

type ImportResponse = {
  summary: {
    imported: number;
    skipped: number;
    failed: number;
  };
  collection?: {
    docId: string;
    title: string;
    resourceType: ResourceType;
  } | null;
};

interface MusicImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
}

function platformLabel(platform: Platform) {
  if (platform === 'netease') return '网易云音乐';
  if (platform === 'tencent') return 'QQ音乐';
  if (platform === 'kugou') return '酷狗音乐';
  if (platform === 'baidu') return '百度音乐';
  return '酷我音乐';
}

function resourceTypeLabel(type: ResourceType) {
  if (type === 'song') return '歌曲';
  if (type === 'album') return '专辑';
  return '歌单';
}

export const MusicImportModal = ({ open, onClose, onImported }: MusicImportModalProps) => {
  const [url, setUrl] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParsedResource | null>(null);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [importResult, setImportResult] = useState<string>('');

  const selectedCount = selectedIds.size;

  const allSelected = useMemo(() => {
    if (!preview || !preview.songs.length) return false;
    return preview.songs.every((song) => selectedIds.has(song.sourceId));
  }, [preview, selectedIds]);

  if (!open) return null;

  const resetResult = () => {
    setImportResult('');
    setConfirmingImport(false);
  };

  const handleParse = async () => {
    if (!url.trim()) {
      setError('请先粘贴音乐链接');
      return;
    }

    setParsing(true);
    setError('');
    setImportResult('');
    setConfirmingImport(false);

    try {
      const response = await apiPost<ParseUrlResponse>('/api/music/parse-url', {
        url: url.trim(),
      });
      setPreview(response.resource);
      setSelectedIds(new Set(response.resource.songs.map((song) => song.sourceId)));
    } catch (err) {
      setPreview(null);
      setSelectedIds(new Set());
      setError(err instanceof Error ? err.message : '解析链接失败');
    } finally {
      setParsing(false);
    }
  };

  const toggleSong = (sourceId: string) => {
    resetResult();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!preview) return;
    resetResult();
    setSelectedIds(new Set(preview.songs.map((song) => song.sourceId)));
  };

  const handleSelectNone = () => {
    resetResult();
    setSelectedIds(new Set());
  };

  const handleFinalImport = async () => {
    if (!preview) return;
    if (!selectedCount) {
      setError('请至少选择一首歌曲');
      return;
    }

    setImporting(true);
    setError('');
    setImportResult('');

    try {
      const response = await apiPost<ImportResponse>('/api/music/import', {
        url: url.trim() || preview.platformUrl,
        selectedSongIds: [...selectedIds],
      });

      const summary = response.summary;
      const parts = [`导入成功 ${summary.imported} 首`];
      if (summary.skipped) {
        parts.push(`已存在 ${summary.skipped} 首`);
      }
      if (summary.failed) {
        parts.push(`失败 ${summary.failed} 首`);
      }
      if (response.collection) {
        parts.push(`已更新${resourceTypeLabel(response.collection.resourceType)}：${response.collection.title}`);
      }
      setImportResult(parts.join('，'));
      setConfirmingImport(false);
      await onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white rounded-[36px] shadow-2xl border border-gray-100 flex flex-col">
        <header className="px-6 md:px-8 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-serif font-bold text-gray-900">导入音乐 / 专辑 / 歌单</h3>
            <p className="text-xs text-gray-500 mt-1">粘贴链接后自动识别平台；导入前需二次确认</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </header>

        <div className="px-6 md:px-8 py-6 space-y-5 overflow-y-auto">
          <div className="rounded-3xl border border-gray-100 bg-gray-50/60 p-4 md:p-5">
            <label className="text-sm font-semibold text-gray-700 inline-flex items-center gap-2 mb-3">
              <Link2 size={16} /> 粘贴链接
            </label>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setError('');
                }}
                placeholder="例如: https://music.163.com/#/playlist?id=3778678"
                className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
              />
              <button
                onClick={handleParse}
                disabled={parsing}
                className="px-5 py-3 rounded-2xl bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {parsing ? <Loader2 size={16} className="animate-spin" /> : null}
                {parsing ? '解析中' : '解析链接'}
              </button>
            </div>
            {error ? <p className="text-sm text-red-500 mt-3">{error}</p> : null}
          </div>

          {preview ? (
            <section className="rounded-3xl border border-brand-primary/20 bg-brand-cream/30 p-4 md:p-6 space-y-4">
              <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 shrink-0">
                    {preview.cover ? (
                      <img src={preview.cover} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">
                      {platformLabel(preview.platform)} · {resourceTypeLabel(preview.type)}
                    </p>
                    <h4 className="text-xl font-serif font-bold text-gray-900 truncate">{preview.title}</h4>
                    <p className="text-sm text-gray-500 truncate">{preview.artist}</p>
                  </div>
                </div>
                <a
                  href={preview.platformUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-olive hover:underline"
                >
                  查看原始页面
                </a>
              </div>

              {preview.description ? (
                <p className="text-sm text-gray-600 bg-white/70 rounded-2xl p-3">{preview.description}</p>
              ) : null}

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  共 {preview.totalSongs} 首，已选择 {selectedCount} 首
                </span>
                <div className="flex items-center gap-3">
                  <button onClick={handleSelectAll} className="text-brand-olive hover:underline">全选</button>
                  <button onClick={handleSelectNone} className="text-gray-500 hover:underline">清空</button>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {preview.songs.map((song, index) => {
                  const checked = selectedIds.has(song.sourceId);
                  return (
                    <label
                      key={`${song.sourceId}-${index}`}
                      className={clsx(
                        'px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors',
                        checked && 'bg-brand-primary/5',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSong(song.sourceId)}
                        className="w-4 h-4 accent-brand-primary"
                      />
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        {song.cover ? (
                          <img src={song.cover} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{song.title}</p>
                        <p className="text-xs text-gray-500 truncate">{song.artist} · {song.album}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {importResult ? (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
                  <CheckCircle2 size={16} />
                  <span>{importResult}</span>
                </div>
              ) : null}

              {!importResult ? (
                !confirmingImport ? (
                  <button
                    onClick={() => {
                      if (!selectedCount) {
                        setError('请至少选择一首歌曲');
                        return;
                      }
                      setConfirmingImport(true);
                      setError('');
                    }}
                    className="w-full md:w-auto px-6 py-3 rounded-2xl bg-brand-primary text-gray-900 font-bold hover:brightness-95"
                  >
                    下一步：确认导入
                  </button>
                ) : (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 space-y-3">
                    <p className="text-sm text-amber-800 flex items-center gap-2">
                      <AlertTriangle size={16} />
                      即将导入 {selectedCount} 首歌曲，确认后将写入数据库。
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleFinalImport}
                        disabled={importing}
                        className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {importing ? <Loader2 size={16} className="animate-spin" /> : null}
                        {importing ? '导入中' : '最终确认导入'}
                      </button>
                      <button
                        onClick={() => setConfirmingImport(false)}
                        className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-white"
                      >
                        返回修改
                      </button>
                    </div>
                  </div>
                )
              ) : null}
            </section>
          ) : null}
        </div>

        <footer className="px-6 md:px-8 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <p className="text-xs text-gray-500 inline-flex items-center gap-1">
            <AlertTriangle size={14} />
            仅管理员可导入，且始终保留原平台链接。
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-white"
          >
            关闭
          </button>
        </footer>
      </div>
    </div>
  );
};
