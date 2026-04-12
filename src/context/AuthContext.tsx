import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, onAuthStateChanged, User } from '../lib/auth';
import { UserPreferencesProvider } from './UserPreferencesContext';
import { useTheme } from './ThemeContext';
import type { UserProfile } from '../types/entities';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isBanned: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isBanned: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAcademy } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAcademy) {
      setUser(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAcademy]);

  const profile = user
    ? {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL || '',
        email: user.email,
        role: user.role,
        status: user.status,
        banReason: user.banReason,
        bannedAt: user.bannedAt,
        level: user.level,
        bio: user.bio,
      }
    : null;

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isBanned = profile?.status === 'banned';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isBanned }}>
      <UserPreferencesProvider>
        {children}
      </UserPreferencesProvider>
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
