import React, { useState } from 'react';
import ModalWrapper from './ModalWrapper';
import type { Folder } from '@/types';

interface MoveToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  currentFolderId: string | null;
  projectCount: number; // "Move X projects to..."
  onMove: (folderId: string | null) => Promise<void>;
}

/**
 * MoveToFolderModal - Move projects to a different folder
 *
 * Usage:
 * ```tsx
 * <MoveToFolderModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   folders={allFolders}
 *   currentFolderId={selectedProject.folder_id}
 *   projectCount={selectedProjects.length}
 *   onMove={async (folderId) => await moveProjects(selectedProjects, folderId)}
 * />
 * ```
 */
export default function MoveToFolderModal({
  isOpen,
  onClose,
  folders,
  currentFolderId,
  projectCount,
  onMove,
}: MoveToFolderModalProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    currentFolderId
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // No change
    if (selectedFolderId === currentFolderId) {
      onClose();
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await onMove(selectedFolderId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move projects');
    } finally {
      setIsLoading(false);
    }
  };

  const projectText = projectCount === 1 ? 'project' : 'projects';

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={`Move ${projectCount} ${projectText}`}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="px-6 py-4">
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-400 mb-3">
            Select destination folder
          </label>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {/* No Folder option */}
            <label
              className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-all ${
                selectedFolderId === null
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
              }`}
            >
              <input
                type="radio"
                name="folder"
                checked={selectedFolderId === null}
                onChange={() => setSelectedFolderId(null)}
                disabled={isLoading}
                className="w-4 h-4 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
              />
              <div className="flex items-center gap-2 flex-1">
                <div className="w-3 h-3 rounded bg-zinc-600" />
                <span className="text-sm text-zinc-200">No Folder</span>
              </div>
              {currentFolderId === null && (
                <span className="text-xs text-zinc-500">Current</span>
              )}
            </label>

            {/* Folder options */}
            {folders.map((folder) => (
              <label
                key={folder.id}
                className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-all ${
                  selectedFolderId === folder.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
                }`}
              >
                <input
                  type="radio"
                  name="folder"
                  checked={selectedFolderId === folder.id}
                  onChange={() => setSelectedFolderId(folder.id)}
                  disabled={isLoading}
                  className="w-4 h-4 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                />
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: folder.color || '#6b7280' }}
                  />
                  <span className="text-sm text-zinc-200">{folder.name}</span>
                </div>
                {currentFolderId === folder.id && (
                  <span className="text-xs text-zinc-500">Current</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || selectedFolderId === currentFolderId}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Moving...' : 'Move'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
