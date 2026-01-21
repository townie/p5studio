import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserProfile } from '@/types';
import { isSupabaseConfigured } from '@/services/supabase';
import {
  getCurrentUser,
  onAuthStateChange,
  signInWithGitHub,
  signInWithGoogle,
  signOut as authSignOut,
  getUserProfile,
} from '@/services/authService';

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  signInWithGitHub: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    try {
      const profile = await getCurrentUser();
      setUser(profile);
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    // Subscribe to auth changes
    const unsubscribe = onAuthStateChange(async (authUser) => {
      if (authUser) {
        const profile = await getUserProfile(authUser.id);
        setUser(profile);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, [refreshUser]);

  const handleSignInWithGitHub = async () => {
    setIsLoading(true);
    const { error } = await signInWithGitHub();
    if (error) {
      console.error('GitHub sign in error:', error);
      setIsLoading(false);
    }
    // Note: OAuth redirects, so loading state will be handled on return
  };

  const handleSignInWithGoogle = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      console.error('Google sign in error:', error);
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    const { error } = await authSignOut();
    if (error) {
      console.error('Sign out error:', error);
    }
    setUser(null);
    setIsLoading(false);
  };

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    isConfigured: isSupabaseConfigured,
    signInWithGitHub: handleSignInWithGitHub,
    signInWithGoogle: handleSignInWithGoogle,
    signOut: handleSignOut,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
