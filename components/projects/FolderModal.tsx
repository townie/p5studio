import React, { useState, useEffect, useRef } from 'react';
import ModalWrapper from './ModalWrapper';
import type { Folder } from '@/types';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder?: Folder | null; // null = create new, existing = edit
  onSave: (name: string, color?: string, icon?: string) => Promise<void>;
}

// Preset colors for folder organization
const PRESET_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Gray', value: '#6b7280' },
];

/**
 * FolderModal - Create or edit a folder for organizing projects
 *
 * Usage:
 * ```tsx
 * // Create new folder
 * <FolderModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSave={async (name, color, icon) => await createFolder({ name, color, icon })}
 * />
 *
 * // Edit existing folder
 * <FolderModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   folder={selectedFolder}
 *   onSave={async (name, color, icon) => await updateFolder(folder.id, { name, color, icon })}
 * />
 * ```
 */
export default function FolderModal({
  isOpen,
  onClose,
  folder,
  onSave,
}: FolderModalProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | undefined>(
    PRESET_COLORS[4].value // Default to blue
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!folder;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (folder) {
        setName(folder.name);
        setSelectedColor(folder.color || PRESET_COLORS[4].value);
      } else {
        setName('');
        setSelectedColor(PRESET_COLORS[4].value);
      }
      setError(null);
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, folder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Folder name is required');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await onSave(trimmedName, selectedColor, undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save folder');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Folder' : 'Create Folder'}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="px-6 py-4">
        {/* Name input */}
        <div className="mb-4">
          <label
            htmlFor="folder-name"
            className="block text-sm font-medium text-zinc-400 mb-2"
          >
            Folder Name
          </label>
          <input
            ref={inputRef}
            id="folder-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Work Projects"
            disabled={isLoading}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 disabled:opacity-50 transition-all"
            autoComplete="off"
          />
        </div>

        {/* Color picker */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Color
          </label>
          <div className="grid grid-cols-8 gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => setSelectedColor(color.value)}
                disabled={isLoading}
                className={`w-8 h-8 rounded transition-all ${
                  selectedColor === color.value
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 scale-110'
                    : 'hover:scale-110'
                } disabled:opacity-50`}
                style={{ backgroundColor: color.value }}
                aria-label={`Select ${color.name}`}
                title={color.name}
              />
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
            disabled={isLoading || !name.trim()}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Folder'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
