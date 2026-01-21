
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
  Timeline = 'timeline'
}

// ============================================
// Save/Share/Gallery System Types
// ============================================

/**
 * Save status for auto-save functionality
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Project visibility levels
 */
export type Visibility = 'public' | 'unlisted' | 'private';

/**
 * Notification types for the notification system
 */
export type NotificationType = 'like' | 'fork' | 'follow' | 'comment' | 'mention';

/**
 * User profile data (maps to profiles table)
 */
export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  twitter_handle: string | null;
  github_handle: string | null;
  created_at: string;
  updated_at: string;
  // Denormalized stats
  projects_count: number;
  followers_count: number;
  following_count: number;
  total_likes_received: number;
}

/**
 * Stored project history entry (maps to project_history table)
 */
export interface ProjectHistoryEntry {
  id: string;
  project_id: string;
  entry_id: string;
  code: string;
  timestamp: number;
  label: string;
  type: 'initial' | 'manual' | 'ai';
  prompt: string | null;
  position: number;
  created_at: string;
}

/**
 * Project data stored in the database (maps to projects table)
 */
export interface Project {
  id: string;
  user_id: string;
  // Basic info
  name: string;
  description: string | null;
  // Current state
  current_code: string;
  current_index: number;
  // Visibility
  visibility: Visibility;
  // Forking lineage
  forked_from_id: string | null;
  fork_depth: number;
  // Metadata
  tags: string[];
  thumbnail_url: string | null;
  preview_gif_url: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
  published_at: string | null;
  // Denormalized stats
  likes_count: number;
  forks_count: number;
  views_count: number;
  comments_count: number;
}

/**
 * Project with nested author profile (for gallery/display)
 */
export interface ProjectWithAuthor extends Project {
  author: Profile;
  forked_from?: ProjectWithAuthor | null;
}

/**
 * Like interaction (maps to likes table)
 */
export interface Like {
  user_id: string;
  project_id: string;
  created_at: string;
}

/**
 * Bookmark interaction (maps to bookmarks table)
 */
export interface Bookmark {
  user_id: string;
  project_id: string;
  created_at: string;
}

/**
 * Follow relationship (maps to follows table)
 */
export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

/**
 * Comment on a project (maps to comments table)
 */
export interface Comment {
  id: string;
  project_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Comment with nested author profile (for display)
 */
export interface CommentWithAuthor extends Comment {
  author: Profile;
  replies?: CommentWithAuthor[];
}

/**
 * Notification for user activity (maps to notifications table)
 */
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  actor_id: string;
  project_id: string | null;
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
}

/**
 * Notification with nested actor and related entities (for display)
 */
export interface NotificationWithDetails extends Notification {
  actor: Profile;
  project?: Project | null;
  comment?: Comment | null;
}

/**
 * Tag for categorizing projects (maps to tags table)
 */
export interface Tag {
  id: string;
  name: string;
  slug: string;
  projects_count: number;
  created_at: string;
}

/**
 * Collection of curated projects (maps to collections table)
 */
export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  is_featured: boolean;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Project within a collection (maps to collection_projects table)
 */
export interface CollectionProject {
  collection_id: string;
  project_id: string;
  position: number;
  added_at: string;
}

/**
 * Collection with nested projects (for display)
 */
export interface CollectionWithProjects extends Collection {
  projects: ProjectWithAuthor[];
}

/**
 * View record for analytics (maps to views table)
 */
export interface View {
  id: string;
  project_id: string;
  viewer_id: string | null;
  viewer_ip_hash: string | null;
  created_at: string;
}

/**
 * Gallery filter options
 */
export type GalleryFilter = 'trending' | 'new' | 'following';

/**
 * Gallery query parameters
 */
export interface GalleryQuery {
  filter: GalleryFilter;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}
