import { supabase, isSupabaseConfigured } from './supabase';
import type { UserProfile } from '@/types';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthResult {
  user: UserProfile | null;
  error: string | null;
}

// Sign in with GitHub OAuth
export async function signInWithGitHub(): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return { user: null, error: 'Supabase not configured' };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    return { user: null, error: error.message };
  }

  // OAuth redirects, so we don't have user here yet
  return { user: null, error: null };
}

// Sign in with Google OAuth
export async function signInWithGoogle(): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return { user: null, error: 'Supabase not configured' };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    return { user: null, error: error.message };
  }

  return { user: null, error: null };
}

// Sign out
export async function signOut(): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase not configured' };
  }

  const { error } = await supabase.auth.signOut();
  return { error: error?.message || null };
}

// Get current session
export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Get current user profile
export async function getCurrentUser(): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return getUserProfile(user.id);
}

// Get user profile by ID
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data as UserProfile;
}

// Get user profile by username
export async function getUserByUsername(username: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !data) {
    return null;
  }

  return data as UserProfile;
}

// Update user profile
export async function updateProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'display_name' | 'bio' | 'avatar_url'>>
): Promise<{ profile: UserProfile | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { profile: null, error: 'Supabase not configured' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    return { profile: null, error: error.message };
  }

  return { profile: data as UserProfile, error: null };
}

// Subscribe to auth state changes
export function onAuthStateChange(
  callback: (user: User | null) => void
): () => void {
  if (!isSupabaseConfigured) {
    return () => {};
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      callback(session?.user || null);
    }
  );

  return () => subscription.unsubscribe();
}

// Check if user is following another user
export async function isFollowing(
  followerId: string,
  followingId: string
): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return false;
  }

  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .single();

  return Boolean(data);
}

// Follow a user
export async function followUser(
  followerId: string,
  followingId: string
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase not configured' };
  }

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });

  return { error: error?.message || null };
}

// Unfollow a user
export async function unfollowUser(
  followerId: string,
  followingId: string
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase not configured' };
  }

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  return { error: error?.message || null };
}

// Get follower count
export async function getFollowerCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured) {
    return 0;
  }

  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId);

  return count || 0;
}

// Get following count
export async function getFollowingCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured) {
    return 0;
  }

  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId);

  return count || 0;
}
