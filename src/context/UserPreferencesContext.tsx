import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserPreferences, ViewMode, DEFAULT_PREFERENCES } from '../types/userPreferences';
import { apiGet, apiPatch } from '../lib/apiClient';
import { useAuth } from './AuthContext';
import type { AuthMeResponse } from '../types/api';

const STORAGE_KEY = 'user_preferences';

interface UserPreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  setViewMode: (mode: ViewMode) => Promise<void>;
  loading: boolean;
}

const UserPreferencesContext = createContext<UserPreferencesContextType>({
  preferences: DEFAULT_PREFERENCES,
  updatePreferences: async () => {},
  setViewMode: async () => {},
  loading: true,
});

export const UserPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPreferences = async () => {
      if (!authLoading) {
        if (user) {
          try {
            const userData = await fetchUserPreferencesFromAPI();
            if (userData?.preferences) {
              setPreferences({
                ...DEFAULT_PREFERENCES,
                ...(userData.preferences as Partial<UserPreferences>),
              });
            }
          } catch (error) {
            console.error('Failed to load user preferences from API:', error);
            const localPrefs = loadFromLocalStorage();
            setPreferences(localPrefs);
          }
        } else {
          const localPrefs = loadFromLocalStorage();
          setPreferences(localPrefs);
        }
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user, authLoading]);

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

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        updatePreferences,
        setViewMode,
        loading,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
};

export const useUserPreferences = () => useContext(UserPreferencesContext);
