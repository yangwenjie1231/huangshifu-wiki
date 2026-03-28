import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Filter, Link2, Loader2, Search } from 'lucide-react';
import { clsx } from 'clsx';

import { apiGet } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';

type Platform = 'netease' | 'tencent' | 'kugou' | 'baidu' | 'kuwo';

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
  primaryPlatform?: Platform | null;
  platformIds?: PlatformIds;
};

const platformInfo: Array<{ key: keyof PlatformIds; label: string; color: string; bgColor: string }> = [
  { key: 'neteaseId', label: '网易云', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  { key: 'tencentId', label: 'QQ音乐', color: 'text-green-700', bgColor: 'bg-green-100' },
  { key: 'kugouId', label: '酷狗', color: 'text-red-700', bgColor: 'bg-red-100' },
  { key: 'baiduId', label: '百度', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  { key: 'kuwoId', label: '酷我', color: 'text-purple-700', bgColor: 'bg-purple-100' },
];

function buildPlatformUrl(platform: Platform, id: string): string {
  if (platform === 'netease') return `https://music.163.com/song?id=${id}`;
  if (platform === 'tencent') return `https://y.qq.com/n/ryqq/songDetail/${id}`;
  if (platform === 'kugou') return `https://www.kugou.com/song/#hash=${id}`;
  if (platform === 'baidu') return `https://music.baidu.com/song/${id}`;
  return `https://www.kuwo.cn/song_detail/${id}`;
}

const MusicLinks = () => {
  const [songs, setSongs] = useState<SongItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState<Platform | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'partial' | 'unlinked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { isAdmin } = useAuth();

  useEffect(() => {
    const fetchSongs = async () => {
      setLoading(true);
      try {
        const data = await apiGet<{ songs: SongItem[] }>('/api/music');
        setSongs(data.songs || []);
      } catch (error) {
        console.error('Fetch songs error:', error);
        setSongs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSongs();
  }, []);

  const filteredSongs = useMemo(() => {
    let result = songs;

    if (filterPlatform !== 'all') {
      result = result.filter((song) => {
        const fieldKey = `${filterPlatform}Id` as keyof PlatformIds;
        return song.platformIds?.[fieldKey];
      });
    }

    if (filterStatus === 'partial') {
      result = result.filter((song) => {
        const linkedCount = platformInfo.filter(
          (p) => song.platformIds?.[p.key]
        ).length;
        return linkedCount > 0 && linkedCount < 5;
      });
    } else if (filterStatus === 'unlinked') {
      result = result.filter((song) => {
        return platformInfo.every((p) => !song.platformIds?.[p.key]);
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (song) =>
          song.title.toLowerCase().includes(query) ||
          song.artist.toLowerCase().includes(query)
      );
    }

    return result;
  }, [songs, filterPlatform, filterStatus, searchQuery]);

  const stats = useMemo(() => {
    const total = songs.length;
    const linkedCount = songs.filter((song) =>
      platformInfo.some((p) => song.platformIds?.[p.key])
    ).length;
    const partialCount = songs.filter((song) => {
      const count = platformInfo.filter((p) => song.platformIds?.[p.key]).length;
      return count > 0 && count < 5;
    }).length;
    const fullyLinkedCount = songs.filter((song) =>
      platformInfo.every((p) => song.platformIds?.[p.key])
    ).length;
    return { total, linkedCount, partialCount, fullyLinkedCount };
  }, [songs]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-brand-primary text-gray-900 rounded-xl shadow-lg">
            <Link2 size={24} />
          </div>
          <h1 className="text-4xl font-serif font-bold text-gray-900">歌曲关联管理</h1>
        </div>
        <p className="text-gray-500">管理同一歌曲在不同平台的关联</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">总歌曲数</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-blue-600">{stats.linkedCount}</p>
          <p className="text-xs text-gray-500">已关联</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-yellow-600">{stats.partialCount}</p>
          <p className="text-xs text-gray-500">部分关联</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-green-600">{stats.fullyLinkedCount}</p>
          <p className="text-xs text-gray-500">全部关联</p>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索歌名或艺术家..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/25"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'partial' | 'unlinked')}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/25 text-sm"
            >
              <option value="all">全部状态</option>
              <option value="partial">部分关联</option>
              <option value="unlinked">未关联</option>
            </select>
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value as Platform | 'all')}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/25 text-sm"
            >
              <option value="all">全部平台</option>
              <option value="netease">网易云</option>
              <option value="tencent">QQ音乐</option>
              <option value="kugou">酷狗</option>
              <option value="baidu">百度</option>
              <option value="kuwo">酷我</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider px-6 py-4">歌曲</th>
                <th className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider px-4 py-4">网易云</th>
                <th className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider px-4 py-4">QQ音乐</th>
                <th className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider px-4 py-4">酷狗</th>
                <th className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider px-4 py-4">百度</th>
                <th className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider px-4 py-4">酷我</th>
                <th className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider px-4 py-4">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredSongs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    未找到匹配的歌曲
                  </td>
                </tr>
              ) : (
                filteredSongs.map((song) => {
                  const linkedPlatforms = platformInfo.filter((p) => song.platformIds?.[p.key]);
                  const unlinkedPlatforms = platformInfo.filter((p) => !song.platformIds?.[p.key]);
                  return (
                    <tr key={song.docId} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <Link to={`/music/${song.docId}`} className="flex items-center gap-3 hover:text-brand-primary">
                          <img
                            src={song.cover}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate max-w-[200px]">{song.title}</p>
                            <p className="text-xs text-gray-500 truncate max-w-[200px]">{song.artist}</p>
                          </div>
                        </Link>
                      </td>
                      {platformInfo.map((platform) => {
                        const isLinked = Boolean(song.platformIds?.[platform.key]);
                        return (
                          <td key={platform.key} className="px-4 py-4 text-center">
                            {isLinked ? (
                              <a
                                href={buildPlatformUrl(
                                  platform.key.replace('Id', '') as Platform,
                                  song.platformIds![platform.key]!
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={clsx(
                                  'inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all hover:scale-110',
                                  platform.bgColor,
                                  platform.color
                                )}
                                title={song.platformIds![platform.key]}
                              >
                                ✓
                              </a>
                            ) : (
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs text-gray-300">
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            to={`/music/${song.docId}`}
                            className="p-2 text-gray-400 hover:text-brand-primary transition-colors"
                            title="编辑"
                          >
                            <ExternalLink size={16} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-50 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            显示 {filteredSongs.length} / {songs.length} 首歌曲
          </p>
        </div>
      </div>
    </div>
  );
};

export default MusicLinks;