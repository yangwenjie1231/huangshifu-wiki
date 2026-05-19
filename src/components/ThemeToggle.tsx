import { Sun, Moon, Monitor } from 'lucide-react';
import { useUserPreferences } from '../context/UserPreferencesContext';
import type { ThemeMode } from '../types/userPreferences';

const THEME_CYCLE: ThemeMode[] = ['default', 'dark', 'system'];

const THEME_LABELS: Record<ThemeMode, string> = {
  default: '浅色模式',
  dark: '深色模式',
  system: '跟随系统',
};

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  default: Sun,
  dark: Moon,
  system: Monitor,
};

export function ThemeToggle() {
  const { preferences, setTheme } = useUserPreferences();
  const currentTheme = preferences.theme ?? 'system';
  const Icon = THEME_ICONS[currentTheme];

  const handleToggle = () => {
    const currentIndex = THEME_CYCLE.indexOf(currentTheme);
    const nextTheme = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
    setTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="p-2 text-text-muted hover:text-brand-gold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 rounded"
      aria-label={THEME_LABELS[currentTheme]}
      title={THEME_LABELS[currentTheme]}
    >
      <Icon size={18} />
    </button>
  );
}
