import { useState, useEffect, useCallback } from 'react';
import type { Collection } from '@/types';
import {
  getUserCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from '@/services/collectionService';

/**
 * Hook for managing user's collections
 */
export function useCollections(userId: string | undefined): {
  collections: Collection[];
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  addCollection: (name: string, description?: string, isPublic?: boolean) => Promise<Collection>;
  editCollection: (collectionId: string, updates: Partial<Pick<Collection, 'name' | 'description' | 'is_public'>>) => Promise<Collection>;
  removeCollection: (collectionId: string) => Promise<void>;
} {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCollections = useCallback(async () => {
    if (!userId) {
      setCollections([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getUserCollections(userId);
      setCollections(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load collections');
      setError(error);
      setCollections([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const addCollection = useCallback(
    async (name: string, description?: string, isPublic?: boolean): Promise<Collection> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const newCollection = await createCollection(userId, name, description, isPublic);
      setCollections((prev) => [...prev, newCollection]);
      return newCollection;
    },
    [userId]
  );

  const editCollection = useCallback(
    async (
      collectionId: string,
      updates: Partial<Pick<Collection, 'name' | 'description' | 'is_public'>>
    ): Promise<Collection> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const updatedCollection = await updateCollection(collectionId, userId, updates);
      setCollections((prev) =>
        prev.map((c) => (c.id === collectionId ? updatedCollection : c))
      );
      return updatedCollection;
    },
    [userId]
  );

  const removeCollection = useCallback(
    async (collectionId: string): Promise<void> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      await deleteCollection(collectionId, userId);
      setCollections((prev) => prev.filter((c) => c.id !== collectionId));
    },
    [userId]
  );

  return {
    collections,
    isLoading,
    error,
    reload: fetchCollections,
    addCollection,
    editCollection,
    removeCollection,
  };
}
