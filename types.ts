
export interface HistoryEntry {
  id: string;
  code: string;
  timestamp: number;
  label: string;
  type: 'initial' | 'manual' | 'ai';
  prompt?: string;
}

export interface ProjectData {
  name: string;
  history: HistoryEntry[];
  currentIndex: number;
}

export enum ViewMode {
  Split = 'split',
  Code = 'code',
  Preview = 'preview',
  Timeline = 'timeline',
  Gallery = 'gallery'
}

// ============================================
// Extended types for Save/Share/Gallery system
// ============================================

export interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  tags: string[];
  history: HistoryEntry[];
  current_index: number;
  is_public: boolean;
  forked_from_id: string | null;
  forked_from_index: number | null;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface PublishedSketch {
  id: string;
  short_id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string | null;
  tags: string[];
  history: HistoryEntry[];
  current_index: number;
  thumbnail: string | null;
  views: number;
  likes: number;
  forks: number;
  is_featured: boolean;
  challenge_id: string | null;
  published_at: string;
  updated_at: string;
}

export interface GallerySketch extends PublishedSketch {
  author_username: string;
  author_display_name: string | null;
  author_avatar_url: string | null;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

// Local storage types for offline support
export interface LocalProject extends Omit<Project, 'user_id' | 'created_at' | 'updated_at' | 'published_at'> {
  created_at: number;
  updated_at: number;
  synced: boolean;
  remote_id?: string;
}

export interface LocalStorage {
  projects: LocalProject[];
  currentProjectId: string | null;
}

// Share link types
export type ShareMode = 'snapshot' | 'journey' | 'embed';

export interface ShareData {
  mode: ShareMode;
  shortId: string;
  url: string;
  embedCode?: string;
}

// Fork reference for tracking lineage
export interface ForkReference {
  projectId: string;
  shortId: string;
  historyIndex: number;
  authorUsername: string;
  title: string;
}

// Dialog states
export interface SaveDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  tags: string[];
  isPublic: boolean;
}

export interface ShareDialogState {
  isOpen: boolean;
  sketch: GallerySketch | null;
  mode: ShareMode;
}

// Gallery filter/sort options
export type GallerySortBy = 'recent' | 'trending' | 'most_liked' | 'most_forked';
export type GalleryFilter = 'all' | 'featured' | 'following' | 'challenges';

export interface GalleryState {
  sketches: GallerySketch[];
  isLoading: boolean;
  sortBy: GallerySortBy;
  filter: GalleryFilter;
  searchQuery: string;
  hasMore: boolean;
  page: number;
}

// Auth state
export interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
