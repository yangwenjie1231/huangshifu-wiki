import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFindMany = vi.fn()

vi.mock('@prisma/client', () => {
  class PrismaClient {
    mediaAsset = { findMany: mockFindMany }
    imageMap = { findMany: mockFindMany }
    user = { findMany: mockFindMany }
    galleryImage = { findMany: mockFindMany }
    songCover = { findMany: mockFindMany }
    albumCover = { findMany: mockFindMany }
    musicTrack = { findMany: mockFindMany }
    album = { findMany: mockFindMany }
    wikiImageEmbedding = { findMany: mockFindMany }
    postImageEmbedding = { findMany: mockFindMany }
    wikiPage = { findMany: mockFindMany }
    wikiRevision = { findMany: mockFindMany }
    post = { findMany: mockFindMany }
    postComment = { findMany: mockFindMany }
    wikiPullRequestComment = { findMany: mockFindMany }
    wikiPullRequest = { findMany: mockFindMany }
    announcement = { findMany: mockFindMany }
    $disconnect = vi.fn().mockResolvedValue(undefined)
  }

  return { PrismaClient }
})

describe('cleanup orphan uploads script', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindMany.mockResolvedValue([])
  })

  it('treats absolute local avatar urls as referenced uploads', async () => {
    mockFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ photoURL: 'https://example.com/uploads/avatars/a.jpg' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const { collectReferencedStorageKeys } = await import('../../scripts/cleanup-orphan-uploads')

    const keys = await collectReferencedStorageKeys()

    expect(keys.has('avatars/a.jpg')).toBe(true)
  })
})
