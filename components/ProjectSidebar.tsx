import React, { useState, useEffect } from 'react';
import type { LocalProject, HistoryEntry } from '@/types';
import {
  getLocalProjects,
  deleteLocalProject,
  getCurrentProjectId,
  setCurrentProjectId,
} from '@/services/projectService';

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (project: LocalProject) => void;
  onNewProject: () => void;
  currentProjectId: string | null;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  isOpen,
  onClose,
  onSelectProject,
  onNewProject,
  currentProjectId,
}) => {
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = () => {
    const localProjects = getLocalProjects();
    setProjects(localProjects);
  };

  const handleDelete = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirm === projectId) {
      deleteLocalProject(projectId);
      loadProjects();
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(projectId);
      // Auto-cancel after 3 seconds
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const handleSelect = (project: LocalProject) => {
    setCurrentProjectId(project.id);
    onSelectProject(project);
    onClose();
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getLastEditType = (history: HistoryEntry[]) => {
    if (history.length === 0) return null;
    return history[history.length - 1].type;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-80 z-50 bg-[#0d0d0d] border-r border-zinc-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-medium text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
              <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
            </svg>
            Your Projects
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* New Project Button */}
        <div className="p-4 border-b border-zinc-800">
          <button
            onClick={() => {
              onNewProject();
              onClose();
            }}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-indigo-600 transition-all flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Project
          </button>
        </div>

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
                  <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                  <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                </svg>
              </div>
              <p className="text-zinc-400 mb-2">No saved projects yet</p>
              <p className="text-sm text-zinc-600">
                Save your current sketch to see it here
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {projects.map((project) => {
                const isSelected = project.id === currentProjectId;
                const lastEditType = getLastEditType(project.history);

                return (
                  <div
                    key={project.id}
                    onClick={() => handleSelect(project)}
                    className={`group relative p-3 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-purple-500/20 border border-purple-500/30'
                        : 'bg-zinc-900/50 border border-transparent hover:bg-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Thumbnail */}
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                        {project.thumbnail ? (
                          <img
                            src={project.thumbnail}
                            alt={project.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                              <circle cx="9" cy="9" r="2"/>
                              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate text-sm">
                          {project.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-zinc-500">
                            {project.history.length} version{project.history.length !== 1 ? 's' : ''}
                          </span>
                          {lastEditType && (
                            <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                              lastEditType === 'ai'
                                ? 'bg-purple-500/20 text-purple-300'
                                : lastEditType === 'manual'
                                ? 'bg-zinc-500/20 text-zinc-300'
                                : 'bg-indigo-500/20 text-indigo-300'
                            }`}>
                              {lastEditType}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-600 mt-1">
                          {formatRelativeTime(project.updated_at)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {project.synced && (
                          <span className="p-1 text-green-500" title="Synced to cloud">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
                              <path d="m9 15 3 3 6-6"/>
                            </svg>
                          </span>
                        )}
                        <button
                          onClick={(e) => handleDelete(project.id, e)}
                          className={`p-1 rounded transition-colors ${
                            deleteConfirm === project.id
                              ? 'bg-red-500 text-white'
                              : 'text-zinc-500 hover:text-red-400 hover:bg-red-400/10'
                          }`}
                          title={deleteConfirm === project.id ? 'Click again to confirm' : 'Delete'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Tags */}
                    {project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {project.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 bg-zinc-800 text-zinc-500 text-[10px] rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-purple-500 rounded-r" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
          <p className="text-xs text-zinc-600 text-center">
            {projects.length} project{projects.length !== 1 ? 's' : ''} saved locally
          </p>
        </div>
      </div>
    </>
  );
};

export default ProjectSidebar;
