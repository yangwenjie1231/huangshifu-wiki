// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AdminSettings from '../../src/pages/Admin/AdminSettings'

const { mockApiRequest, mockApiPatch, mockClearApiCache, mockGenerateApiCacheKey, mockShow } =
  vi.hoisted(() => ({
    mockApiRequest: vi.fn(),
    mockApiPatch: vi.fn(),
    mockClearApiCache: vi.fn(),
    mockGenerateApiCacheKey: vi.fn((method: string, path: string) => `${method}|${path}|`),
    mockShow: vi.fn(),
  }))

vi.mock('../../src/lib/apiClient', () => ({
  apiRequest: mockApiRequest,
  apiPatch: mockApiPatch,
  clearApiCache: mockClearApiCache,
  generateApiCacheKey: mockGenerateApiCacheKey,
}))

vi.mock('../../src/components/Toast', () => ({
  useToast: () => ({
    show: mockShow,
  }),
}))

describe('AdminSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('does not render a savable form when mail service config fails to load', async () => {
    mockApiRequest
      .mockRejectedValueOnce(new Error('network failed'))
      .mockResolvedValueOnce({ enabled: true })

    render(<AdminSettings />)

    expect(
      await screen.findByText('邮件服务配置加载失败，未加载成功前无法保存设置。')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
    expect(await screen.findByRole('switch', { name: '开放账号注册' })).toBeInTheDocument()
    expect(mockApiPatch).not.toHaveBeenCalled()
  })

  it('saves registration config independently from mail service config', async () => {
    const user = userEvent.setup()
    mockApiRequest
      .mockRejectedValueOnce(new Error('mail failed'))
      .mockResolvedValueOnce({ enabled: true })
    mockApiPatch.mockResolvedValueOnce({
      success: true,
      config: { enabled: false },
    })

    render(<AdminSettings />)

    const switchButton = await screen.findByRole('switch', { name: '开放账号注册' })
    expect(switchButton).toHaveAttribute('aria-checked', 'true')

    await user.click(switchButton)
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(mockApiPatch).toHaveBeenCalledWith('/api/config/registration', {
      enabled: false,
    })
    expect(mockClearApiCache).toHaveBeenCalledWith('GET|/api/config/registration/admin|')
    expect(mockShow).toHaveBeenCalledWith('注册设置已保存')
  })
})
