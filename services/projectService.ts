import { supabase } from '@/lib/supabase';
import type {
  Project,
  ProjectData,
  ProjectWithAuthor,
  HistoryEntry,
  ProjectHistoryEntry,
  Visibility,
} from '@/types';

/**
 * Convert client-side HistoryEntry to database ProjectHistoryEntry format
 */
function historyEntryToDb(
  entry: HistoryEntry,
  projectId: string,
  position: number
): Omit<ProjectHistoryEntry, 'id' | 'created_at'> {
  return {
    project_id: projectId,
    entry_id: entry.id,
    code: entry.code,
    timestamp: entry.timestamp,
    label: entry.label,
    type: entry.type,
    prompt: entry.prompt ?? null,
    position,
  };
}

/**
 * Convert database ProjectHistoryEntry to client-side HistoryEntry format
 */
function dbToHistoryEntry(dbEntry: ProjectHistoryEntry): HistoryEntry {
  return {
    id: dbEntry.entry_id,
    code: dbEntry.code,
    timestamp: dbEntry.timestamp,
    label: dbEntry.label,
    type: dbEntry.type,
    prompt: dbEntry.prompt ?? undefined,
  };
}

/**
 * Save or update a project with its full history
 */
export async function saveProject(
  userId: string,
  projectData: ProjectData,
  projectId?: string
): Promise<{ project: Project; isNew: boolean }> {
  const currentCode =
    projectData.history[projectData.currentIndex]?.code ?? '';

  if (projectId) {
    // Update existing project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .update({
        name: projectData.name,
        current_code: currentCode,
        current_index: projectData.currentIndex,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .eq('user_id', userId) // Ensure ownership
      .select()
      .single();

    if (projectError) {
      throw new Error(`Failed to update project: ${projectError.message}`);
    }

    // Sync history entries
    await syncHistoryEntries(projectId, projectData.history);

    return { project, isNew: false };
  } else {
    // Create new project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: projectData.name,
        current_code: currentCode,
        current_index: projectData.currentIndex,
        visibility: 'private' as Visibility,
        fork_depth: 0,
        tags: [],
        likes_count: 0,
        forks_count: 0,
        views_count: 0,
        comments_count: 0,
      })
      .select()
      .single();

    if (projectError) {
      throw new Error(`Failed to create project: ${projectError.message}`);
    }

    // Insert all history entries
    const historyInserts = projectData.history.map((entry, index) =>
      historyEntryToDb(entry, project.id, index)
    );

    if (historyInserts.length > 0) {
      const { error: historyError } = await supabase
        .from('project_history')
        .insert(historyInserts);

      if (historyError) {
        throw new Error(`Failed to save history: ${historyError.message}`);
      }
    }

    return { project, isNew: true };
  }
}

/**
 * Sync history entries for an existing project
 * This handles additions, updates, and deletions
 */
async function syncHistoryEntries(
  projectId: string,
  history: HistoryEntry[]
): Promise<void> {
  // Get existing history entries
  const { data: existingEntries, error: fetchError } = await supabase
    .from('project_history')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true });

  if (fetchError) {
    throw new Error(`Failed to fetch history: ${fetchError.message}`);
  }

  const existingMap = new Map(
    (existingEntries ?? []).map((e) => [e.entry_id, e])
  );
  const newEntryIds = new Set(history.map((e) => e.id));

  // Entries to delete (exist in DB but not in new history)
  const toDelete = (existingEntries ?? []).filter(
    (e) => !newEntryIds.has(e.entry_id)
  );

  // Entries to insert or update
  const toUpsert: Omit<ProjectHistoryEntry, 'id' | 'created_at'>[] = [];

  history.forEach((entry, position) => {
    const existing = existingMap.get(entry.id);
    const dbEntry = historyEntryToDb(entry, projectId, position);

    if (!existing) {
      // New entry
      toUpsert.push(dbEntry);
    } else if (
      existing.code !== entry.code ||
      existing.label !== entry.label ||
      existing.position !== position ||
      existing.prompt !== (entry.prompt ?? null)
    ) {
      // Entry needs update
      toUpsert.push(dbEntry);
    }
  });

  // Delete removed entries
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('project_history')
      .delete()
      .in(
        'id',
        toDelete.map((e) => e.id)
      );

    if (deleteError) {
      throw new Error(`Failed to delete history entries: ${deleteError.message}`);
    }
  }

  // Upsert new/updated entries
  if (toUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from('project_history')
      .upsert(toUpsert, { onConflict: 'project_id,entry_id' });

    if (upsertError) {
      throw new Error(`Failed to upsert history entries: ${upsertError.message}`);
    }
  }
}

/**
 * Load a project with its full history
 */
export async function loadProject(
  projectId: string
): Promise<{ project: Project; projectData: ProjectData } | null> {
  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (projectError) {
    if (projectError.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to load project: ${projectError.message}`);
  }

  // Fetch history entries
  const { data: historyEntries, error: historyError } = await supabase
    .from('project_history')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true });

  if (historyError) {
    throw new Error(`Failed to load history: ${historyError.message}`);
  }

  // Convert to client-side format
  const history = (historyEntries ?? []).map(dbToHistoryEntry);

  const projectData: ProjectData = {
    name: project.name,
    history,
    currentIndex: project.current_index,
  };

  return { project, projectData };
}

/**
 * Get all projects for a user
 */
export async function getUserProjects(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch user projects: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Delete a project and its history
 */
export async function deleteProject(
  projectId: string,
  userId: string
): Promise<void> {
  // Delete history entries first (cascade should handle this, but be explicit)
  const { error: historyError } = await supabase
    .from('project_history')
    .delete()
    .eq('project_id', projectId);

  if (historyError) {
    throw new Error(`Failed to delete project history: ${historyError.message}`);
  }

  // Delete the project
  const { error: projectError } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId); // Ensure ownership

  if (projectError) {
    throw new Error(`Failed to delete project: ${projectError.message}`);
  }
}

/**
 * Update project visibility
 */
export async function updateProjectVisibility(
  projectId: string,
  userId: string,
  visibility: Visibility
): Promise<Project> {
  const updateData: Partial<Project> = {
    visibility,
    updated_at: new Date().toISOString(),
  };

  // Set published_at when making public for the first time
  if (visibility === 'public') {
    const { data: existingProject } = await supabase
      .from('projects')
      .select('published_at')
      .eq('id', projectId)
      .single();

    if (!existingProject?.published_at) {
      updateData.published_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', projectId)
    .eq('user_id', userId) // Ensure ownership
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update visibility: ${error.message}`);
  }

  return data;
}

/**
 * Get a public or unlisted project (for sharing)
 * Does not require ownership - used for viewing shared projects
 */
export async function getPublicProject(
  projectId: string
): Promise<ProjectWithAuthor | null> {
  const { data, error } = await supabase
    .from('projects')
    .select(
      `
      *,
      author:profiles!user_id(*),
      forked_from:projects!forked_from_id(
        *,
        author:profiles!user_id(*)
      )
    `
    )
    .eq('id', projectId)
    .in('visibility', ['public', 'unlisted'])
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found or not accessible
      return null;
    }
    throw new Error(`Failed to fetch public project: ${error.message}`);
  }

  return data as ProjectWithAuthor;
}

/**
 * Get a public project with its full history (for viewing/forking)
 */
export async function getPublicProjectWithHistory(
  projectId: string
): Promise<{ project: ProjectWithAuthor; projectData: ProjectData } | null> {
  const project = await getPublicProject(projectId);
  if (!project) {
    return null;
  }

  // Fetch history entries
  const { data: historyEntries, error: historyError } = await supabase
    .from('project_history')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true });

  if (historyError) {
    throw new Error(`Failed to load history: ${historyError.message}`);
  }

  const history = (historyEntries ?? []).map(dbToHistoryEntry);

  const projectData: ProjectData = {
    name: project.name,
    history,
    currentIndex: project.current_index,
  };

  return { project, projectData };
}

/**
 * Fork a project
 */
export async function forkProject(
  sourceProjectId: string,
  userId: string,
  newName?: string
): Promise<{ project: Project; projectData: ProjectData }> {
  // Load the source project
  const source = await getPublicProjectWithHistory(sourceProjectId);
  if (!source) {
    throw new Error('Source project not found or not accessible');
  }

  // Create new project data with forked name
  const forkedData: ProjectData = {
    name: newName ?? `${source.project.name} (fork)`,
    history: source.projectData.history,
    currentIndex: source.projectData.currentIndex,
  };

  // Create the new project
  const { data: newProject, error: projectError } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: forkedData.name,
      description: source.project.description,
      current_code: source.project.current_code,
      current_index: forkedData.currentIndex,
      visibility: 'private' as Visibility,
      forked_from_id: sourceProjectId,
      fork_depth: source.project.fork_depth + 1,
      tags: source.project.tags,
      likes_count: 0,
      forks_count: 0,
      views_count: 0,
      comments_count: 0,
    })
    .select()
    .single();

  if (projectError) {
    throw new Error(`Failed to fork project: ${projectError.message}`);
  }

  // Copy history entries
  const historyInserts = forkedData.history.map((entry, index) =>
    historyEntryToDb(entry, newProject.id, index)
  );

  if (historyInserts.length > 0) {
    const { error: historyError } = await supabase
      .from('project_history')
      .insert(historyInserts);

    if (historyError) {
      throw new Error(`Failed to copy history: ${historyError.message}`);
    }
  }

  // Increment forks_count on source project
  await supabase.rpc('increment_forks_count', { project_id: sourceProjectId });

  return { project: newProject, projectData: forkedData };
}

/**
 * Record a view for a project
 */
export async function recordProjectView(
  projectId: string,
  viewerId?: string
): Promise<void> {
  await supabase.from('views').insert({
    project_id: projectId,
    viewer_id: viewerId ?? null,
  });

  // Increment views_count (fire and forget)
  supabase.rpc('increment_views_count', { project_id: projectId });
}
