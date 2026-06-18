import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockSiteConfigFindUnique = vi.hoisted(() => vi.fn())

vi.mock('../../src/server/utils/config', () => ({
  prisma: {
    siteConfig: {
      findUnique: mockSiteConfigFindUnique,
    },
  },
}))

describe('music response transformers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSiteConfigFindUnique.mockResolvedValue({ value: { strategy: 'local' } })
  })

  it('includes description for detail responses and excludes it when requested', async () => {
    const { toSongResponse } = await import('../../src/server/utils/response-transformers')

    const baseSong = {
      docId: 'song-doc-1',
      id: 'song-1',
      title: '测试歌曲',
      artist: '歌手',
      album: '专辑',
      cover: '',
      audioUrl: '',
      lyric: '歌词',
      description: 'Markdown 描述',
      primaryPlatform: 'netease',
      enabledPlatform: null,
      neteaseId: null,
      tencentId: null,
      kugouId: null,
      baiduId: null,
      kuwoId: null,
      customPlatformLinks: null,
      displayAlbumMode: 'linked',
      manualAlbumName: null,
      defaultCoverSource: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      covers: [],
      albumRelations: [],
      instrumentalLinks: [],
    }

    const detail = toSongResponse(baseSong as Parameters<typeof toSongResponse>[0])
    expect(detail.description).toBe('Markdown 描述')
    expect(detail.lyric).toBe('歌词')

    const listItem = toSongResponse(baseSong as Parameters<typeof toSongResponse>[0], {
      excludeLyric: true,
      excludeDescription: true,
    })
    expect(listItem.description).toBeUndefined()
    expect(listItem.lyric).toBeUndefined()
  })
})
