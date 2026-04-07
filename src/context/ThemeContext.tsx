import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  applyThemeToDocument,
  createThemeSearchParams,
  getThemeFromSearch,
  resolveTheme,
  ThemeName,
  writeThemeStorage,
} from '../lib/theme';

interface ThemeContextValue {
  theme: ThemeName;
  isAcademy: boolean;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'default',
  isAcademy: false,
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window === 'undefined') return 'default';
    return resolveTheme(window.location.search, window.localStorage);
  });

  useEffect(() => {
    const nextTheme = resolveTheme(location.search, window.localStorage);
    setThemeState((current) => (current === nextTheme ? current : nextTheme));

    return () => {
      // no-op
    };
  }, [location.search]);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const setTheme = (nextTheme: ThemeName) => {
    const nextSearch = createThemeSearchParams(location.search, nextTheme);
    navigate(
      { pathname: location.pathname, search: `?${nextSearch.toString()}`, hash: location.hash },
      { replace: true },
    );

    if (typeof window !== 'undefined') {
      writeThemeStorage(window.localStorage, nextTheme);
    }
    setThemeState(nextTheme);
  };

  const value = useMemo(
    () => ({
      theme,
      isAcademy: theme === 'academy',
      setTheme,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
