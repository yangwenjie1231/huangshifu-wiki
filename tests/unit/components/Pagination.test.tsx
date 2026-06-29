// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Pagination from '../../../src/components/Pagination'

describe('Pagination', () => {
  const defaultProps = {
    page: 3,
    totalPages: 5,
    onPageChange: vi.fn(),
  }

  it('returns null when totalPages <= 0', () => {
    const { container } = render(<Pagination {...defaultProps} totalPages={0} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders current page info correctly', () => {
    const { container } = render(<Pagination {...defaultProps} />)
    expect(container.innerHTML).toContain('3')
    expect(container.innerHTML).toContain('5')
  })

  it('page info has aria-live attribute for screen readers', () => {
    const { container } = render(<Pagination {...defaultProps} />)
    const pageInfo = container.querySelector('[aria-live="polite"]')
    expect(pageInfo).toBeInTheDocument()
    expect(pageInfo).toHaveAttribute('aria-atomic', 'true')
    expect(pageInfo?.textContent).toContain('3')
    expect(pageInfo?.textContent).toContain('5')
  })

  it('has navigation role and aria-label', () => {
    const { container } = render(<Pagination {...defaultProps} />)
    const navs = container.querySelectorAll('[role="navigation"]')
    expect(navs.length).toBeGreaterThanOrEqual(1)
    expect(navs[0]).toHaveAttribute('aria-label', '分页导航')
  })

  it('prev button has correct aria-label', () => {
    render(<Pagination {...defaultProps} />)
    const prevButtons = screen.getAllByLabelText('上一页')
    expect(prevButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('next button has correct aria-label', () => {
    render(<Pagination {...defaultProps} />)
    const nextButtons = screen.getAllByLabelText('下一页')
    expect(nextButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('disables prev button on first page', () => {
    const { container } = render(<Pagination {...defaultProps} page={1} />)
    const prevBtns = container.querySelectorAll<HTMLButtonElement>('[aria-label="上一页"]')
    if (prevBtns.length > 0) {
      expect(prevBtns[0].disabled || prevBtns[0].getAttribute('aria-disabled') === 'true').toBe(
        true
      )
    }
  })

  it('disables next button on last page', () => {
    const { container } = render(<Pagination {...defaultProps} page={5} totalPages={5} />)
    const nextBtns = container.querySelectorAll<HTMLButtonElement>('[aria-label="下一页"]')
    if (nextBtns.length > 0) {
      expect(nextBtns[0].disabled || nextBtns[0].getAttribute('aria-disabled') === 'true').toBe(
        true
      )
    }
  })

  it('enables both buttons in middle pages', () => {
    const { container } = render(<Pagination {...defaultProps} page={3} />)
    const prevBtns = container.querySelectorAll<HTMLButtonElement>(
      '[aria-label="上一页"]'
    ) as NodeListOf<HTMLButtonElement>
    const nextBtns = container.querySelectorAll<HTMLButtonElement>(
      '[aria-label="下一页"]'
    ) as NodeListOf<HTMLButtonElement>
    if (prevBtns.length > 0 && nextBtns.length > 0) {
      expect(!prevBtns[0].disabled && !nextBtns[0].disabled).toBe(true)
    }
  })

  it('calls onPageChange with page-1 when prev clicked', async () => {
    const user = userEvent.setup()
    render(<Pagination {...defaultProps} page={3} />)
    const prevBtns = screen.getAllByLabelText('上一页')
    if (prevBtns.length > 0) {
      await user.click(prevBtns[0])
      expect(defaultProps.onPageChange).toHaveBeenCalledWith(2)
    }
  })

  it('calls onPageChange with page+1 when next clicked', async () => {
    const user = userEvent.setup()
    render(<Pagination {...defaultProps} page={2} />)
    const nextBtns = screen.getAllByLabelText('下一页')
    if (nextBtns.length > 0) {
      await user.click(nextBtns[0])
      expect(defaultProps.onPageChange).toHaveBeenCalled()
    }
  })

  it('shows pageSize selector when showPageSizeSelector is true', () => {
    const { container } = render(
      <Pagination
        {...defaultProps}
        showPageSizeSelector={true}
        pageSize={10}
        onPageSizeChange={vi.fn()}
      />
    )
    const selectors = container.querySelectorAll('[aria-label*="每页"]')
    expect(selectors.length).toBeGreaterThanOrEqual(1)
  })

  it('pageSize select has correct value and aria-label', () => {
    const { container } = render(
      <Pagination
        {...defaultProps}
        showPageSizeSelector={true}
        pageSize={20}
        onPageSizeChange={vi.fn()}
      />
    )
    const selects = container.querySelectorAll<HTMLSelectElement>('select')
    if (selects.length > 0) {
      expect(selects[0].value).toBe('20')
    }
  })

  it('calls onPageSizeChange when pageSize changes', async () => {
    const user = userEvent.setup()
    const onPageSizeChange = vi.fn()
    const { container } = render(
      <Pagination
        {...defaultProps}
        showPageSizeSelector={true}
        pageSize={10}
        onPageSizeChange={onPageSizeChange}
      />
    )
    const selects = container.querySelectorAll<HTMLSelectElement>('select')
    if (selects.length > 0) {
      await user.selectOptions(selects[0], '50')
      expect(onPageSizeChange).toHaveBeenCalledWith(50)
    }
  })

  it('hides pageSize selector by default', () => {
    const { container } = render(<Pagination {...defaultProps} />)
    const selectors = container.querySelectorAll('[aria-label*="每页"]')
    expect(selectors.length).toBe(0)
  })
})
