import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Disc3, Play, Heart, ExternalLink, Link2 } from 'lucide-react';
import { clsx } from 'clsx';

import { apiDelete, apiGet, apiPost } from '../lib/apiClient';
import { useMusic } from '../context/MusicContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { copyToClipboard, toAbsoluteInternalUrl } from '../lib/copyLink';

type SongItem = {
  docId: string;
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  audioUrl: string;
  sourceUrl?: string | null;
  lyric?: string | null;
  favoritedByMe?: boolean;
  trackOrder?: number;
};

type AlbumResponse = {
  album: {
    id: string;
    title: string;
    artist: string;
    cover: string;
    description?: string | null;
    platformUrl?: string | null;
    tracks: SongItem[];
  };
};

const AlbumDetail = () => {
  const { albumId } = useParams();
  const [loading, setLoading] = useState(true);
  const [album, setAlbum] = useState<AlbumResponse['album'] | null>(null);
  const [favoriting, setFavoriting] = useState<string | null>(null);
  const { user } = useAuth();
  const { currentSong, playAlbumTracks } = useMusic();
  const { show } = useToast();

  const fetchAlbum = async () => {
    if (!albumId) return;
    setLoading(true);
    try {
      const response = await apiGet<AlbumResponse>(`/api/albums/${albumId}`);
      setAlbum(response.album || null);
    } catch (error) {
      console.error('Fetch album detail error:', error);
      setAlbum(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlbum();
  }, [albumId]);

  const handlePlay = (index = 0) => {
    if (!album) return;
    const tracks = [...album.tracks].sort((a, b) => (a.trackOrder || 0) - (b.trackOrder || 0));
    playAlbumTracks(album.id, album.title, tracks, index);
  };

  const toggleFavorite = async (song: SongItem) => {
    if (!user || !song.docId || favoriting === song.docId) {
      if (!user) alert('请先登录后收藏');
      return;
    }

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

      setAlbum((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tracks: prev.tracks.map((track) => (
            track.docId === song.docId
              ? { ...track, favoritedByMe: !track.favoritedByMe }
              : track
          )),
        };
      });
    } catch (error) {
      console.error('Toggle favorite in album detail error:', error);
      alert('收藏操作失败，请稍后重试');
    } finally {
      setFavoriting(null);
    }
  };

  const handleCopyAlbumLink = async () => {
    if (!album?.id) return;
    const copied = await copyToClipboard(toAbsoluteInternalUrl(`/album/${album.id}`));
    if (copied) {
      show('专辑内链已复制');
      return;
    }
    show('复制链接失败，请稍后重试', { variant: 'error' });
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="h-40 bg-white rounded-[32px] border border-gray-100 animate-pulse" />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Link to="/music" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-olive transition-colors">
          <ArrowLeft size={16} /> 返回音乐馆
        </Link>
        <div className="mt-6 bg-white rounded-[32px] border border-gray-100 p-10 text-center text-gray-400">
          专辑不存在或已被删除
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <Link to="/music" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-olive transition-colors">
        <ArrowLeft size={16} /> 返回音乐馆
      </Link>

      <section className="mt-6 bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
        <header className="px-6 md:px-8 py-6 border-b border-gray-100 flex flex-col md:flex-row gap-5 md:items-center md:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <img src={album.cover} alt="" className="w-20 h-20 rounded-2xl object-cover shadow" referrerPolicy="no-referrer" />
            <div className="min-w-0">
              <h1 className="text-3xl font-serif font-bold text-gray-900 truncate">{album.title}</h1>
              <p className="text-sm text-gray-500">{album.artist} · {album.tracks.length} 首歌曲</p>
              {album.description ? <p className="text-xs text-gray-400 mt-1 line-clamp-2">{album.description}</p> : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyAlbumLink}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-sm text-gray-600 hover:text-brand-olive hover:border-brand-olive/40"
              title="复制内链"
            >
              <Link2 size={14} /> 复制内链
            </button>
            {album.platformUrl ? (
              <a
                href={album.platformUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-sm text-gray-600 hover:text-brand-olive hover:border-brand-olive/40"
              >
                <ExternalLink size={14} /> 原始链接
              </a>
            ) : null}
            <button
              onClick={() => handlePlay(0)}
              disabled={album.tracks.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-olive text-white text-sm font-bold hover:bg-brand-olive/90 disabled:opacity-50"
            >
              <Play size={16} /> 播放专辑
            </button>
          </div>
        </header>

        <ul>
          {album.tracks.map((track, index) => (
            <li
              key={track.docId}
              className={clsx(
                'px-6 md:px-8 py-4 border-b border-gray-50 last:border-b-0 flex items-center gap-3 hover:bg-gray-50 transition-colors',
                currentSong?.docId === track.docId && 'bg-brand-primary/5',
              )}
            >
              <button
                onClick={() => handlePlay(index)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-brand-olive hover:text-white transition-colors inline-flex items-center justify-center"
              >
                <Play size={14} />
              </button>
              <span className="text-xs font-bold text-gray-300 w-4">{(track.trackOrder ?? index) + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{track.title}</p>
                <p className="text-xs text-gray-400 truncate">{track.artist}</p>
              </div>
              <button
                onClick={() => toggleFavorite(track)}
                disabled={favoriting === track.docId}
                className={clsx(
                  'p-2 transition-colors',
                  track.favoritedByMe ? 'text-red-500' : 'text-gray-400 hover:text-red-500',
                  favoriting === track.docId && 'opacity-50 cursor-not-allowed',
                )}
              >
                <Heart size={16} />
              </button>
            </li>
          ))}
        </ul>

        {album.tracks.length === 0 ? (
          <div className="px-6 md:px-8 py-10 text-center text-gray-400">
            <Disc3 className="mx-auto mb-2" size={28} />
            当前专辑暂无曲目
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default AlbumDetail;
