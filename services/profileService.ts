import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

/**
 * Service response type for consistent error handling
 */
export interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
}

/**
 * Profile stats including projects, followers, and likes
 */
export interface ProfileStats {
  projects_count: number;
  followers_count: number;
  following_count: number;
  total_likes_received: number;
}

/**
 * Fetch a user's profile by user ID
 */
export async function getProfile(userId: string): Promise<ServiceResponse<Profile>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, error: 'Profile not found' };
      }
      return { data: null, error: error.message };
    }

    return { data: data as Profile, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch profile';
    return { data: null, error: message };
  }
}

/**
 * Fetch a profile by username
 */
export async function getProfileByUsername(username: string): Promise<ServiceResponse<Profile>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, error: 'Profile not found' };
      }
      return { data: null, error: error.message };
    }

    return { data: data as Profile, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch profile';
    return { data: null, error: message };
  }
}

/**
 * Update a user's profile
 * Only allows updating specific fields to prevent overwriting system fields
 */
export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'username' | 'display_name' | 'avatar_url' | 'bio' | 'website' | 'twitter_handle' | 'github_handle'>>
): Promise<ServiceResponse<Profile>> {
  try {
    // Sanitize username if provided
    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.username) {
      sanitizedUpdates.username = sanitizedUpdates.username.toLowerCase().trim();

      // Validate username format
      if (!/^[a-z0-9_-]{3,30}$/.test(sanitizedUpdates.username)) {
        return {
          data: null,
          error: 'Username must be 3-30 characters and contain only lowercase letters, numbers, underscores, and hyphens'
        };
      }

      // Check if username is already taken by another user
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', sanitizedUpdates.username)
        .neq('id', userId)
        .single();

      if (existing) {
        return { data: null, error: 'Username is already taken' };
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...sanitizedUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Profile, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update profile';
    return { data: null, error: message };
  }
}

/**
 * Check if a username is available
 */
export async function checkUsernameAvailable(username: string): Promise<ServiceResponse<boolean>> {
  try {
    const normalizedUsername = username.toLowerCase().trim();

    // Validate username format first
    if (!/^[a-z0-9_-]{3,30}$/.test(normalizedUsername)) {
      return {
        data: false,
        error: 'Username must be 3-30 characters and contain only lowercase letters, numbers, underscores, and hyphens'
      };
    }

    // Check reserved usernames
    const reservedUsernames = [
      'admin', 'administrator', 'root', 'system', 'p5studio',
      'support', 'help', 'api', 'www', 'mail', 'ftp',
      'gallery', 'explore', 'settings', 'profile', 'login',
      'signup', 'register', 'logout', 'auth', 'user', 'users'
    ];

    if (reservedUsernames.includes(normalizedUsername)) {
      return { data: false, error: 'This username is reserved' };
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', normalizedUsername)
      .single();

    if (error) {
      // PGRST116 means no rows found, which means username is available
      if (error.code === 'PGRST116') {
        return { data: true, error: null };
      }
      return { data: null, error: error.message };
    }

    // If we got data, username is taken
    return { data: !data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to check username availability';
    return { data: null, error: message };
  }
}

/**
 * Get profile stats for a user
 * Returns denormalized stats from the profile, with option to refresh from source tables
 */
export async function getProfileStats(
  userId: string,
  refresh: boolean = false
): Promise<ServiceResponse<ProfileStats>> {
  try {
    if (refresh) {
      // First get user's project IDs for likes count
      const { data: userProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', userId);

      const projectIds = userProjects?.map(p => p.id) ?? [];

      // Fetch fresh counts from source tables
      const [projectsResult, followersResult, followingResult, likesResult] = await Promise.all([
        supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('follows')
          .select('follower_id', { count: 'exact', head: true })
          .eq('following_id', userId),
        supabase
          .from('follows')
          .select('following_id', { count: 'exact', head: true })
          .eq('follower_id', userId),
        projectIds.length > 0
          ? supabase
              .from('likes')
              .select('project_id', { count: 'exact', head: true })
              .in('project_id', projectIds)
          : Promise.resolve({ count: 0 }),
      ]);

      const stats: ProfileStats = {
        projects_count: projectsResult.count ?? 0,
        followers_count: followersResult.count ?? 0,
        following_count: followingResult.count ?? 0,
        total_likes_received: likesResult.count ?? 0,
      };

      return { data: stats, error: null };
    }

    // Use denormalized stats from profile
    const { data, error } = await supabase
      .from('profiles')
      .select('projects_count, followers_count, following_count, total_likes_received')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, error: 'Profile not found' };
      }
      return { data: null, error: error.message };
    }

    return { data: data as ProfileStats, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch profile stats';
    return { data: null, error: message };
  }
}
