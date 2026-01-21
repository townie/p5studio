import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCurrentProfile } from '@/hooks/useProfile';
import { updateProfile, checkUsernameAvailable } from '@/services/profileService';

interface ProfileSettingsProps {
  onClose?: () => void;
  onSaved?: () => void;
}

/**
 * ProfileSettings component for editing user profile
 */
const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onClose, onSaved }) => {
  const { user, profile, refetch } = useCurrentProfile();

  // Form state
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [githubHandle, setGithubHandle] = useState('');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Debounce timer ref
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
      setWebsite(profile.website || '');
      setTwitterHandle(profile.twitter_handle || '');
      setGithubHandle(profile.github_handle || '');
    }
  }, [profile]);

  // Check username availability with debounce
  const checkUsername = useCallback(
    async (value: string) => {
      // Skip if same as current username
      if (value === profile?.username) {
        setUsernameStatus('idle');
        setUsernameError(null);
        return;
      }

      // Validate format first
      if (!/^[a-z0-9_-]{3,30}$/.test(value.toLowerCase())) {
        setUsernameStatus('invalid');
        setUsernameError(
          'Username must be 3-30 characters and contain only lowercase letters, numbers, underscores, and hyphens'
        );
        return;
      }

      setUsernameStatus('checking');
      setUsernameError(null);

      const result = await checkUsernameAvailable(value);

      if (result.error) {
        setUsernameStatus('invalid');
        setUsernameError(result.error);
      } else if (result.data) {
        setUsernameStatus('available');
        setUsernameError(null);
      } else {
        setUsernameStatus('taken');
        setUsernameError('This username is already taken');
      }
    },
    [profile?.username]
  );

  // Handle username change with debounce
  const handleUsernameChange = (value: string) => {
    const normalizedValue = value.toLowerCase().trim();
    setUsername(normalizedValue);

    // Clear previous timer
    if (usernameCheckTimer.current) {
      clearTimeout(usernameCheckTimer.current);
    }

    // Reset status if empty or same as current
    if (!normalizedValue || normalizedValue === profile?.username) {
      setUsernameStatus('idle');
      setUsernameError(null);
      return;
    }

    // Quick validation
    if (normalizedValue.length < 3) {
      setUsernameStatus('invalid');
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    // Set checking status immediately
    setUsernameStatus('checking');

    // Debounce the actual API check
    usernameCheckTimer.current = setTimeout(() => {
      checkUsername(normalizedValue);
    }, 500);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      setError('You must be logged in to update your profile');
      return;
    }

    // Validate username if changed
    if (username !== profile?.username && usernameStatus !== 'available' && usernameStatus !== 'idle') {
      setError('Please fix the username before saving');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Prepare updates
      const updates: Parameters<typeof updateProfile>[1] = {};

      if (username !== profile?.username) {
        updates.username = username;
      }
      if (displayName !== (profile?.display_name || '')) {
        updates.display_name = displayName || null;
      }
      if (bio !== (profile?.bio || '')) {
        updates.bio = bio || null;
      }
      if (website !== (profile?.website || '')) {
        updates.website = website || null;
      }
      if (twitterHandle !== (profile?.twitter_handle || '')) {
        updates.twitter_handle = twitterHandle || null;
      }
      if (githubHandle !== (profile?.github_handle || '')) {
        updates.github_handle = githubHandle || null;
      }

      // Check if there are any changes
      if (Object.keys(updates).length === 0) {
        setSuccessMessage('No changes to save');
        setIsSaving(false);
        return;
      }

      const result = await updateProfile(user.id, updates);

      if (result.error) {
        setError(result.error);
      } else {
        setSuccessMessage('Profile updated successfully');
        await refetch();
        onSaved?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  // Clear messages after timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  if (!profile) {
    return (
      <div className="bg-[#0d0d0d] rounded-xl border border-zinc-800 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d0d0d] rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Profile Settings</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Username */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-zinc-300 mb-2">
            Username
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">@</span>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              className={`w-full pl-8 pr-10 py-2.5 bg-zinc-900 border rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 transition-colors ${
                usernameStatus === 'available'
                  ? 'border-green-500/50 focus:ring-green-500/30'
                  : usernameStatus === 'taken' || usernameStatus === 'invalid'
                  ? 'border-red-500/50 focus:ring-red-500/30'
                  : 'border-zinc-800 focus:ring-purple-500/30 focus:border-purple-500/50'
              }`}
              placeholder="username"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {usernameStatus === 'checking' && (
                <svg
                  className="animate-spin h-4 w-4 text-zinc-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {usernameStatus === 'available' && (
                <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
          </div>
          {usernameError && <p className="mt-1.5 text-sm text-red-400">{usernameError}</p>}
          {usernameStatus === 'available' && (
            <p className="mt-1.5 text-sm text-green-400">Username is available</p>
          )}
        </div>

        {/* Display Name */}
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-zinc-300 mb-2">
            Display Name
          </label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-colors"
            placeholder="Your display name"
            maxLength={50}
          />
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-zinc-300 mb-2">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-colors resize-none"
            placeholder="Tell us about yourself"
            maxLength={160}
          />
          <p className="mt-1.5 text-xs text-zinc-500">{bio.length}/160 characters</p>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800 pt-6">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Social Links</h3>

          {/* Website */}
          <div className="mb-4">
            <label htmlFor="website" className="block text-sm font-medium text-zinc-300 mb-2">
              Website
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
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
              </span>
              <input
                type="url"
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-colors"
                placeholder="https://yourwebsite.com"
              />
            </div>
          </div>

          {/* Twitter */}
          <div className="mb-4">
            <label htmlFor="twitter" className="block text-sm font-medium text-zinc-300 mb-2">
              Twitter / X
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </span>
              <input
                type="text"
                id="twitter"
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value.replace('@', ''))}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-colors"
                placeholder="username"
              />
            </div>
          </div>

          {/* GitHub */}
          <div>
            <label htmlFor="github" className="block text-sm font-medium text-zinc-300 mb-2">
              GitHub
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <input
                type="text"
                id="github"
                value={githubHandle}
                onChange={(e) => setGithubHandle(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-colors"
                placeholder="username"
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-400">{successMessage}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSaving || usernameStatus === 'taken' || usernameStatus === 'invalid'}
            className="px-6 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileSettings;
