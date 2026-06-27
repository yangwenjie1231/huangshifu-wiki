// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminListPage from '../../src/pages/Admin/AdminListPage'

const mockApiGet = vi.hoisted(() => vi.fn())
const mockApiDelete = vi.hoisted(() => vi.fn())
const mockApiPost = vi.hoisted(() => vi.fn())
const mockApiPatch = vi.hoisted(() => vi.fn())
const mockInvalidateApiCacheByPrefix = vi.hoisted(() => vi.fn())
const mockShowToast = vi.hoisted(() => vi.fn())
const mockConfirmDialog = vi.hoisted(() => vi.fn())
const mockPromptDialog = vi.hoisted(() => vi.fn())

vi.mock('../../src/lib/apiClient', () => ({
  apiGet: mockApiGet,
  apiDelete: mockApiDelete,
  apiPost: mockApiPost,
  apiPatch: mockApiPatch,
  invalidateApiCacheByPrefix: mockInvalidateApiCacheByPrefix,
}))

vi.mock('../../src/components/Toast', () => ({
  useToast: () => ({
    show: mockShowToast,
  }),
}))

vi.mock('../../src/components/Dialog', () => ({
  useDialog: () => ({
    confirm: mockConfirmDialog,
    prompt: mockPromptDialog,
  }),
}))

vi.mock('../../src/components/SmartImage', () => ({
  SmartImage: (props: { alt?: string; className?: string; src?: string }) => (
    <img alt={props.alt || ''} className={props.className} src={props.src || ''} />
  ),
}))

describe('AdminListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfirmDialog.mockResolvedValue(true)
    mockPromptDialog.mockResolvedValue('')

    mockApiGet.mockResolvedValue({
      data: [
        {
          id: 'discussion',
          name: '讨论区',
          description: '测试版块',
          order: 1,
          createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
          updatedAt: new Date('2024-01-02T00:00:00.000Z').toISOString(),
        },
      ],
    })
    mockApiDelete.mockResolvedValue({ success: true })
  })

  it('删除版块时应调用后台软删除接口', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AdminListPage type="sections" />
      </MemoryRouter>
    )

    expect(await screen.findByText('测试版块')).toBeInTheDocument()

    const deleteButton = screen.getByTitle('删除')
    await user.click(deleteButton)

    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith('/api/admin/sections/discussion')
    })
  })

  it('批量更新音乐展示后应先失效列表缓存再重新获取', async () => {
    const user = userEvent.setup()
    mockApiGet.mockResolvedValue({
      data: [
        {
          docId: 'song-doc-1',
          id: 'song-1',
          title: '测试歌曲',
          artist: '测试歌手',
          displayAlbumMode: 'none',
          createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
          updatedAt: new Date('2024-01-02T00:00:00.000Z').toISOString(),
        },
      ],
    })
    mockApiPatch.mockResolvedValue({ success: true, updated: 1 })

    render(
      <MemoryRouter>
        <AdminListPage type="music" />
      </MemoryRouter>
    )

    expect(await screen.findByText('测试歌曲')).toBeInTheDocument()

    await user.click(screen.getByLabelText('选择 测试歌曲'))
    await user.click(screen.getByRole('button', { name: '批量更新展示' }))
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith('/api/admin/music/batch-display', {
        songDocIds: ['song-doc-1'],
        displayAlbumMode: 'linked',
        manualAlbumName: null,
        displayAlbumDocId: null,
      })
    })
    expect(mockInvalidateApiCacheByPrefix).toHaveBeenCalledWith('/api/admin/music')
    expect(mockInvalidateApiCacheByPrefix.mock.invocationCallOrder[0]).toBeLessThan(
      mockApiGet.mock.invocationCallOrder[1]
    )
  })
})
