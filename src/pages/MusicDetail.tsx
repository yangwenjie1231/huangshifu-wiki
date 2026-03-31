import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, ExternalLink, Heart, Link2, MessageSquare, Play } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

import { apiDelete, apiGet, apiPost } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import { useMusic } from '../context/MusicContext';
import { useToast } from '../components/Toast';
import { SongCoverManager } from '../components/SongCoverManager';
import { SongEditModal } from '../components/SongEditModal';
import { copyToClipboard, toAbsoluteInternalUrl } from '../lib/copyLink';

type PlatformIds = {
  neteaseId?: string | null;
  tencentId?: string | null;
  kugouId?: string | null;
  baiduId?: string | null;
  kuwoId?: string | null;
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
  platformIds?: PlatformIds;
};

type SongDetailResponse = {
  song: SongItem & { platformIds?: PlatformIds };
};

type SongListResponse = {
  songs: SongItem[];
};

type PostItem = {
  id: string;
  title: string;
  likesCount: number;
  commentsCount: number;
  updatedAt: string;
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

const formatDate = (value: string | null | undefined) => {
  if (!value) return '刚刚';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '刚刚' : format(parsed, 'yyyy-MM-dd');
};

const MusicDetail = () => {
  const { songId } = useParams();
  const [song, setSong] = useState<SongItem | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriting, setFavoriting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [allSongs, setAllSongs] = useState<SongItem[]>([]);
  const [instrumentalForSongs, setInstrumentalForSongs] = useState<SongItem[]>([]);
  const [relationQuery, setRelationQuery] = useState('');
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [relationSaving, setRelationSaving] = useState<string | null>(null);
  const { user, isAdmin } = useAuth();
  const { setCurrentSong, setIsPlaying, setPlaylist } = useMusic();
  const { show } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      if (!songId) return;
      setLoading(true);
      try {
        const detail = await apiGet<SongDetailResponse>(`/api/music/${songId}`);
        const currentSong = detail.song || null;
        setSong(currentSong);
        if (currentSong?.docId) {
          const postResult = await apiGet<{ posts: PostItem[] }>(`/api/music/${currentSong.docId}/posts`);
          setPosts(postResult.posts || []);
        } else {
          setPosts([]);
        }
      } catch (error) {
        console.error('Fetch song detail failed:', error);
        setSong(null);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [songId]);

  useEffect(() => {
    const fetchInstrumentalManagementData = async () => {
      if (!song?.docId || !isAdmin) {
        setAllSongs([]);
        setInstrumentalForSongs([]);
        return;
      }

      setRelationsLoading(true);
      try {
        const [songListResult, instrumentalForResult] = await Promise.all([
          apiGet<SongListResponse>('/api/music'),
          apiGet<SongListResponse>(`/api/music/${song.docId}/instrumental-for`),
        ]);
        setAllSongs((songListResult.songs || []).filter((item) => item.docId !== song.docId));
        setInstrumentalForSongs(instrumentalForResult.songs || []);
      } catch (error) {
        console.error('Fetch instrumental management data failed:', error);
        show('加载伴奏管理信息失败，请稍后重试', { variant: 'error' });
      } finally {
        setRelationsLoading(false);
      }
    };

    void fetchInstrumentalManagementData();
  }, [isAdmin, show, song?.docId]);

  const lyricLines = useMemo(() => {
    if (!song?.lyric) return [];
    return song.lyric.split('\n').map((line) => line.trim()).filter(Boolean);
  }, [song?.lyric]);

  const linkedTargetIds = useMemo(() => new Set(instrumentalForSongs.map((item) => item.docId)), [instrumentalForSongs]);

  const relationCandidates = useMemo(() => {
    const trimmedQuery = relationQuery.trim().toLowerCase();
    if (!trimmedQuery) return [];

    return allSongs
      .filter((item) => {
        if (linkedTargetIds.has(item.docId)) return false;
        const haystack = [item.title, item.artist, item.album, item.docId].join(' ').toLowerCase();
        return haystack.includes(trimmedQuery);
      })
      .slice(0, 8);
  }, [allSongs, linkedTargetIds, relationQuery]);

  const refreshInstrumentalManagementData = async (docId: string) => {
    const [songListResult, instrumentalForResult] = await Promise.all([
      apiGet<SongListResponse>('/api/music'),
      apiGet<SongListResponse>(`/api/music/${docId}/instrumental-for`),
    ]);
    setAllSongs((songListResult.songs || []).filter((item) => item.docId !== docId));
    setInstrumentalForSongs(instrumentalForResult.songs || []);
  };

  const handlePlay = () => {
    if (!song) return;
    setPlaylist([song]);
    setCurrentSong(song);
    setIsPlaying(true);
  };

  const handleCopyLink = async () => {
    if (!song?.docId) return;
    const copied = await copyToClipboard(toAbsoluteInternalUrl(`/music/${song.docId}`));
    if (copied) {
      show('歌曲内链已复制');
      return;
    }
    show('复制链接失败，请稍后重试', { variant: 'error' });
  };

  const handleToggleFavorite = async () => {
    if (!song || !song.docId) return;
    if (!user) {
      show('请先登录后收藏', { variant: 'error' });
      return;
    }
    if (favoriting) return;

    setFavoriting(true);
    try {
      if (song.favoritedByMe) {
        await apiDelete(`/api/favorites/music/${song.docId}`);
        setSong((prev) => (prev ? { ...prev, favoritedByMe: false } : prev));
      } else {
        await apiPost('/api/favorites', {
          targetType: 'music',
          targetId: song.docId,
        });
        setSong((prev) => (prev ? { ...prev, favoritedByMe: true } : prev));
      }
    } catch (error) {
      console.error('Toggle song favorite failed:', error);
      show('收藏操作失败，请稍后重试', { variant: 'error' });
    } finally {
      setFavoriting(false);
    }
  };

  const handleAddInstrumentalRelation = async (targetSong: SongItem) => {
    if (!song?.docId || relationSaving) return;

    setRelationSaving(targetSong.docId);
    try {
      await apiPost(`/api/music/${targetSong.docId}/instrumentals`, {
        instrumentalSongDocId: song.docId,
      });
      await refreshInstrumentalManagementData(song.docId);
      setRelationQuery('');
      show(`已将当前歌曲设为「${targetSong.title}」的伴奏`);
    } catch (error) {
      console.error('Create instrumental relation failed:', error);
      show(error instanceof Error ? error.message : '设置伴奏失败，请稍后重试', { variant: 'error' });
    } finally {
      setRelationSaving(null);
    }
  };

  const handleRemoveInstrumentalRelation = async (targetSong: SongItem) => {
    if (!song?.docId || relationSaving) return;

    setRelationSaving(targetSong.docId);
    try {
      await apiDelete(`/api/music/${targetSong.docId}/instrumentals/${song.docId}`);
      await refreshInstrumentalManagementData(song.docId);
      show(`已移除与「${targetSong.title}」的伴奏关联`);
    } catch (error) {
      console.error('Delete instrumental relation failed:', error);
      show(error instanceof Error ? error.message : '移除伴奏关联失败，请稍后重试', { variant: 'error' });
    } finally {
      setRelationSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="h-48 bg-white rounded-[32px] border border-gray-100 animate-pulse" />
      </div>
    );
  }

  if (!song) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Link to="/music" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-primary transition-colors">
          <ArrowLeft size={16} /> 返回音乐馆
        </Link>
        <div className="mt-6 bg-white rounded-[32px] border border-gray-100 p-10 text-center text-gray-400">
          歌曲不存在或已被删除
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-6">
      <Link to="/music" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-primary transition-colors">
        <ArrowLeft size={16} /> 返回音乐馆
      </Link>

      <section className="bg-white rounded-[32px] border border-gray-100 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
          <div className="flex gap-5 min-w-0">
            <img
              src={song.cover}
              alt={song.title}
              className="w-24 h-24 rounded-2xl object-cover shadow"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <h1 className="text-3xl font-serif font-bold text-gray-900 truncate">{song.title}</h1>
              <p className="text-sm text-gray-500 mt-1">{song.artist} · {song.album}</p>
              <p className="text-xs text-gray-400 mt-2">ID: {song.id}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePlay}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-primary text-gray-900 text-sm font-bold hover:scale-105 transition-all"
            >
              <Play size={16} /> 播放
            </button>
            <button
              onClick={handleToggleFavorite}
              disabled={favoriting}
              className={clsx(
                'inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm transition-colors',
                song.favoritedByMe
                  ? 'border-red-200 text-red-500 bg-red-50'
                  : 'border-gray-200 text-gray-600 hover:text-red-500 hover:border-red-200',
                favoriting && 'opacity-50 cursor-not-allowed',
              )}
            >
              <Heart size={15} /> {song.favoritedByMe ? '已收藏' : '收藏'}
            </button>
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-sm text-gray-600 hover:text-brand-primary hover:border-brand-primary/40"
            >
              <Link2 size={15} /> 复制内链
            </button>
            <a
              href={getSongExternalUrl(song)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-sm text-gray-600 hover:text-brand-primary hover:border-brand-primary/40"
            >
              <ExternalLink size={15} /> 原始链接
            </a>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-[32px] border border-gray-100 p-6 sm:p-8 shadow-sm">
        <h2 className="text-xl font-serif font-bold text-gray-900 mb-4">歌词</h2>
        {lyricLines.length > 0 ? (
          <div className="space-y-2 text-sm text-gray-600 leading-relaxed max-h-[380px] overflow-y-auto pr-2">
            {lyricLines.map((line, index) => (
              <p key={`${line}-${index}`}>{line}</p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">暂无歌词</p>
        )}
      </section>

      <section className="bg-white rounded-[32px] border border-gray-100 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare size={18} className="text-brand-primary" /> 关联乐评
          </h2>
          <Link
            to={`/forum/new?musicDocId=${song.docId}&musicTitle=${encodeURIComponent(song.title)}`}
            className="px-3 py-1.5 bg-brand-primary text-gray-900 rounded-full text-xs font-bold hover:scale-105 transition-all"
          >
            发表乐评
          </Link>
        </div>

        {posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/forum/${post.id}`}
                className="block border border-gray-100 rounded-2xl p-4 hover:shadow-md hover:border-brand-primary/20 transition-all"
              >
                <h3 className="font-bold text-gray-900 mb-2">{post.title}</h3>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Heart size={12} /> {post.likesCount || 0}</span>
                  <span className="flex items-center gap-1"><MessageSquare size={12} /> {post.commentsCount || 0}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(post.updatedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400 italic">暂无乐评，快来发表第一篇吧！</div>
        )}
      </section>

      {isAdmin && song?.docId && (
        <section className="bg-white rounded-[32px] border border-gray-100 p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-serif font-bold text-gray-900 mb-4">管理功能</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-4 py-2 rounded-full border border-gray-200 text-sm text-gray-600 hover:text-brand-primary hover:border-brand-primary/40 transition-colors"
            >
              编辑歌曲
            </button>
            <SongCoverManager
              songDocId={song.docId}
              currentCover={song.cover}
              onCoverUpdated={(newCoverUrl) => setSong((prev) => prev ? { ...prev, cover: newCoverUrl } : prev)}
            />
          </div>

          <div className="mt-6 rounded-[28px] border border-gray-100 bg-gray-50/70 p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">伴奏管理</h3>
              <p className="mt-1 text-sm text-gray-500">
                将当前歌曲设为某首原曲的伴奏。设置后，这首歌会在音乐馆中默认隐藏，仅在打开“显示伴奏”时显示。
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">查找原曲</label>
              <input
                type="text"
                value={relationQuery}
                onChange={(event) => setRelationQuery(event.target.value)}
                placeholder="按标题、歌手、专辑或 docId 搜索"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
              />
              {relationQuery.trim() ? (
                relationCandidates.length > 0 ? (
                  <div className="space-y-2">
                    {relationCandidates.map((candidate) => (
                      <div
                        key={candidate.docId}
                        className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">{candidate.title}</p>
                          <p className="truncate text-xs text-gray-500">{candidate.artist} · {candidate.album || '未填写专辑'}</p>
                          <p className="mt-1 truncate text-[11px] text-gray-400">docId: {candidate.docId}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddInstrumentalRelation(candidate)}
                          disabled={relationSaving === candidate.docId}
                          className="shrink-0 rounded-full border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 transition-colors hover:border-brand-primary/40 hover:text-brand-primary disabled:opacity-50"
                        >
                          {relationSaving === candidate.docId ? '设置中...' : '设为当前歌曲的原曲'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">没有找到可关联的原曲。</p>
                )
              ) : (
                <p className="text-sm text-gray-400 italic">输入关键词后会显示可关联的原曲候选。</p>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">当前已关联的原曲</h4>
              {relationsLoading ? (
                <p className="text-sm text-gray-400 italic">加载中...</p>
              ) : instrumentalForSongs.length > 0 ? (
                <div className="space-y-2">
                  {instrumentalForSongs.map((targetSong) => (
                    <div
                      key={targetSong.docId}
                      className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <Link to={`/music/${targetSong.docId}`} className="truncate text-sm font-semibold text-gray-900 hover:text-brand-primary">
                          {targetSong.title}
                        </Link>
                        <p className="truncate text-xs text-gray-500">{targetSong.artist} · {targetSong.album || '未填写专辑'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveInstrumentalRelation(targetSong)}
                        disabled={relationSaving === targetSong.docId}
                        className="shrink-0 rounded-full border border-red-200 px-4 py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        {relationSaving === targetSong.docId ? '移除中...' : '移除伴奏关联'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">当前歌曲还没有被设置为任何原曲的伴奏。</p>
              )}
            </div>
          </div>
        </section>
      )}

      {isAdmin && song && (
        <SongEditModal
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            if (songId) {
              apiGet<SongDetailResponse>(`/api/music/${songId}`).then((res) => setSong(res.song));
            }
          }}
          song={song}
        />
      )}
    </div>
  );
};

export default MusicDetail;
