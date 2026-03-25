import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Music as MusicIcon,
  Plus,
  Trash2,
  Heart,
  ExternalLink,
  Sparkles,
  ChevronRight,
  Headphones,
  X,
  ListMusic,
  Disc3,
  Play,
  Album as AlbumIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { MusicPlayer } from '../components/MusicPlayer';
import { apiDelete, apiGet, apiPost } from '../lib/apiClient';

type SongItem = {
  docId: string;
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  lyric?: string | null;
  favoritedByMe?: boolean;
  albumId?: string | null;
  albumTitle?: string | null;
  trackOrder?: number;
};

type AlbumItem = {
  id: string;
  title: string;
  artist: string;
  cover: string;
  description?: string | null;
  releaseDate?: string | null;
  trackCount: number;
  tracks: SongItem[];
};

type MusicListResponse = {
  songs: SongItem[];
};

type AlbumListResponse = {
  albums: AlbumItem[];
};

type CreateAlbumPayload = {
  title: string;
  artist: string;
  cover: string;
  description?: string;
  releaseDate?: string;
  trackDocIds: string[];
};

const Music = () => {
  const [songs, setSongs] = useState<SongItem[]>([]);
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'songs' | 'albums'>('songs');
  const [searchId, setSearchId] = useState('');
  const [isAddingSong, setIsAddingSong] = useState(false);
  const [isAddingAlbum, setIsAddingAlbum] = useState(false);
  const [favoriting, setFavoriting] = useState<string | null>(null);
  const [submittingAlbum, setSubmittingAlbum] = useState(false);
  const [albumForm, setAlbumForm] = useState<{
    title: string;
    artist: string;
    cover: string;
    description: string;
    releaseDate: string;
    trackDocIds: string;
  }>({
    title: '',
    artist: '',
    cover: '',
    description: '',
    releaseDate: '',
    trackDocIds: '',
  });
  const { user, isAdmin, isBanned } = useAuth();
  const {
    currentSong,
    setCurrentSong,
    setIsPlaying,
    setPlaylist,
    playSongAtIndex,
    playAlbumTracks,
  } = useMusic();

  const fetchSongsAndAlbums = async () => {
    setLoading(true);
    try {
      const [songsData, albumsData] = await Promise.all([
        apiGet<MusicListResponse>('/api/music'),
        apiGet<AlbumListResponse>('/api/albums', { includeTracks: true }),
      ]);
      const fetchedSongs = songsData.songs || [];
      const fetchedAlbums = albumsData.albums || [];
      setSongs(fetchedSongs);
      setAlbums(fetchedAlbums);
      setPlaylist(fetchedSongs, { type: 'songs' });
    } catch (error) {
      console.error('Fetch music data error:', error);
      alert('加载音乐数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongsAndAlbums();
  }, []);

  const handleAddSong = async () => {
    if (!searchId.trim()) return;
    if (isBanned) {
      alert('账号已被封禁，无法执行此操作');
      return;
    }

    const ids = searchId
      .split(/[\s,\n]+/)
      .map((raw) => {
        let normalized = raw.trim();
        if (normalized.includes('id=')) {
          normalized = normalized.split('id=')[1].split('&')[0];
        }
        return normalized;
      })
      .filter(Boolean);

    if (!ids.length) {
      return;
    }

    setLoading(true);
    let addedCount = 0;
    let skippedCount = 0;

    for (const id of ids) {
      try {
        await apiPost('/api/music/from-netease', { id });
        addedCount += 1;
      } catch {
        skippedCount += 1;
      }
    }

    alert(`添加完成！成功: ${addedCount}, 跳过/失败: ${skippedCount}`);
    setSearchId('');
    setIsAddingSong(false);
    await fetchSongsAndAlbums();
  };

  const handleDeleteSong = async (songDocId: string) => {
    if (isBanned) {
      alert('账号已被封禁，无法执行此操作');
      return;
    }
    if (!window.confirm('确认删除这首歌曲？此操作无法撤销。')) {
      return;
    }
    try {
      await apiDelete(`/api/music/${songDocId}`);
      if (currentSong?.docId === songDocId) {
        setCurrentSong(null);
      }
      await fetchSongsAndAlbums();
    } catch (error) {
      console.error('Delete song error:', error);
      alert('删除失败，请稍后重试');
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    if (isBanned) {
      alert('账号已被封禁，无法执行此操作');
      return;
    }
    if (!window.confirm('确认删除这个专辑？仅删除专辑关系，不删除歌曲。')) {
      return;
    }
    try {
      await apiDelete(`/api/albums/${albumId}`);
      await fetchSongsAndAlbums();
    } catch (error) {
      console.error('Delete album error:', error);
      alert('删除专辑失败，请稍后重试');
    }
  };

  const toggleFavorite = async (song: SongItem) => {
    if (!user || !song.docId) {
      alert('请先登录后收藏');
      return;
    }

    if (favoriting === song.docId) return;

    setFavoriting(song.docId);
    try {
      if (song.favoritedByMe) {
        await apiDelete(`/api/favorites/music/${song.docId}`);
      } else {
        await apiPost('/api/favorites', {
          targetType: 'music',
          targetId: song.docId,
        });
      }

      setSongs((prev) => prev.map((item) => (
        item.docId === song.docId
          ? { ...item, favoritedByMe: !item.favoritedByMe }
          : item
      )));

      setAlbums((prev) => prev.map((album) => ({
        ...album,
        tracks: album.tracks.map((track) => (
          track.docId === song.docId
            ? { ...track, favoritedByMe: !track.favoritedByMe }
            : track
        )),
      })));
    } catch (error) {
      console.error('Toggle music favorite error:', error);
      alert('收藏操作失败，请稍后重试');
    } finally {
      setFavoriting(null);
    }
  };

  const handlePlaySongFromList = (song: SongItem) => {
    const index = songs.findIndex((item) => item.docId === song.docId);
    if (index >= 0) {
      setPlaylist(songs, { type: 'songs' });
      playSongAtIndex(index);
      return;
    }

    setCurrentSong(song);
    setIsPlaying(true);
  };

  const handlePlayAlbum = (album: AlbumItem, startIndex = 0) => {
    if (!album.tracks.length) {
      return;
    }
    const tracks = [...album.tracks].sort((a, b) => (a.trackOrder || 0) - (b.trackOrder || 0));
    playAlbumTracks(album.id, album.title, tracks, startIndex);
  };

  const parseTrackDocIds = (value: string) => {
    const tokens = value
      .split(/[\s,\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    return Array.from(new Set(tokens));
  };

  const availableSongsMap = useMemo(() => {
    const map = new Map<string, SongItem>();
    songs.forEach((song) => {
      map.set(song.docId, song);
    });
    return map;
  }, [songs]);

  const handleCreateAlbum = async () => {
    if (isBanned) {
      alert('账号已被封禁，无法执行此操作');
      return;
    }

    const trackDocIds = parseTrackDocIds(albumForm.trackDocIds);
    if (!albumForm.title.trim() || !albumForm.artist.trim() || !albumForm.cover.trim()) {
      alert('请填写专辑名称、歌手、封面 URL');
      return;
    }
    if (!trackDocIds.length) {
      alert('请至少填写一个歌曲 docId');
      return;
    }

    const unknownDocIds = trackDocIds.filter((docId) => !availableSongsMap.has(docId));
    if (unknownDocIds.length) {
      alert(`以下歌曲 docId 不存在：${unknownDocIds.join(', ')}`);
      return;
    }

    const payload: CreateAlbumPayload = {
      title: albumForm.title.trim(),
      artist: albumForm.artist.trim(),
      cover: albumForm.cover.trim(),
      trackDocIds,
      ...(albumForm.description.trim() ? { description: albumForm.description.trim() } : {}),
      ...(albumForm.releaseDate ? { releaseDate: albumForm.releaseDate } : {}),
    };

    setSubmittingAlbum(true);
    try {
      await apiPost('/api/albums', payload);
      setAlbumForm({
        title: '',
        artist: '',
        cover: '',
        description: '',
        releaseDate: '',
        trackDocIds: '',
      });
      setIsAddingAlbum(false);
      await fetchSongsAndAlbums();
      setActiveTab('albums');
    } catch (error) {
      console.error('Create album error:', error);
      alert(error instanceof Error ? error.message : '创建专辑失败');
    } finally {
      setSubmittingAlbum(false);
    }
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
          <p className="text-gray-500 italic">诗扶之声 · 歌曲与专辑双维度整理</p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => {
                if (isBanned) {
                  alert('账号已被封禁，无法执行此操作');
                  return;
                }
                setIsAddingSong((prev) => !prev);
                if (isAddingAlbum) setIsAddingAlbum(false);
              }}
              className="px-8 py-4 bg-gray-900 text-white rounded-full font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-xl"
            >
              {isAddingSong ? <X size={20} /> : <Plus size={20} />}
              {isAddingSong ? '取消添加歌曲' : '添加歌曲'}
            </button>

            <button
              onClick={() => {
                if (isBanned) {
                  alert('账号已被封禁，无法执行此操作');
                  return;
                }
                setIsAddingAlbum((prev) => !prev);
                if (isAddingSong) setIsAddingSong(false);
              }}
              className="px-8 py-4 bg-brand-primary text-gray-900 rounded-full font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-xl"
            >
              {isAddingAlbum ? <X size={20} /> : <AlbumIcon size={20} />}
              {isAddingAlbum ? '取消添加专辑' : '添加专辑'}
            </button>
          </div>
        )}
      </header>

      <div className="mb-8 flex items-center gap-3">
        <button
          onClick={() => setActiveTab('songs')}
          className={clsx(
            'px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2',
            activeTab === 'songs'
              ? 'bg-brand-olive text-white'
              : 'bg-white text-gray-500 border border-gray-200 hover:border-brand-olive/20',
          )}
        >
          <ListMusic size={16} /> 歌曲
        </button>
        <button
          onClick={() => setActiveTab('albums')}
          className={clsx(
            'px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2',
            activeTab === 'albums'
              ? 'bg-brand-olive text-white'
              : 'bg-white text-gray-500 border border-gray-200 hover:border-brand-olive/20',
          )}
        >
          <Disc3 size={16} /> 专辑
        </button>
      </div>

      <AnimatePresence>
        {isAddingSong && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-10 p-8 bg-brand-cream/30 rounded-[40px] border border-brand-primary/10 overflow-hidden"
          >
            <h3 className="text-xl font-serif font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Sparkles size={20} className="text-brand-primary" /> 输入网易云音乐 ID 或链接（支持批量）
            </h3>
            <div className="flex flex-col gap-4">
              <textarea
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
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

      <AnimatePresence>
        {isAddingAlbum && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-10 p-8 bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden"
          >
            <h3 className="text-xl font-serif font-bold text-gray-900 mb-6 flex items-center gap-2">
              <AlbumIcon size={20} className="text-brand-olive" /> 创建专辑（Album/Track）
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                value={albumForm.title}
                onChange={(e) => setAlbumForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="专辑名称"
                className="px-4 py-3 rounded-2xl bg-brand-cream/40 border border-transparent focus:outline-none focus:border-brand-olive/30"
              />
              <input
                value={albumForm.artist}
                onChange={(e) => setAlbumForm((prev) => ({ ...prev, artist: e.target.value }))}
                placeholder="歌手"
                className="px-4 py-3 rounded-2xl bg-brand-cream/40 border border-transparent focus:outline-none focus:border-brand-olive/30"
              />
              <input
                value={albumForm.cover}
                onChange={(e) => setAlbumForm((prev) => ({ ...prev, cover: e.target.value }))}
                placeholder="封面 URL"
                className="px-4 py-3 rounded-2xl bg-brand-cream/40 border border-transparent focus:outline-none focus:border-brand-olive/30 md:col-span-2"
              />
              <input
                type="date"
                value={albumForm.releaseDate}
                onChange={(e) => setAlbumForm((prev) => ({ ...prev, releaseDate: e.target.value }))}
                className="px-4 py-3 rounded-2xl bg-brand-cream/40 border border-transparent focus:outline-none focus:border-brand-olive/30"
              />
              <input
                value={albumForm.trackDocIds}
                onChange={(e) => setAlbumForm((prev) => ({ ...prev, trackDocIds: e.target.value }))}
                placeholder="歌曲 docId（逗号/空格分隔）"
                className="px-4 py-3 rounded-2xl bg-brand-cream/40 border border-transparent focus:outline-none focus:border-brand-olive/30"
              />
              <textarea
                value={albumForm.description}
                onChange={(e) => setAlbumForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="专辑描述（可选）"
                className="px-4 py-3 rounded-2xl bg-brand-cream/40 border border-transparent focus:outline-none focus:border-brand-olive/30 min-h-[96px] md:col-span-2"
              />
            </div>

            <div className="mt-6 flex flex-wrap justify-between items-center gap-3">
              <p className="text-xs text-gray-500">
                可用歌曲 docId：{songs.slice(0, 6).map((song) => song.docId).join(', ')}{songs.length > 6 ? '...' : ''}
              </p>
              <button
                onClick={handleCreateAlbum}
                disabled={submittingAlbum}
                className="px-8 py-3 rounded-full bg-brand-olive text-white text-sm font-bold hover:bg-brand-olive/90 transition-all disabled:opacity-50"
              >
                {submittingAlbum ? '创建中...' : '创建专辑'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          {activeTab === 'songs' ? (
            <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                <h2 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
                  <ListMusic size={24} className="text-brand-primary" /> 歌曲列表
                </h2>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{songs.length} 首歌曲</span>
              </div>

              <div className="divide-y divide-gray-50">
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="p-6 animate-pulse flex gap-4">
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
                      onClick={() => handlePlaySongFromList(song)}
                      className={clsx(
                        'p-6 flex items-center gap-4 hover:bg-gray-50 transition-all cursor-pointer group',
                        currentSong?.docId === song.docId && 'bg-brand-primary/5',
                      )}
                    >
                      <span className="text-xs font-bold text-gray-300 w-4">{index + 1}</span>
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-md">
                        <img src={song.cover} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        {currentSong?.docId === song.docId && (
                          <div className="absolute inset-0 bg-brand-primary/40 flex items-center justify-center">
                            <Play size={16} className="text-gray-900 fill-current" />
                          </div>
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="font-bold text-gray-900 group-hover:text-brand-primary transition-colors truncate">{song.title}</h4>
                        <p className="text-xs text-gray-400 truncate">{song.artist} — {song.album}</p>
                      </div>
                      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(song);
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
                          href={`https://music.163.com/song?id=${song.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-brand-primary transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={18} />
                        </a>
                        {isAdmin ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSong(song.docId);
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-gray-400 italic">暂无音乐，快去添加吧</div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-48 rounded-[32px] border border-gray-100 bg-white animate-pulse" />
                ))
              ) : albums.length > 0 ? (
                albums.map((album) => (
                  <div key={album.id} className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-gray-50 flex flex-col md:flex-row gap-5 md:items-center md:justify-between">
                      <div className="flex items-center gap-4 min-w-0">
                        <img src={album.cover} alt="" className="w-16 h-16 rounded-2xl object-cover shadow" referrerPolicy="no-referrer" />
                        <div className="min-w-0">
                          <h3 className="text-xl font-serif font-bold text-gray-900 truncate">{album.title}</h3>
                          <p className="text-sm text-gray-500 truncate">{album.artist} · {album.trackCount} 首</p>
                          {album.description ? <p className="text-xs text-gray-400 mt-1 line-clamp-2">{album.description}</p> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/album/${album.id}`}
                          className="px-4 py-2 rounded-full bg-gray-50 text-gray-700 text-xs font-bold hover:bg-gray-100 transition-all"
                        >
                          查看详情
                        </Link>
                        <button
                          onClick={() => handlePlayAlbum(album, 0)}
                          className="px-4 py-2 rounded-full bg-brand-olive text-white text-xs font-bold hover:bg-brand-olive/90 transition-all flex items-center gap-1"
                        >
                          <Play size={14} /> 播放专辑
                        </button>
                        {isAdmin ? (
                          <button
                            onClick={() => handleDeleteAlbum(album.id)}
                            className="px-4 py-2 rounded-full bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-all flex items-center gap-1"
                          >
                            <Trash2 size={14} /> 删除专辑
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="divide-y divide-gray-50">
                      {album.tracks.map((track, index) => (
                        <div
                          key={`${album.id}_${track.docId}`}
                          onClick={() => handlePlayAlbum(album, index)}
                          className={clsx(
                            'px-6 md:px-8 py-4 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition-colors group',
                            currentSong?.docId === track.docId && 'bg-brand-primary/5',
                          )}
                        >
                          <span className="text-xs font-bold text-gray-300 w-4">{(track.trackOrder ?? index) + 1}</span>
                          <div className="flex-grow min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate group-hover:text-brand-olive">{track.title}</p>
                            <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(track);
                            }}
                            disabled={favoriting === track.docId}
                            className={clsx(
                              'p-2 transition-colors',
                              track.favoritedByMe ? 'text-red-500' : 'text-gray-400 hover:text-red-500',
                              favoriting === track.docId && 'opacity-50 cursor-not-allowed',
                            )}
                          >
                            <Heart size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white p-20 rounded-[40px] border border-gray-100 text-center">
                  <Disc3 size={48} className="mx-auto text-brand-olive/20 mb-6" />
                  <p className="text-gray-400 italic">暂无专辑，管理员可在上方创建</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6 flex items-center gap-2">
              <MusicIcon size={24} className="text-brand-primary" /> 正在播放
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
              <h3 className="text-xl font-serif font-bold mb-4 relative z-10">中期增强进度</h3>
              <p className="text-gray-400 text-sm leading-relaxed relative z-10">
                已升级为歌曲 + 专辑双入口。可从专辑详情直接建立播放队列，支持专辑顺序播放。
              </p>
              <span className="mt-6 text-brand-primary font-bold text-sm flex items-center gap-1 relative z-10">
                Album / Track 已上线 <ChevronRight size={16} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Music;
