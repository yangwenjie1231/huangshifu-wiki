import { describe, expect, it } from 'vitest';

import {
  createThemeSearchParams,
  getStoredTheme,
  getThemeFromSearch,
  isThemeName,
  resolveTheme,
  THEME_STORAGE_KEY,
} from '../../src/lib/theme';

describe('theme helpers', () => {
  it('recognizes valid themes only', () => {
    expect(isThemeName('default')).toBe(true);
    expect(isThemeName('academy')).toBe(true);
    expect(isThemeName('dark')).toBe(false);
    expect(isThemeName(null)).toBe(false);
  });

  it('reads theme from query string', () => {
    expect(getThemeFromSearch('?theme=academy')).toBe('academy');
    expect(getThemeFromSearch('?theme=default')).toBe('default');
    expect(getThemeFromSearch('?theme=unknown')).toBe(null);
  });

  it('falls back to storage then default', () => {
    const storage = {
      getItem: (key: string) => (key === THEME_STORAGE_KEY ? 'academy' : null),
    } as Pick<Storage, 'getItem'>;

    expect(getStoredTheme(storage)).toBe('academy');
    expect(resolveTheme('', storage)).toBe('academy');
    expect(resolveTheme('?theme=default', storage)).toBe('default');
  });

  it('builds theme search params without dropping existing ones', () => {
    const params = createThemeSearchParams('?page=2', 'academy');
    expect(params.get('page')).toBe('2');
    expect(params.get('theme')).toBe('academy');
  });
});
