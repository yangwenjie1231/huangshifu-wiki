import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserPreferences, ViewMode, ThemeMode, DEFAULT_PREFERENCES } from '../types/userPreferences';
import { apiGet, apiPatch } from '../lib/apiClient';
import { useAuth } from './AuthContext';
import type { AuthMeResponse } from '../types/api';
import {
  applyResolvedTheme,
  hasStoredPreferenceValues,
  mergeStoredPreferences,
  normalizeStoredPreferences,
  readStoredPreferences,
  resolveThemeMode,
  writeStoredPreferences,
  type ResolvedTheme,
} from '../lib/theme';

interface UserPreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  setViewMode: (mode: ViewMode) => Promise<void>;
  setTheme: (mode: ThemeMode) => Promise<void>;
  resolvedTheme: ResolvedTheme;
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
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('default');
  const [loading, setLoading] = useState(true);

  const applyPreferences = useCallback((nextPreferences: UserPreferences) => {
    setPreferences(nextPreferences)
    writeStoredPreferences(nextPreferences, user?.uid)
    const resolved = resolveThemeMode(nextPreferences.theme)
    setResolvedTheme(resolved)
    applyResolvedTheme(resolved)
  }, [user?.uid])

  useEffect(() => {
    const loadPreferences = async () => {
      if (!authLoading) {
        if (user) {
          try {
            const userData = await fetchUserPreferencesFromAPI();
            const storedPreferences = readStoredPreferences(user.uid, {
              includeLegacyFallback: true,
            })

            if (hasStoredPreferenceValues(userData?.preferences)) {
              applyPreferences(
                mergeStoredPreferences(
                  storedPreferences,
                  userData.preferences as Partial<UserPreferences>
                )
              )
            } else {
              applyPreferences(storedPreferences)
            }
          } catch (error) {
            console.error('Failed to load user preferences from API:', error);
            applyPreferences(readStoredPreferences(user.uid, { includeLegacyFallback: true }))
          }
        } else {
          applyPreferences(readStoredPreferences())
        }
        setLoading(false);
      }
    };

    loadPreferences();
  }, [applyPreferences, user, authLoading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (preferences.theme === 'system') {
        const resolved = resolveThemeMode('system');
        setResolvedTheme(resolved);
        applyResolvedTheme(resolved);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [preferences.theme]);

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
    const newPrefs = normalizeStoredPreferences({
      ...preferences,
      ...updates,
    });
    applyPreferences(newPrefs)

    if (user) {
      try {
        await apiPatch('/api/users/me', { preferences: updates });
      } catch (error) {
        console.error('Failed to sync preferences to server:', error);
      }
    }
  }, [applyPreferences, preferences, user]);

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
