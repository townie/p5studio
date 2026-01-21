import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Project } from '@/types';

interface ProjectsDropdownProps {
  recentProjects?: Project[];
  onNavigate?: (path: string) => void;
  onNewProject?: () => void;
}

/**
 * ProjectsDropdown - Quick access dropdown for recent projects
 *
 * Features:
 * - "New Project" button at top
 * - List of 5 most recent projects
 * - "View All" link to profile
 * - Click outside / Escape to close
 * - Keyboard navigation
 */
export default function ProjectsDropdown({
  recentProjects = [],
  onNavigate,
  onNewProject,
}: ProjectsDropdownProps) {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Limit to 5 most recent projects
  const displayedProjects = recentProjects.slice(0, 5);

  // Calculate navigable items count: New Project + projects + View All (if has projects)
  const navigableCount = 1 + displayedProjects.length + (displayedProjects.length > 0 ? 1 : 0);

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return;

    switch (event.key) {
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        triggerRef.current?.focus();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => (prev < navigableCount - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : navigableCount - 1));
        break;
      case 'Enter':
      case ' ':
        if (focusedIndex >= 0) {
          event.preventDefault();
          handleItemAction(focusedIndex);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
    }
  }, [isOpen, focusedIndex, navigableCount]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Focus item when focusedIndex changes
  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  const handleItemAction = (index: number) => {
    if (index === 0) {
      // New Project
      onNewProject?.();
    } else if (index <= displayedProjects.length) {
      // Project item
      const project = displayedProjects[index - 1];
      if (project && onNavigate) {
        onNavigate(`/project/${project.id}`);
      }
    } else {
      // View All
      if (onNavigate && profile) {
        onNavigate(`/profile/${profile.username}`);
      }
    }
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const toggleMenu = () => {
    setIsOpen(prev => !prev);
    if (!isOpen) {
      setFocusedIndex(-1);
    }
  };

  // Only show if user is authenticated
  if (!user) return null;

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={toggleMenu}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-600"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        </svg>
        <span>Projects</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      <div
        role="menu"
        aria-orientation="vertical"
        className={`absolute left-0 top-full mt-2 w-72 bg-[#111] border border-zinc-800 rounded-xl shadow-xl shadow-black/50 overflow-hidden z-50 origin-top-left transition-all duration-200 ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        {/* New Project Button */}
        <div className="p-2 border-b border-zinc-800">
          <button
            ref={el => { itemRefs.current[0] = el; }}
            role="menuitem"
            tabIndex={focusedIndex === 0 ? 0 : -1}
            onClick={() => handleItemAction(0)}
            className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#111] ${
              focusedIndex === 0 ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-[#111]' : ''
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            New Project
          </button>
        </div>

        {/* Recent Projects List */}
        {displayedProjects.length > 0 ? (
          <>
            <div className="py-1">
              <p className="px-4 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
                Recent Projects
              </p>
              {displayedProjects.map((project, index) => {
                const itemIndex = index + 1;
                const isFocused = focusedIndex === itemIndex;

                return (
                  <button
                    key={project.id}
                    ref={el => { itemRefs.current[itemIndex] = el; }}
                    role="menuitem"
                    tabIndex={isFocused ? 0 : -1}
                    onClick={() => handleItemAction(itemIndex)}
                    className={`w-full px-4 py-2.5 text-left transition-colors flex items-start gap-3 focus:outline-none ${
                      isFocused ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                    }`}
                  >
                    {/* Thumbnail or placeholder */}
                    {project.thumbnail_url ? (
                      <img
                        src={project.thumbnail_url}
                        alt={project.name}
                        className="w-10 h-10 rounded-md object-cover border border-zinc-700 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-gradient-to-br from-zinc-800 to-zinc-700 border border-zinc-700 flex items-center justify-center flex-shrink-0">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-zinc-500"
                        >
                          <polygon points="12 2 2 7 12 12 22 7 12 2" />
                          <polyline points="2 17 12 22 22 17" />
                          <polyline points="2 12 12 17 22 12" />
                        </svg>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate font-medium">
                        {project.name}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {formatRelativeTime(project.updated_at)}
                      </p>
                    </div>

                    {/* Visibility indicator */}
                    {project.visibility === 'private' && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-zinc-600 flex-shrink-0 mt-1"
                        title="Private"
                      >
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    )}
                    {project.visibility === 'unlisted' && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-zinc-600 flex-shrink-0 mt-1"
                        title="Unlisted"
                      >
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" x2="22" y1="2" y2="22" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {/* View All Link */}
            <div className="border-t border-zinc-800 p-2">
              <button
                ref={el => { itemRefs.current[displayedProjects.length + 1] = el; }}
                role="menuitem"
                tabIndex={focusedIndex === displayedProjects.length + 1 ? 0 : -1}
                onClick={() => handleItemAction(displayedProjects.length + 1)}
                className={`w-full px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 focus:outline-none ${
                  focusedIndex === displayedProjects.length + 1 ? 'bg-zinc-800 text-zinc-200' : ''
                }`}
              >
                View All Projects
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="px-4 py-8 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-zinc-700 mx-auto mb-3"
            >
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="M9 15h6" />
              <path d="M12 12v6" />
            </svg>
            <p className="text-sm text-zinc-500 mb-1">No projects yet</p>
            <p className="text-xs text-zinc-600">Create your first project to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
