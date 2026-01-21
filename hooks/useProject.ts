import { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, ProjectData, SaveStatus } from '@/types';
import {
  saveProject,
  loadProject,
  getUserProjects,
  deleteProject,
} from '@/services/projectService';

const AUTO_SAVE_DELAY = 2000; // 2 seconds debounce

/**
 * Hook for auto-saving project data with debouncing
 */
export function useAutoSave(
  projectId: string | undefined,
  projectData: ProjectData | null,
  userId: string | undefined
): {
  saveStatus: SaveStatus;
  lastSaved: Date | null;
  forceSave: () => Promise<void>;
} {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDataRef = useRef<string | null>(null);

  // Serialize project data for comparison
  const serializedData = projectData ? JSON.stringify(projectData) : null;

  const performSave = useCallback(async () => {
    if (!projectId || !projectData || !userId) {
      return;
    }

    // Skip if data hasn't changed
    if (serializedData === lastSavedDataRef.current) {
      return;
    }

    setSaveStatus('saving');

    try {
      await saveProject(userId, projectData, projectId);
      lastSavedDataRef.current = serializedData;
      setLastSaved(new Date());
      setSaveStatus('saved');
    } catch (error) {
      console.error('Auto-save failed:', error);
      setSaveStatus('error');
    }
  }, [projectId, projectData, userId, serializedData]);

  // Debounced auto-save
  useEffect(() => {
    if (!projectId || !projectData || !userId) {
      return;
    }

    // Skip if data hasn't changed
    if (serializedData === lastSavedDataRef.current) {
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      performSave();
    }, AUTO_SAVE_DELAY);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [projectId, projectData, userId, serializedData, performSave]);

  // Force save (bypass debounce)
  const forceSave = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    await performSave();
  }, [performSave]);

  return { saveStatus, lastSaved, forceSave };
}

/**
 * Hook for loading and managing a single project
 */
export function useProject(projectId: string | undefined): {
  project: Project | null;
  projectData: ProjectData | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
} {
  const [project, setProject] = useState<Project | null>(null);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setProjectData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await loadProject(projectId);
      if (result) {
        setProject(result.project);
        setProjectData(result.projectData);
      } else {
        setProject(null);
        setProjectData(null);
        setError(new Error('Project not found'));
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load project');
      setError(error);
      setProject(null);
      setProjectData(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  return {
    project,
    projectData,
    isLoading,
    error,
    reload: fetchProject,
  };
}

/**
 * Hook for listing a user's projects
 */
export function useUserProjects(userId: string | undefined): {
  projects: Project[];
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  removeProject: (projectId: string) => Promise<void>;
} {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!userId) {
      setProjects([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getUserProjects(userId);
      setProjects(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load projects');
      setError(error);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const removeProject = useCallback(
    async (projectId: string) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      try {
        await deleteProject(projectId, userId);
        // Optimistically remove from local state
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete project');
        throw error;
      }
    },
    [userId]
  );

  return {
    projects,
    isLoading,
    error,
    reload: fetchProjects,
    removeProject,
  };
}

/**
 * Hook for creating a new project
 */
export function useCreateProject(userId: string | undefined): {
  createProject: (projectData: ProjectData) => Promise<Project>;
  isCreating: boolean;
  error: Error | null;
} {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createProject = useCallback(
    async (projectData: ProjectData): Promise<Project> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      setIsCreating(true);
      setError(null);

      try {
        const result = await saveProject(userId, projectData);
        return result.project;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create project');
        setError(error);
        throw error;
      } finally {
        setIsCreating(false);
      }
    },
    [userId]
  );

  return {
    createProject,
    isCreating,
    error,
  };
}

/**
 * Hook for managing project save state with manual save capability
 */
export function useSaveProject(
  projectId: string | undefined,
  userId: string | undefined
): {
  save: (projectData: ProjectData) => Promise<{ project: Project; isNew: boolean }>;
  isSaving: boolean;
  error: Error | null;
} {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const save = useCallback(
    async (
      projectData: ProjectData
    ): Promise<{ project: Project; isNew: boolean }> => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      setIsSaving(true);
      setError(null);

      try {
        const result = await saveProject(userId, projectData, projectId);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to save project');
        setError(error);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [projectId, userId]
  );

  return {
    save,
    isSaving,
    error,
  };
}
