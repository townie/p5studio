import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useProfile, useCurrentProfile } from '@/hooks/useProfile';
import { useUserProjects } from '@/hooks/useProject';
import { getProfileByUsername } from '@/services/profileService';
import type { Profile, Project } from '@/types';

interface ProfilePageProps {
  userId?: string;
  username?: string;
  onEditProfile?: () => void;
  onOpenSettings?: () => void;
  onProjectClick?: (project: Project) => void;
}

/**
 * ProfilePage component displays a user's profile with their projects
 */
const ProfilePage: React.FC<ProfilePageProps> = ({
  userId,
  username,
  onEditProfile,
  onOpenSettings,
  onProjectClick,
}) => {
  const [profileData, setProfileData] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Get current authenticated user
  const { user: currentUser, profile: currentUserProfile } = useCurrentProfile();

  // Fetch profile by userId if provided
  const { profile: profileById, loading: loadingById, error: errorById } = useProfile(userId);

  // Determine which user ID to use for fetching projects
  const targetUserId = userId || profileData?.id || profileById?.id;

  // Fetch user's projects
  const { projects, isLoading: projectsLoading, error: projectsError } = useUserProjects(targetUserId);

  // Filter to only show public projects for other users, show all for own profile
  const isOwnProfile = currentUser?.id === targetUserId;
  const displayedProjects = isOwnProfile
    ? projects
    : projects.filter((p) => p.visibility === 'public');

  // Fetch profile by username if provided
  useEffect(() => {
    if (username && !userId) {
      setProfileLoading(true);
      setProfileError(null);
      getProfileByUsername(username)
        .then((result) => {
          if (result.error) {
            setProfileError(result.error);
            setProfileData(null);
          } else {
            setProfileData(result.data);
          }
        })
        .finally(() => setProfileLoading(false));
    }
  }, [username, userId]);

  // Use profileById when userId is provided
  useEffect(() => {
    if (userId && profileById) {
      setProfileData(profileById);
    }
  }, [userId, profileById]);

  // Check if current user is following this profile
  useEffect(() => {
    if (!currentUser?.id || !targetUserId || currentUser.id === targetUserId) {
      setIsFollowing(false);
      return;
    }

    const checkFollowStatus = async () => {
      const { data } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', targetUserId)
        .single();

      setIsFollowing(!!data);
    };

    checkFollowStatus();
  }, [currentUser?.id, targetUserId]);

  // Handle follow/unfollow
  const handleFollowToggle = useCallback(async () => {
    if (!currentUser?.id || !targetUserId) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', targetUserId);
        setIsFollowing(false);
      } else {
        // Follow
        await supabase.from('follows').insert({
          follower_id: currentUser.id,
          following_id: targetUserId,
        });
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Failed to toggle follow:', error);
    } finally {
      setFollowLoading(false);
    }
  }, [currentUser?.id, targetUserId, isFollowing]);

  // Loading state
  const loading = profileLoading || loadingById;
  const error = profileError || errorById;
  const profile = profileData || profileById;

  // Get initials for avatar placeholder
  const getInitials = (name: string | null, username: string): string => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return username.slice(0, 2).toUpperCase();
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format large numbers
  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-center px-4">
        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-medium text-zinc-200 mb-2">Profile Not Found</h2>
        <p className="text-zinc-500">{error || 'The user you are looking for does not exist.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      {/* Profile Header */}
      <div className="border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || profile.username}
                  className="w-24 h-24 rounded-full object-cover border-2 border-zinc-800"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center border-2 border-zinc-800">
                  <span className="text-2xl font-bold text-white">
                    {getInitials(profile.display_name, profile.username)}
                  </span>
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-3">
                <div>
                  <h1 className="text-2xl font-bold text-zinc-100">
                    {profile.display_name || profile.username}
                  </h1>
                  <p className="text-zinc-500">@{profile.username}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 md:ml-auto">
                  {isOwnProfile ? (
                    <>
                      <button
                        onClick={onEditProfile}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition-colors border border-zinc-700"
                      >
                        Edit Profile
                      </button>
                      <button
                        onClick={onOpenSettings}
                        className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors border border-zinc-700"
                        title="Settings"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </button>
                    </>
                  ) : currentUser ? (
                    <button
                      onClick={handleFollowToggle}
                      disabled={followLoading}
                      className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                        isFollowing
                          ? 'bg-zinc-800 text-zinc-100 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 border border-zinc-700'
                          : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500'
                      }`}
                    >
                      {followLoading ? (
                        <span className="flex items-center gap-2">
                          <svg
                            className="animate-spin h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Loading
                        </span>
                      ) : isFollowing ? (
                        'Following'
                      ) : (
                        'Follow'
                      )}
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="text-zinc-300 mb-4 max-w-xl">{profile.bio}</p>
              )}

              {/* Social Links */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-purple-400 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                    {new URL(profile.website).hostname}
                  </a>
                )}
                {profile.twitter_handle && (
                  <a
                    href={`https://twitter.com/${profile.twitter_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-purple-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    @{profile.twitter_handle}
                  </a>
                )}
                {profile.github_handle && (
                  <a
                    href={`https://github.com/${profile.github_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-purple-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path
                        fillRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {profile.github_handle}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-6 pt-6 border-t border-zinc-800">
            <div className="text-center">
              <p className="text-xl font-bold text-zinc-100">
                {formatCount(profile.projects_count)}
              </p>
              <p className="text-sm text-zinc-500">Projects</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-zinc-100">
                {formatCount(profile.followers_count)}
              </p>
              <p className="text-sm text-zinc-500">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-zinc-100">
                {formatCount(profile.following_count)}
              </p>
              <p className="text-sm text-zinc-500">Following</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-zinc-100">
            {isOwnProfile ? 'My Projects' : 'Projects'}
          </h2>
          <span className="text-sm text-zinc-500">
            {displayedProjects.length} {displayedProjects.length === 1 ? 'project' : 'projects'}
          </span>
        </div>

        {projectsLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
          </div>
        ) : projectsError ? (
          <div className="text-center py-12">
            <p className="text-zinc-500">Failed to load projects</p>
          </div>
        ) : displayedProjects.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8 text-zinc-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <p className="text-zinc-500">
              {isOwnProfile
                ? "You haven't created any projects yet"
                : 'No public projects yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => onProjectClick?.(project)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Project Card component for the projects grid
 */
interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => {
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <button
      onClick={onClick}
      className="group text-left bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 hover:bg-zinc-900 transition-all"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-zinc-800 relative overflow-hidden">
        {project.thumbnail_url ? (
          <img
            src={project.thumbnail_url}
            alt={project.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-indigo-900/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-10 h-10 text-zinc-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </div>
        )}

        {/* Visibility Badge */}
        {project.visibility !== 'public' && (
          <div className="absolute top-2 right-2">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                project.visibility === 'private'
                  ? 'bg-zinc-800 text-zinc-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}
            >
              {project.visibility === 'private' ? 'Private' : 'Unlisted'}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-medium text-zinc-100 truncate group-hover:text-purple-400 transition-colors">
          {project.name}
        </h3>
        <div className="flex items-center justify-between mt-2 text-sm text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              {project.likes_count}
            </span>
            {project.forks_count > 0 && (
              <span className="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                {project.forks_count}
              </span>
            )}
          </div>
          <span>{formatDate(project.created_at)}</span>
        </div>
      </div>
    </button>
  );
};

export default ProfilePage;
