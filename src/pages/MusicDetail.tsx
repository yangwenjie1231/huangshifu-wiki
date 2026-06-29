import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Heart,
  Link2,
  MessageSquare,
  Play,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { format } from 'date-fns'

import { apiDelete, apiGet } from '../lib/apiClient'
import { useAuth } from '../context/AuthContext'
import { useMusic } from '../context/MusicContext'
import { useDialog } from '../components/Dialog'
import { useToast } from '../components/Toast'
import { useToggleInteraction } from '../hooks/useToggleInteraction'
import { useI18n } from '../lib/i18n'
import { CoverManager } from '../components/CoverManager'
import { SmartImage } from '../components/SmartImage'
import { SongEditModal } from '../components/SongEditModal'
import { LyricsDisplay } from '../components/LyricsDisplay'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { copyToClipboard, toAbsoluteInternalUrl } from '../lib/copyLink'
import { getPlatformExternalUrl } from '../lib/musicPlatformUrls'
import { formatMusicCredits } from '../lib/musicCredits'
import { formatTime } from '../lib/formatUtils'
import { Platform, PlatformIds } from '../types/PlatformIds'

type CustomPlatformLink = {
  label: string
  url: string
}

type CustomPlatformConfig = {
  key: string
  label: string
  urlPattern: string
  color: string
  bgColor: string
}

type SongItem = {
  docId: string
  id: string
  title: string
  artists: string[]
  lyricists?: string[]
  composers?: string[]
  arrangers?: string[]
  vocals?: string[]
  album: string
  cover: string
  audioUrl: string
  lyric?: string | null
  description?: string | null
  releaseDate?: string | null
  durationMs?: number | null
  primaryPlatform?: Platform | null
  favoritedByMe?: boolean
  platformIds?: PlatformIds
  customPlatformIds?: Record<string, string>
  customPlatformLinks?: CustomPlatformLink[]
}

type SongDetailResponse = {
  song: SongItem & { platformIds?: PlatformIds }
}

type PostItem = {
  id: string
  title: string
  likesCount: number
  commentsCount: number
  updatedAt: string
}

const getSongExternalUrl = (song: SongItem) => {
  const id = (song.id || '').trim()
  if (!id) return '#'
  return getPlatformExternalUrl(song.primaryPlatform || 'netease', id) || '#'
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return '刚刚'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '刚刚' : format(parsed, 'yyyy-MM-dd')
}

const MusicDetail = () => {
  const { songId } = useParams()
  const navigate = useNavigate()
  const [song, setSong] = useState<SongItem | null>(null)
  const [posts, setPosts] = useState<PostItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [customPlatforms, setCustomPlatforms] = useState<CustomPlatformConfig[]>([])
  const [descExpanded, setDescExpanded] = useState(false)
  const [lyricsExpanded, setLyricsExpanded] = useState(false)
  const [lyricsCopied, setLyricsCopied] = useState(false)
  const { user, isAdmin } = useAuth()
  const { setCurrentSong, setIsPlaying, setPlaylist } = useMusic()
  const dialog = useDialog()
  const { show } = useToast()
  const { t } = useI18n()

  const { toggleFavorite, favoriting } = useToggleInteraction({
    entity: song,
    setEntity: setSong as (entity: SongItem | ((prev: SongItem) => SongItem)) => void,
    user,
    apiBase: '/api/music',
    entityId: song?.docId,
    toast: { show },
    t,
  })

  useEffect(() => {
    apiGet<{ platforms: CustomPlatformConfig[] }>('/api/music-platforms')
      .then((data) => setCustomPlatforms(data.platforms || []))
      .catch(() => setCustomPlatforms([]))
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      if (!songId) return
      setLoading(true)
      try {
        const detail = await apiGet<SongDetailResponse>(`/api/music/${songId}`)
        const currentSong = detail.song || null
        setSong(currentSong)
        if (currentSong?.docId) {
          const postResult = await apiGet<{ posts: PostItem[] }>(
            `/api/music/${currentSong.docId}/posts`
          )
          setPosts(postResult.posts || [])
        } else {
          setPosts([])
        }
      } catch (error) {
        console.error('Fetch song detail failed:', error)
        setSong(null)
        setPosts([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [songId])

  const customPlatformLinks = song?.customPlatformLinks || []

  const handlePlay = () => {
    if (!song) return
    setPlaylist([song])
    setCurrentSong(song)
    setIsPlaying(true)
  }

  const handleCopyLink = async () => {
    if (!song?.docId) return
    const copied = await copyToClipboard(toAbsoluteInternalUrl(`/music/${song.docId}`))
    if (copied) {
      show('歌曲内链已复制')
      return
    }
    show('复制链接失败，请稍后重试', { variant: 'error' })
  }

  const handleCopyLyrics = async () => {
    if (!song?.lyric) return
    try {
      await navigator.clipboard.writeText(song.lyric)
      setLyricsCopied(true)
      setTimeout(() => setLyricsCopied(false), 2000)
    } catch {
      show('复制失败，请手动复制', { variant: 'error' })
    }
  }

  const handleDeleteSong = async () => {
    if (!song?.docId || isDeleting) return
    const confirmed = await dialog.confirm({
      title: '删除歌曲',
      message: `确定要删除歌曲《${song.title}》吗？删除后可在回收站恢复。`,
      confirmText: '删除',
      variant: 'danger',
    })
    if (!confirmed) return

    try {
      setIsDeleting(true)
      await apiDelete(`/api/music/${song.docId}`)
      show('歌曲已删除')
      navigate('/music')
    } catch (error) {
      console.error('Delete song failed:', error)
      show(error instanceof Error ? error.message : '删除歌曲失败', { variant: 'error' })
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen antique-page bg-bg-primary">
        <div className="max-w-[1100px] mx-auto px-6 py-8 pb-32">
          <div className="h-48 bg-surface-alt rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (!song) {
    return (
      <div className="min-h-screen antique-page bg-bg-primary">
        <div className="max-w-[1100px] mx-auto px-6 py-8 pb-32">
          <Link
            to="/music"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-brand-gold transition-colors"
          >
            <ArrowLeft size={16} /> 返回音乐馆
          </Link>
          <div className="mt-6 bg-surface rounded border border-border p-10 text-center text-text-muted italic tracking-[0.1em]">
            歌曲不存在或已被删除
          </div>
        </div>
      </div>
    )
  }

  const artistsText = formatMusicCredits(song.artists, '未知歌手')
  const creditRows = [
    { label: '作词', value: formatMusicCredits(song.lyricists) },
    { label: '作曲', value: formatMusicCredits(song.composers) },
    { label: '编曲', value: formatMusicCredits(song.arrangers) },
    { label: '演唱', value: formatMusicCredits(song.vocals) },
  ].filter((item) => item.value)

  return (
    <div className="min-h-screen antique-detail text-[var(--color-text-antique)] bg-bg-primary">
      <div className="max-w-[1100px] mx-auto px-6 py-8 pb-32">
        <Link
          to="/music"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-brand-gold transition-colors mb-5"
        >
          <ArrowLeft size={16} /> 返回音乐馆
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-start">
          {/* Main Content */}
          <div>
            {/* Detail Header */}
            <div className="flex flex-col md:flex-row gap-5 mb-6 pb-6 border-b border-border">
              <SmartImage
                src={song.cover}
                alt={song.title}
                className="w-40 h-40 md:w-44 md:h-44 object-cover flex-shrink-0 rounded bg-surface-alt"
              />
              <div className="flex-1 flex flex-col justify-center min-w-0">
                <h1 className="text-[1.75rem] font-bold text-text-primary tracking-[0.12em] mb-1.5">
                  {song.title}
                </h1>
                <p className="text-base text-text-secondary tracking-[0.08em] mb-3">
                  {artistsText}
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4 text-sm text-text-muted">
                  <span>专辑：{song.album}</span>
                  <span>ID：{song.id}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handlePlay}
                    className="inline-flex items-center gap-2 px-6 py-2 theme-button-primary rounded text-[0.9375rem] tracking-[0.08em] transition-all"
                  >
                    <Play size={16} /> 播放
                  </button>
                  <button
                    onClick={toggleFavorite}
                    disabled={favoriting}
                    className={clsx(
                      'inline-flex items-center gap-2 px-5 py-2.5 border text-[0.9375rem] rounded transition-all',
                      song.favoritedByMe
                        ? 'theme-border-error-soft theme-text-error theme-bg-error-soft'
                        : 'theme-button-danger-outline text-text-secondary',
                      favoriting && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <Heart size={15} /> {song.favoritedByMe ? '已收藏' : '收藏'}
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-[0.9375rem] text-text-secondary hover:text-brand-gold hover:border-brand-gold rounded transition-all"
                  >
                    <Link2 size={15} /> 复制内链
                  </button>
                  <a
                    href={getSongExternalUrl(song)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-[0.9375rem] text-text-secondary hover:text-brand-gold hover:border-brand-gold rounded transition-all"
                  >
                    <ExternalLink size={15} /> 原始链接
                  </a>
                </div>
              </div>
            </div>

            {/* Lyrics */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-base font-semibold text-text-primary tracking-[0.12em] flex items-center gap-2">
                  <span className="w-[3px] h-4 bg-brand-gold rounded-[1px] opacity-60 inline-block" />
                  歌词
                </h2>
                {song?.lyric && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyLyrics}
                      className="text-xs px-3 py-1.5 border border-border text-text-muted hover:text-brand-gold hover:border-brand-gold rounded transition-all duration-300"
                    >
                      {lyricsCopied ? '已复制' : '复制歌词'}
                    </button>
                    <button
                      onClick={() => setLyricsExpanded(!lyricsExpanded)}
                      className="text-xs px-3 py-1.5 border border-border text-text-muted hover:text-brand-gold hover:border-brand-gold rounded transition-all duration-300"
                    >
                      {lyricsExpanded ? '收起' : '展开'}
                    </button>
                  </div>
                )}
              </div>
              <div
                className={clsx(
                  'text-lg leading-normal text-text-secondary whitespace-pre-line tracking-[0.04em] py-3 px-1 overflow-hidden transition-all',
                  !lyricsExpanded && 'max-h-[300px]'
                )}
              >
                <LyricsDisplay lyric={song?.lyric || ''} />
              </div>
            </div>

            {/* Description */}
            {song?.description && (
              <div className="mb-10">
                <h2 className="text-base font-semibold text-text-primary tracking-[0.12em] mb-4 pb-2.5 border-b border-border flex items-center gap-2">
                  <span className="w-[3px] h-4 bg-brand-gold rounded-[1px] opacity-60 inline-block" />
                  歌曲描述
                </h2>
                <div
                  className={clsx(
                    'prose max-w-none text-text-secondary overflow-hidden transition-all',
                    !descExpanded && 'max-h-[16rem]'
                  )}
                >
                  <MarkdownRenderer content={song.description || ''} />
                </div>
                <button
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="text-xs px-3 py-1.5 border border-border text-text-muted hover:text-brand-gold hover:border-brand-gold rounded transition-all duration-300 mt-3 inline-flex items-center gap-1"
                >
                  {descExpanded ? (
                    <>
                      收起 <ChevronUp size={14} />
                    </>
                  ) : (
                    <>
                      展开 <ChevronDown size={14} />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Related Posts */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-border">
                <h2 className="text-base font-semibold text-text-primary tracking-[0.12em] flex items-center gap-2">
                  <span className="w-[3px] h-4 bg-brand-gold rounded-[1px] opacity-60 inline-block" />
                  关联乐评
                </h2>
                <Link
                  to={`/forum/new?musicDocId=${song.docId}&musicTitle=${encodeURIComponent(song.title)}`}
                  className="px-4 py-2 theme-button-primary rounded text-xs font-semibold transition-all"
                >
                  发表乐评
                </Link>
              </div>

              {posts.length > 0 ? (
                <div className="flex flex-col">
                  {posts.map((post) => (
                    <Link
                      key={post.id}
                      to={`/forum/${post.id}`}
                      className="py-3.5 border-b border-border transition-colors group"
                    >
                      <p className="text-[0.9375rem] text-text-primary mb-1 tracking-[0.04em] group-hover:text-brand-gold transition-colors">
                        {post.title}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <Heart size={12} /> {post.likesCount || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare size={12} /> {post.commentsCount || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {formatDate(post.updatedAt)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-text-muted italic tracking-[0.1em] py-6">
                  暂无乐评，快来发表第一篇吧！
                </div>
              )}
            </div>

            {/* Custom Platform Links */}
            {customPlatformLinks.length > 0 && (
              <div className="mb-10">
                <h2 className="text-base font-semibold text-text-primary tracking-[0.12em] mb-4 pb-2.5 border-b border-border flex items-center gap-2">
                  <span className="w-[3px] h-4 bg-brand-gold rounded-[1px] opacity-60 inline-block" />
                  更多平台
                </h2>
                <div className="flex flex-col">
                  {customPlatformLinks.map((link) => (
                    <a
                      key={`${link.label}-${link.url}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 py-2.5 border-b border-border text-sm text-text-secondary hover:text-brand-gold hover:pl-1 transition-all"
                    >
                      <ExternalLink size={16} className="text-text-muted flex-shrink-0" />
                      <span className="truncate">{link.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Preset Platforms */}
            {customPlatforms.length > 0 &&
              song?.customPlatformIds &&
              Object.keys(song.customPlatformIds).length > 0 && (
                <div className="mb-10">
                  <h2 className="text-base font-semibold text-text-primary tracking-[0.12em] mb-4 pb-2.5 border-b border-border flex items-center gap-2">
                    <span className="w-[3px] h-4 bg-brand-gold rounded-[1px] opacity-60 inline-block" />
                    预设平台
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {customPlatforms
                      .filter((p) => song.customPlatformIds?.[p.key])
                      .map((platform) => {
                        const id = song.customPlatformIds![platform.key]
                        const url = platform.urlPattern.replace('{id}', id)
                        return (
                          <a
                            key={platform.key}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all hover:text-[var(--color-accent-antique)] border-b border-transparent hover:border-[var(--color-accent-antique)] text-[var(--color-text-antique-muted)]"
                          >
                            {platform.label}
                            <ExternalLink size={12} />
                          </a>
                        )
                      })}
                  </div>
                </div>
              )}

            {/* Admin */}
            {isAdmin && song?.docId && (
              <div className="mb-10">
                <h2 className="text-base font-semibold text-text-primary tracking-[0.12em] mb-4 pb-2.5 border-b border-border flex items-center gap-2">
                  <span className="w-[3px] h-4 bg-brand-gold rounded-[1px] opacity-60 inline-block" />
                  管理功能
                </h2>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-5 py-2 border border-border text-sm text-text-secondary hover:text-brand-gold hover:border-brand-gold rounded transition-all"
                  >
                    编辑歌曲
                  </button>
                  <button
                    onClick={handleDeleteSong}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-2 px-5 py-2 theme-button-danger rounded text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={15} /> {isDeleting ? '删除中...' : '删除歌曲'}
                  </button>
                  <CoverManager
                    resourceType="song"
                    resourceId={song.docId}
                    currentCover={song.cover}
                    onCoverUpdated={(newCoverUrl) =>
                      setSong((prev) => (prev ? { ...prev, cover: newCoverUrl } : prev))
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:sticky lg:top-20">
            <div className="py-5 border-b border-border">
              <h3 className="text-[0.875rem] font-semibold text-text-secondary tracking-[0.12em] uppercase mb-3.5">
                歌曲信息
              </h3>
              <div className="flex flex-col gap-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">歌手</span>
                  <span className="text-text-primary">{artistsText}</span>
                </div>
                {creditRows.map((row) => (
                  <div className="flex items-center justify-between" key={row.label}>
                    <span className="text-text-muted">{row.label}</span>
                    <span className="text-text-primary">{row.value}</span>
                  </div>
                ))}
                {song.releaseDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">发行日期</span>
                    <span className="text-text-primary">{song.releaseDate}</span>
                  </div>
                )}
                {typeof song.durationMs === 'number' && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">时长</span>
                    <span className="text-text-primary">{formatTime(song.durationMs / 1000)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">专辑</span>
                  <span className="text-text-primary">{song.album}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">平台 ID</span>
                  <span className="text-text-primary">{song.id}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {isAdmin && song && (
        <SongEditModal
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            if (songId) {
              apiGet<SongDetailResponse>(`/api/music/${songId}`).then((res) => setSong(res.song))
            }
          }}
          song={song}
        />
      )}
    </div>
  )
}

export default MusicDetail
