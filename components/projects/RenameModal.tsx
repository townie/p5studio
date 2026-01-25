import React, { useState, useEffect, useRef } from 'react';
import ModalWrapper from './ModalWrapper';

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onRename: (newName: string) => Promise<void>;
}

/**
 * RenameModal - Simple modal for renaming a project
 *
 * Usage:
 * ```tsx
 * <RenameModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   currentName={project.name}
 *   onRename={async (name) => await updateProject({ name })}
 * />
 * ```
 */
export default function RenameModal({
  isOpen,
  onClose,
  currentName,
  onRename,
}: RenameModalProps) {
  const [name, setName] = useState(currentName);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setError(null);
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }

    if (trimmedName === currentName) {
      onClose();
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await onRename(trimmedName);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title="Rename Project"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="px-6 py-4">
        <div className="mb-4">
          <label
            htmlFor="project-name"
            className="block text-sm font-medium text-zinc-400 mb-2"
          >
            Project Name
          </label>
          <input
            ref={inputRef}
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Amazing Sketch"
            disabled={isLoading}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 disabled:opacity-50 transition-all"
            autoComplete="off"
          />
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
            disabled={isLoading || !name.trim()}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
