// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import GalleryDetail from '../../src/pages/GalleryDetail'
import type { GalleryItem } from '../../src/types/entities'

const mockApiGet = vi.hoisted(() => vi.fn())
const mockSmartImage = vi.hoisted(() => vi.fn())

vi.mock('../../src/lib/apiClient', () => ({
  apiDelete: vi.fn(),
  apiGet: mockApiGet,
  apiPost: vi.fn(),
}))

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    isBanned: false,
  }),
}))

vi.mock('../../src/components/Dialog', () => ({
  useDialog: () => ({
    confirm: vi.fn(),
    prompt: vi.fn(),
  }),
}))

vi.mock('../../src/components/Toast', () => ({
  useToast: () => ({
    show: vi.fn(),
  }),
}))

vi.mock('../../src/components/SmartImage', () => ({
  SmartImage: (props: { src?: string; alt?: string; className?: string }) => {
    mockSmartImage(props)
    return <img src={props.src || ''} alt={props.alt || ''} className={props.className} />
  },
}))

vi.mock('../../src/components/Lightbox', () => ({
  Lightbox: () => null,
}))

const makeGallery = (image: GalleryItem['images'][number]): GalleryItem => ({
  id: 'gallery-1',
  title: '等待缩略图详情',
  description: '',
  authorUid: 'user-1',
  authorName: '测试用户',
  tags: [],
  locationCode: null,
  locationName: null,
  locationDetail: null,
  copyright: null,
  published: true,
  publishedAt: '2026-05-25T10:00:00.000Z',
  createdAt: '2026-05-25T10:00:00.000Z',
  updatedAt: '2026-05-25T10:00:00.000Z',
  likesCount: 0,
  dislikesCount: 0,
  favoritesCount: 0,
  images: [image],
})

const renderGalleryDetail = () =>
  render(
    <MemoryRouter initialEntries={['/gallery/gallery-1']}>
      <Routes>
        <Route path="/gallery/:galleryId" element={<GalleryDetail />} />
      </Routes>
    </MemoryRouter>
  )

describe('GalleryDetail', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('polls pending thumbnails while staying on the detail page without using the original image', async () => {
    const pendingGallery = makeGallery({
      id: 'image-1',
      assetId: null,
      url: '',
      originalUrl: '/uploads/galleries/original.jpg',
      thumbnailUrl: null,
      thumbnailStatus: 'processing',
      name: 'original.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
    })
    const completedGallery = makeGallery({
      ...pendingGallery.images[0],
      thumbnailUrl: '/uploads/variants/image-1/1080h.webp',
      thumbnailStatus: 'completed',
    })

    let galleryFetchCount = 0
    mockApiGet.mockImplementation((path: string) => {
      if (path === '/api/config/gallery-access') {
        return Promise.resolve({ adminOnly: false })
      }
      if (path === '/api/galleries/gallery-1/comments') {
        return Promise.resolve({ comments: [] })
      }
      if (path === '/api/galleries/gallery-1') {
        galleryFetchCount += 1
        return Promise.resolve({ gallery: galleryFetchCount === 1 ? pendingGallery : completedGallery })
      }
      return Promise.resolve({})
    })

    renderGalleryDetail()

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('等待缩略图详情')).toBeInTheDocument()
    expect(screen.getByText('生成中...')).toBeInTheDocument()
    expect(mockSmartImage).not.toHaveBeenCalledWith(
      expect.objectContaining({ src: '/uploads/galleries/original.jpg' })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(mockSmartImage).toHaveBeenCalledWith(
      expect.objectContaining({ src: '/uploads/variants/image-1/1080h.webp' })
    )
    expect(screen.queryByText('生成中...')).not.toBeInTheDocument()
  })
})
