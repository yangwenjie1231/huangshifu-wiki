// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RouteGuard } from '../../src/components/RouteGuard'

type MockAuthState = {
  user: { uid: string } | null
  isAdmin: boolean
  isBanned: boolean
  loading: boolean
  ensureInitialized: () => Promise<void>
}

const mockAuthState = vi.hoisted<MockAuthState>(() => ({
  user: null,
  isAdmin: false,
  isBanned: false,
  loading: false,
  ensureInitialized: vi.fn(async () => {}),
}))

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}))

describe('RouteGuard', () => {
  it('shows forbidden fallback for banned admins without redirecting to login', () => {
    mockAuthState.user = { uid: 'admin-1' }
    mockAuthState.isAdmin = true
    mockAuthState.isBanned = true
    mockAuthState.loading = false

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <RouteGuard requireAdmin>
                <div>管理后台</div>
              </RouteGuard>
            }
          />
          <Route path="/login" element={<div>登录页面</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('访问受限')).toBeInTheDocument()
    expect(screen.queryByText('管理后台')).not.toBeInTheDocument()
    expect(screen.queryByText('登录页面')).not.toBeInTheDocument()
  })
})
