import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Plus, Search, Trash2 } from 'lucide-react'

import { apiGet, apiPatch } from '../lib/apiClient'
import { CONTENT_LIMITS } from '../lib/contentLimits'
import { getPlatformExternalUrl } from '../lib/musicPlatformUrls'
import { formatMusicCredits, normalizeStringListInput } from '../lib/musicCredits'
import { Platform, PlatformIds } from '../types/PlatformIds'
import { useToast } from './Toast'
import { MatchSuggestionModal } from './MatchSuggestionModal'
import { FormModal } from './Modal/FormModal'
import { CharacterCount } from './CharacterCount'
import MarkdownEditor from './MarkdownEditor'

type CustomPlatformConfig = {
  key: string
  label: string
  urlPattern: string
  color: string
  bgColor: string
}

type SongFormData = {
  title: string
  artists: string
  lyricists: string
  composers: string
  arrangers: string
  vocals: string
  album: string
  releaseDate: string
  durationMs: string
  lyric?: string | null
  description?: string | null
}

type CustomPlatformLink = {
  label: string
  url: string
}

const normalizeCustomPlatformLinkUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const raw = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    return parsed.toString()
  } catch {
    return ''
  }
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

interface SongEditModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  song: SongItem
}

const platformFields: Array<{
  key: keyof PlatformIds
  label: string
  urlPattern: (id: string) => string
}> = [
  {
    key: 'neteaseId',
    label: '网易云音乐',
    urlPattern: (id) => getPlatformExternalUrl('netease', id) || '#',
  },
  {
    key: 'tencentId',
    label: 'QQ音乐',
    urlPattern: (id) => getPlatformExternalUrl('tencent', id) || '#',
  },
  {
    key: 'kugouId',
    label: '酷狗音乐',
    urlPattern: (id) => getPlatformExternalUrl('kugou', id) || '#',
  },
  {
    key: 'baiduId',
    label: '百度音乐',
    urlPattern: (id) => getPlatformExternalUrl('baidu', id) || '#',
  },
  {
    key: 'kuwoId',
    label: '酷我音乐',
    urlPattern: (id) => getPlatformExternalUrl('kuwo', id) || '#',
  },
]

const creditFields: Array<{
  key: 'lyricists' | 'composers' | 'arrangers' | 'vocals'
  label: string
  placeholder: string
}> = [
  { key: 'lyricists', label: '作词', placeholder: '作词人，多个用逗号分隔' },
  { key: 'composers', label: '作曲', placeholder: '作曲人，多个用逗号分隔' },
  { key: 'arrangers', label: '编曲', placeholder: '编曲人，多个用逗号分隔' },
  { key: 'vocals', label: '演唱', placeholder: '演唱者，多个用逗号分隔' },
]

export const SongEditModal = ({ open, onClose, onSuccess, song }: SongEditModalProps) => {
  const [formData, setFormData] = useState<SongFormData>({
    title: song.title || '',
    artists: formatMusicCredits(song.artists),
    lyricists: formatMusicCredits(song.lyricists),
    composers: formatMusicCredits(song.composers),
    arrangers: formatMusicCredits(song.arrangers),
    vocals: formatMusicCredits(song.vocals),
    album: song.album || '',
    releaseDate: song.releaseDate || '',
    durationMs: typeof song.durationMs === 'number' ? String(song.durationMs) : '',
    lyric: song.lyric || '',
    description: song.description || '',
  })
  const [platformIds, setPlatformIds] = useState<PlatformIds>({
    neteaseId: song.platformIds?.neteaseId || '',
    tencentId: song.platformIds?.tencentId || '',
    kugouId: song.platformIds?.kugouId || '',
    baiduId: song.platformIds?.baiduId || '',
    kuwoId: song.platformIds?.kuwoId || '',
  })
  const [customPlatformLinks, setCustomPlatformLinks] = useState<CustomPlatformLink[]>(
    song.customPlatformLinks || []
  )
  const [customPlatformIds, setCustomPlatformIds] = useState<Record<string, string>>(
    song.customPlatformIds || {}
  )
  const [customPlatforms, setCustomPlatforms] = useState<CustomPlatformConfig[]>([])
  const [platformExpanded, setPlatformExpanded] = useState(false)
  const [customPlatformExpanded, setCustomPlatformExpanded] = useState(false)
  const [matchingPlatform, setMatchingPlatform] = useState<Platform | null>(null)
  const [saving, setSaving] = useState(false)
  const { show } = useToast()

  useEffect(() => {
    if (open) {
      apiGet<{ platforms: CustomPlatformConfig[] }>('/api/music-platforms')
        .then((data) => setCustomPlatforms(data.platforms || []))
        .catch(() => setCustomPlatforms([]))
    }
  }, [open])

  useEffect(() => {
    if (song) {
      setFormData({
        title: song.title || '',
        artists: formatMusicCredits(song.artists),
        lyricists: formatMusicCredits(song.lyricists),
        composers: formatMusicCredits(song.composers),
        arrangers: formatMusicCredits(song.arrangers),
        vocals: formatMusicCredits(song.vocals),
        album: song.album || '',
        releaseDate: song.releaseDate || '',
        durationMs: typeof song.durationMs === 'number' ? String(song.durationMs) : '',
        lyric: song.lyric || '',
        description: song.description || '',
      })
      setPlatformIds({
        neteaseId: song.platformIds?.neteaseId || '',
        tencentId: song.platformIds?.tencentId || '',
        kugouId: song.platformIds?.kugouId || '',
        baiduId: song.platformIds?.baiduId || '',
        kuwoId: song.platformIds?.kuwoId || '',
      })
      setCustomPlatformLinks(song.customPlatformLinks || [])
      setCustomPlatformIds(song.customPlatformIds || {})
    }
  }, [song, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      show('请输入歌曲标题', { variant: 'error' })
      return
    }
    const artists = normalizeStringListInput(formData.artists)
    if (!artists.length) {
      show('请输入艺术家名称', { variant: 'error' })
      return
    }

    const normalizedCustomPlatformLinks = customPlatformLinks.map((link) => ({
      label: link.label.trim(),
      url: link.url.trim(),
    }))
    const hasIncompleteCustomPlatformLink = normalizedCustomPlatformLinks.some(
      (link) => (link.label || link.url) && (!link.label || !link.url)
    )
    if (hasIncompleteCustomPlatformLink) {
      show('自定义平台链接需要同时填写平台名称和地址', { variant: 'error' })
      return
    }
    const hasInvalidCustomPlatformLink = normalizedCustomPlatformLinks.some(
      (link) => link.url && !normalizeCustomPlatformLinkUrl(link.url)
    )
    if (hasInvalidCustomPlatformLink) {
      show('自定义平台链接地址无效，请填写正确的 http/https 链接', { variant: 'error' })
      return
    }

    setSaving(true)
    const description =
      typeof formData.description === 'string' && formData.description.trim()
        ? formData.description
        : null
    try {
      await apiPatch(`/api/music/${song.docId}`, {
        title: formData.title.trim(),
        artists,
        lyricists: normalizeStringListInput(formData.lyricists),
        composers: normalizeStringListInput(formData.composers),
        arrangers: normalizeStringListInput(formData.arrangers),
        vocals: normalizeStringListInput(formData.vocals),
        album: formData.album.trim(),
        releaseDate: formData.releaseDate || null,
        durationMs: formData.durationMs ? Number(formData.durationMs) : null,
        lyric: formData.lyric?.trim() || null,
        description,
        neteaseId: platformIds.neteaseId || null,
        tencentId: platformIds.tencentId || null,
        kugouId: platformIds.kugouId || null,
        baiduId: platformIds.baiduId || null,
        kuwoId: platformIds.kuwoId || null,
        customPlatformIds,
        customPlatformLinks: normalizedCustomPlatformLinks.filter((link) => link.label && link.url),
      })
      show('歌曲已更新')
      onSuccess()
      onClose()
    } catch (error) {
      const err = error as {
        conflict?: boolean
        conflictingSong?: { docId: string; title: string; artists: string[] }
        message?: string
      }
      if (err.conflict && err.conflictingSong) {
        show(`该平台ID已被歌曲「${err.conflictingSong.title}」使用`, { variant: 'error' })
      } else {
        show(error instanceof Error ? error.message : '保存失败', { variant: 'error' })
      }
    } finally {
      setSaving(false)
    }
  }

  const handlePlatformIdChange = (key: keyof PlatformIds, value: string) => {
    setPlatformIds((prev) => ({ ...prev, [key]: value }))
  }

  const handleCustomPlatformLinkChange = (
    index: number,
    key: keyof CustomPlatformLink,
    value: string
  ) => {
    setCustomPlatformLinks((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    )
  }

  const handleAddCustomPlatformLink = () => {
    setCustomPlatformLinks((prev) => [...prev, { label: '', url: '' }])
  }

  const handleRemoveCustomPlatformLink = (index: number) => {
    setCustomPlatformLinks((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }

  const handleMatchSelect = (platform: Platform, sourceId: string) => {
    handlePlatformIdChange(`${platform}Id` as keyof PlatformIds, sourceId)
    setMatchingPlatform(null)
  }

  const linkedPlatforms = platformFields.filter((p) => platformIds[p.key])

  return (
    <>
      <FormModal
        open={open}
        onClose={onClose}
        title="编辑歌曲"
        subtitle="修改歌曲基本信息"
        onSubmit={handleSubmit}
        submitText="保存"
        loading={saving}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-text-primary">
              歌曲标题 <span className="theme-text-error">*</span>
            </label>
            <CharacterCount current={formData.title.length} max={CONTENT_LIMITS.music.title} />
          </div>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            maxLength={CONTENT_LIMITS.music.title}
            placeholder="歌曲名称"
            className="theme-input w-full px-3 py-2 text-sm rounded"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-text-primary">
              艺术家 <span className="theme-text-error">*</span>
            </label>
            <CharacterCount
              current={formData.artists.length}
              max={CONTENT_LIMITS.music.artist * 10}
            />
          </div>
          <input
            type="text"
            value={formData.artists}
            onChange={(e) => setFormData((prev) => ({ ...prev, artists: e.target.value }))}
            maxLength={CONTENT_LIMITS.music.artist * 10}
            placeholder="歌手名称，多个用逗号分隔"
            className="theme-input w-full px-3 py-2 text-sm rounded"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {creditFields.map(({ key, label, placeholder }) => (
            <div className="space-y-1.5" key={key}>
              <label className="text-sm font-medium text-text-primary">{label}</label>
              <input
                type="text"
                value={formData[key]}
                onChange={(e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }))}
                maxLength={CONTENT_LIMITS.music.artist * 10}
                placeholder={placeholder}
                className="theme-input w-full px-3 py-2 text-sm rounded"
              />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-text-primary">专辑</label>
            <CharacterCount current={formData.album.length} max={CONTENT_LIMITS.music.album} />
          </div>
          <input
            type="text"
            value={formData.album}
            onChange={(e) => setFormData((prev) => ({ ...prev, album: e.target.value }))}
            maxLength={CONTENT_LIMITS.music.album}
            placeholder="所属专辑（可选）"
            className="theme-input w-full px-3 py-2 text-sm rounded"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">发行日期</label>
            <input
              type="date"
              value={formData.releaseDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, releaseDate: e.target.value }))}
              className="theme-input w-full px-3 py-2 text-sm rounded"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">时长（毫秒）</label>
            <input
              type="number"
              min={0}
              step={1}
              value={formData.durationMs}
              onChange={(e) => setFormData((prev) => ({ ...prev, durationMs: e.target.value }))}
              placeholder="例如 226000"
              className="theme-input w-full px-3 py-2 text-sm rounded"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-text-primary">歌词</label>
            <CharacterCount
              current={(formData.lyric || '').length}
              max={CONTENT_LIMITS.music.lyric}
            />
          </div>
          <textarea
            value={formData.lyric || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, lyric: e.target.value }))}
            maxLength={CONTENT_LIMITS.music.lyric}
            placeholder="歌词内容（可选，每行一句）"
            rows={6}
            className="theme-input w-full px-3 py-2 text-sm rounded resize-none"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-text-primary">歌曲描述</label>
            <CharacterCount
              current={(formData.description || '').length}
              max={CONTENT_LIMITS.music.description}
            />
          </div>
          <MarkdownEditor
            value={formData.description || ''}
            onChange={(value) => setFormData((prev) => ({ ...prev, description: value }))}
            height="260px"
            placeholder="创作者的话、创作背景等（可选，支持 Markdown）"
            ariaLabel="歌曲描述（支持 Markdown）"
            maxLength={CONTENT_LIMITS.music.description}
          />
        </div>

        <button
          type="button"
          onClick={() => setPlatformExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between p-3 rounded border border-border bg-surface-alt/60 hover:bg-surface-alt transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">关联平台</span>
            {linkedPlatforms.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded theme-tag font-medium">
                已关联 {linkedPlatforms.length} 个
              </span>
            )}
          </div>
          {platformExpanded ? (
            <ChevronUp size={16} className="text-text-muted" />
          ) : (
            <ChevronDown size={16} className="text-text-muted" />
          )}
        </button>

        {platformExpanded && (
          <div className="space-y-2">
            {platformFields.map((platform) => {
              const currentId = platformIds[platform.key] || ''
              const isLinked = Boolean(currentId)
              return (
                <div key={platform.key} className="flex items-center gap-2">
                  <span className="w-24 text-xs text-text-secondary shrink-0">
                    {platform.label}
                  </span>
                  <input
                    type="text"
                    value={currentId}
                    onChange={(e) => handlePlatformIdChange(platform.key, e.target.value)}
                    maxLength={CONTENT_LIMITS.music.platformId}
                    placeholder={isLinked ? '已关联' : '输入平台歌曲ID'}
                    className="theme-input flex-1 px-3 py-2 text-sm rounded"
                  />
                  {isLinked && (
                    <a
                      href={platform.urlPattern(currentId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-text-muted hover:text-brand-gold transition-colors"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setMatchingPlatform(platform.key.replace('Id', '') as Platform)}
                    className="px-3 py-2 rounded border border-border text-xs text-text-secondary hover:text-brand-gold hover:border-brand-gold transition-all flex items-center gap-1"
                  >
                    <Search size={13} />
                    匹配
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {customPlatforms.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setCustomPlatformExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between p-3 rounded border border-border bg-surface-alt/60 hover:bg-surface-alt transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">预设平台</span>
                {Object.keys(customPlatformIds).length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded theme-tag font-medium">
                    已添加 {Object.keys(customPlatformIds).length} 个
                  </span>
                )}
              </div>
              {customPlatformExpanded ? (
                <ChevronUp size={16} className="text-text-muted" />
              ) : (
                <ChevronDown size={16} className="text-text-muted" />
              )}
            </button>

            {customPlatformExpanded && (
              <div className="space-y-2">
                {customPlatforms.map((platform) => {
                  const currentId = customPlatformIds[platform.key] || ''
                  const isLinked = Boolean(currentId)
                  const buildUrl = (id: string) => platform.urlPattern.replace('{id}', id)
                  return (
                    <div key={platform.key} className="flex items-center gap-2">
                      <span className="w-20 text-xs px-2 py-1 rounded text-center shrink-0 theme-tag font-medium">
                        {platform.label}
                      </span>
                      <input
                        type="text"
                        value={currentId}
                        onChange={(e) =>
                          setCustomPlatformIds((prev) => ({
                            ...prev,
                            [platform.key]: e.target.value,
                          }))
                        }
                        maxLength={CONTENT_LIMITS.music.platformId}
                        placeholder={isLinked ? '已添加' : '输入平台ID'}
                        className="theme-input flex-1 px-3 py-2 text-sm rounded"
                      />
                      {isLinked && (
                        <>
                          <a
                            href={buildUrl(currentId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-text-muted hover:text-brand-gold transition-colors"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              setCustomPlatformIds((prev) => {
                                const next = { ...prev }
                                delete next[platform.key]
                                return next
                              })
                            }
                            className="p-1.5 text-text-muted theme-icon-button-danger transition-colors"
                            title="移除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        <div className="rounded border border-border bg-surface-alt/60 p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-text-primary">自定义平台链接</p>
              <p className="text-xs text-text-muted mt-0.5">例如哔哩哔哩、5sing 或其他发布平台</p>
            </div>
            <button
              type="button"
              onClick={handleAddCustomPlatformLink}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-border text-xs text-text-secondary hover:text-brand-gold hover:border-brand-gold transition-all"
            >
              <Plus size={13} /> 添加链接
            </button>
          </div>

          {customPlatformLinks.length > 0 ? (
            <div className="space-y-2">
              {customPlatformLinks.map((link, index) => {
                const previewUrl = normalizeCustomPlatformLinkUrl(link.url)
                return (
                  <div
                    key={`custom-link-${index}`}
                    className="rounded border border-border bg-surface p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) =>
                          handleCustomPlatformLinkChange(index, 'label', e.target.value)
                        }
                        maxLength={CONTENT_LIMITS.music.customPlatformLabel}
                        placeholder="平台名称，例如 Bilibili"
                        className="theme-input w-36 px-3 py-2 text-sm rounded"
                      />
                      <input
                        type="text"
                        value={link.url}
                        onChange={(e) =>
                          handleCustomPlatformLinkChange(index, 'url', e.target.value)
                        }
                        maxLength={CONTENT_LIMITS.music.customPlatformUrl}
                        placeholder="链接地址"
                        className="theme-input flex-1 px-3 py-2 text-sm rounded"
                      />
                      {previewUrl && (
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-text-muted hover:text-brand-gold transition-colors"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomPlatformLink(index)}
                        className="p-1.5 text-text-muted theme-icon-button-danger transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded border border-dashed border-border bg-surface/70 px-3 py-4 text-xs text-text-muted text-center">
              暂无自定义平台链接
            </div>
          )}
        </div>

        <div className="rounded border border-border bg-surface-alt/60 p-3">
          <div className="flex items-center gap-3">
            <img
              src={song.cover}
              alt="封面"
              className="w-12 h-12 rounded object-cover border border-border"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{song.title}</p>
              <p className="text-xs text-text-muted truncate">
                {formatMusicCredits(song.artists, '未知歌手')}
              </p>
              <p className="text-xs text-text-muted mt-0.5">ID: {song.id}</p>
            </div>
          </div>
        </div>
      </FormModal>

      {matchingPlatform && (
        <MatchSuggestionModal
          open={true}
          onClose={() => setMatchingPlatform(null)}
          title={formData.title}
          artist={formatMusicCredits(normalizeStringListInput(formData.artists), '未知歌手')}
          targetPlatform={matchingPlatform}
          existingPlatformId={platformIds[`${matchingPlatform}Id` as keyof PlatformIds]}
          onSelect={(sourceId) => handleMatchSelect(matchingPlatform, sourceId)}
        />
      )}
    </>
  )
}
