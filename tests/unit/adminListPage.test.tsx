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
const mockShowToast = vi.hoisted(() => vi.fn())

vi.mock('../../src/lib/apiClient', () => ({
  apiGet: mockApiGet,
  apiDelete: mockApiDelete,
  apiPost: mockApiPost,
  apiPatch: mockApiPatch,
}))

vi.mock('../../src/components/Toast', () => ({
  useToast: () => ({
    show: mockShowToast,
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
    vi.stubGlobal('confirm', vi.fn(() => true))

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

  it('删除版块时应调用 /api/sections/:id', async () => {
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
      expect(mockApiDelete).toHaveBeenCalledWith('/api/sections/discussion')
    })
  })
})
