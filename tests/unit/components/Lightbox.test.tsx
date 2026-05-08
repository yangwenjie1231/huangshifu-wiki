// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Lightbox } from '../../../src/components/Lightbox';

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
      <div {...props}>{children}</div>,
    svg: (props: Record<string, unknown>) => <svg {...props} />,
  },
}));

const mockImages = [
  { id: '1', name: '图片1.jpg', url: '/img/1.jpg' },
  { id: '2', name: '图片2.jpg', url: '/img/2.jpg' },
  { id: '3', name: '图片3.jpg', url: '/img/3.jpg' },
];

describe('Lightbox', () => {
  it('does not render when images is empty', () => {
    const { container } = render(<Lightbox images={[]} initialIndex={0} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders dialog with role=dialog when open with images', () => {
    render(<Lightbox images={mockImages} initialIndex={0} onClose={vi.fn()} />);
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0]).toBeInTheDocument();
  });

  it('has aria-modal=true on dialog', () => {
    render(<Lightbox images={mockImages} initialIndex={0} onClose={vi.fn()} />);
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs[0]).toHaveAttribute('aria-modal', 'true');
  });

  it('shows image counter with role=status', () => {
    render(<Lightbox images={mockImages} initialIndex={0} onClose={vi.fn()} />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status.textContent).toContain('1 / 3');
  });

  it('image counter has aria-live=polite and aria-atomic=true', () => {
    render(<Lightbox images={mockImages} initialIndex={0} onClose={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
  });

  it('image counter updates when initialIndex changes', () => {
    const { rerender } = render(
      <Lightbox images={mockImages} initialIndex={0} onClose={vi.fn()} />
    );
    expect(screen.getByRole('status').textContent).toContain('1 / 3');

    rerender(<Lightbox images={mockImages} initialIndex={2} onClose={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toContain('3 / 3');
  });

  it('includes image position in dialog aria-label', () => {
    render(<Lightbox images={mockImages} initialIndex={1} onClose={vi.fn()} />);
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs[0].getAttribute('aria-label')).toContain('2 / 3');
  });

  it('calls onClose when close button clicked', async () => {
    const u = userEvent.setup();
    const onClose = vi.fn();
    render(<Lightbox images={mockImages} initialIndex={0} onClose={onClose} />);

    await u.click(screen.getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders prev and next navigation buttons for multiple images', () => {
    render(<Lightbox images={mockImages} initialIndex={1} onClose={vi.fn()} />);
    expect(screen.getByLabelText('上一张')).toBeInTheDocument();
    expect(screen.getByLabelText('下一张')).toBeInTheDocument();
  });

  it('backdrop has role=presentation', () => {
    render(<Lightbox images={mockImages} initialIndex={0} onClose={vi.fn()} />);
    expect(screen.getByRole('presentation')).toBeInTheDocument();
  });
});
