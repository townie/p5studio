import React, { useState, useEffect, useRef } from 'react';
import ModalWrapper from './ModalWrapper';
import type { Collection } from '@/types';

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection?: Collection | null;
  onSave: (name: string, description?: string, isPublic?: boolean) => Promise<void>;
}

/**
 * CollectionModal - Create or edit a collection of curated projects
 *
 * Usage:
 * ```tsx
 * // Create new collection
 * <CollectionModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSave={async (name, desc, isPublic) => await createCollection({ name, description: desc, is_public: isPublic })}
 * />
 *
 * // Edit existing collection
 * <CollectionModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   collection={selectedCollection}
 *   onSave={async (name, desc, isPublic) => await updateCollection(collection.id, { name, description: desc, is_public: isPublic })}
 * />
 * ```
 */
export default function CollectionModal({
  isOpen,
  onClose,
  collection,
  onSave,
}: CollectionModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!collection;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (collection) {
        setName(collection.name);
        setDescription(collection.description || '');
        setIsPublic(collection.is_public);
      } else {
        setName('');
        setDescription('');
        setIsPublic(false);
      }
      setError(null);
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, collection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Collection name is required');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await onSave(trimmedName, description.trim() || undefined, isPublic);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save collection');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Collection' : 'Create Collection'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="px-6 py-4">
        {/* Name input */}
        <div className="mb-4">
          <label
            htmlFor="collection-name"
            className="block text-sm font-medium text-zinc-400 mb-2"
          >
            Collection Name
          </label>
          <input
            ref={inputRef}
            id="collection-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Favorite Sketches"
            disabled={isLoading}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 disabled:opacity-50 transition-all"
            autoComplete="off"
          />
        </div>

        {/* Description textarea */}
        <div className="mb-4">
          <label
            htmlFor="collection-description"
            className="block text-sm font-medium text-zinc-400 mb-2"
          >
            Description (optional)
          </label>
          <textarea
            id="collection-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A collection of creative sketches..."
            disabled={isLoading}
            rows={3}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 disabled:opacity-50 transition-all resize-none"
          />
        </div>

        {/* Public/Private toggle */}
        <div className="mb-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={isLoading}
              className="mt-0.5 w-4 h-4 bg-zinc-800 border border-zinc-700 rounded text-purple-600 focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-200">
                Make this collection public
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                Public collections can be discovered and viewed by others
              </div>
            </div>
          </label>
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
            {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Collection'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
