import React, { useState, useRef, useEffect } from 'react';
import type { Project } from '@/types';

interface ProjectListProps {
  projects: Project[];
  selectedIds: Set<string>;
  onSelectProject: (projectId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onProjectClick: (project: Project) => void;
  onRename: (project: Project) => void;
  onDelete: (project: Project) => void;
  onDuplicate: (project: Project) => void;
  onChangeVisibility: (project: Project) => void;
  onMoveToFolder: (project: Project) => void;
  onAddToCollection: (project: Project) => void;
}

/**
 * ProjectList component - displays projects in a table/list view
 * Features: sortable columns, compact layout, batch selection
 */
const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  selectedIds,
  onSelectProject,
  onSelectAll,
  onProjectClick,
  onRename,
  onDelete,
  onDuplicate,
  onChangeVisibility,
  onMoveToFolder,
  onAddToCollection,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const allSelected = projects.length > 0 && projects.every((p) => selectedIds.has(p.id));
  const someSelected = projects.some((p) => selectedIds.has(p.id)) && !allSelected;

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMenu) {
        const menuEl = menuRefs.current.get(activeMenu);
        if (menuEl && !menuEl.contains(event.target as Node)) {
          setActiveMenu(null);
        }
      }
    };

    if (activeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeMenu]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getVisibilityBadge = (visibility: Project['visibility']) => {
    const configs = {
      public: { icon: '🌐', label: 'Public', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
      unlisted: { icon: '🔗', label: 'Unlisted', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
      private: { icon: '🔒', label: 'Private', className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
    };

    const config = configs[visibility];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${config.className}`}>
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </span>
    );
  };

  const handleSelectAll = () => {
    onSelectAll(!allSelected);
  };

  const handleMenuToggle = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === projectId ? null : projectId);
  };

  const handleMenuAction = (project: Project, action: () => void) => {
    setActiveMenu(null);
    action();
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-16">
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
        <p className="text-zinc-500 text-lg">No projects found</p>
        <p className="text-zinc-600 text-sm mt-2">Create your first project to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="w-12 px-4 py-3">
              <button
                onClick={handleSelectAll}
                className="flex items-center justify-center"
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    allSelected
                      ? 'bg-purple-600 border-purple-600'
                      : someSelected
                      ? 'bg-purple-600/50 border-purple-600'
                      : 'border-zinc-600 hover:border-zinc-500'
                  }`}
                >
                  {allSelected && (
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                  {someSelected && !allSelected && (
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M20 12H4"
                      />
                    </svg>
                  )}
                </div>
              </button>
            </th>
            <th className="w-20 px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Preview
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Visibility
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Updated
            </th>
            <th className="w-16 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {projects.map((project) => (
            <tr
              key={project.id}
              onClick={() => onProjectClick(project)}
              className="hover:bg-zinc-900/50 cursor-pointer transition-colors group"
            >
              {/* Checkbox */}
              <td className="px-4 py-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProject(project.id, !selectedIds.has(project.id));
                  }}
                  className="flex items-center justify-center"
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      selectedIds.has(project.id)
                        ? 'bg-purple-600 border-purple-600'
                        : 'border-zinc-600 group-hover:border-zinc-500'
                    }`}
                  >
                    {selectedIds.has(project.id) && (
                      <svg
                        className="w-3.5 h-3.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              </td>

              {/* Thumbnail */}
              <td className="px-4 py-4">
                <div className="w-16 h-12 rounded-lg overflow-hidden bg-zinc-800">
                  {project.thumbnail_url ? (
                    <img
                      src={project.thumbnail_url}
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-indigo-900/30">
                      <svg
                        className="w-5 h-5 text-zinc-600"
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
                </div>
              </td>

              {/* Name */}
              <td className="px-4 py-4">
                <span className="font-medium text-zinc-100 group-hover:text-purple-400 transition-colors">
                  {project.name}
                </span>
              </td>

              {/* Visibility */}
              <td className="px-4 py-4">
                {getVisibilityBadge(project.visibility)}
              </td>

              {/* Updated */}
              <td className="px-4 py-4 text-sm text-zinc-500">
                {formatDate(project.updated_at)}
              </td>

              {/* Actions */}
              <td className="px-4 py-4">
                <div className="relative" ref={(el) => el && menuRefs.current.set(project.id, el)}>
                  <button
                    onClick={(e) => handleMenuToggle(project.id, e)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                    title="More actions"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                      />
                    </svg>
                  </button>

                  {activeMenu === project.id && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-20">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuAction(project, () => onRename(project));
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuAction(project, () => onDuplicate(project));
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Duplicate
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuAction(project, () => onChangeVisibility(project));
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Change Visibility
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuAction(project, () => onMoveToFolder(project));
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        Move to Folder
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuAction(project, () => onAddToCollection(project));
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Add to Collection
                      </button>
                      <div className="border-t border-zinc-800 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMenuAction(project, () => onDelete(project));
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProjectList;
