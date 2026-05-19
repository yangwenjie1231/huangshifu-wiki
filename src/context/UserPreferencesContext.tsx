import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserPreferences, ViewMode, ThemeMode, DEFAULT_PREFERENCES } from '../types/userPreferences';
import { apiGet, apiPatch } from '../lib/apiClient';
import { useAuth } from './AuthContext';
import type { AuthMeResponse } from '../types/api';

const STORAGE_KEY = 'user_preferences';

function getSystemTheme(): 'default' | 'dark' {
  if (typeof window === 'undefined') return 'default';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
}

function resolveTheme(mode: ThemeMode): 'default' | 'dark' {
  if (mode === 'system') return getSystemTheme();
  return mode;
}

function applyTheme(resolved: 'default' | 'dark'): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
}

interface UserPreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  setViewMode: (mode: ViewMode) => Promise<void>;
  setTheme: (mode: ThemeMode) => Promise<void>;
  resolvedTheme: 'default' | 'dark';
  loading: boolean;
}

const UserPreferencesContext = createContext<UserPreferencesContextType>({
  preferences: DEFAULT_PREFERENCES,
  updatePreferences: async () => {},
  setViewMode: async () => {},
  setTheme: async () => {},
  resolvedTheme: 'default',
  loading: true,
});

export const UserPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [resolvedTheme, setResolvedTheme] = useState<'default' | 'dark'>('default');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPreferences = async () => {
      if (!authLoading) {
        if (user) {
          try {
            const userData = await fetchUserPreferencesFromAPI();
            if (userData?.preferences) {
              const prefs = {
                ...DEFAULT_PREFERENCES,
                ...(userData.preferences as Partial<UserPreferences>),
              };
              setPreferences(prefs);
              const resolved = resolveTheme(prefs.theme);
              setResolvedTheme(resolved);
              applyTheme(resolved);
            }
          } catch (error) {
            console.error('Failed to load user preferences from API:', error);
            const localPrefs = loadFromLocalStorage();
            setPreferences(localPrefs);
            const resolved = resolveTheme(localPrefs.theme);
            setResolvedTheme(resolved);
            applyTheme(resolved);
          }
        } else {
          const localPrefs = loadFromLocalStorage();
          setPreferences(localPrefs);
          const resolved = resolveTheme(localPrefs.theme);
          setResolvedTheme(resolved);
          applyTheme(resolved);
        }
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user, authLoading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (preferences.theme === 'system') {
        const resolved = getSystemTheme();
        setResolvedTheme(resolved);
        applyTheme(resolved);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [preferences.theme]);

  const loadFromLocalStorage = (): UserPreferences => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load preferences from localStorage:', error);
    }
    return DEFAULT_PREFERENCES;
  };

  const saveToLocalStorage = (prefs: UserPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (error) {
      console.error('Failed to save preferences to localStorage:', error);
    }
  };

  const fetchUserPreferencesFromAPI = async (): Promise<{ preferences?: Record<string, unknown> } | null> => {
    try {
      const data = await apiGet<AuthMeResponse>('/api/users/me');
      return data.user;
    } catch (error) {
      console.error('Failed to fetch user preferences from API:', error);
      return null;
    }
  };

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    const newPrefs = { ...preferences, ...updates };
    setPreferences(newPrefs);
    saveToLocalStorage(newPrefs);

    if (updates.theme !== undefined) {
      const resolved = resolveTheme(updates.theme);
      setResolvedTheme(resolved);
      applyTheme(resolved);
    }

    if (user) {
      try {
        await apiPatch('/api/users/me', { preferences: updates });
      } catch (error) {
        console.error('Failed to sync preferences to server:', error);
      }
    }
  }, [preferences, user]);

  const setViewMode = useCallback((mode: ViewMode) => {
    return updatePreferences({ viewMode: mode });
  }, [updatePreferences]);

  const setTheme = useCallback((mode: ThemeMode) => {
    return updatePreferences({ theme: mode });
  }, [updatePreferences]);

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        updatePreferences,
        setViewMode,
        setTheme,
        resolvedTheme,
        loading,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
};

export const useUserPreferences = () => useContext(UserPreferencesContext);
