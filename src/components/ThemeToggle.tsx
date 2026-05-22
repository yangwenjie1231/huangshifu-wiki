import { Sun, Moon, Monitor } from 'lucide-react';
import { clsx } from 'clsx';
import { useUserPreferences } from '../context/UserPreferencesContext';
import type { ThemeMode } from '../types/userPreferences';

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

const THEME_OPTIONS: ThemeMode[] = ['default', 'dark', 'system'];

interface ThemeToggleProps {
  fullWidth?: boolean
}

export function ThemeToggle({ fullWidth = false }: ThemeToggleProps) {
  const { preferences, setTheme, resolvedTheme } = useUserPreferences();
  const currentTheme = preferences.theme ?? 'system';

  return (
    <div
      className={clsx(
        'inline-flex items-center rounded-lg border border-border bg-surface-alt p-1',
        fullWidth && 'flex w-full'
      )}
      role="group"
      aria-label="颜色模式"
    >
      {THEME_OPTIONS.map((mode) => {
        const Icon = THEME_ICONS[mode]
        const isActive = currentTheme === mode
        const resolvedLabel =
          mode === 'system' ? `${THEME_LABELS[mode]}（当前${resolvedTheme === 'dark' ? '深色' : '浅色'}）` : THEME_LABELS[mode]

        return (
          <button
            key={mode}
            type="button"
            onClick={() => void setTheme(mode)}
            className={clsx(
              'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 cursor-pointer',
              fullWidth && 'flex-1',
              isActive
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-muted hover:text-brand-gold'
            )}
            aria-pressed={isActive}
            aria-label={resolvedLabel}
            title={resolvedLabel}
          >
            <Icon size={16} />
            <span>{mode === 'default' ? '浅色' : mode === 'dark' ? '深色' : '系统'}</span>
          </button>
        )
      })}
    </div>
  );
}
