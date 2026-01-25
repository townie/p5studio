import { useState, useEffect, useCallback } from 'react';
import type { Folder } from '@/types';
import {
  getUserFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  reorderFolders,
} from '@/services/folderService';

/**
 * Hook for managing user's folders
 */
export function useFolders(userId: string | undefined): {
  folders: Folder[];
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  addFolder: (name: string, color?: string, icon?: string) => Promise<Folder>;
  editFolder: (folderId: string, updates: Partial<Pick<Folder, 'name' | 'color' | 'icon'>>) => Promise<Folder>;
  removeFolder: (folderId: string) => Promise<void>;
  reorder: (folderIds: string[]) => Promise<void>;
} {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFolders = useCallback(async () => {
    if (!userId) {
      setFolders([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getUserFolders(userId);
      setFolders(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load folders');
      setError(error);
      setFolders([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const addFolder = useCallback(
    async (name: string, color?: string, icon?: string): Promise<Folder> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const newFolder = await createFolder(userId, name, color, icon);
      setFolders((prev) => [...prev, newFolder]);
      return newFolder;
    },
    [userId]
  );

  const editFolder = useCallback(
    async (
      folderId: string,
      updates: Partial<Pick<Folder, 'name' | 'color' | 'icon'>>
    ): Promise<Folder> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const updatedFolder = await updateFolder(folderId, userId, updates);
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? updatedFolder : f))
      );
      return updatedFolder;
    },
    [userId]
  );

  const removeFolder = useCallback(
    async (folderId: string): Promise<void> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      await deleteFolder(folderId, userId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
    },
    [userId]
  );

  const reorder = useCallback(
    async (folderIds: string[]): Promise<void> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      await reorderFolders(userId, folderIds);
      // Reorder local state
      const folderMap = new Map(folders.map((f) => [f.id, f]));
      const reordered = folderIds
        .map((id) => folderMap.get(id))
        .filter((f): f is Folder => f !== undefined);
      setFolders(reordered);
    },
    [userId, folders]
  );

  return {
    folders,
    isLoading,
    error,
    reload: fetchFolders,
    addFolder,
    editFolder,
    removeFolder,
    reorder,
  };
}
