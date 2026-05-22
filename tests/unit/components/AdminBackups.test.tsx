// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import AdminBackups from '../../../src/pages/Admin/AdminBackups'

const mockApiGet = vi.hoisted(() => vi.fn())
const mockApiPost = vi.hoisted(() => vi.fn())
const mockApiUpload = vi.hoisted(() => vi.fn())
const mockGetXsrfToken = vi.hoisted(() => vi.fn())
const mockShow = vi.hoisted(() => vi.fn())
const mockFetch = vi.hoisted(() => vi.fn())

vi.mock('../../../src/lib/apiClient', () => ({
  apiGet: mockApiGet,
  apiPost: mockApiPost,
  apiUpload: mockApiUpload,
  getXsrfToken: mockGetXsrfToken,
}))

vi.mock('../../../src/components/Toast', () => ({
  useToast: () => ({
    show: mockShow,
  }),
}))

describe('AdminBackups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue('blob:test'),
      revokeObjectURL: vi.fn(),
    })
    mockGetXsrfToken.mockReturnValue('token')
    mockApiGet.mockResolvedValue({
      backups: [
        {
          filename: 'backup-1.zip',
          size: 1024,
          sizeFormatted: '1 KB',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    })
    mockFetch.mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['backup'])),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('opens download dialog instead of delete dialog when password is missing', async () => {
    render(<AdminBackups />)

    await waitFor(() => {
      expect(screen.getByText('backup-1.zip')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTitle('下载'))

    expect(screen.getByText('下载备份')).toBeInTheDocument()
    expect(screen.getByText('请输入备份密码后再下载备份文件。')).toBeInTheDocument()
    expect(screen.queryByText('删除备份')).not.toBeInTheDocument()
  })

  it('disables confirm download while the request is in flight', async () => {
    let resolveFetch: ((value: Response) => void) | null = null
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve as (value: Response) => void
      })
    )

    render(<AdminBackups />)

    await waitFor(() => {
      expect(screen.getByText('backup-1.zip')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTitle('下载'))
    fireEvent.change(screen.getByPlaceholderText('请输入备份密码'), {
      target: { value: 'secret' },
    })
    fireEvent.click(screen.getByText('确认下载'))

    await waitFor(() => {
      expect(screen.getByText('确认下载').closest('button')).toBeDisabled()
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)

    resolveFetch?.({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['backup'])),
    } as unknown as Response)

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith('下载完成', { variant: 'success' })
    })
  })

  it('does not close a newer dialog when an earlier download finishes', async () => {
    let resolveFetch: ((value: Response) => void) | null = null
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve as (value: Response) => void
      })
    )

    render(<AdminBackups />)

    await waitFor(() => {
      expect(screen.getByText('backup-1.zip')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTitle('下载'))
    fireEvent.change(screen.getByPlaceholderText('请输入备份密码'), {
      target: { value: 'secret' },
    })
    fireEvent.click(screen.getByText('确认下载'))

    await waitFor(() => {
      expect(screen.getByText('确认下载').closest('button')).toBeDisabled()
    })

    fireEvent.click(screen.getByText('取消'))
    fireEvent.click(screen.getByTitle('删除'))

    expect(screen.getByText('删除备份')).toBeInTheDocument()

    resolveFetch?.({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['backup'])),
    } as unknown as Response)

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith('下载完成', { variant: 'success' })
    })

    expect(screen.getByText('删除备份')).toBeInTheDocument()
  })
})
