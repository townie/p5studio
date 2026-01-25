import { supabase } from '@/lib/supabase';
import type { Collection, CollectionProject, Project } from '@/types';

/**
 * Get all collections for a user
 */
export async function getUserCollections(userId: string): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch user collections: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Create a new collection
 */
export async function createCollection(
  userId: string,
  name: string,
  description?: string,
  isPublic: boolean = false
): Promise<Collection> {
  const { data, error } = await supabase
    .from('collections')
    .insert({
      user_id: userId,
      name,
      description: description ?? null,
      is_public: isPublic,
      is_featured: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create collection: ${error.message}`);
  }

  return data;
}

/**
 * Update a collection
 */
export async function updateCollection(
  collectionId: string,
  userId: string,
  updates: Partial<Pick<Collection, 'name' | 'description' | 'is_public'>>
): Promise<Collection> {
  const { data, error } = await supabase
    .from('collections')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', collectionId)
    .eq('user_id', userId) // Ensure ownership
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update collection: ${error.message}`);
  }

  return data;
}

/**
 * Delete a collection
 */
export async function deleteCollection(
  collectionId: string,
  userId: string
): Promise<void> {
  // Delete collection_projects entries first (cascade should handle this, but be explicit)
  const { error: projectsError } = await supabase
    .from('collection_projects')
    .delete()
    .eq('collection_id', collectionId);

  if (projectsError) {
    throw new Error(`Failed to delete collection projects: ${projectsError.message}`);
  }

  // Delete the collection
  const { error: collectionError } = await supabase
    .from('collections')
    .delete()
    .eq('id', collectionId)
    .eq('user_id', userId); // Ensure ownership

  if (collectionError) {
    throw new Error(`Failed to delete collection: ${collectionError.message}`);
  }
}

/**
 * Add a project to a collection
 */
export async function addProjectToCollection(
  collectionId: string,
  projectId: string,
  userId: string
): Promise<void> {
  // Verify collection ownership
  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .select('id')
    .eq('id', collectionId)
    .eq('user_id', userId)
    .single();

  if (collectionError || !collection) {
    throw new Error('Collection not found or access denied');
  }

  // Get the next position (max position + 1)
  const { data: existingProjects, error: positionError } = await supabase
    .from('collection_projects')
    .select('position')
    .eq('collection_id', collectionId)
    .order('position', { ascending: false })
    .limit(1);

  if (positionError) {
    throw new Error(`Failed to determine position: ${positionError.message}`);
  }

  const nextPosition = existingProjects && existingProjects.length > 0
    ? existingProjects[0].position + 1
    : 0;

  // Add the project to the collection
  const { error: insertError } = await supabase
    .from('collection_projects')
    .insert({
      collection_id: collectionId,
      project_id: projectId,
      position: nextPosition,
    });

  if (insertError) {
    // Check if it's a duplicate entry error
    if (insertError.code === '23505') {
      throw new Error('Project already exists in this collection');
    }
    throw new Error(`Failed to add project to collection: ${insertError.message}`);
  }
}

/**
 * Remove a project from a collection
 */
export async function removeProjectFromCollection(
  collectionId: string,
  projectId: string,
  userId: string
): Promise<void> {
  // Verify collection ownership
  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .select('id')
    .eq('id', collectionId)
    .eq('user_id', userId)
    .single();

  if (collectionError || !collection) {
    throw new Error('Collection not found or access denied');
  }

  // Remove the project from the collection
  const { error } = await supabase
    .from('collection_projects')
    .delete()
    .eq('collection_id', collectionId)
    .eq('project_id', projectId);

  if (error) {
    throw new Error(`Failed to remove project from collection: ${error.message}`);
  }
}

/**
 * Get projects in a collection
 */
export async function getCollectionProjects(collectionId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('collection_projects')
    .select(`
      project_id,
      position,
      projects (*)
    `)
    .eq('collection_id', collectionId)
    .order('position', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch collection projects: ${error.message}`);
  }

  // Extract projects from the join and ensure proper typing
  const projects = (data ?? [])
    .map((cp: any) => cp.projects)
    .filter((p): p is Project => p !== null);

  return projects;
}

/**
 * Get collections that contain a specific project
 */
export async function getProjectCollections(
  projectId: string,
  userId: string
): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collection_projects')
    .select(`
      collection_id,
      collections (*)
    `)
    .eq('project_id', projectId);

  if (error) {
    throw new Error(`Failed to fetch project collections: ${error.message}`);
  }

  // Extract collections from the join and filter by user ownership
  const collections = (data ?? [])
    .map((cp: any) => cp.collections)
    .filter((c): c is Collection => c !== null && c.user_id === userId);

  return collections;
}

/**
 * Bulk add/remove projects to/from collections
 * This replaces the project's collection memberships with the provided list
 */
export async function updateProjectCollections(
  projectId: string,
  userId: string,
  collectionIds: string[]
): Promise<void> {
  // Get current collections for this project (owned by user)
  const currentCollections = await getProjectCollections(projectId, userId);
  const currentCollectionIds = new Set(currentCollections.map(c => c.id));

  // Determine what to add and remove
  const toAdd = collectionIds.filter(id => !currentCollectionIds.has(id));
  const toRemove = currentCollections
    .filter(c => !collectionIds.includes(c.id))
    .map(c => c.id);

  // Remove from collections no longer selected
  if (toRemove.length > 0) {
    for (const collectionId of toRemove) {
      await removeProjectFromCollection(collectionId, projectId, userId);
    }
  }

  // Add to newly selected collections
  if (toAdd.length > 0) {
    for (const collectionId of toAdd) {
      await addProjectToCollection(collectionId, projectId, userId);
    }
  }
}
