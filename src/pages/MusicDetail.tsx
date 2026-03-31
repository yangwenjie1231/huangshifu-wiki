import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, ExternalLink, Heart, Link2, MessageSquare, Play } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  description?: string | null;
  primaryPlatform?: 'netease' | 'tencent' | 'kugou' | 'baidu' | 'kuwo' | null;
  favoritedByMe?: boolean;
  platformIds?: PlatformIds;
};

type SongDetailResponse = {
  song: SongItem & { platformIds?: PlatformIds };
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

  const lyricLines = useMemo(() => {
    if (!song?.lyric) return [];
    return song.lyric.split('\n').map((line) => line.trim()).filter(Boolean);
  }, [song?.lyric]);

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

      {song.description ? (
        <section className="bg-white rounded-[32px] border border-gray-100 p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-serif font-bold text-gray-900 mb-4">歌曲描述</h2>
          <div className="prose prose-stone max-w-none text-sm text-gray-600">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {song.description}
            </ReactMarkdown>
          </div>
        </section>
      ) : null}

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
