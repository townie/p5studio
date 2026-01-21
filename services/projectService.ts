import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Project,
  PublishedSketch,
  GallerySketch,
  HistoryEntry,
  LocalProject,
  GallerySortBy,
  GalleryFilter
} from '@/types';

const LOCAL_STORAGE_KEY = 'p5studio_projects';
const CURRENT_PROJECT_KEY = 'p5studio_current_project';

// ============================================
// Local Storage Operations
// ============================================

export function getLocalProjects(): LocalProject[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveLocalProject(project: LocalProject): void {
  const projects = getLocalProjects();
  const existingIndex = projects.findIndex(p => p.id === project.id);

  if (existingIndex >= 0) {
    projects[existingIndex] = { ...project, updated_at: Date.now() };
  } else {
    projects.unshift(project);
  }

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projects));
}

export function deleteLocalProject(projectId: string): void {
  const projects = getLocalProjects().filter(p => p.id !== projectId);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projects));
}

export function getLocalProject(projectId: string): LocalProject | null {
  return getLocalProjects().find(p => p.id === projectId) || null;
}

export function getCurrentProjectId(): string | null {
  return localStorage.getItem(CURRENT_PROJECT_KEY);
}

export function setCurrentProjectId(projectId: string | null): void {
  if (projectId) {
    localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
  } else {
    localStorage.removeItem(CURRENT_PROJECT_KEY);
  }
}

export function createLocalProject(
  title: string,
  history: HistoryEntry[],
  currentIndex: number
): LocalProject {
  return {
    id: crypto.randomUUID(),
    title,
    description: null,
    tags: [],
    history,
    current_index: currentIndex,
    is_public: false,
    forked_from_id: null,
    forked_from_index: null,
    thumbnail: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    synced: false,
  };
}

// ============================================
// Cloud Storage Operations
// ============================================

// Save project to cloud
export async function saveProject(
  userId: string,
  project: Partial<Project> & { history: HistoryEntry[]; current_index: number }
): Promise<{ project: Project | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { project: null, error: 'Supabase not configured' };
  }

  const projectData = {
    user_id: userId,
    title: project.title || 'Untitled Sketch',
    description: project.description || null,
    tags: project.tags || [],
    history: project.history,
    current_index: project.current_index,
    is_public: project.is_public || false,
    forked_from_id: project.forked_from_id || null,
    forked_from_index: project.forked_from_index || null,
    thumbnail: project.thumbnail || null,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (project.id) {
    // Update existing
    result = await supabase
      .from('projects')
      .update(projectData)
      .eq('id', project.id)
      .eq('user_id', userId)
      .select()
      .single();
  } else {
    // Insert new
    result = await supabase
      .from('projects')
      .insert(projectData)
      .select()
      .single();
  }

  if (result.error) {
    return { project: null, error: result.error.message };
  }

  return { project: result.data as Project, error: null };
}

// Get user's projects
export async function getUserProjects(userId: string): Promise<Project[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects:', error);
    return [];
  }

  return data as Project[];
}

// Get single project
export async function getProject(projectId: string): Promise<Project | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error) {
    console.error('Error fetching project:', error);
    return null;
  }

  return data as Project;
}

// Delete project
export async function deleteProject(
  projectId: string,
  userId: string
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase not configured' };
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId);

  return { error: error?.message || null };
}

// ============================================
// Publishing / Sharing Operations
// ============================================

// Generate a short ID for sharing
function generateShortId(length: number = 7): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Publish a sketch to the gallery
export async function publishSketch(
  userId: string,
  project: Project | LocalProject,
  title: string,
  description: string | null,
  tags: string[]
): Promise<{ sketch: PublishedSketch | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { sketch: null, error: 'Supabase not configured' };
  }

  // Generate unique short ID
  let shortId = generateShortId();
  let attempts = 0;
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from('published_sketches')
      .select('id')
      .eq('short_id', shortId)
      .single();

    if (!existing) break;
    shortId = generateShortId();
    attempts++;
  }

  const sketchData = {
    short_id: shortId,
    project_id: 'remote_id' in project && project.remote_id ? project.remote_id : project.id,
    user_id: userId,
    title,
    description,
    tags,
    history: project.history,
    current_index: project.current_index,
    thumbnail: project.thumbnail,
  };

  const { data, error } = await supabase
    .from('published_sketches')
    .insert(sketchData)
    .select()
    .single();

  if (error) {
    return { sketch: null, error: error.message };
  }

  return { sketch: data as PublishedSketch, error: null };
}

// Get published sketch by short ID
export async function getPublishedSketch(shortId: string): Promise<GallerySketch | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabase
    .from('gallery_sketches')
    .select('*')
    .eq('short_id', shortId)
    .single();

  if (error) {
    console.error('Error fetching published sketch:', error);
    return null;
  }

  // Increment view count
  await supabase.rpc('increment_view_count', { sketch_short_id: shortId });

  return data as GallerySketch;
}

// Unpublish a sketch
export async function unpublishSketch(
  sketchId: string,
  userId: string
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase not configured' };
  }

  const { error } = await supabase
    .from('published_sketches')
    .delete()
    .eq('id', sketchId)
    .eq('user_id', userId);

  return { error: error?.message || null };
}

// ============================================
// Gallery Operations
// ============================================

interface GalleryOptions {
  sortBy?: GallerySortBy;
  filter?: GalleryFilter;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
  userId?: string;
  tag?: string;
}

export async function getGallerySketches(
  options: GalleryOptions = {}
): Promise<{ sketches: GallerySketch[]; hasMore: boolean }> {
  if (!isSupabaseConfigured) {
    return { sketches: [], hasMore: false };
  }

  const {
    sortBy = 'recent',
    filter = 'all',
    searchQuery = '',
    page = 0,
    pageSize = 20,
    userId,
    tag,
  } = options;

  let query = supabase
    .from('gallery_sketches')
    .select('*');

  // Apply filters
  if (filter === 'featured') {
    query = query.eq('is_featured', true);
  }

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  if (searchQuery) {
    query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
  }

  // Apply sorting
  switch (sortBy) {
    case 'trending':
      // For trending, we'd ideally use the trending_sketches view
      query = query.order('likes', { ascending: false });
      break;
    case 'most_liked':
      query = query.order('likes', { ascending: false });
      break;
    case 'most_forked':
      query = query.order('forks', { ascending: false });
      break;
    case 'recent':
    default:
      query = query.order('published_at', { ascending: false });
      break;
  }

  // Pagination
  const from = page * pageSize;
  const to = from + pageSize;
  query = query.range(from, to);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching gallery:', error);
    return { sketches: [], hasMore: false };
  }

  return {
    sketches: data as GallerySketch[],
    hasMore: data.length === pageSize + 1,
  };
}

// Get featured sketches
export async function getFeaturedSketches(): Promise<GallerySketch[]> {
  const { sketches } = await getGallerySketches({
    filter: 'featured',
    pageSize: 6,
  });
  return sketches;
}

// Get user's published sketches
export async function getUserSketches(userId: string): Promise<GallerySketch[]> {
  const { sketches } = await getGallerySketches({
    userId,
    pageSize: 100,
  });
  return sketches;
}

// ============================================
// Like Operations
// ============================================

export async function likeSketch(
  userId: string,
  sketchId: string
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase not configured' };
  }

  const { error } = await supabase
    .from('likes')
    .insert({ user_id: userId, sketch_id: sketchId });

  return { error: error?.message || null };
}

export async function unlikeSketch(
  userId: string,
  sketchId: string
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase not configured' };
  }

  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', userId)
    .eq('sketch_id', sketchId);

  return { error: error?.message || null };
}

export async function hasUserLiked(
  userId: string,
  sketchId: string
): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return false;
  }

  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', userId)
    .eq('sketch_id', sketchId)
    .single();

  return Boolean(data);
}

// Get user's liked sketches
export async function getUserLikedSketches(userId: string): Promise<GallerySketch[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase
    .from('likes')
    .select(`
      sketch_id,
      published_sketches!inner (
        *,
        profiles!inner (
          username,
          display_name,
          avatar_url
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching liked sketches:', error);
    return [];
  }

  // Transform the nested data
  return data.map((item: any) => ({
    ...item.published_sketches,
    author_username: item.published_sketches.profiles.username,
    author_display_name: item.published_sketches.profiles.display_name,
    author_avatar_url: item.published_sketches.profiles.avatar_url,
  }));
}

// ============================================
// Fork Operations
// ============================================

export async function forkSketch(
  userId: string,
  sketch: GallerySketch,
  historyIndex?: number
): Promise<{ project: Project | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { project: null, error: 'Supabase not configured' };
  }

  const forkIndex = historyIndex ?? sketch.current_index;
  const forkedHistory = sketch.history.slice(0, forkIndex + 1);

  const projectData = {
    user_id: userId,
    title: `Fork of ${sketch.title}`,
    description: `Forked from @${sketch.author_username}'s "${sketch.title}"`,
    tags: sketch.tags,
    history: forkedHistory,
    current_index: forkedHistory.length - 1,
    is_public: false,
    forked_from_id: sketch.project_id,
    forked_from_index: forkIndex,
    thumbnail: sketch.thumbnail,
  };

  const { data, error } = await supabase
    .from('projects')
    .insert(projectData)
    .select()
    .single();

  if (error) {
    return { project: null, error: error.message };
  }

  return { project: data as Project, error: null };
}

// ============================================
// Thumbnail Generation
// ============================================

export async function generateThumbnail(code: string): Promise<string | null> {
  return new Promise((resolve) => {
    // Create an offscreen iframe to run the sketch
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.width = '400px';
    iframe.style.height = '400px';
    document.body.appendChild(iframe);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
          <style>
            body { margin: 0; overflow: hidden; background: #0a0a0a; }
            canvas { display: block; }
          </style>
        </head>
        <body>
          <script>
            ${code}

            // Capture after 1 second
            setTimeout(() => {
              const canvas = document.querySelector('canvas');
              if (canvas) {
                window.parent.postMessage({
                  type: 'thumbnail',
                  data: canvas.toDataURL('image/jpeg', 0.7)
                }, '*');
              } else {
                window.parent.postMessage({ type: 'thumbnail', data: null }, '*');
              }
            }, 1000);
          </script>
        </body>
      </html>
    `;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'thumbnail') {
        window.removeEventListener('message', handleMessage);
        document.body.removeChild(iframe);
        resolve(event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);

    const blob = new Blob([html], { type: 'text/html' });
    iframe.src = URL.createObjectURL(blob);

    // Timeout after 3 seconds
    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      resolve(null);
    }, 3000);
  });
}

// ============================================
// Share URL Generation
// ============================================

export function getShareUrl(shortId: string, mode: 'snapshot' | 'journey' = 'snapshot'): string {
  const baseUrl = window.location.origin;
  const path = mode === 'journey' ? '/j/' : '/s/';
  return `${baseUrl}${path}${shortId}`;
}

export function getEmbedCode(shortId: string, width = 400, height = 400): string {
  const baseUrl = window.location.origin;
  return `<iframe src="${baseUrl}/embed/${shortId}" width="${width}" height="${height}" frameborder="0" allowfullscreen></iframe>`;
}
