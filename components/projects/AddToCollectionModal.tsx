import React, { useState } from 'react';
import ModalWrapper from './ModalWrapper';
import type { Collection } from '@/types';

interface AddToCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
  selectedCollectionIds: Set<string>; // currently selected collections for the project(s)
  projectCount: number;
  onSave: (collectionIds: string[]) => Promise<void>;
  onCreateCollection: () => void;
}

/**
 * AddToCollectionModal - Add projects to collections
 *
 * Usage:
 * ```tsx
 * <AddToCollectionModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   collections={allCollections}
 *   selectedCollectionIds={new Set(project.collections.map(c => c.id))}
 *   projectCount={selectedProjects.length}
 *   onSave={async (collectionIds) => await addProjectsToCollections(selectedProjects, collectionIds)}
 *   onCreateCollection={() => { setIsOpen(false); setShowCreateCollection(true); }}
 * />
 * ```
 */
export default function AddToCollectionModal({
  isOpen,
  onClose,
  collections,
  selectedCollectionIds,
  projectCount,
  onSave,
  onCreateCollection,
}: AddToCollectionModalProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(selectedCollectionIds)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (collectionId: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(collectionId)) {
      newSelected.delete(collectionId);
    } else {
      newSelected.add(collectionId);
    }
    setSelected(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setIsLoading(true);

    try {
      await onSave(Array.from(selected));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update collections');
    } finally {
      setIsLoading(false);
    }
  };

  const projectText = projectCount === 1 ? 'project' : 'projects';

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={`Add ${projectCount} ${projectText} to collections`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="px-6 py-4">
        <div className="mb-4">
          {collections.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {collections.map((collection) => {
                const isSelected = selected.has(collection.id);
                return (
                  <label
                    key={collection.id}
                    className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggle(collection.id)}
                      disabled={isLoading}
                      className="mt-0.5 w-4 h-4 bg-zinc-800 border border-zinc-700 rounded text-purple-600 focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-200">
                          {collection.name}
                        </span>
                        {collection.is_public && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded">
                            <svg
                              className="w-3 h-3"
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
                            Public
                          </span>
                        )}
                      </div>
                      {collection.description && (
                        <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                          {collection.description}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-500 mb-4">
                You don't have any collections yet
              </p>
            </div>
          )}
        </div>

        {/* Create new collection link */}
        <button
          type="button"
          onClick={onCreateCollection}
          disabled={isLoading}
          className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 mb-4 disabled:opacity-50 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create New Collection
        </button>

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
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
