// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navbar } from '../../../src/components/Navbar';

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
      <div {...props}>{children}</div>,
    svg: (props: Record<string, unknown>) => <svg {...props} />,
  },
}));

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    isAdmin: false,
    isBanned: false,
  }),
}));

vi.mock('../../../src/lib/auth', () => ({
  logoutRequest: vi.fn(),
}));

vi.mock('../../../src/components/Toast', () => ({
  useToast: () => ({ show: vi.fn() }),
}));

vi.mock('../../../src/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../src/lib/defaultAvatar', () => ({
  DEFAULT_AVATAR: '/default-avatar.jpg',
  handleAvatarError: vi.fn(),
}));

vi.mock('../../../src/components/Navbar/AuthModal', () => ({
  AuthModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="auth-modal">Auth Modal</div> : null,
}));

vi.mock('../../../src/components/Navbar/NotificationPanel', () => ({
  NotificationPanel: () => <div data-testid="notification-panel" />,
}));

vi.mock('../../../src/components/Navbar/MobileMenu', () => ({
  MobileMenu: ({ open }: { open: boolean }) =>
    open ? <div data-testid="mobile-menu">Mobile Menu</div> : null,
}));

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders navigation with role=navigation', () => {
    render(<Navbar />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('has correct aria-label for navigation', () => {
    render(<Navbar />);
    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', '主导航');
  });

  it('renders site title "诗扶小筑"', () => {
    render(<Navbar />);
    expect(screen.getByText('诗扶小筑')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<Navbar />);
    expect(screen.getByText('nav.wiki')).toBeInTheDocument();
    expect(screen.getByText('nav.forum')).toBeInTheDocument();
    expect(screen.getByText('nav.gallery')).toBeInTheDocument();
    expect(screen.getByText('nav.music')).toBeInTheDocument();
    expect(screen.getByText('搜索')).toBeInTheDocument();
  });

  it('shows login and register buttons when not authenticated', () => {
    render(<Navbar />);
    expect(screen.getByText('注册')).toBeInTheDocument();
    expect(screen.getByText('登录')).toBeInTheDocument();
  });

  it('opens auth modal when login button is clicked', async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    const loginButton = screen.getByText('登录');
    await user.click(loginButton);

    expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
  });

  it('opens auth modal when register button is clicked', async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    const registerButton = screen.getByText('注册');
    await user.click(registerButton);

    expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
  });

  it('renders mobile menu toggle button', () => {
    render(<Navbar />);
    expect(screen.getByLabelText('打开菜单')).toBeInTheDocument();
  });

  it('toggles mobile menu state when toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    const toggleButton = screen.getByLabelText('打开菜单');
    await user.click(toggleButton);

    expect(screen.getByTestId('mobile-menu')).toBeInTheDocument();
    expect(screen.getByLabelText('关闭菜单')).toBeInTheDocument();
  });
});
