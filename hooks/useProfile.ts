import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getProfile, getProfileStats, type ProfileStats, type ServiceResponse } from '@/services/profileService';
import type { Profile } from '@/types';
import type { User } from '@supabase/supabase-js';

/**
 * Profile hook state
 */
interface UseProfileState {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

/**
 * Profile hook return type
 */
interface UseProfileReturn extends UseProfileState {
  refetch: () => Promise<void>;
}

/**
 * Current profile hook return type with additional auth state
 */
interface UseCurrentProfileReturn extends UseProfileReturn {
  user: User | null;
  isAuthenticated: boolean;
  stats: ProfileStats | null;
  statsLoading: boolean;
  refetchStats: () => Promise<void>;
}

/**
 * Hook to fetch and cache a user's profile by ID
 */
export function useProfile(userId: string | null | undefined): UseProfileReturn {
  const [state, setState] = useState<UseProfileState>({
    profile: null,
    loading: false,
    error: null,
  });

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setState({ profile: null, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    const result = await getProfile(userId);

    setState({
      profile: result.data,
      loading: false,
      error: result.error,
    });
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Subscribe to realtime changes for this profile
  useEffect(() => {
    if (!userId) return;

    const subscription = supabase
      .channel(`profile:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            setState(prev => ({
              ...prev,
              profile: payload.new as Profile,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  return {
    ...state,
    refetch: fetchProfile,
  };
}

/**
 * Hook to get the current authenticated user's profile
 * Automatically fetches the profile when the user is authenticated
 */
export function useCurrentProfile(): UseCurrentProfileReturn {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Get initial auth state and subscribe to changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Use the profile hook with the current user's ID
  const { profile, loading: profileLoading, error, refetch: refetchProfile } = useProfile(user?.id);

  // Fetch stats for the current user
  const fetchStats = useCallback(async () => {
    if (!user?.id) {
      setStats(null);
      return;
    }

    setStatsLoading(true);
    const result = await getProfileStats(user.id);
    setStats(result.data);
    setStatsLoading(false);
  }, [user?.id]);

  // Fetch stats when user changes
  useEffect(() => {
    if (user?.id) {
      fetchStats();
    } else {
      setStats(null);
    }
  }, [user?.id, fetchStats]);

  // Combined refetch function
  const refetch = useCallback(async () => {
    await Promise.all([refetchProfile(), fetchStats()]);
  }, [refetchProfile, fetchStats]);

  return {
    user,
    isAuthenticated: !!user,
    profile,
    loading: authLoading || profileLoading,
    error,
    stats,
    statsLoading,
    refetch,
    refetchStats: fetchStats,
  };
}
