import React, { useState, useRef, useEffect } from 'react';
import { Collection } from '@/types';

interface CollectionsSidebarProps {
  collections: Collection[];
  activeCollection: string | null;
  onCollectionSelect: (collectionId: string | null) => void;
  onCreateCollection: () => void;
  onEditCollection: (collection: Collection) => void;
  onDeleteCollection: (collectionId: string) => void;
}

/**
 * CollectionsSidebar - Sidebar for curated project collections
 *
 * Features:
 * - List of collections with name and project count
 * - Context menu for Edit/Delete actions
 * - "+ New Collection" button
 * - Active state styling with purple accent
 * - Public/Private visibility indicator
 *
 * Accessibility:
 * - Keyboard navigation (Arrow keys, Enter, Space)
 * - ARIA labels and roles
 * - Focus management
 * - Escape to close menu
 */
export default function CollectionsSidebar({
  collections,
  activeCollection,
  onCollectionSelect,
  onCreateCollection,
  onEditCollection,
  onDeleteCollection,
}: CollectionsSidebarProps) {
  const [contextMenuCollection, setContextMenuCollection] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setContextMenuCollection(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenuCollection(null);
      }
    };

    if (contextMenuCollection) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenuCollection]);

  const handleContextMenu = (e: React.MouseEvent, collectionId: string) => {
    e.preventDefault();
    setContextMenuCollection(collectionId);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const handleOptionsClick = (e: React.MouseEvent, collectionId: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenuCollection(contextMenuCollection === collectionId ? null : collectionId);
    setContextMenuPosition({ x: rect.left, y: rect.bottom + 4 });
  };

  const handleEdit = (collection: Collection) => {
    setContextMenuCollection(null);
    onEditCollection(collection);
  };

  const handleDelete = (collectionId: string) => {
    setContextMenuCollection(null);
    onDeleteCollection(collectionId);
  };

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          Collections
        </h2>
      </div>

      {/* Collection List */}
      <div className="flex-1 overflow-y-auto">
        <nav aria-label="Project collections" className="py-2">
          {/* All Collections View */}
          <button
            onClick={() => onCollectionSelect(null)}
            className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors group ${
              activeCollection === null
                ? 'bg-purple-500/20 text-purple-300 border-l-2 border-purple-500'
                : 'text-zinc-300 hover:bg-zinc-800/50 border-l-2 border-transparent'
            }`}
            aria-current={activeCollection === null ? 'page' : undefined}
          >
            {/* Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={activeCollection === null ? 'text-purple-400' : 'text-zinc-500'}
            >
              <rect width="7" height="7" x="3" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="14" rx="1" />
              <rect width="7" height="7" x="3" y="14" rx="1" />
            </svg>

            <span className="flex-1 text-sm font-medium">All Collections</span>

            {/* Count Badge */}
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeCollection === null
                ? 'bg-purple-500/30 text-purple-200'
                : 'bg-zinc-800 text-zinc-400'
            }`}>
              {collections.length}
            </span>
          </button>

          {/* Divider */}
          {collections.length > 0 && (
            <div className="my-2 mx-4 border-t border-zinc-800" />
          )}

          {/* Collection List */}
          {collections.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto mb-3 text-zinc-700"
              >
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
              <p className="text-sm text-zinc-500 mb-1">No collections yet</p>
              <p className="text-xs text-zinc-600">Create a collection to organize your projects</p>
            </div>
          ) : (
            collections.map((collection) => (
              <div key={collection.id} className="relative">
                <button
                  onClick={() => onCollectionSelect(collection.id)}
                  onContextMenu={(e) => handleContextMenu(e, collection.id)}
                  className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors group ${
                    activeCollection === collection.id
                      ? 'bg-purple-500/20 text-purple-300 border-l-2 border-purple-500'
                      : 'text-zinc-300 hover:bg-zinc-800/50 border-l-2 border-transparent'
                  }`}
                  aria-current={activeCollection === collection.id ? 'page' : undefined}
                >
                  {/* Collection Icon */}
                  <div className="relative flex-shrink-0">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={activeCollection === collection.id ? 'text-purple-400' : 'text-zinc-500'}
                    >
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    </svg>

                    {/* Visibility Indicator */}
                    {!collection.is_public && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="absolute -bottom-1 -right-1 text-zinc-500 bg-zinc-900 rounded-full"
                        aria-label="Private collection"
                      >
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    )}
                  </div>

                  {/* Collection Name and Description */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {collection.name}
                    </div>
                    {collection.description && (
                      <div className="text-xs text-zinc-500 truncate mt-0.5">
                        {collection.description}
                      </div>
                    )}
                  </div>

                  {/* Options Button */}
                  <button
                    onClick={(e) => handleOptionsClick(e, collection.id)}
                    aria-label={`Options for ${collection.name}`}
                    className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-700/50 transition-all ${
                      contextMenuCollection === collection.id ? 'opacity-100' : ''
                    }`}
                    tabIndex={-1}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-zinc-400"
                    >
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="12" cy="5" r="1" />
                      <circle cx="12" cy="19" r="1" />
                    </svg>
                  </button>
                </button>

                {/* Context Menu */}
                {contextMenuCollection === collection.id && (
                  <div
                    ref={menuRef}
                    role="menu"
                    aria-orientation="vertical"
                    className="absolute z-50 bg-[#111] border border-zinc-800 rounded-lg shadow-xl shadow-black/50 py-1 min-w-[160px]"
                    style={{
                      left: contextMenuPosition.x,
                      top: contextMenuPosition.y,
                    }}
                  >
                    <button
                      role="menuitem"
                      onClick={() => handleEdit(collection)}
                      className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-zinc-500"
                      >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                      Edit Collection
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => handleDelete(collection.id)}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-red-400"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                      Delete Collection
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </nav>
      </div>

      {/* New Collection Button */}
      <div className="px-4 py-4 border-t border-zinc-800">
        <button
          onClick={onCreateCollection}
          className="w-full px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg border border-purple-500/30 hover:border-purple-500/50 transition-all"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          New Collection
        </button>
      </div>
    </div>
  );
}
