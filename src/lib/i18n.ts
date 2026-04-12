import { useTheme } from '../context/ThemeContext';
import defaultLocale from '../locales/default.json';
import academyLocale from '../locales/academy.json';

type Locale = typeof defaultLocale;

const locales: Record<string, Locale> = {
  default: defaultLocale,
  academy: academyLocale,
};

function getNestedValue(obj: Record<string, unknown>, keyPath: string): string {
  return keyPath.split('.').reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj) as string || keyPath;
}

function replaceParams(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    return String(params[key.trim()] ?? match);
  });
}

export function useI18n() {
  const { theme } = useTheme();
  
  const t = (key: string, params?: Record<string, string | number>): string => {
    const locale = locales[theme] || defaultLocale;
    const text = getNestedValue(locale as unknown as Record<string, unknown>, key);
    return params ? replaceParams(text, params) : text;
  };
  
  return { t, theme };
}

export function getI18n(theme: string) {
  const locale = locales[theme] || defaultLocale;
  
  const t = (key: string, params?: Record<string, string | number>): string => {
    const text = getNestedValue(locale as unknown as Record<string, unknown>, key);
    return params ? replaceParams(text, params) : text;
  };
  
  return { t };
}