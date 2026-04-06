export type ThemeName = 'default' | 'academy';

export const THEME_STORAGE_KEY = 'huangshifu.theme';
export const THEME_PARAM = 'theme';
export const THEME_VALUES: ThemeName[] = ['default', 'academy'];

export function isThemeName(value: string | null | undefined): value is ThemeName {
  return value === 'default' || value === 'academy';
}

export function getThemeFromSearch(search: string): ThemeName | null {
  const params = new URLSearchParams(search);
  const theme = params.get(THEME_PARAM);
  return isThemeName(theme) ? theme : null;
}

export function getStoredTheme(storage: Pick<Storage, 'getItem'>): ThemeName | null {
  try {
    const raw = storage.getItem(THEME_STORAGE_KEY);
    return isThemeName(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function resolveTheme(search: string, storage: Pick<Storage, 'getItem'>): ThemeName {
  return getThemeFromSearch(search) || getStoredTheme(storage) || 'default';
}

export function createThemeSearchParams(search: string, theme: ThemeName) {
  const params = new URLSearchParams(search);
  params.set(THEME_PARAM, theme);
  return params;
}

export function withThemeSearch(path: string, theme: ThemeName) {
  if (theme !== 'academy') return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${THEME_PARAM}=academy`;
}

export function writeThemeStorage(storage: Pick<Storage, 'setItem'>, theme: ThemeName) {
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures; theme still applies in-memory.
  }
}

export function applyThemeToDocument(theme: ThemeName) {
  if (typeof document === 'undefined') return;

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === 'academy' ? 'light' : 'light';
}

export function setThemeMetaColor(theme: ThemeName) {
  if (typeof document === 'undefined') return;

  const color = theme === 'academy' ? '#F5F1E8' : '#FFD700';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', color);
  }
}

export function getThemeDisplayName(theme: ThemeName) {
  return theme === 'academy' ? '从前书院' : '诗扶小筑';
}
