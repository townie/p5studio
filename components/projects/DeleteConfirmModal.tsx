import React, { useState } from 'react';
import ModalWrapper from './ModalWrapper';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectCount: number;
  onConfirm: () => Promise<void>;
}

/**
 * DeleteConfirmModal - Confirmation dialog for deleting projects
 *
 * Usage:
 * ```tsx
 * <DeleteConfirmModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   projectCount={selectedProjects.length}
 *   onConfirm={async () => await deleteProjects(selectedProjects)}
 * />
 * ```
 */
export default function DeleteConfirmModal({
  isOpen,
  onClose,
  projectCount,
  onConfirm,
}: DeleteConfirmModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setIsLoading(true);

    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete projects');
    } finally {
      setIsLoading(false);
    }
  };

  const projectText = projectCount === 1 ? 'project' : 'projects';

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Projects"
      maxWidth="sm"
    >
      <div className="px-6 py-4">
        {/* Warning icon and message */}
        <div className="flex gap-4 mb-6">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-zinc-100 mb-2">
              Delete {projectCount} {projectText}?
            </h3>
            <p className="text-sm text-zinc-400">
              {projectCount === 1
                ? 'This project will be permanently deleted. This action cannot be undone.'
                : `These ${projectCount} projects will be permanently deleted. This action cannot be undone.`}
            </p>
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
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
