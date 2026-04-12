import React, { useState, useEffect, useMemo } from 'react';
import { auth } from '../lib/auth';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { Music as MusicIcon, Search, Plus, Play, Disc, List, Trash2, Heart, ExternalLink, Sparkles, ChevronRight, Headphones, X, MessageSquare, Clock, Link2, Album, Grid3X3 } from 'lucide-react';
import { useUserPreferences } from '../context/UserPreferencesContext';
import { ViewModeSelector } from '../components/ViewModeSelector';
import { VIEW_MODE_CONFIG } from '../lib/viewModes';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { MusicPlayer } from '../components/MusicPlayer';
import { MusicImportModal } from '../components/MusicImportModal';
import { AlbumEditModal } from '../components/AlbumEditModal';
import { useToast } from '../components/Toast';
import { apiDelete, apiGet, apiPost } from '../lib/apiClient';
import { copyToClipboard, toAbsoluteInternalUrl } from '../lib/copyLink';
import { format } from 'date-fns';
import Pagination from '../components/Pagination';
import { PlatformIds } from '../types/PlatformIds';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../lib/i18n';

const DEFAULT_PAGE_SIZE = 40;

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
  platformIds?: PlatformIds;
  createdAt?: string;
};

type PostItem = {
  id: string;
  title: string;
  section: string;
  musicDocId?: string | null;
  albumDocId?: string | null;
  content: string;
  tags?: string[];
  authorUid: string;
  status?: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
};

type AlbumItem = {
  docId?: string;
  id: string;
  title: string;
  artist: string;
  cover: string;
  description?: string | null;
  trackCount?: number;
  tracks?: unknown[];
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
  const [editingAlbum, setEditingAlbum] = useState<AlbumItem | null>(null);
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean, type: 'single' | 'batch', id?: string }>({ show: false, type: 'single' });
  const [favoriting, setFavoriting] = useState<string | null>(null);
  const [selectedSongForPosts, setSelectedSongForPosts] = useState<SongItem | null>(null);
  const [songPosts, setSongPosts] = useState<PostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [activeTab, setActiveTab] = useState<'music' | 'albums'>('music');
  const [selectedPlatform, setSelectedPlatform] = useState<'netease' | 'tencent' | 'kugou' | 'baidu' | 'kuwo'>('netease');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [showAccompaniments, setShowAccompaniments] = useState(false);
  const [sortBy, setSortBy] = useState<'createdAt' | 'title' | 'artist'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterPlatform, setFilterPlatform] = useState<'netease' | 'tencent' | 'kugou' | 'baidu' | 'kuwo' | 'all'>('all');
  const { user, isAdmin, isBanned } = useAuth();
  const { currentSong, setCurrentSong, setIsPlaying, setPlaylist, playSongAtIndex } = useMusic();
  const { show } = useToast();
  const { preferences, setViewMode } = useUserPreferences();
  const viewMode = preferences.viewMode;
  const { t } = useI18n();

  const fetchInstrumentalTargets = async () => {
    try {
      const data = await apiGet<{ docIds: string[] }>('/api/music/instrumental-targets');
      return new Set(data.docIds || []);
    } catch {
      return new Set<string>();
    }
  };

  const [instrumentalTargetDocIds, setInstrumentalTargetDocIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeTab === 'music') {
      fetchInstrumentalTargets().then(setInstrumentalTargetDocIds);
    }
  }, [activeTab]);

  const displaySongs = useMemo(() => {
    let result = [...songs];

    if (!showAccompaniments) {
      result = result.filter(song => !instrumentalTargetDocIds.has(song.docId));
    }

    if (filterPlatform !== 'all') {
      const fieldKey = `${filterPlatform}Id` as keyof PlatformIds;
      result = result.filter(song => song.platformIds?.[fieldKey]);
    }

    result.sort((a, b) => {
      if (sortBy === 'title') {
        return sortOrder === 'asc'
          ? a.title.localeCompare(b.title, 'zh-CN')
          : b.title.localeCompare(a.title, 'zh-CN');
      }
      if (sortBy === 'artist') {
        return sortOrder === 'asc'
          ? a.artist.localeCompare(b.artist, 'zh-CN')
          : b.artist.localeCompare(a.artist, 'zh-CN');
      }
      return sortOrder === 'asc'
        ? (a.createdAt || '').localeCompare(b.createdAt || '')
        : (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return result;
  }, [songs, showAccompaniments, instrumentalTargetDocIds, filterPlatform, sortBy, sortOrder]);

  const totalMusicPages = Math.ceil(displaySongs.length / pageSize);
  const paginatedSongs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return displaySongs.slice(start, start + pageSize);
  }, [displaySongs, page, pageSize]);

  const handleMusicPageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const fetchSongs = async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ songs: SongItem[] }>('/api/music');
      const fetchedSongs = data.songs || [];
      setSongs(fetchedSongs);
      setPlaylist(fetchedSongs);
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, '/api/music');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSongs();
    fetchAlbums();
  }, []);

  const fetchAlbums = async () => {
    setLoadingAlbums(true);
    try {
      const data = await apiGet<{ albums: AlbumItem[] }>('/api/albums');
      setAlbums(data.albums || []);
    } catch (error) {
      console.error('Fetch albums error:', error);
      setAlbums([]);
    }
    setLoadingAlbums(false);
  };

  const fetchSongPosts = async (song: SongItem) => {
    setLoadingPosts(true);
    try {
      const data = await apiGet<{ posts: PostItem[] }>(`/api/music/${song.docId}/posts`);
      setSongPosts(data.posts || []);
    } catch (error) {
      console.error('Fetch song posts error:', error);
      setSongPosts([]);
    }
    setLoadingPosts(false);
  };

  const handleShowPosts = (song: SongItem) => {
    if (selectedSongForPosts?.docId === song.docId) {
      setSelectedSongForPosts(null);
      setSongPosts([]);
    } else {
      setSelectedSongForPosts(song);
      fetchSongPosts(song);
    }
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return '刚刚';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '刚刚' : format(parsed, 'yyyy-MM-dd');
  };

  const handleAddSong = async () => {
    if (!searchId) return;
    if (isBanned) {
      show('账号已被封禁，无法执行此操作', { variant: 'error' });
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
    const existingSongs = new Set(songs.map((song) => String(song.id).trim()));

    for (const id of ids) {
      try {
        if (existingSongs.has(id)) {
          skippedCount++;
          continue;
        }

        try {
          await apiPost<{ song: any }>(`/api/music/from-${selectedPlatform}`, { id });
          existingSongs.add(id);
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

    show(`添加完成！成功: ${addedCount}, 跳过/失败: ${skippedCount}`);
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

  const handleCopySongLink = async (event: React.MouseEvent<HTMLButtonElement>, song: SongItem) => {
    event.stopPropagation();
    const copied = await copyToClipboard(toAbsoluteInternalUrl(`/music/${song.docId}`));
    if (copied) {
      show('歌曲内链已复制');
      return;
    }
    show('复制链接失败，请稍后重试', { variant: 'error' });
  };

  const handleCopyAlbumLink = async (event: React.MouseEvent<HTMLButtonElement>, albumId: string) => {
    event.stopPropagation();
    const copied = await copyToClipboard(toAbsoluteInternalUrl(`/album/${albumId}`));
    if (copied) {
      show('专辑内链已复制');
      return;
    }
    show('复制链接失败，请稍后重试', { variant: 'error' });
  };

  const handleDeleteSong = async (songId: string) => {
    try {
      if (currentSong?.docId === songId) {
        setCurrentSong(null);
      }
      await apiDelete(`/api/music/${songId}`);
      fetchSongs();
      setConfirmModal({ show: false, type: 'single' });
    } catch (e) {
      console.error("Delete error:", e);
      show("删除失败，请检查权限", { variant: 'error' });
    }
  };

  const handleToggleFavorite = async (song: SongItem) => {
    if (!user || !song.docId) {
      show('请先登录后收藏', { variant: 'error' });
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
      show('收藏操作失败，请稍后重试', { variant: 'error' });
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
    let successCount = 0;
    let failCount = 0;

    for (const docId of Array.from(selectedSongs)) {
      try {
        await apiDelete(`/api/music/${docId}`);
        successCount++;
      } catch (e) {
        console.error(`Error deleting ${docId}:`, e);
        failCount++;
      }
    }
    
    if (failCount > 0) {
      show(`批量删除完成。成功: ${successCount}, 失败: ${failCount}`, { variant: failCount > 0 ? 'error' : 'success' });
    }

    setSelectedSongs(new Set());
    setIsBatchMode(false);
    setConfirmModal({ show: false, type: 'single' });
    fetchSongs();
    setLoading(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      <header className="mb-8 md:mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-primary text-gray-900 rounded-xl shadow-lg">
              <Headphones size={24} />
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900">{t('music.title')}</h1>
          </div>
          <p className="text-gray-500 italic">{t('music.description')}</p>
        </div>
        
        {isAdmin && (
          <div className="flex flex-wrap gap-3 md:gap-4">
            <button 
              onClick={() => {
                if (isBanned) {
                  show('账号已被封禁，无法执行此操作', { variant: 'error' });
                  return;
                }
                setIsBatchMode(!isBatchMode);
                setSelectedSongs(new Set());
              }}
              aria-label={isBatchMode ? t('music.batchExit') : t('music.batchManage')}
              className={clsx(
                "px-4 md:px-6 py-3 md:py-4 rounded-full font-bold transition-all flex items-center gap-2 shadow-lg md:shadow-xl",
                isBatchMode ? "bg-brand-primary text-gray-900" : "bg-white text-gray-500 border border-gray-100"
              )}
            >
              <List size={18} />
              <span className="hidden sm:inline">{isBatchMode ? t('music.batchExit') : t('music.batchManage')}</span>
            </button>
            <button
              onClick={() => {
                if (isBanned) {
                  show('账号已被封禁，无法执行此操作', { variant: 'error' });
                  return;
                }
                setIsImportModalOpen(true);
              }}
              aria-label={t('music.linkImport')}
              className="px-4 md:px-6 py-3 md:py-4 bg-brand-primary text-gray-900 rounded-full font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-lg md:shadow-xl touch-target-lg"
            >
              <Search size={18} />
              <span className="hidden sm:inline">{t('music.linkImport')}</span>
            </button>
            <button 
              onClick={() => {
                if (isBanned) {
                  show('账号已被封禁，无法执行此操作', { variant: 'error' });
                  return;
                }
                setIsAdding(!isAdding);
              }}
              aria-label={isAdding ? t('music.cancelAdd') : t('music.addMusic')}
              className="px-4 md:px-6 py-3 md:py-4 bg-gray-900 text-white rounded-full font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-lg md:shadow-xl touch-target-lg"
            >
              {isAdding ? <X size={18} /> : <Plus size={18} />}
              <span className="hidden sm:inline">{isAdding ? t('music.cancelAdd') : t('music.addMusic')}</span>
            </button>
            <Link
              to="/music/links"
              aria-label={t('music.linkManage')}
              className="px-4 md:px-6 py-3 md:py-4 bg-white text-gray-900 border border-gray-200 rounded-full font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-lg md:shadow-xl touch-target-lg"
            >
              <Link2 size={18} />
              <span className="hidden sm:inline">{t('music.linkManage')}</span>
            </Link>
          </div>
        )}
      </header>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-8 md:mb-12 p-5 md:p-8 bg-brand-cream/30 rounded-2xl md:rounded-3xl border border-brand-primary/10"
          >
            <h3 className="text-xl font-serif font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Sparkles size={20} className="text-brand-primary" /> {t('music.inputMusicId')}
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-gray-600">{t('music.selectPlatform')}：</label>
                <select
                  value={selectedPlatform}
                  onChange={e => setSelectedPlatform(e.target.value as typeof selectedPlatform)}
                  className="px-4 py-2 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-primary/20 shadow-sm"
                >
                  <option value="netease">{t('music.platforms.netease')}</option>
                  <option value="tencent">{t('music.platforms.tencent')}</option>
                  <option value="kugou">{t('music.platforms.kugou')}</option>
                  <option value="baidu">{t('music.platforms.baidu')}</option>
                  <option value="kuwo">{t('music.platforms.kuwo')}</option>
                </select>
              </div>
              <textarea 
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                placeholder={`${t('music.inputPlaceholder')} ${selectedPlatform === 'netease' ? t('music.platforms.netease') : selectedPlatform === 'tencent' ? t('music.platforms.tencent') : selectedPlatform === 'kugou' ? t('music.platforms.kugou') : selectedPlatform === 'baidu' ? t('music.platforms.baidu') : t('music.platforms.kuwo')} ${t('music.idOrLinkList')}`}
                className="w-full px-6 py-4 bg-white rounded-3xl border-none focus:ring-2 focus:ring-brand-primary/20 shadow-sm min-h-[120px]"
              />
              <div className="flex justify-end">
                <button 
                  onClick={handleAddSong}
                  disabled={loading}
                  className="px-10 py-4 bg-brand-primary text-gray-900 rounded-3xl font-bold hover:scale-105 transition-all shadow-md disabled:opacity-50"
                >
                  {loading ? t('music.processing') : t('music.getAndAdd')}
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

      <AlbumEditModal
        open={isAlbumModalOpen}
        onClose={() => setIsAlbumModalOpen(false)}
        onSuccess={fetchAlbums}
        album={editingAlbum}
      />

      {isBatchMode && selectedSongs.size > 0 && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-8"
        >
          <span className="text-sm font-bold">{t('music.selectedCount', { count: selectedSongs.size })}</span>
          <div className="flex gap-4">
            <button 
              onClick={() => setSelectedSongs(new Set())}
              className="text-sm text-gray-400 hover:text-white"
            >
              {t('music.cancelSelect')}
            </button>
            <button 
              onClick={() => setConfirmModal({ show: true, type: 'batch' })}
              className="px-6 py-2 bg-red-500 text-white rounded-full text-sm font-bold hover:bg-red-600 transition-all"
            >
              {t('music.batchDelete')}
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
              <h3 className="text-2xl font-serif font-bold text-gray-900 mb-4">{t('music.confirmDelete')}</h3>
              <p className="text-gray-500 mb-8">
                {confirmModal.type === 'single' 
                  ? t('music.confirmDeleteSingle') 
                  : t('music.confirmDeleteBatch', { count: selectedSongs.size })}
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModal({ show: false, type: 'single' })}
                  className="flex-grow px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  {t('music.cancel')}
                </button>
                <button 
                  onClick={() => confirmModal.type === 'single' ? handleDeleteSong(confirmModal.id!) : handleBatchDelete()}
                  className="flex-grow px-6 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all"
                >
                  {t('music.confirmDeleteButton')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-12">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 md:p-6 lg:p-8 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="inline-flex bg-gray-100 rounded-full p-1.5">
                <button
                  onClick={() => setActiveTab('music')}
                  className={clsx(
                    'px-5 py-2 rounded-full text-sm font-bold transition-all inline-flex items-center gap-2',
                    activeTab === 'music' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
                  )}
                >
                  <Grid3X3 size={16} /> {t('music.tabMusic')}
                </button>
                <button
                  onClick={() => setActiveTab('albums')}
                  className={clsx(
                    'px-5 py-2 rounded-full text-sm font-bold transition-all inline-flex items-center gap-2',
                    activeTab === 'albums' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
                  )}
                >
                  <Album size={16} /> {t('music.tabAlbums')}
                </button>
              </div>
              <div className="flex items-center gap-3">
                {isAdmin && activeTab === 'albums' && (
                  <button
                    onClick={() => {
                      setEditingAlbum(null);
                      setIsAlbumModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-full bg-brand-primary text-gray-900 text-xs font-bold hover:scale-105 transition-all"
                  >
                    <Plus size={14} className="inline mr-1" /> {t('music.createAlbum')}
                  </button>
                )}
                <ViewModeSelector value={viewMode} onChange={setViewMode} size="sm" />
                {activeTab === 'music' && (
                  <>
                    <select
                      value={sortBy}
                      onChange={(e) => {
                        setSortBy(e.target.value as typeof sortBy);
                        setPage(1);
                      }}
                      className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"
                    >
                      <option value="createdAt">{t('music.sortBy.createdAt')}</option>
                      <option value="title">{t('music.sortBy.title')}</option>
                      <option value="artist">{t('music.sortBy.artist')}</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
                      title={sortOrder === 'asc' ? t('music.sortOrder.asc') : t('music.sortOrder.desc')}
                    >
                      {sortOrder === 'desc' ? '↓' : '↑'}
                    </button>
                    <select
                      value={filterPlatform}
                      onChange={(e) => {
                        setFilterPlatform(e.target.value as typeof filterPlatform);
                        setPage(1);
                      }}
                      className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"
                    >
                      <option value="all">{t('music.platforms.all')}</option>
                      <option value="netease">{t('music.platforms.netease')}</option>
                      <option value="tencent">{t('music.platforms.tencent')}</option>
                      <option value="kugou">{t('music.platforms.kugou')}</option>
                      <option value="baidu">{t('music.platforms.baidu')}</option>
                      <option value="kuwo">{t('music.platforms.kuwo')}</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showAccompaniments}
                        onChange={(e) => setShowAccompaniments(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                      />
                      <span>{t('music.showAccompaniments')}</span>
                    </label>
                  </>
                )}
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {activeTab === 'music' ? `${displaySongs.length} ${t('music.unit.song')}` : `${albums.length} ${t('music.unit.album')}`}
                </span>
              </div>
            </div>

            {activeTab === 'music' ? (
              <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
                {loading ? (
                  <div className={clsx('grid', VIEW_MODE_CONFIG[viewMode].gridCols, VIEW_MODE_CONFIG[viewMode].gap)}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className={clsx(
                        viewMode === 'list' ? 'h-20' : 'rounded-xl md:rounded-2xl border border-gray-100 p-3 md:p-4 animate-pulse',
                        viewMode !== 'list' && 'bg-white'
                      )}>
                        <div className={clsx(viewMode === 'list' ? 'flex gap-3 md:gap-4' : '')}>
                          <div className={clsx(viewMode === 'list' ? 'w-14 h-14 md:w-16 md:h-16 rounded-lg bg-gray-100 flex-shrink-0' : 'aspect-square rounded-xl md:rounded-2xl bg-gray-100')} />
                          <div className={clsx(viewMode === 'list' ? 'flex-1' : '')}>
                            <div className={viewMode === 'list' ? 'mt-2 h-4 bg-gray-100 rounded w-1/3' : 'mt-3 md:mt-4 h-4 bg-gray-100 rounded w-2/3'} />
                            <div className={viewMode === 'list' ? 'mt-1 h-3 bg-gray-100 rounded w-1/4' : 'mt-2 h-3 bg-gray-100 rounded w-1/2'} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : songs.length > 0 ? (
                  <>
                    <div className={clsx('grid', VIEW_MODE_CONFIG[viewMode].gridCols, VIEW_MODE_CONFIG[viewMode].gap)}>
                      {paginatedSongs.map((song) => (
                        <div
                          key={song.docId}
                          className={clsx(
                            viewMode === 'list' 
                              ? 'flex gap-3 md:gap-4 p-3 rounded-lg md:rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all' 
                              : 'rounded-xl md:rounded-2xl border transition-all p-3 md:p-4 group bg-white',
                            currentSong?.docId === song.docId && !isBatchMode && viewMode !== 'list' ? 'border-brand-primary/40 shadow-lg shadow-brand-primary/10' : 'border-gray-100 hover:border-brand-primary/30 hover:shadow-md',
                            isBatchMode && selectedSongs.has(song.docId) && 'border-brand-primary bg-brand-primary/5',
                          )}
                        >
                          {viewMode === 'list' ? (
                            <>
                              <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                <img src={song.cover} alt={song.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <button
                                  onClick={() => playSong(song)}
                                  className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                                  title={t('music.play')}
                                >
                                  <Play size={14} className="text-white" />
                                </button>
                              </div>
                              <div className="flex-1 min-w-0 flex items-center">
                                <div className="flex-1 min-w-0">
                                  <Link to={`/music/${song.docId}`} className="font-bold text-gray-900 line-clamp-1 hover:text-brand-primary transition-colors text-sm md:text-base">
                                    {song.title}
                                  </Link>
                                  <p className="text-xs text-gray-400 line-clamp-1">{song.artist} — {song.album}</p>
                                </div>
                                <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                                  {isBatchMode ? (
                                    <button
                                      onClick={() => toggleSelect(song.docId)}
                                      className={clsx(
                                        'px-2.5 md:px-3 py-1.5 rounded-full text-xs font-bold transition-all touch-target-lg',
                                        selectedSongs.has(song.docId) ? 'bg-brand-primary text-gray-900' : 'bg-gray-100 text-gray-500',
                                      )}
                                    >
                                      {selectedSongs.has(song.docId) ? t('music.selected') : t('music.select')}
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleToggleFavorite(song)}
                                        disabled={favoriting === song.docId}
                                        className={clsx(
                                          'p-1.5 md:p-2 transition-colors touch-target-lg',
                                          song.favoritedByMe ? 'text-red-500' : 'text-gray-400 hover:text-red-500',
                                        )}
                                        title={t('music.favorite')}
                                      >
                                        <Heart size={14} />
                                      </button>
                                      <Link
                                        to={`/music/${song.docId}`}
                                        className="px-2.5 md:px-3 py-1.5 rounded-full bg-black/60 text-white text-xs hover:bg-black/75 transition-colors"
                                        title={t('music.detail')}
                                      >
                                        {t('music.detail')}
                                      </Link>
                                    </>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="relative aspect-square rounded-xl md:rounded-2xl overflow-hidden bg-gray-100">
                                <img src={song.cover} alt={song.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-90" />
                                <div className="absolute left-2.5 right-2.5 bottom-2.5 md:left-3 md:right-3 md:bottom-3 flex items-center justify-between gap-2">
                                  <button
                                    onClick={() => playSong(song)}
                                    className={clsx(
                                      'w-9 h-9 md:w-10 md:h-10 rounded-full inline-flex items-center justify-center transition-all',
                                      isBatchMode ? 'bg-white/80 text-gray-900 hover:bg-white' : 'bg-brand-primary text-gray-900 hover:scale-105',
                                    )}
                                    title={isBatchMode ? t('music.selectSong') : t('music.playSong')}
                                  >
                                    <Play size={14} className={clsx(!isBatchMode && currentSong?.docId === song.docId && 'fill-current')} />
                                  </button>
                                  <Link
                                    to={`/music/${song.docId}`}
                                    className="inline-flex items-center gap-1 text-xs px-2 py-1.5 md:px-3 md:py-2 rounded-full bg-black/60 text-white hover:bg-black/75 transition-colors"
                                    title={t('music.viewSongDetail')}
                                  >
                                    {t('music.detail')} <ChevronRight size={12} />
                                  </Link>
                                </div>
                              </div>

                              <div className="mt-3 md:mt-4">
                                <Link to={`/music/${song.docId}`} className="font-bold text-gray-900 line-clamp-1 hover:text-brand-primary transition-colors text-sm md:text-base" title={t('music.viewSongDetail')}>
                                  {song.title}
                                </Link>
                                <p className="text-xs text-gray-400 mt-1 line-clamp-1">{song.artist} — {song.album}</p>
                                {song.platformIds && (
                                  <div className="flex items-center gap-1.5 mt-2">
                                    {song.platformIds.neteaseId && (
                                      <a
                                        href={`https://music.163.com/song?id=${song.platformIds.neteaseId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs px-2 py-0.5 sm:px-2 sm:py-0.5 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors w-8 sm:w-auto flex items-center justify-center sm:justify-start"
                                        title={`${t('music.platforms.netease')}: ${song.platformIds.neteaseId}`}
                                      >
                                        <span className="hidden sm:inline">{t('music.platforms.netease')}</span>
                                        <span className="sm:hidden font-bold">云</span>
                                      </a>
                                    )}
                                    {song.platformIds.tencentId && (
                                      <a
                                        href={`https://y.qq.com/n/ryqq/songDetail/${song.platformIds.tencentId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs px-2 py-0.5 sm:px-2 sm:py-0.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors w-8 sm:w-auto flex items-center justify-center sm:justify-start"
                                        title={`${t('music.platforms.tencent')}: ${song.platformIds.tencentId}`}
                                      >
                                        <span className="hidden sm:inline">QQ音乐</span>
                                        <span className="sm:hidden font-bold">Q</span>
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div
                                className={clsx(
                                  'mt-4',
                                  viewMode === 'small'
                                    ? 'flex items-center justify-between'
                                    : 'flex items-center justify-between',
                                )}
                              >
                                {isBatchMode ? (
                                  <button
                                    onClick={() => toggleSelect(song.docId)}
                                    className={clsx(
                                      'px-3 py-1.5 rounded-full text-xs font-bold transition-all',
                                      selectedSongs.has(song.docId) ? 'bg-brand-primary text-gray-900' : 'bg-gray-100 text-gray-500 hover:text-gray-800',
                                    )}
                                  >
                                    {selectedSongs.has(song.docId) ? t('music.selected') : t('music.select')}
                                  </button>
                                ) : (
                                  <div className={clsx(
                                    'flex items-center gap-1',
                                    viewMode === 'small' ? 'overflow-hidden' : 'flex-wrap'
                                  )}>
                                    <button
                                      onClick={() => handleToggleFavorite(song)}
                                      disabled={favoriting === song.docId}
                                      className={clsx(
                                        'p-2 transition-colors shrink-0',
                                        song.favoritedByMe ? 'text-red-500' : 'text-gray-400 hover:text-red-500',
                                        favoriting === song.docId && 'opacity-50 cursor-not-allowed',
                                      )}
                                      title={t('music.favorite')}
                                    >
                                      <Heart size={16} />
                                    </button>
                                    <a
                                      href={getSongExternalUrl(song)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2 text-gray-400 hover:text-brand-primary transition-colors shrink-0"
                                      title={t('music.openOriginalLink')}
                                    >
                                      <ExternalLink size={16} />
                                    </a>
                                    <button
                                      onClick={(event) => handleCopySongLink(event, song)}
                                      className="p-2 text-gray-400 hover:text-brand-primary transition-colors shrink-0"
                                      title={t('music.copyInternalLink')}
                                    >
                                      <Link2 size={16} />
                                    </button>
                                    <button
                                      onClick={() => handleShowPosts(song)}
                                      className={clsx(
                                        'p-2 transition-colors shrink-0',
                                        viewMode === 'small' ? 'hidden sm:inline-flex' : 'inline-flex',
                                        selectedSongForPosts?.docId === song.docId ? 'text-brand-primary' : 'text-gray-400 hover:text-brand-primary',
                                      )}
                                      title={t('music.viewPosts')}
                                    >
                                      <MessageSquare size={16} />
                                    </button>
                                  </div>
                                )}

                                {isAdmin && !isBatchMode ? (
                                  <button
                                    onClick={() => setConfirmModal({ show: true, type: 'single', id: song.docId })}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                                    title={t('music.deleteSong')}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                ) : null}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    <AnimatePresence>
                      {selectedSongForPosts && (
                        <motion.div
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 12 }}
                          className="border border-gray-100 rounded-3xl overflow-hidden"
                        >
                          <div className="p-6 bg-brand-cream/20">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <MessageSquare size={18} />
                                {t('music.relatedPosts')}
                              </h3>
                              <button
                                onClick={() => setSelectedSongForPosts(null)}
                                className="p-2 hover:bg-black/5 rounded-full transition-colors"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="divide-y divide-gray-50">
                            {loadingPosts ? (
                              <div className="p-8 text-center text-gray-400">{t('music.loading')}</div>
                            ) : songPosts.length > 0 ? (
                              songPosts.map((post) => (
                                <div key={post.id} className="p-6 hover:bg-black/5 transition-colors">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="font-bold text-sm">{post.title}</span>
                                    <span className="text-xs text-gray-400">by {post.authorUid?.substring(0, 6)}</span>
                                  </div>
                                  <p className="text-sm text-gray-600 line-clamp-2">{post.content}</p>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                    <span className="flex items-center gap-1"><Heart size={12} /> {post.likesCount}</span>
                                    <span className="flex items-center gap-1"><MessageSquare size={12} /> {post.commentsCount}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="p-8 text-center text-gray-400">{t('music.noPosts')}</div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {totalMusicPages > 1 && (
                      <Pagination
                        page={page}
                        totalPages={totalMusicPages}
                        onPageChange={handleMusicPageChange}
                        pageSize={pageSize}
                        onPageSizeChange={handlePageSizeChange}
                        showPageSizeSelector
                      />
                    )}
                  </>
                ) : (
                  <div className="py-20 text-center text-gray-400 italic">{t('music.noMusic')}</div>
                )}
              </div>
            ) : (
              <div className="p-6 md:p-8">
                {loadingAlbums ? (
                  <div className={clsx('grid', VIEW_MODE_CONFIG[viewMode].gridCols, VIEW_MODE_CONFIG[viewMode].gap)}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className={clsx(
                        viewMode === 'list' ? 'h-20' : 'rounded-3xl border border-gray-100 p-4 animate-pulse',
                        viewMode !== 'list' && 'bg-white'
                      )}>
                        <div className={clsx(viewMode === 'list' ? 'flex gap-4' : '')}>
                          <div className={clsx(viewMode === 'list' ? 'w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0' : 'aspect-square rounded-2xl bg-gray-100')} />
                          <div className={clsx(viewMode === 'list' ? 'flex-1' : '')}>
                            <div className={viewMode === 'list' ? 'mt-2 h-4 bg-gray-100 rounded w-1/3' : 'mt-4 h-4 bg-gray-100 rounded w-2/3'} />
                            <div className={viewMode === 'list' ? 'mt-1 h-3 bg-gray-100 rounded w-1/4' : 'mt-2 h-3 bg-gray-100 rounded w-1/3'} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : albums.length > 0 ? (
                  <div className={clsx('grid', VIEW_MODE_CONFIG[viewMode].gridCols, VIEW_MODE_CONFIG[viewMode].gap)}>
                    {albums.map((album) => {
                      const albumId = album.docId || album.id;
                      const trackCount = album.trackCount ?? album.tracks?.length ?? 0;

                      return (
                        <div key={albumId} className={clsx(
                          viewMode === 'list' 
                            ? 'flex gap-4 p-3 rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all' 
                            : 'rounded-3xl border border-gray-100 p-4 hover:border-brand-primary/30 hover:shadow-md transition-all bg-white group'
                        )}>
                          {viewMode === 'list' ? (
                            <>
                              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                <img src={album.cover} alt={album.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                              <div className="flex-1 min-w-0 flex items-center">
                                <div className="flex-1 min-w-0">
                                  <Link to={`/album/${albumId}`} className="font-bold text-gray-900 line-clamp-1 hover:text-brand-primary transition-colors">
                                    {album.title}
                                  </Link>
                                  <p className="text-xs text-gray-400 line-clamp-1">{album.artist}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{trackCount} {t('music.unit.song')}</span>
                                  <Link
                                    to={`/album/${albumId}`}
                                    className="px-3 py-1.5 rounded-full bg-brand-primary/15 text-gray-900 text-xs hover:bg-brand-primary/25 transition-colors"
                                  >
                                    {t('music.view')}
                                  </Link>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <Link to={`/album/${albumId}`} className="block relative aspect-square rounded-2xl overflow-hidden bg-gray-100">
                                <img src={album.cover} alt={album.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-80" />
                                <div className="absolute left-3 bottom-3 inline-flex items-center gap-1 text-xs text-white bg-black/60 rounded-full px-3 py-1.5">
                                  <List size={13} /> {trackCount} {t('music.unit.song')}
                                </div>
                              </Link>

                              <div className="mt-4">
                                <Link to={`/album/${albumId}`} className="font-bold text-gray-900 line-clamp-1 hover:text-brand-primary transition-colors">
                                  {album.title}
                                </Link>
                                <p className="text-xs text-gray-400 mt-1 line-clamp-1">{album.artist}</p>
                              </div>

                              <div className="mt-3 flex items-center justify-between">
                                <Link
                                  to={`/album/${albumId}`}
                                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-brand-primary/15 text-gray-900 hover:bg-brand-primary/25 transition-colors"
                                >
                                  {t('music.viewAlbum')} <ChevronRight size={14} />
                                </Link>
                                <button
                                  onClick={(event) => handleCopyAlbumLink(event, albumId)}
                                  className="p-2 text-gray-400 hover:text-brand-primary transition-colors"
                                  title={t('music.copyAlbumLink')}
                                >
                                  <Link2 size={16} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-20 text-center text-gray-400 italic">{t('music.noAlbums')}</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Disc size={24} className="text-brand-primary" /> {t('music.playing')}
            </h2>
            {currentSong ? (
              <MusicPlayer songId={currentSong.id} />
            ) : (
              <div className="bg-white rounded-[40px] p-12 border border-gray-100 shadow-sm text-center">
                <div className="w-20 h-20 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-6 text-brand-primary">
                  <MusicIcon size={40} />
                </div>
                <p className="text-gray-400 italic">{t('music.selectSongToPlay')}</p>
              </div>
            )}
            
            <div className="mt-8 p-8 bg-gray-900 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Sparkles size={120} />
              </div>
              <h3 className="text-xl font-serif font-bold mb-4 relative z-10">{t('music.tips.title')}</h3>
              <p className="text-gray-400 text-sm leading-relaxed relative z-10">
                {t('music.tips.content')}
              </p>
              <button className="mt-6 text-brand-primary font-bold text-sm flex items-center gap-1 hover:underline relative z-10">
                {t('music.tips.learnMore')} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Music;
