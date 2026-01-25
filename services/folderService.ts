import { supabase } from '@/lib/supabase';
import type { Folder, Project } from '@/types';

/**
 * Get all folders for a user, ordered by position
 */
export async function getUserFolders(userId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch user folders: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Create a new folder
 */
export async function createFolder(
  userId: string,
  name: string,
  color?: string,
  icon?: string
): Promise<Folder> {
  // Get the current max position to append this folder at the end
  const { data: existingFolders, error: fetchError } = await supabase
    .from('folders')
    .select('position')
    .eq('user_id', userId)
    .order('position', { ascending: false })
    .limit(1);

  if (fetchError) {
    throw new Error(`Failed to fetch existing folders: ${fetchError.message}`);
  }

  const maxPosition = existingFolders?.[0]?.position ?? -1;
  const newPosition = maxPosition + 1;

  const { data, error } = await supabase
    .from('folders')
    .insert({
      user_id: userId,
      name,
      color: color ?? null,
      icon: icon ?? null,
      position: newPosition,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create folder: ${error.message}`);
  }

  return data;
}

/**
 * Update a folder's name, color, or icon
 */
export async function updateFolder(
  folderId: string,
  userId: string,
  updates: Partial<Pick<Folder, 'name' | 'color' | 'icon'>>
): Promise<Folder> {
  const { data, error } = await supabase
    .from('folders')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', folderId)
    .eq('user_id', userId) // Ensure ownership
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update folder: ${error.message}`);
  }

  return data;
}

/**
 * Delete a folder
 * All projects in this folder will have their folder_id set to null (become unfoldered)
 */
export async function deleteFolder(
  folderId: string,
  userId: string
): Promise<void> {
  // First, unfolder all projects in this folder
  const { error: unfoldError } = await supabase
    .from('projects')
    .update({ folder_id: null, updated_at: new Date().toISOString() })
    .eq('folder_id', folderId)
    .eq('user_id', userId);

  if (unfoldError) {
    throw new Error(`Failed to unfolder projects: ${unfoldError.message}`);
  }

  // Delete the folder
  const { error: deleteError } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId)
    .eq('user_id', userId); // Ensure ownership

  if (deleteError) {
    throw new Error(`Failed to delete folder: ${deleteError.message}`);
  }
}

/**
 * Reorder folders by setting new positions
 * folderIds array should be in the desired order
 */
export async function reorderFolders(
  userId: string,
  folderIds: string[]
): Promise<void> {
  // Build update operations for each folder
  const updates = folderIds.map((folderId, index) => ({
    id: folderId,
    user_id: userId,
    position: index,
    updated_at: new Date().toISOString(),
  }));

  if (updates.length === 0) {
    return;
  }

  // Use upsert with onConflict to update positions
  const { error } = await supabase
    .from('folders')
    .upsert(updates, {
      onConflict: 'id',
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Failed to reorder folders: ${error.message}`);
  }
}

/**
 * Move a project to a folder (or null to unfolder it)
 */
export async function moveProjectToFolder(
  projectId: string,
  userId: string,
  folderId: string | null
): Promise<void> {
  // If moving to a folder, verify the folder exists and belongs to the user
  if (folderId) {
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id')
      .eq('id', folderId)
      .eq('user_id', userId)
      .single();

    if (folderError || !folder) {
      throw new Error('Folder not found or does not belong to user');
    }
  }

  const { error } = await supabase
    .from('projects')
    .update({
      folder_id: folderId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .eq('user_id', userId); // Ensure ownership

  if (error) {
    throw new Error(`Failed to move project to folder: ${error.message}`);
  }
}

/**
 * Get all projects in a specific folder (or unfoldered projects if folderId is null)
 */
export async function getProjectsInFolder(
  userId: string,
  folderId: string | null
): Promise<Project[]> {
  let query = supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId);

  if (folderId === null) {
    query = query.is('folder_id', null);
  } else {
    query = query.eq('folder_id', folderId);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch projects in folder: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Get folder with project count
 */
export async function getFolderWithProjectCount(
  folderId: string,
  userId: string
): Promise<Folder & { project_count: number }> {
  const { data: folder, error: folderError } = await supabase
    .from('folders')
    .select('*')
    .eq('id', folderId)
    .eq('user_id', userId)
    .single();

  if (folderError) {
    throw new Error(`Failed to fetch folder: ${folderError.message}`);
  }

  const { count, error: countError } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('folder_id', folderId)
    .eq('user_id', userId);

  if (countError) {
    throw new Error(`Failed to count projects: ${countError.message}`);
  }

  return {
    ...folder,
    project_count: count ?? 0,
  };
}
