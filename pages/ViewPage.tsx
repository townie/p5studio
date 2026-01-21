import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Preview from '@/components/Preview';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_SKETCH_CODE } from '@/constants';
import type { ProjectWithAuthor, Profile } from '@/types';

/**
 * ViewPage - Public view page for shared projects at /s/:projectId
 * Shows read-only preview of the sketch with author info and interaction buttons
 */
const ViewPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<ProjectWithAuthor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLikeLoading, setIsLikeLoading] = useState(false);

  // Fetch project data
  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) {
        setError('Project not found');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // TODO: Replace with actual API call
        // For now, use placeholder data for demonstration
        console.log('Fetching project:', projectId);

        // Simulated project data - replace with actual Supabase query
        const mockProject: ProjectWithAuthor = {
          id: projectId,
          user_id: 'mock-user-id',
          name: 'Amazing P5.js Sketch',
          description: 'A beautiful generative art piece created with P5.js',
          current_code: DEFAULT_SKETCH_CODE,
          current_index: 0,
          visibility: 'public',
          forked_from_id: null,
          fork_depth: 0,
          tags: ['generative', 'art', 'creative-coding'],
          thumbnail_url: null,
          preview_gif_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          published_at: new Date().toISOString(),
          likes_count: 42,
          forks_count: 7,
          views_count: 156,
          comments_count: 3,
          author: {
            id: 'mock-user-id',
            username: 'creativecoder',
            display_name: 'Creative Coder',
            avatar_url: null,
            bio: 'Making art with code',
            website: null,
            twitter_handle: null,
            github_handle: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            projects_count: 15,
            followers_count: 234,
            following_count: 89,
            total_likes_received: 567,
          },
        };

        setProject(mockProject);
        setLikeCount(mockProject.likes_count);
      } catch (err) {
        console.error('Error fetching project:', err);
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  // Handle like/unlike
  const handleLikeToggle = async () => {
    if (!user) {
      // TODO: Show login modal or redirect to login
      alert('Please sign in to like projects');
      return;
    }

    setIsLikeLoading(true);
    try {
      // TODO: Replace with actual API call
      if (isLiked) {
        setLikeCount((prev) => prev - 1);
        setIsLiked(false);
      } else {
        setLikeCount((prev) => prev + 1);
        setIsLiked(true);
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    } finally {
      setIsLikeLoading(false);
    }
  };

  // Handle fork (open in editor)
  const handleFork = () => {
    if (!user) {
      // TODO: Show login modal or redirect to login
      alert('Please sign in to fork projects');
      return;
    }

    // TODO: Create fork in database and navigate to new project
    // For now, just navigate to editor with project loaded
    navigate(`/project/${projectId}?fork=true`);
  };

  // Handle open in editor
  const handleOpenInEditor = () => {
    if (user && project?.user_id === user.id) {
      // User owns this project, open directly
      navigate(`/project/${projectId}`);
    } else {
      // Fork for non-owners
      handleFork();
    }
  };

  // Get initials for avatar
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

  // Format count
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

  if (error || !project) {
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
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-medium text-zinc-200 mb-2">Project Not Found</h2>
        <p className="text-zinc-500 mb-6">{error || 'The project you are looking for does not exist or is private.'}</p>
        <Link
          to="/"
          className="px-4 py-2 bg-zinc-800 text-zinc-100 rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Go Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-[#222] flex items-center justify-between px-6 bg-[#0d0d0d] z-20">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-900/20">
              <span className="text-white font-bold text-xs">P5</span>
            </div>
            <h1 className="font-medium tracking-tight text-zinc-200">
              P5.AI <span className="text-zinc-500 font-light">Studio</span>
            </h1>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Like Button */}
          <button
            onClick={handleLikeToggle}
            disabled={isLikeLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isLiked
                ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
            } disabled:opacity-50`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill={isLiked ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            {formatCount(likeCount)}
          </button>

          {/* Fork Button */}
          <button
            onClick={handleFork}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Fork ({formatCount(project.forks_count)})
          </button>

          {/* Open in Editor Button */}
          <button
            onClick={handleOpenInEditor}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-purple-500 hover:to-indigo-500 transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            Open in Editor
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Preview */}
        <div className="flex-1">
          <Preview code={project.current_code} />
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-zinc-800 bg-[#0d0d0d] p-6 overflow-y-auto">
          {/* Project Info */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-zinc-100 mb-2">{project.name}</h2>
            {project.description && (
              <p className="text-zinc-400 text-sm">{project.description}</p>
            )}
          </div>

          {/* Author */}
          <Link
            to={`/@${project.author.username}`}
            className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:bg-zinc-900 transition-colors mb-6"
          >
            {project.author.avatar_url ? (
              <img
                src={project.author.avatar_url}
                alt={project.author.display_name || project.author.username}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                <span className="text-sm font-bold text-white">
                  {getInitials(project.author.display_name, project.author.username)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-zinc-100 truncate">
                {project.author.display_name || project.author.username}
              </p>
              <p className="text-sm text-zinc-500 truncate">@{project.author.username}</p>
            </div>
          </Link>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="text-center p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
              <p className="text-lg font-bold text-zinc-100">{formatCount(project.views_count)}</p>
              <p className="text-xs text-zinc-500">Views</p>
            </div>
            <div className="text-center p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
              <p className="text-lg font-bold text-zinc-100">{formatCount(likeCount)}</p>
              <p className="text-xs text-zinc-500">Likes</p>
            </div>
            <div className="text-center p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
              <p className="text-lg font-bold text-zinc-100">{formatCount(project.forks_count)}</p>
              <p className="text-xs text-zinc-500">Forks</p>
            </div>
          </div>

          {/* Tags */}
          {project.tags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded-md hover:bg-zinc-700 cursor-pointer transition-colors"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Forked From */}
          {project.forked_from_id && project.forked_from && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Forked from</h3>
              <Link
                to={`/s/${project.forked_from_id}`}
                className="block p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:bg-zinc-900 transition-colors"
              >
                <p className="font-medium text-zinc-100 truncate">{project.forked_from.name}</p>
                <p className="text-sm text-zinc-500 truncate">
                  by @{project.forked_from.author.username}
                </p>
              </Link>
            </div>
          )}

          {/* Created Date */}
          <div className="text-sm text-zinc-500">
            Created {new Date(project.created_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewPage;
