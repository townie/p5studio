import React from 'react';
import type { Project } from '@/types';
import ProjectCard from './ProjectCard';

interface ProjectGridProps {
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
 * ProjectGrid component - displays projects in a responsive grid layout
 * Features: select all checkbox, responsive columns, empty state
 */
const ProjectGrid: React.FC<ProjectGridProps> = ({
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
  const allSelected = projects.length > 0 && projects.every((p) => selectedIds.has(p.id));
  const someSelected = projects.some((p) => selectedIds.has(p.id)) && !allSelected;

  const handleSelectAll = () => {
    onSelectAll(!allSelected);
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
    <div className="space-y-4">
      {/* Select All Header */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-2">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                allSelected
                  ? 'bg-purple-600 border-purple-600'
                  : someSelected
                  ? 'bg-purple-600/50 border-purple-600'
                  : 'border-zinc-600'
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
            <span>
              {selectedIds.size === projects.length
                ? 'Deselect All'
                : `${selectedIds.size} selected`}
            </span>
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            isSelected={selectedIds.has(project.id)}
            onSelect={(selected) => onSelectProject(project.id, selected)}
            onClick={() => onProjectClick(project)}
            onRename={() => onRename(project)}
            onDelete={() => onDelete(project)}
            onDuplicate={() => onDuplicate(project)}
            onChangeVisibility={() => onChangeVisibility(project)}
            onMoveToFolder={() => onMoveToFolder(project)}
            onAddToCollection={() => onAddToCollection(project)}
          />
        ))}
      </div>
    </div>
  );
};

export default ProjectGrid;
