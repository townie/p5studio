-- Migration: 006_indexes
-- Description: Create all indexes and full-text search setup for performance
-- Dependencies: All previous migrations

-- ============================================================================
-- PROFILES INDEXES
-- ============================================================================

-- Index for username lookups (already unique, but adding for clarity)
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Index for finding users by follower/following counts (for leaderboards)
CREATE INDEX idx_profiles_followers_count ON profiles(followers_count DESC);
CREATE INDEX idx_profiles_total_likes ON profiles(total_likes_received DESC);

-- ============================================================================
-- PROJECTS INDEXES
-- ============================================================================

-- Index for user's projects
CREATE INDEX idx_projects_user_id ON projects(user_id);

-- Index for public projects (partial index for efficiency)
CREATE INDEX idx_projects_visibility ON projects(visibility) WHERE visibility = 'public';

-- Index for gallery sorting by publish date
CREATE INDEX idx_projects_published_at ON projects(published_at DESC) WHERE visibility = 'public';

-- Index for trending/popular projects (sorted by likes)
CREATE INDEX idx_projects_likes_count ON projects(likes_count DESC) WHERE visibility = 'public';

-- Index for recent projects
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- Index for finding forks of a project
CREATE INDEX idx_projects_forked_from ON projects(forked_from_id) WHERE forked_from_id IS NOT NULL;

-- Index for tag-based filtering
CREATE INDEX idx_projects_tags ON projects USING gin(tags);

-- Composite index for user's projects sorted by update time
CREATE INDEX idx_projects_user_updated ON projects(user_id, updated_at DESC);

-- ============================================================================
-- PROJECT HISTORY INDEXES
-- ============================================================================

-- Index for retrieving history entries for a project
CREATE INDEX idx_project_history_project_id ON project_history(project_id);

-- Composite index for retrieving history in order
CREATE INDEX idx_project_history_project_position ON project_history(project_id, position);

-- ============================================================================
-- SOCIAL TABLE INDEXES
-- ============================================================================

-- Likes: Index for finding who liked a project
CREATE INDEX idx_likes_project_id ON likes(project_id);

-- Likes: Index for finding what a user liked
CREATE INDEX idx_likes_user_id ON likes(user_id);

-- Likes: Index for recent likes (for activity feeds)
CREATE INDEX idx_likes_created_at ON likes(created_at DESC);

-- Bookmarks: Index for user's bookmarks
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);

-- Bookmarks: Index for recent bookmarks
CREATE INDEX idx_bookmarks_created_at ON bookmarks(user_id, created_at DESC);

-- Follows: Index for finding followers of a user
CREATE INDEX idx_follows_following_id ON follows(following_id);

-- Follows: Index for finding who a user follows
CREATE INDEX idx_follows_follower_id ON follows(follower_id);

-- Follows: Index for recent follows
CREATE INDEX idx_follows_created_at ON follows(created_at DESC);

-- Collections: Index for user's collections
CREATE INDEX idx_collections_user_id ON collections(user_id);

-- Collections: Index for public/featured collections
CREATE INDEX idx_collections_public ON collections(is_public, is_featured) WHERE is_public = TRUE;

-- Collection projects: Index for project membership
CREATE INDEX idx_collection_projects_project ON collection_projects(project_id);

-- ============================================================================
-- COMMENTS INDEXES
-- ============================================================================

-- Index for comments on a project
CREATE INDEX idx_comments_project_id ON comments(project_id);

-- Index for a user's comments
CREATE INDEX idx_comments_user_id ON comments(user_id);

-- Index for finding replies to a comment
CREATE INDEX idx_comments_parent_id ON comments(parent_id) WHERE parent_id IS NOT NULL;

-- Index for recent comments (activity feeds)
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- Composite index for project comments sorted by time
CREATE INDEX idx_comments_project_created ON comments(project_id, created_at);

-- Partial index excluding deleted comments
CREATE INDEX idx_comments_active ON comments(project_id, created_at)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- NOTIFICATIONS INDEXES
-- ============================================================================

-- Index for user's notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id, read_at);

-- Index for unread notifications
CREATE INDEX idx_notifications_unread ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

-- Index for recent notifications
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================================
-- VIEWS INDEXES
-- ============================================================================

-- Index for view analytics per project
CREATE INDEX idx_views_project_created ON views(project_id, created_at);

-- Index for recent views (trending calculation)
CREATE INDEX idx_views_recent ON views(created_at DESC);

-- Partial index for authenticated views
CREATE INDEX idx_views_viewer ON views(viewer_id, created_at)
  WHERE viewer_id IS NOT NULL;

-- ============================================================================
-- TAGS INDEXES
-- ============================================================================

-- Index for tag lookups by slug
CREATE INDEX idx_tags_slug ON tags(slug);

-- Index for popular tags
CREATE INDEX idx_tags_projects_count ON tags(projects_count DESC);

-- ============================================================================
-- FULL-TEXT SEARCH
-- ============================================================================

-- Add search vector column to projects for full-text search
ALTER TABLE projects ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'C')
  ) STORED;

-- GIN index for full-text search
CREATE INDEX idx_projects_search ON projects USING gin(search_vector);

-- Add search vector to profiles for user search
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(username, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(display_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(bio, '')), 'C')
  ) STORED;

-- GIN index for profile search
CREATE INDEX idx_profiles_search ON profiles USING gin(search_vector);

-- ============================================================================
-- SEARCH FUNCTIONS
-- ============================================================================

-- Function to search projects
CREATE OR REPLACE FUNCTION search_projects(
  search_query TEXT,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  visibility_filter TEXT DEFAULT 'public'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  thumbnail_url TEXT,
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  likes_count INT,
  forks_count INT,
  views_count INT,
  created_at TIMESTAMPTZ,
  rank REAL
) AS $$
  SELECT
    p.id,
    p.name,
    p.description,
    p.thumbnail_url,
    p.user_id,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    p.likes_count,
    p.forks_count,
    p.views_count,
    p.created_at,
    ts_rank(p.search_vector, websearch_to_tsquery('english', search_query)) AS rank
  FROM projects p
  JOIN profiles pr ON p.user_id = pr.id
  WHERE p.visibility = visibility_filter
    AND p.search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC, p.likes_count DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE;

-- Function to search users
CREATE OR REPLACE FUNCTION search_users(
  search_query TEXT,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  projects_count INT,
  followers_count INT,
  rank REAL
) AS $$
  SELECT
    id,
    username,
    display_name,
    avatar_url,
    bio,
    projects_count,
    followers_count,
    ts_rank(search_vector, websearch_to_tsquery('english', search_query)) AS rank
  FROM profiles
  WHERE search_vector @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC, followers_count DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- TRENDING ALGORITHM
-- ============================================================================

-- Add trending_score column to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS trending_score REAL DEFAULT 0;

-- Index for trending projects
CREATE INDEX idx_projects_trending ON projects(trending_score DESC)
  WHERE visibility = 'public';

-- Function to calculate trending score for a project
CREATE OR REPLACE FUNCTION calculate_trending_score(p_project_id UUID)
RETURNS REAL AS $$
DECLARE
  score REAL;
  age_hours REAL;
  recent_views INT;
  recent_likes INT;
  recent_forks INT;
BEGIN
  -- Get project age in hours since publishing
  SELECT EXTRACT(EPOCH FROM (NOW() - COALESCE(published_at, created_at))) / 3600
  INTO age_hours
  FROM projects WHERE id = p_project_id;

  -- Count recent activity (last 24 hours)
  SELECT COUNT(*) INTO recent_views
  FROM views
  WHERE project_id = p_project_id
    AND created_at > NOW() - INTERVAL '24 hours';

  SELECT COUNT(*) INTO recent_likes
  FROM likes
  WHERE project_id = p_project_id
    AND created_at > NOW() - INTERVAL '24 hours';

  SELECT COUNT(*) INTO recent_forks
  FROM projects
  WHERE forked_from_id = p_project_id
    AND created_at > NOW() - INTERVAL '24 hours';

  -- Hacker News-style gravity algorithm
  -- score = (likes*3 + forks*5 + views*0.1) / (age_hours + 2)^1.8
  score := (recent_likes * 3 + recent_forks * 5 + recent_views * 0.1)
           / POWER(GREATEST(age_hours, 1) + 2, 1.8);

  RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Function to update trending scores for all public projects
-- This should be called periodically via a cron job
CREATE OR REPLACE FUNCTION update_all_trending_scores()
RETURNS INT AS $$
DECLARE
  affected_rows INT;
BEGIN
  UPDATE projects
  SET trending_score = calculate_trending_score(id)
  WHERE visibility = 'public'
    AND published_at IS NOT NULL;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GALLERY QUERY FUNCTIONS
-- ============================================================================

-- Function to get trending projects for gallery
CREATE OR REPLACE FUNCTION get_trending_projects(
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  thumbnail_url TEXT,
  preview_gif_url TEXT,
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  likes_count INT,
  forks_count INT,
  views_count INT,
  comments_count INT,
  published_at TIMESTAMPTZ,
  trending_score REAL
) AS $$
  SELECT
    p.id,
    p.name,
    p.description,
    p.thumbnail_url,
    p.preview_gif_url,
    p.user_id,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    p.likes_count,
    p.forks_count,
    p.views_count,
    p.comments_count,
    p.published_at,
    p.trending_score
  FROM projects p
  JOIN profiles pr ON p.user_id = pr.id
  WHERE p.visibility = 'public'
    AND p.published_at IS NOT NULL
  ORDER BY p.trending_score DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE;

-- Function to get newest projects for gallery
CREATE OR REPLACE FUNCTION get_new_projects(
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  thumbnail_url TEXT,
  preview_gif_url TEXT,
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  likes_count INT,
  forks_count INT,
  views_count INT,
  comments_count INT,
  published_at TIMESTAMPTZ
) AS $$
  SELECT
    p.id,
    p.name,
    p.description,
    p.thumbnail_url,
    p.preview_gif_url,
    p.user_id,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    p.likes_count,
    p.forks_count,
    p.views_count,
    p.comments_count,
    p.published_at
  FROM projects p
  JOIN profiles pr ON p.user_id = pr.id
  WHERE p.visibility = 'public'
    AND p.published_at IS NOT NULL
  ORDER BY p.published_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE;

-- Function to get projects from followed users
CREATE OR REPLACE FUNCTION get_following_projects(
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  thumbnail_url TEXT,
  preview_gif_url TEXT,
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  likes_count INT,
  forks_count INT,
  views_count INT,
  comments_count INT,
  published_at TIMESTAMPTZ
) AS $$
  SELECT
    p.id,
    p.name,
    p.description,
    p.thumbnail_url,
    p.preview_gif_url,
    p.user_id,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    p.likes_count,
    p.forks_count,
    p.views_count,
    p.comments_count,
    p.published_at
  FROM projects p
  JOIN profiles pr ON p.user_id = pr.id
  WHERE p.visibility = 'public'
    AND p.published_at IS NOT NULL
    AND p.user_id IN (
      SELECT following_id FROM follows WHERE follower_id = auth.uid()
    )
  ORDER BY p.published_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION search_projects IS 'Full-text search for projects with ranking';
COMMENT ON FUNCTION search_users IS 'Full-text search for users with ranking';
COMMENT ON FUNCTION calculate_trending_score IS 'Calculates trending score using time-decay algorithm';
COMMENT ON FUNCTION update_all_trending_scores IS 'Updates trending scores for all public projects (run via cron)';
COMMENT ON FUNCTION get_trending_projects IS 'Returns trending projects for gallery view';
COMMENT ON FUNCTION get_new_projects IS 'Returns newest projects for gallery view';
COMMENT ON FUNCTION get_following_projects IS 'Returns projects from followed users for gallery view';
