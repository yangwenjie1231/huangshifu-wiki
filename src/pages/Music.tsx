import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, deleteDoc, where, orderBy, db, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { Music as MusicIcon, Search, Plus, Play, Pause, Disc, List, Trash2, Heart, ExternalLink, Sparkles, ChevronRight, Volume2, Headphones, X } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { MusicPlayer } from '../components/MusicPlayer';
import { MusicImportModal } from '../components/MusicImportModal';
import { apiDelete, apiPost } from '../lib/apiClient';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

type SongItem = {
  docId: string;
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  primaryPlatform?: 'netease' | 'tencent' | 'kugou' | 'baidu' | 'kuwo' | null;
  lyric?: string | null;
  favoritedByMe?: boolean;
};

const getSongExternalUrl = (song: SongItem) => {
  const id = (song.id || '').trim();
  if (!id) {
    return '#';
  }

  const platform = song.primaryPlatform || 'netease';
  if (platform === 'tencent') {
    return `https://y.qq.com/n/ryqq/songDetail/${id}`;
  }
  if (platform === 'kugou') {
    return `https://www.kugou.com/song/#hash=${id}`;
  }
  if (platform === 'kuwo') {
    return `https://www.kuwo.cn/play_detail/${id}`;
  }
  if (platform === 'baidu') {
    return `https://music.91q.com/#/song/${id}`;
  }
  return `https://music.163.com/song?id=${id}`;
};

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const Music = () => {
  const [songs, setSongs] = useState<SongItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean, type: 'single' | 'batch', id?: string }>({ show: false, type: 'single' });
  const [favoriting, setFavoriting] = useState<string | null>(null);
  const { user, isAdmin, isBanned } = useAuth();
  const { currentSong, setCurrentSong, setIsPlaying, setPlaylist, playSongAtIndex } = useMusic();

  const fetchSongs = async () => {
    setLoading(true);
    const path = 'music';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetchedSongs = snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id })) as SongItem[];
      setSongs(fetchedSongs);
      setPlaylist(fetchedSongs);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  const handleAddSong = async () => {
    if (!searchId) return;
    if (isBanned) {
      alert('账号已被封禁，无法执行此操作');
      return;
    }
    
    // Split by comma, space or newline for batch processing
    const ids = searchId.split(/[\s,\n]+/).map(s => {
      let id = s.trim();
      if (id.includes('id=')) {
        id = id.split('id=')[1].split('&')[0];
      }
      return id;
    }).filter(id => id);

    if (ids.length === 0) return;

    setLoading(true);
    let addedCount = 0;
    let skippedCount = 0;

    for (const id of ids) {
      try {
        // Check if song already exists
        const path = 'music';
        const q = query(collection(db, path), where('id', '==', id));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          skippedCount++;
          continue;
        }

        try {
          await apiPost<{ song: any }>('/api/music/from-netease', { id });
          addedCount++;
        } catch (error) {
          console.error(`Failed to add metadata for ID: ${id}`, error);
          skippedCount++;
        }
      } catch (e) {
        console.error(`Error adding song ${id}:`, e);
        skippedCount++;
      }
    }

    alert(`添加完成！成功: ${addedCount}, 跳过/失败: ${skippedCount}`);
    setSearchId('');
    setIsAdding(false);
    fetchSongs();
    setLoading(false);
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
    const path = 'music';
    try {
      if (currentSong?.docId === songId) {
        setCurrentSong(null);
      }
      await deleteDoc(doc(db, path, songId));
      fetchSongs();
      setConfirmModal({ show: false, type: 'single' });
    } catch (e) {
      console.error("Delete error:", e);
      alert("删除失败，请检查权限");
    }
  };

  const handleToggleFavorite = async (song: SongItem) => {
    if (!user || !song.docId) {
      alert('请先登录后收藏');
      return;
    }

    if (favoriting === song.docId) return;
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
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedSongs(newSelected);
  };

  const handleBatchDelete = async () => {
    if (selectedSongs.size === 0) return;

    setLoading(true);
    const path = 'music';
    let successCount = 0;
    let failCount = 0;

    for (const docId of Array.from(selectedSongs)) {
      try {
        await deleteDoc(doc(db, path, docId));
        successCount++;
      } catch (e) {
        console.error(`Error deleting ${docId}:`, e);
        failCount++;
      }
    }
    
    if (failCount > 0) {
      alert(`批量删除完成。成功: ${successCount}, 失败: ${failCount}`);
    }

    setSelectedSongs(new Set());
    setIsBatchMode(false);
    setConfirmModal({ show: false, type: 'single' });
    fetchSongs();
    setLoading(false);
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
        
        {isAdmin && (
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
                "px-6 py-4 rounded-full font-bold transition-all flex items-center gap-2 shadow-xl",
                isBatchMode ? "bg-brand-primary text-gray-900" : "bg-white text-gray-500 border border-gray-100"
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
              <Search size={20} />
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
        )}
      </header>

      <AnimatePresence>
        {isAdding && (
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
                onChange={e => setSearchId(e.target.value)}
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
        )}
      </AnimatePresence>

      <MusicImportModal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImported={fetchSongs}
      />

      {isBatchMode && selectedSongs.size > 0 && (
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
      )}

      <AnimatePresence>
        {confirmModal.show && (
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
                  ? "您确定要删除这首歌曲吗？此操作无法撤销。" 
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
                  onClick={() => confirmModal.type === 'single' ? handleDeleteSong(confirmModal.id!) : handleBatchDelete()}
                  className="flex-grow px-6 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all"
                >
                  确定删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
              <h2 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
                <List size={24} className="text-brand-primary" /> 播放列表
              </h2>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{songs.length} 首歌曲</span>
            </div>
            
            <div className="divide-y divide-gray-50">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="p-6 animate-pulse flex gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl" />
                    <div className="flex-grow space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/4" />
                    </div>
                  </div>
                ))
              ) : songs.length > 0 ? songs.map((song, index) => (
                <div 
                  key={song.docId}
                  onClick={() => playSong(song)}
                  className={clsx(
                    "p-6 flex items-center gap-4 hover:bg-gray-50 transition-all cursor-pointer group",
                    currentSong?.docId === song.docId && !isBatchMode && "bg-brand-primary/5",
                    isBatchMode && selectedSongs.has(song.docId) && "bg-brand-primary/10"
                  )}
                >
                  {isBatchMode ? (
                    <div className={clsx(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                      selectedSongs.has(song.docId) ? "bg-brand-primary border-brand-primary" : "border-gray-200 bg-white"
                    )}>
                      {selectedSongs.has(song.docId) && <X size={14} className="text-gray-900" />}
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-gray-300 w-4">{index + 1}</span>
                  )}
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md">
                    <img src={song.cover} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {currentSong?.docId === song.docId && !isBatchMode && (
                      <div className="absolute inset-0 bg-brand-primary/40 flex items-center justify-center">
                        <Play size={16} className="text-gray-900 fill-current" />
                      </div>
                    )}
                  </div>
                  <div className="flex-grow">
                    <h4 className="font-bold text-gray-900 group-hover:text-brand-primary transition-colors">{song.title}</h4>
                    <p className="text-xs text-gray-400">{song.artist} — {song.album}</p>
                  </div>
                  <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isAdmin && !isBatchMode && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmModal({ show: true, type: 'single', id: song.docId });
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="删除歌曲"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    {!isBatchMode && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
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
                          href={getSongExternalUrl(song)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-brand-primary transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink size={18} />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center text-gray-400 italic">暂无音乐，快去添加吧</div>
              )}
            </div>
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
                您可以直接输入网易云音乐的歌曲 ID 或链接来添加音乐。系统会自动获取封面、歌词和音频地址。
              </p>
              <button className="mt-6 text-brand-primary font-bold text-sm flex items-center gap-1 hover:underline relative z-10">
                了解更多 <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Music;
