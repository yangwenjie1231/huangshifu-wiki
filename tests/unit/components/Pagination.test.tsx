// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from '../../../src/components/Pagination';

describe('Pagination', () => {
  const defaultProps = {
    page: 3,
    totalPages: 5,
    onPageChange: vi.fn(),
  };

  it('returns null when totalPages <= 0', () => {
    const { container } = render(<Pagination {...defaultProps} totalPages={0} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders current page info correctly', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByText(/3\s*\/\s*5/)).toBeInTheDocument();
  });

  it('page info has aria-live attribute for screen readers', () => {
    const { container } = render(<Pagination {...defaultProps} />);
    const pageInfo = container.querySelector('[aria-live="polite"]');
    expect(pageInfo).toBeInTheDocument();
    expect(pageInfo).toHaveAttribute('aria-atomic', 'true');
    expect(pageInfo?.textContent).toContain('3');
    expect(pageInfo?.textContent).toContain('5');
  });

  it('has navigation role and aria-label', () => {
    const { container } = render(<Pagination {...defaultProps} />);
    const nav = container.querySelector('[role="navigation"]');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveAttribute('aria-label', '分页导航');
  });

  it('prev button has correct aria-label', () => {
    render(<Pagination {...defaultProps} />);
    // 使用getAllBy并取第一个，避免多重匹配问题
    const prevButtons = screen.getAllByLabelText('上一页');
    expect(prevButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('next button has correct aria-label', () => {
    render(<Pagination {...defaultProps} />);
    const nextButtons = screen.getAllByLabelText('下一页');
    expect(nextButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('disables prev button on first page', () => {
    render(<Pagination {...defaultProps} page={1} />);
    const prevBtn = screen.getAllByLabelText('上一页')[0];
    expect(prevBtn).toBeDisabled();
    expect(prevBtn).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables next button on last page', () => {
    render(<Pagination {...defaultProps} page={5} totalPages={5} />);
    const nextBtn = screen.getAllByLabelText('下一页')[0];
    expect(nextBtn).toBeDisabled();
    expect(nextBtn).toHaveAttribute('aria-disabled', 'true');
  });

  it('enables both buttons in middle pages', () => {
    render(<Pagination {...defaultProps} page={3} totalPages={5} />);
    expect(screen.getAllByLabelText('上一页')[0]).not.toBeDisabled();
    expect(screen.getAllByLabelText('下一页')[0]).not.toBeDisabled();
  });

  it('calls onPageChange with page-1 when prev clicked', async () => {
    const user = userEvent.setup();
    render(<Pagination {...defaultProps} page={3} />);
    await user.click(screen.getAllByLabelText('上一页')[0]);
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with page+1 when next clicked', async () => {
    const user = userEvent.setup();
    render(<Pagination {...defaultProps} page={2} />);
    await user.click(screen.getAllByLabelText('下一页')[0]);
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(3);
  });

  it('shows pageSize selector when showPageSizeSelector is true', () => {
    render(
      <Pagination
        {...defaultProps}
        showPageSizeSelector={true}
        pageSize={10}
        onPageSizeChange={vi.fn()}
      />
    );
    const selectors = screen.getAllByLabelText('每页显示条数');
    expect(selectors.length).toBeGreaterThanOrEqual(1);
  });

  it('pageSize select has correct value and aria-label', () => {
    render(
      <Pagination
        {...defaultProps}
        showPageSizeSelector={true}
        pageSize={20}
        onPageSizeChange={vi.fn()}
      />
    );
    const select = screen.getAllByLabelText('每页显示条数')[0];
    expect(select).toHaveValue('20');
  });

  it('calls onPageSizeChange when pageSize changes', async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        {...defaultProps}
        showPageSizeSelector={true}
        pageSize={10}
        onPageSizeChange={onPageSizeChange}
      />
    );
    await user.selectOptions(screen.getAllByLabelText('每页显示条数')[0], '50');
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('hides pageSize selector by default', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.queryAllByLabelText('每页显示条数').length).toBe(0);
  });
});
