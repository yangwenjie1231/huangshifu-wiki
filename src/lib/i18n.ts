import { useTheme } from '../context/ThemeContext';
import defaultLocale from '../locales/default.json';
import academyLocale from '../locales/academy.json';

type Locale = typeof defaultLocale;

const locales: Record<string, Locale> = {
  default: defaultLocale,
  academy: academyLocale,
};

function getNestedValue(obj: any, keyPath: string): string {
  return keyPath.split('.').reduce((acc, key) => acc?.[key], obj) || keyPath;
}

function replaceParams(text: string, params: Record<string, any>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    return params[key.trim()] || match;
  });
}

export function useI18n() {
  const { theme } = useTheme();
  
  const t = (key: string, params?: Record<string, any>): string => {
    const locale = locales[theme] || defaultLocale;
    const text = getNestedValue(locale, key);
    return params ? replaceParams(text, params) : text;
  };
  
  return { t, theme };
}

export function getI18n(theme: string) {
  const locale = locales[theme] || defaultLocale;
  
  const t = (key: string, params?: Record<string, any>): string => {
    const text = getNestedValue(locale, key);
    return params ? replaceParams(text, params) : text;
  };
  
  return { t };
}