import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Disc,
  ExternalLink,
  Headphones,
  Heart,
  Link2,
  List,
  Music as MusicIcon,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'motion/react';

import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { MusicPlayer } from '../components/MusicPlayer';
import { MusicImportModal } from '../components/MusicImportModal';
import { apiDelete, apiGet, apiPost } from '../lib/apiClient';

type SongItem = {
  docId: string;
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  sourcePlatform?: string | null;
  sourceUrl?: string | null;
  lyric?: string | null;
  favoritedByMe?: boolean;
};

type AlbumItem = {
  id: string;
  title: string;
  artist: string;
  cover: string;
  description?: string | null;
  tracksCount: number;
  platform?: string | null;
  platformId?: string | null;
  platformUrl?: string | null;
};

type MusicListResponse = {
  songs: SongItem[];
};

type AlbumListResponse = {
  albums: AlbumItem[];
};

const Music = () => {
  const [songs, setSongs] = useState<SongItem[]>([]);
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [searchId, setSearchId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; type: 'single' | 'batch'; id?: string }>({
    show: false,
    type: 'single',
  });
  const [favoriting, setFavoriting] = useState<string | null>(null);
  const [busyAdding, setBusyAdding] = useState(false);
  const [busyDeleting, setBusyDeleting] = useState(false);

  const { user, isAdmin, isBanned } = useAuth();
  const { currentSong, setCurrentSong, setIsPlaying, setPlaylist, playSongAtIndex } = useMusic();

  const loading = loadingSongs || loadingAlbums || busyAdding || busyDeleting;

  const albumsPreview = useMemo(() => albums.slice(0, 6), [albums]);

  const fetchSongs = async () => {
    setLoadingSongs(true);
    try {
      const response = await apiGet<MusicListResponse>('/api/music');
      const nextSongs = response.songs || [];
      setSongs(nextSongs);
      setPlaylist(nextSongs);
    } catch (error) {
      console.error('Fetch music error:', error);
      alert('加载音乐列表失败，请稍后重试');
    } finally {
      setLoadingSongs(false);
    }
  };

  const fetchAlbums = async () => {
    setLoadingAlbums(true);
    try {
      const response = await apiGet<AlbumListResponse>('/api/albums');
      setAlbums(response.albums || []);
    } catch (error) {
      console.error('Fetch albums error:', error);
      setAlbums([]);
    } finally {
      setLoadingAlbums(false);
    }
  };

  const refreshData = async () => {
    await Promise.all([fetchSongs(), fetchAlbums()]);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleAddSong = async () => {
    if (!searchId.trim()) {
      return;
    }
    if (isBanned) {
      alert('账号已被封禁，无法执行此操作');
      return;
    }

    const ids = searchId
      .split(/[\s,\n]+/)
      .map((raw) => {
        const value = raw.trim();
        if (!value) {
          return '';
        }
        if (value.includes('id=')) {
          return value.split('id=')[1]?.split('&')[0] || '';
        }
        return value;
      })
      .filter(Boolean);

    if (!ids.length) {
      return;
    }

    setBusyAdding(true);
    let addedCount = 0;
    let skippedCount = 0;

    for (const id of ids) {
      try {
        await apiPost<{ song: SongItem; created: boolean }>('/api/music/from-netease', { id });
        addedCount += 1;
      } catch (error) {
        console.error(`Add song failed: ${id}`, error);
        skippedCount += 1;
      }
    }

    alert(`添加完成！成功: ${addedCount}, 跳过/失败: ${skippedCount}`);
    setSearchId('');
    setIsAdding(false);
    await refreshData();
    setBusyAdding(false);
  };

  const playSong = (song: SongItem) => {
    if (isBatchMode) {
      toggleSelect(song.docId);
      return;
    }

    const index = songs.findIndex((item) => item.docId === song.docId);
    if (index >= 0) {
      playSongAtIndex(index);
      return;
    }

    setCurrentSong(song);
    setIsPlaying(true);
  };

  const handleDeleteSong = async (songId: string) => {
    try {
      if (currentSong?.docId === songId) {
        setCurrentSong(null);
      }
      await apiDelete<{ success: boolean }>(`/api/music/${songId}`);
      setConfirmModal({ show: false, type: 'single' });
      await refreshData();
    } catch (error) {
      console.error('Delete song error:', error);
      alert('删除失败，请检查权限');
    }
  };

  const handleToggleFavorite = async (song: SongItem) => {
    if (!user || !song.docId) {
      alert('请先登录后收藏');
      return;
    }

    if (favoriting === song.docId) {
      return;
    }

    setFavoriting(song.docId);
    try {
      if (song.favoritedByMe) {
        await apiDelete(`/api/favorites/music/${song.docId}`);
        setSongs((prev) => prev.map((item) => (item.docId === song.docId ? { ...item, favoritedByMe: false } : item)));
      } else {
        await apiPost('/api/favorites', {
          targetType: 'music',
          targetId: song.docId,
        });
        setSongs((prev) => prev.map((item) => (item.docId === song.docId ? { ...item, favoritedByMe: true } : item)));
      }
    } catch (error) {
      console.error('Toggle music favorite error:', error);
      alert('收藏操作失败，请稍后重试');
    } finally {
      setFavoriting(null);
    }
  };

  const toggleSelect = (docId: string) => {
    setSelectedSongs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (!selectedSongs.size) {
      return;
    }

    setBusyDeleting(true);
    let successCount = 0;
    let failCount = 0;

    for (const docId of Array.from(selectedSongs)) {
      try {
        await apiDelete(`/api/music/${docId}`);
        successCount += 1;
      } catch (error) {
        console.error(`Delete song failed: ${docId}`, error);
        failCount += 1;
      }
    }

    if (failCount > 0) {
      alert(`批量删除完成。成功: ${successCount}, 失败: ${failCount}`);
    }

    if (currentSong && selectedSongs.has(currentSong.docId || '')) {
      setCurrentSong(null);
    }

    setSelectedSongs(new Set());
    setIsBatchMode(false);
    setConfirmModal({ show: false, type: 'single' });
    await refreshData();
    setBusyDeleting(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-primary text-gray-900 rounded-xl shadow-lg">
              <Headphones size={24} />
            </div>
            <h1 className="text-5xl font-serif font-bold text-gray-900">音乐馆</h1>
          </div>
          <p className="text-gray-500 italic">诗扶之声 · 记录每一首动人的旋律</p>
        </div>

        {isAdmin ? (
          <div className="flex gap-4">
            <button
              onClick={() => {
                if (isBanned) {
                  alert('账号已被封禁，无法执行此操作');
                  return;
                }
                setIsBatchMode(!isBatchMode);
                setSelectedSongs(new Set());
              }}
              className={clsx(
                'px-6 py-4 rounded-full font-bold transition-all flex items-center gap-2 shadow-xl',
                isBatchMode ? 'bg-brand-primary text-gray-900' : 'bg-white text-gray-500 border border-gray-100',
              )}
            >
              <List size={20} />
              {isBatchMode ? '退出批量' : '批量管理'}
            </button>
            <button
              onClick={() => {
                if (isBanned) {
                  alert('账号已被封禁，无法执行此操作');
                  return;
                }
                setIsImportModalOpen(true);
              }}
              className="px-8 py-4 bg-brand-primary text-gray-900 rounded-full font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-xl"
            >
              <Link2 size={20} />
              链接导入
            </button>
            <button
              onClick={() => {
                if (isBanned) {
                  alert('账号已被封禁，无法执行此操作');
                  return;
                }
                setIsAdding(!isAdding);
              }}
              className="px-8 py-4 bg-gray-900 text-white rounded-full font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-xl"
            >
              {isAdding ? <X size={20} /> : <Plus size={20} />}
              {isAdding ? '取消添加' : '添加音乐'}
            </button>
          </div>
        ) : null}
      </header>

      <AnimatePresence>
        {isAdding ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-12 p-8 bg-brand-cream/30 rounded-[40px] border border-brand-primary/10"
          >
            <h3 className="text-xl font-serif font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Sparkles size={20} className="text-brand-primary" /> 输入网易云音乐 ID 或链接 (支持批量，用空格或逗号分隔)
            </h3>
            <div className="flex flex-col gap-4">
              <textarea
                value={searchId}
                onChange={(event) => setSearchId(event.target.value)}
                placeholder="例如: 1335942780, 1335942781 或链接列表"
                className="w-full px-6 py-4 bg-white rounded-3xl border-none focus:ring-2 focus:ring-brand-primary/20 shadow-sm min-h-[120px]"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleAddSong}
                  disabled={loading}
                  className="px-10 py-4 bg-brand-primary text-gray-900 rounded-3xl font-bold hover:scale-105 transition-all shadow-md disabled:opacity-50"
                >
                  {loading ? '正在处理...' : '获取并添加'}
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <MusicImportModal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImported={async () => {
          await refreshData();
        }}
      />

      {isBatchMode && selectedSongs.size > 0 ? (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-8"
        >
          <span className="text-sm font-bold">已选择 {selectedSongs.size} 首歌曲</span>
          <div className="flex gap-4">
            <button
              onClick={() => setSelectedSongs(new Set())}
              className="text-sm text-gray-400 hover:text-white"
            >
              取消选择
            </button>
            <button
              onClick={() => setConfirmModal({ show: true, type: 'batch' })}
              className="px-6 py-2 bg-red-500 text-white rounded-full text-sm font-bold hover:bg-red-600 transition-all"
            >
              批量删除
            </button>
          </div>
        </motion.div>
      ) : null}

      <AnimatePresence>
        {confirmModal.show ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-2xl font-serif font-bold text-gray-900 mb-4">确认删除</h3>
              <p className="text-gray-500 mb-8">
                {confirmModal.type === 'single'
                  ? '您确定要删除这首歌曲吗？此操作无法撤销。'
                  : `您确定要删除选中的 ${selectedSongs.size} 首歌曲吗？此操作无法撤销。`}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setConfirmModal({ show: false, type: 'single' })}
                  className="flex-grow px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={() => (confirmModal.type === 'single' ? handleDeleteSong(confirmModal.id!) : handleBatchDelete())}
                  className="flex-grow px-6 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all"
                >
                  确定删除
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
              <h2 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
                <List size={24} className="text-brand-primary" /> 播放列表
              </h2>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{songs.length} 首歌曲</span>
            </div>

            <div className="divide-y divide-gray-50">
              {loadingSongs ? (
                [1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="p-6 animate-pulse flex gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl" />
                    <div className="flex-grow space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/4" />
                    </div>
                  </div>
                ))
              ) : songs.length > 0 ? (
                songs.map((song, index) => (
                  <div
                    key={song.docId}
                    onClick={() => playSong(song)}
                    className={clsx(
                      'p-6 flex items-center gap-4 hover:bg-gray-50 transition-all cursor-pointer group',
                      currentSong?.docId === song.docId && !isBatchMode && 'bg-brand-primary/5',
                      isBatchMode && selectedSongs.has(song.docId) && 'bg-brand-primary/10',
                    )}
                  >
                    {isBatchMode ? (
                      <div
                        className={clsx(
                          'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                          selectedSongs.has(song.docId) ? 'bg-brand-primary border-brand-primary' : 'border-gray-200 bg-white',
                        )}
                      >
                        {selectedSongs.has(song.docId) ? <X size={14} className="text-gray-900" /> : null}
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-gray-300 w-4">{index + 1}</span>
                    )}

                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md">
                      <img src={song.cover} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      {currentSong?.docId === song.docId && !isBatchMode ? (
                        <div className="absolute inset-0 bg-brand-primary/40 flex items-center justify-center">
                          <Play size={16} className="text-gray-900 fill-current" />
                        </div>
                      ) : null}
                    </div>

                    <div className="flex-grow min-w-0">
                      <h4 className="font-bold text-gray-900 group-hover:text-brand-primary transition-colors truncate">{song.title}</h4>
                      <p className="text-xs text-gray-400 truncate">{song.artist} — {song.album}</p>
                    </div>

                    <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isAdmin && !isBatchMode ? (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setConfirmModal({ show: true, type: 'single', id: song.docId });
                          }}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          title="删除歌曲"
                        >
                          <Trash2 size={18} />
                        </button>
                      ) : null}

                      {!isBatchMode ? (
                        <>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleFavorite(song);
                            }}
                            disabled={favoriting === song.docId}
                            className={clsx(
                              'p-2 transition-colors',
                              song.favoritedByMe ? 'text-red-500' : 'text-gray-400 hover:text-red-500',
                              favoriting === song.docId && 'opacity-50 cursor-not-allowed',
                            )}
                          >
                            <Heart size={18} />
                          </button>
                          <a
                            href={song.sourceUrl || `https://music.163.com/song?id=${song.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-brand-primary transition-colors"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ExternalLink size={18} />
                          </a>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center text-gray-400 italic">暂无音乐，快去添加吧</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
              <h2 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
                <Disc size={22} className="text-brand-primary" /> 专辑与歌单
              </h2>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{albums.length} 个</span>
            </div>

            {loadingAlbums ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : albumsPreview.length ? (
              <div className="divide-y divide-gray-50">
                {albumsPreview.map((album) => (
                  <Link
                    key={album.id}
                    to={`/albums/${album.id}`}
                    className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                  >
                    <img src={album.cover} alt="" className="w-12 h-12 rounded-xl object-cover shadow-sm" referrerPolicy="no-referrer" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 truncate">{album.title}</p>
                      <p className="text-xs text-gray-400 truncate">{album.artist} · {album.tracksCount} 首</p>
                    </div>
                    <span className="text-xs text-brand-olive font-bold">查看详情</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-gray-400 italic">暂无专辑或歌单</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Disc size={24} className="text-brand-primary" /> 正在播放
            </h2>
            {currentSong ? (
              <MusicPlayer songId={currentSong.id} />
            ) : (
              <div className="bg-white rounded-[40px] p-12 border border-gray-100 shadow-sm text-center">
                <div className="w-20 h-20 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-6 text-brand-primary">
                  <MusicIcon size={40} />
                </div>
                <p className="text-gray-400 italic">选择一首歌曲开始播放</p>
              </div>
            )}

            <div className="mt-8 p-8 bg-gray-900 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Sparkles size={120} />
              </div>
              <h3 className="text-xl font-serif font-bold mb-4 relative z-10">音乐小贴士</h3>
              <p className="text-gray-400 text-sm leading-relaxed relative z-10">
                支持粘贴网易云、QQ音乐、酷狗、百度、酷我的歌曲/专辑/歌单链接，系统会先解析并让您二次确认可导入曲目。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Music;
