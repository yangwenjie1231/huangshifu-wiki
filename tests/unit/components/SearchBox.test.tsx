// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBox } from '../../../src/components/search/SearchBox';

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
      <div {...props}>{children}</div>,
    svg: (props: Record<string, unknown>) => <svg {...props} />,
  },
}));

const mockSuggestions = [
  { text: '测试搜索', type: 'keyword' as const, id: null, subtext: null },
  { text: '百科页面', type: 'wiki' as const, id: 'wiki-1', subtext: '百科描述' },
  { text: '音乐专辑', type: 'music' as const, id: 'music-1', subtext: '音乐描述' },
];

describe('SearchBox', () => {
  const defaultProps = {
    query: '',
    suggestions: [] as typeof mockSuggestions,
    aiSearching: false,
    onQueryChange: vi.fn(),
    onSearch: vi.fn(),
    onImageSearch: vi.fn(),
    onDismissSuggestions: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input with correct placeholder', () => {
    render(<SearchBox {...defaultProps} />);
    expect(screen.getByPlaceholderText('搜索百科、帖子、图集、音乐或专辑...')).toBeInTheDocument();
  });

  it('has role=search on form element', () => {
    render(<SearchBox {...defaultProps} />);
    expect(screen.getByRole('search')).toBeInTheDocument();
  });

  it('has aria-label on search input', () => {
    render(<SearchBox {...defaultProps} />);
    expect(screen.getByLabelText('搜索百科、帖子、图集、音乐或专辑')).toBeInTheDocument();
  });

  it('calls onQueryChange when input value changes', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(<SearchBox {...defaultProps} onQueryChange={onQueryChange} />);

    const input = screen.getByRole('searchbox');
    await user.type(input, 'test');

    expect(onQueryChange).toHaveBeenCalledWith('test');
  });

  it('calls onSearch when form is submitted', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchBox {...defaultProps} query="test" onSearch={onSearch} />);

    const submitButton = screen.getByLabelText('提交搜索');
    await user.click(submitButton);

    expect(onSearch).toHaveBeenCalledWith('test');
  });

  it('renders AI image search button', () => {
    render(<SearchBox {...defaultProps} />);
    expect(screen.getByLabelText('AI 图片搜索')).toBeInTheDocument();
  });

  it('disables image search button when aiSearching is true', () => {
    render(<SearchBox {...defaultProps} aiSearching={true} />);
    const imageButton = screen.getByLabelText('AI 图片搜索');
    expect(imageButton).toBeDisabled();
  });

  it('calls onImageSearch when file is selected', async () => {
    const user = userEvent.setup();
    const onImageSearch = vi.fn();
    render(<SearchBox {...defaultProps} onImageSearch={onImageSearch} />);

    const fileInput = screen.getByLabelText('AI 图片搜索').previousElementSibling as HTMLInputElement;
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file] });

    await user.upload(fileInput, file);

    expect(onImageSearch).toHaveBeenCalledWith(file);
  });

  it('renders suggestions list when suggestions are provided', () => {
    render(<SearchBox {...defaultProps} suggestions={mockSuggestions} />);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('displays suggestion items with correct text', () => {
    render(<SearchBox {...defaultProps} suggestions={mockSuggestions} />);
    expect(screen.getByText('测试搜索')).toBeInTheDocument();
    expect(screen.getByText('百科页面')).toBeInTheDocument();
    expect(screen.getByText('音乐专辑')).toBeInTheDocument();
  });

  it('shows suggestion type labels', () => {
    render(<SearchBox {...defaultProps} suggestions={mockSuggestions} />);
    expect(screen.getByText('搜索')).toBeInTheDocument();
    expect(screen.getByText('百科')).toBeInTheDocument();
    expect(screen.getByText('音乐')).toBeInTheDocument();
  });

  it('has aria-expanded=true when suggestions exist', () => {
    render(<SearchBox {...defaultProps} suggestions={mockSuggestions} />);
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('has aria-expanded=false when no suggestions', () => {
    render(<SearchBox {...defaultProps} />);
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('has aria-owns pointing to suggestions listbox', () => {
    render(<SearchBox {...defaultProps} suggestions={mockSuggestions} />);
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('aria-owns', 'search-suggestions');
  });

  it('calls onDismissSuggestions when clicking outside', async () => {
    const user = userEvent.setup();
    const onDismissSuggestions = vi.fn();
    render(
      <div>
        <SearchBox {...defaultProps} suggestions={mockSuggestions} onDismissSuggestions={onDismissSuggestions} />
        <div data-testid="outside">Outside</div>
      </div>
    );

    await user.click(screen.getByTestId('outside'));
    expect(onDismissSuggestions).toHaveBeenCalled();
  });

  it('handles keyboard navigation - ArrowDown highlights next item', async () => {
    const user = userEvent.setup();
    render(<SearchBox {...defaultProps} suggestions={mockSuggestions} />);

    const input = screen.getByRole('searchbox');
    await user.click(input);
    await user.keyboard('{ArrowDown}');

    const firstOption = screen.getAllByRole('option')[0];
    expect(firstOption).toHaveAttribute('aria-selected', 'true');
  });

  it('handles keyboard navigation - Enter selects highlighted item', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchBox {...defaultProps} suggestions={mockSuggestions} onSearch={onSearch} />);

    const input = screen.getByRole('searchbox');
    await user.click(input);
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(onSearch).toHaveBeenCalledWith('测试搜索');
  });

  it('handles keyboard navigation - Escape dismisses suggestions', async () => {
    const user = userEvent.setup();
    const onDismissSuggestions = vi.fn();
    render(<SearchBox {...defaultProps} suggestions={mockSuggestions} onDismissSuggestions={onDismissSuggestions} />);

    const input = screen.getByRole('searchbox');
    await user.click(input);
    await user.keyboard('{Escape}');

    expect(onDismissSuggestions).toHaveBeenCalled();
  });
});
