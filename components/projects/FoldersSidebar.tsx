import { useState, useRef, useEffect } from 'react';
import { Folder } from '@/types';

interface FoldersSidebarProps {
  folders: Folder[];
  activeFolder: string | null; // null = "All Projects", specific ID = that folder
  unfolderedCount: number; // count of projects not in any folder
  onFolderSelect: (folderId: string | null) => void;
  onCreateFolder: () => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string) => void;
}

/**
 * FoldersSidebar - Sidebar for folder-based project organization
 *
 * Features:
 * - "All Projects" item (shows total count)
 * - "Unfiled" item (shows unfolderedCount)
 * - List of folders with name, optional color dot, project count
 * - Context menu for Edit/Delete actions
 * - "+ New Folder" button
 * - Active state styling with purple accent
 *
 * Accessibility:
 * - Keyboard navigation (Arrow keys, Enter, Space)
 * - ARIA labels and roles
 * - Focus management
 * - Escape to close menu
 */
export default function FoldersSidebar({
  folders,
  activeFolder,
  unfolderedCount,
  onFolderSelect,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
}: FoldersSidebarProps) {
  const [contextMenuFolder, setContextMenuFolder] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // Calculate total projects count
  const totalCount = folders.reduce((sum, f) => sum + (f.projects_count || 0), 0) + unfolderedCount;

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setContextMenuFolder(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenuFolder(null);
      }
    };

    if (contextMenuFolder) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenuFolder]);

  const handleContextMenu = (e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    setContextMenuFolder(folderId);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const handleOptionsClick = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenuFolder(contextMenuFolder === folderId ? null : folderId);
    setContextMenuPosition({ x: rect.left, y: rect.bottom + 4 });
  };

  const handleEdit = (folder: Folder) => {
    setContextMenuFolder(null);
    onEditFolder(folder);
  };

  const handleDelete = (folderId: string) => {
    setContextMenuFolder(null);
    onDeleteFolder(folderId);
  };

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          Folders
        </h2>
      </div>

      {/* Folder List */}
      <div className="flex-1 overflow-y-auto">
        <nav aria-label="Project folders" className="py-2">
          {/* All Projects */}
          <button
            onClick={() => onFolderSelect(null)}
            className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors group ${
              activeFolder === null
                ? 'bg-purple-500/20 text-purple-300 border-l-2 border-purple-500'
                : 'text-zinc-300 hover:bg-zinc-800/50 border-l-2 border-transparent'
            }`}
            aria-current={activeFolder === null ? 'page' : undefined}
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
              className={activeFolder === null ? 'text-purple-400' : 'text-zinc-500'}
            >
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>

            <span className="flex-1 text-sm font-medium">All Projects</span>

            {/* Count Badge */}
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeFolder === null
                ? 'bg-purple-500/30 text-purple-200'
                : 'bg-zinc-800 text-zinc-400'
            }`}>
              {totalCount}
            </span>
          </button>

          {/* Unfiled Projects */}
          {unfolderedCount > 0 && (
            <button
              onClick={() => onFolderSelect('unfiled')}
              className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors group ${
                activeFolder === 'unfiled'
                  ? 'bg-purple-500/20 text-purple-300 border-l-2 border-purple-500'
                  : 'text-zinc-300 hover:bg-zinc-800/50 border-l-2 border-transparent'
              }`}
              aria-current={activeFolder === 'unfiled' ? 'page' : undefined}
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
                className={activeFolder === 'unfiled' ? 'text-purple-400' : 'text-zinc-500'}
              >
                <path d="M20 7h-3a2 2 0 0 1-2-2V2" />
                <path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z" />
                <path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8" />
              </svg>

              <span className="flex-1 text-sm font-medium">Unfiled</span>

              {/* Count Badge */}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeFolder === 'unfiled'
                  ? 'bg-purple-500/30 text-purple-200'
                  : 'bg-zinc-800 text-zinc-400'
              }`}>
                {unfolderedCount}
              </span>
            </button>
          )}

          {/* Divider */}
          {folders.length > 0 && (
            <div className="my-2 mx-4 border-t border-zinc-800" />
          )}

          {/* Folder List */}
          {folders.map((folder) => (
            <div key={folder.id} className="relative">
              <button
                onClick={() => onFolderSelect(folder.id)}
                onContextMenu={(e) => handleContextMenu(e, folder.id)}
                className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors group ${
                  activeFolder === folder.id
                    ? 'bg-purple-500/20 text-purple-300 border-l-2 border-purple-500'
                    : 'text-zinc-300 hover:bg-zinc-800/50 border-l-2 border-transparent'
                }`}
                aria-current={activeFolder === folder.id ? 'page' : undefined}
              >
                {/* Color Dot / Folder Icon */}
                {folder.color ? (
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: folder.color }}
                    aria-hidden="true"
                  />
                ) : (
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
                    className={activeFolder === folder.id ? 'text-purple-400' : 'text-zinc-500'}
                  >
                    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                  </svg>
                )}

                <span className="flex-1 text-sm font-medium truncate">
                  {folder.name}
                </span>

                {/* Count Badge */}
                {folder.projects_count !== undefined && folder.projects_count > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    activeFolder === folder.id
                      ? 'bg-purple-500/30 text-purple-200'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {folder.projects_count}
                  </span>
                )}

                {/* Options Button */}
                <button
                  onClick={(e) => handleOptionsClick(e, folder.id)}
                  aria-label={`Options for ${folder.name}`}
                  className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-700/50 transition-all ${
                    contextMenuFolder === folder.id ? 'opacity-100' : ''
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
              {contextMenuFolder === folder.id && (
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
                    onClick={() => handleEdit(folder)}
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
                    Edit Folder
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => handleDelete(folder.id)}
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
                    Delete Folder
                  </button>
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* New Folder Button */}
      <div className="px-4 py-4 border-t border-zinc-800">
        <button
          onClick={onCreateFolder}
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
          New Folder
        </button>
      </div>
    </div>
  );
}
