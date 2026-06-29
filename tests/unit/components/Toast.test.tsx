// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent, within } from '@testing-library/react'
import { ToastProvider, useToast } from '../../../src/components/Toast'

function TestComponent({ message = '测试消息' }: { message?: string }) {
  const toast = useToast()
  return (
    <button onClick={() => toast.show(message)} data-testid="toast-trigger">
      显示提示
    </button>
  )
}

describe('Toast', () => {
  let container: HTMLElement

  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.removeChild(container)
  })

  const renderToast = (ui: React.ReactElement) => {
    return render(ui, { container })
  }

  it('does not show toast initially', () => {
    const { unmount } = renderToast(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    expect(within(container).queryByRole('status')).not.toBeInTheDocument()
    unmount()
  })

  it('shows toast message after calling show()', () => {
    const { unmount } = renderToast(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(within(container).getByTestId('toast-trigger'))
    expect(within(container).getByRole('status')).toBeInTheDocument()
    expect(within(container).getByText('测试消息')).toBeInTheDocument()
    unmount()
  })

  it('toast has role="status" and aria-live="polite"', () => {
    const { unmount } = renderToast(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(within(container).getByTestId('toast-trigger'))
    const statusEl = within(container).getByRole('status')
    expect(statusEl).toBeInTheDocument()
    expect(statusEl).toHaveAttribute('aria-live', 'polite')
    unmount()
  })

  it('displays success variant with brand color styling', () => {
    const { unmount } = renderToast(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(within(container).getByTestId('toast-trigger'))
    const toastBox = within(container).getByRole('status')
    expect(toastBox.className).toContain('border-brand-gold/40')
    expect(toastBox.className).not.toContain('red')
    unmount()
  })

  it('displays error variant with red styling', () => {
    function ErrorTest() {
      const toast = useToast()
      return (
        <button
          onClick={() => toast.show('出错了', { variant: 'error' })}
          data-testid="error-trigger"
        >
          错误
        </button>
      )
    }

    const { unmount } = renderToast(
      <ToastProvider>
        <ErrorTest />
      </ToastProvider>
    )

    fireEvent.click(within(container).getByTestId('error-trigger'))
    const toastBox = within(container).getByRole('status')
    expect(toastBox.className).toContain('theme-status-error')
    unmount()
  })

  it('shows the exact message text', () => {
    function CustomMsg() {
      const toast = useToast()
      return (
        <button onClick={() => toast.show('自定义消息内容')} data-testid="custom-trigger">
          自定义
        </button>
      )
    }

    const { unmount } = renderToast(
      <ToastProvider>
        <CustomMsg />
      </ToastProvider>
    )

    fireEvent.click(within(container).getByTestId('custom-trigger'))
    expect(within(container).getByText('自定义消息内容')).toBeInTheDocument()
    unmount()
  })

  it('indicator dot has aria-hidden="true"', () => {
    const { unmount } = renderToast(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(within(container).getByTestId('toast-trigger'))
    const dot = within(container).getByRole('status').querySelector('[aria-hidden="true"]')
    expect(dot).toBeInTheDocument()
    unmount()
  })

  it('auto-dismisses after duration', () => {
    const { unmount } = renderToast(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(within(container).getByTestId('toast-trigger'))
    expect(within(container).getByRole('status')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2100)
    })

    expect(within(container).queryByRole('status')).not.toBeInTheDocument()
    unmount()
  })

  it('replaces previous toast when new one shown', () => {
    function MultiToast() {
      const toast = useToast()
      return (
        <>
          <button onClick={() => toast.show('第一条')} data-testid="first">
            第一条
          </button>
          <button onClick={() => toast.show('第二条')} data-testid="second">
            第二条
          </button>
        </>
      )
    }

    const { unmount } = renderToast(
      <ToastProvider>
        <MultiToast />
      </ToastProvider>
    )

    fireEvent.click(within(container).getByTestId('first'))

    // 检查 Toast 区域内显示"第一条"
    const statusEl = within(container).getByRole('status')
    expect(statusEl.textContent).toContain('第一条')

    fireEvent.click(within(container).getByTestId('second'))

    // 替换后应显示"第二条"，且不再有"第一条"
    expect(statusEl.textContent).toContain('第二条')
    expect(statusEl.textContent).not.toContain('第一条')
    unmount()
  })
})
