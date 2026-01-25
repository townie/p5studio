import React, { useState } from 'react';
import ModalWrapper from './ModalWrapper';
import type { Visibility } from '@/types';

interface VisibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVisibility: Visibility;
  projectCount: number;
  onSave: (visibility: Visibility) => Promise<void>;
}

interface VisibilityOption {
  value: Visibility;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  {
    value: 'public',
    label: 'Public',
    description: 'Anyone can discover and view this project in the gallery',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    value: 'unlisted',
    label: 'Unlisted',
    description: 'Anyone with the link can view, but won\'t appear in search or gallery',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
    ),
  },
  {
    value: 'private',
    label: 'Private',
    description: 'Only you can view this project',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
  },
];

/**
 * VisibilityModal - Change project visibility settings
 *
 * Usage:
 * ```tsx
 * <VisibilityModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   currentVisibility={project.visibility}
 *   projectCount={selectedProjects.length}
 *   onSave={async (visibility) => await updateProjects(selectedProjects, { visibility })}
 * />
 * ```
 */
export default function VisibilityModal({
  isOpen,
  onClose,
  currentVisibility,
  projectCount,
  onSave,
}: VisibilityModalProps) {
  const [selectedVisibility, setSelectedVisibility] =
    useState<Visibility>(currentVisibility);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // No change
    if (selectedVisibility === currentVisibility) {
      onClose();
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await onSave(selectedVisibility);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update visibility');
    } finally {
      setIsLoading(false);
    }
  };

  const projectText = projectCount === 1 ? 'project' : 'projects';

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={`Change visibility for ${projectCount} ${projectText}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="px-6 py-4">
        <div className="mb-4">
          <div className="space-y-3">
            {VISIBILITY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-start gap-3 p-4 rounded border cursor-pointer transition-all ${
                  selectedVisibility === option.value
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={selectedVisibility === option.value}
                  onChange={() => setSelectedVisibility(option.value)}
                  disabled={isLoading}
                  className="mt-0.5 w-4 h-4 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-purple-400">{option.icon}</div>
                    <span className="text-sm font-medium text-zinc-200">
                      {option.label}
                    </span>
                    {currentVisibility === option.value && (
                      <span className="text-xs text-zinc-500">Current</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">{option.description}</p>
                </div>
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
            disabled={isLoading || selectedVisibility === currentVisibility}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
