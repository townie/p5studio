-- Migration: 001_profiles
-- Description: Create profiles table extending auth.users with RLS policies
-- Dependencies: Supabase auth.users table

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  twitter_handle TEXT,
  github_handle TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Stats (denormalized for performance)
  projects_count INT DEFAULT 0,
  followers_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  total_likes_received INT DEFAULT 0
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can view profiles (public read)
CREATE POLICY "Profiles are publicly viewable"
  ON profiles
  FOR SELECT
  USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "Users can delete own profile"
  ON profiles
  FOR DELETE
  USING (auth.uid() = id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to handle new user signup and create profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON COLUMN profiles.username IS 'Unique username for public display and URLs';
COMMENT ON COLUMN profiles.projects_count IS 'Denormalized count of user projects for performance';
COMMENT ON COLUMN profiles.followers_count IS 'Denormalized count of followers for performance';
COMMENT ON COLUMN profiles.following_count IS 'Denormalized count of users being followed for performance';
COMMENT ON COLUMN profiles.total_likes_received IS 'Denormalized total likes across all projects for performance';
-- Migration: 002_projects
-- Description: Create projects and project_history tables with RLS policies
-- Dependencies: 001_profiles

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Basic info
  name TEXT NOT NULL,
  description TEXT,

  -- The actual code (current state)
  current_code TEXT NOT NULL,
  current_index INT NOT NULL DEFAULT 0,

  -- Visibility
  visibility TEXT CHECK (visibility IN ('public', 'unlisted', 'private')) DEFAULT 'private',

  -- Forking lineage
  forked_from_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  fork_depth INT DEFAULT 0,

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,  -- Generated screenshot
  preview_gif_url TEXT,  -- Animated preview

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,  -- When first made public

  -- Stats (denormalized)
  likes_count INT DEFAULT 0,
  forks_count INT DEFAULT 0,
  views_count INT DEFAULT 0,
  comments_count INT DEFAULT 0
);

-- ============================================================================
-- PROJECT HISTORY TABLE
-- ============================================================================

CREATE TABLE project_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- Matches HistoryEntry interface
  entry_id TEXT NOT NULL,  -- The UUID from client
  code TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  label TEXT NOT NULL,
  type TEXT CHECK (type IN ('initial', 'manual', 'ai')) NOT NULL,
  prompt TEXT,

  -- Order in the history array
  position INT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, position)
);

-- ============================================================================
-- VIEWS TABLE (for trending algorithm)
-- ============================================================================

CREATE TABLE views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL for anonymous
  viewer_ip_hash TEXT,  -- Hashed IP for anonymous rate limiting
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TAGS TABLE (normalized for search)
-- ============================================================================

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  projects_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at on projects
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update user's projects_count when project is created/deleted
CREATE OR REPLACE FUNCTION update_user_projects_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET projects_count = projects_count + 1 WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET projects_count = projects_count - 1 WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_project_created_or_deleted
  AFTER INSERT OR DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_user_projects_count();

-- Update forked_from project's forks_count
CREATE OR REPLACE FUNCTION update_fork_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.forked_from_id IS NOT NULL THEN
    UPDATE projects SET forks_count = forks_count + 1 WHERE id = NEW.forked_from_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.forked_from_id IS NOT NULL THEN
    UPDATE projects SET forks_count = forks_count - 1 WHERE id = OLD.forked_from_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_project_fork_changed
  AFTER INSERT OR DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_fork_count();

-- Update views_count when a view is recorded
CREATE OR REPLACE FUNCTION update_views_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects SET views_count = views_count + 1 WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_view_created
  AFTER INSERT ON views
  FOR EACH ROW
  EXECUTE FUNCTION update_views_count();

-- Set published_at when visibility changes to public
CREATE OR REPLACE FUNCTION set_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.visibility = 'public' AND OLD.visibility != 'public' AND NEW.published_at IS NULL THEN
    NEW.published_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_project_published
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION set_published_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Projects RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Public and unlisted projects are viewable by all, private only by owner
CREATE POLICY "Public projects are viewable by all"
  ON projects
  FOR SELECT
  USING (
    visibility = 'public' OR
    visibility = 'unlisted' OR
    user_id = auth.uid()
  );

-- Users can insert their own projects
CREATE POLICY "Users can insert own projects"
  ON projects
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own projects
CREATE POLICY "Users can update own projects"
  ON projects
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects"
  ON projects
  FOR DELETE
  USING (user_id = auth.uid());

-- Project History RLS
ALTER TABLE project_history ENABLE ROW LEVEL SECURITY;

-- History is viewable if the parent project is viewable
CREATE POLICY "Project history viewable with project"
  ON project_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_history.project_id
      AND (
        projects.visibility = 'public' OR
        projects.visibility = 'unlisted' OR
        projects.user_id = auth.uid()
      )
    )
  );

-- Users can insert history for their own projects
CREATE POLICY "Users can insert history for own projects"
  ON project_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_history.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Users can update history for their own projects
CREATE POLICY "Users can update history for own projects"
  ON project_history
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_history.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Users can delete history for their own projects
CREATE POLICY "Users can delete history for own projects"
  ON project_history
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_history.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Views RLS
ALTER TABLE views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a view (including anonymous)
CREATE POLICY "Anyone can record a view"
  ON views
  FOR INSERT
  WITH CHECK (true);

-- Views are viewable by project owner only (for analytics)
CREATE POLICY "Project owner can view analytics"
  ON views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = views.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Tags RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Tags are publicly viewable
CREATE POLICY "Tags are publicly viewable"
  ON tags
  FOR SELECT
  USING (true);

-- Only authenticated users can create tags
CREATE POLICY "Authenticated users can create tags"
  ON tags
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE projects IS 'User-created p5.js sketches with version history';
COMMENT ON COLUMN projects.current_code IS 'Current state of the sketch code';
COMMENT ON COLUMN projects.current_index IS 'Index pointing to current position in history';
COMMENT ON COLUMN projects.visibility IS 'public: in gallery, unlisted: shareable link only, private: owner only';
COMMENT ON COLUMN projects.forked_from_id IS 'Reference to original project if this is a fork';
COMMENT ON COLUMN projects.fork_depth IS 'Number of forks in the chain (0 = original)';
COMMENT ON COLUMN projects.published_at IS 'Timestamp when project was first made public';

COMMENT ON TABLE project_history IS 'Version history entries for projects, matching client HistoryEntry interface';
COMMENT ON COLUMN project_history.entry_id IS 'Client-generated UUID for the history entry';
COMMENT ON COLUMN project_history.position IS 'Order in the history array (0-indexed)';

COMMENT ON TABLE views IS 'View records for calculating trending scores';
COMMENT ON COLUMN views.viewer_ip_hash IS 'Hashed IP address for rate limiting anonymous views';

COMMENT ON TABLE tags IS 'Normalized tags for search and discovery';
-- Migration: 003_social
-- Description: Create likes, bookmarks, follows, and collections tables with RLS policies
-- Dependencies: 001_profiles, 002_projects

-- ============================================================================
-- LIKES TABLE
-- ============================================================================

CREATE TABLE likes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

-- ============================================================================
-- BOOKMARKS TABLE (private saves)
-- ============================================================================

CREATE TABLE bookmarks (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

-- ============================================================================
-- FOLLOWS TABLE
-- ============================================================================

CREATE TABLE follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- ============================================================================
-- COLLECTIONS TABLE (curated groups)
-- ============================================================================

CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,  -- Admin-curated
  cover_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- COLLECTION_PROJECTS TABLE (junction table)
-- ============================================================================

CREATE TABLE collection_projects (
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  position INT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, project_id)
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update collections updated_at
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update likes_count on projects when like is added/removed
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE projects SET likes_count = likes_count + 1 WHERE id = NEW.project_id;
    -- Also update total_likes_received on the project owner's profile
    UPDATE profiles SET total_likes_received = total_likes_received + 1
    WHERE id = (SELECT user_id FROM projects WHERE id = NEW.project_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE projects SET likes_count = likes_count - 1 WHERE id = OLD.project_id;
    -- Also update total_likes_received on the project owner's profile
    UPDATE profiles SET total_likes_received = total_likes_received - 1
    WHERE id = (SELECT user_id FROM projects WHERE id = OLD.project_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_like_changed
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW
  EXECUTE FUNCTION update_likes_count();

-- Update followers_count and following_count when follow is added/removed
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET followers_count = followers_count - 1 WHERE id = OLD.following_id;
    UPDATE profiles SET following_count = following_count - 1 WHERE id = OLD.follower_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_follow_changed
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_counts();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Likes RLS
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Anyone can see likes (for displaying like counts and who liked)
CREATE POLICY "Likes are publicly viewable"
  ON likes
  FOR SELECT
  USING (true);

-- Users can like projects (insert)
CREATE POLICY "Authenticated users can like projects"
  ON likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unlike (delete their own likes)
CREATE POLICY "Users can unlike projects"
  ON likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Bookmarks RLS
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can only see their own bookmarks (private)
CREATE POLICY "Users can view own bookmarks"
  ON bookmarks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can add bookmarks
CREATE POLICY "Users can add bookmarks"
  ON bookmarks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own bookmarks
CREATE POLICY "Users can remove own bookmarks"
  ON bookmarks
  FOR DELETE
  USING (auth.uid() = user_id);

-- Follows RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Anyone can see follow relationships
CREATE POLICY "Follow relationships are publicly viewable"
  ON follows
  FOR SELECT
  USING (true);

-- Users can follow others
CREATE POLICY "Users can follow others"
  ON follows
  FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow
CREATE POLICY "Users can unfollow"
  ON follows
  FOR DELETE
  USING (auth.uid() = follower_id);

-- Collections RLS
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Public collections and own collections are viewable
CREATE POLICY "Public and own collections are viewable"
  ON collections
  FOR SELECT
  USING (
    is_public = TRUE OR
    user_id = auth.uid()
  );

-- Users can create collections
CREATE POLICY "Users can create collections"
  ON collections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update own collections
CREATE POLICY "Users can update own collections"
  ON collections
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete own collections
CREATE POLICY "Users can delete own collections"
  ON collections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Collection Projects RLS
ALTER TABLE collection_projects ENABLE ROW LEVEL SECURITY;

-- Can view collection projects if collection is viewable
CREATE POLICY "Collection projects viewable with collection"
  ON collection_projects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_projects.collection_id
      AND (
        collections.is_public = TRUE OR
        collections.user_id = auth.uid()
      )
    )
  );

-- Users can add projects to own collections
CREATE POLICY "Users can add to own collections"
  ON collection_projects
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_projects.collection_id
      AND collections.user_id = auth.uid()
    )
  );

-- Users can update own collection projects
CREATE POLICY "Users can update own collection projects"
  ON collection_projects
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_projects.collection_id
      AND collections.user_id = auth.uid()
    )
  );

-- Users can remove from own collections
CREATE POLICY "Users can remove from own collections"
  ON collection_projects
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_projects.collection_id
      AND collections.user_id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE likes IS 'User likes on projects';
COMMENT ON TABLE bookmarks IS 'Private bookmarks/saves for users';
COMMENT ON TABLE follows IS 'User follow relationships';
COMMENT ON COLUMN follows.follower_id IS 'The user who is following';
COMMENT ON COLUMN follows.following_id IS 'The user being followed';

COMMENT ON TABLE collections IS 'User-curated collections of projects';
COMMENT ON COLUMN collections.is_featured IS 'Admin-curated featured collections';

COMMENT ON TABLE collection_projects IS 'Junction table linking collections to projects';
COMMENT ON COLUMN collection_projects.position IS 'Order of project within the collection';
-- Migration: 004_comments
-- Description: Create comments table with threaded replies and RLS policies
-- Dependencies: 001_profiles, 002_projects

-- ============================================================================
-- COMMENTS TABLE
-- ============================================================================

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,  -- For replies
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at on comments
CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update comments_count on projects when comment is added/deleted
CREATE OR REPLACE FUNCTION update_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE projects SET comments_count = comments_count + 1 WHERE id = NEW.project_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE projects SET comments_count = comments_count - 1 WHERE id = OLD.project_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle soft delete
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      UPDATE projects SET comments_count = comments_count - 1 WHERE id = NEW.project_id;
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
      UPDATE projects SET comments_count = comments_count + 1 WHERE id = NEW.project_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_comment_changed
  AFTER INSERT OR DELETE OR UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comments_count();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Comments are viewable if the project is viewable and comment is not deleted
CREATE POLICY "Comments viewable on viewable projects"
  ON comments
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = comments.project_id
      AND (
        projects.visibility = 'public' OR
        projects.visibility = 'unlisted' OR
        projects.user_id = auth.uid()
      )
    )
  );

-- Authenticated users can comment on public/unlisted projects
CREATE POLICY "Users can comment on accessible projects"
  ON comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = comments.project_id
      AND (
        projects.visibility = 'public' OR
        projects.visibility = 'unlisted' OR
        projects.user_id = auth.uid()
      )
    )
  );

-- Users can update their own comments (for editing)
CREATE POLICY "Users can update own comments"
  ON comments
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own comments (soft delete)
-- Project owners can also moderate (delete) comments on their projects
CREATE POLICY "Users can delete own comments or project owners can moderate"
  ON comments
  FOR DELETE
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = comments.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to soft delete a comment (preserves thread structure)
CREATE OR REPLACE FUNCTION soft_delete_comment(comment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  affected_rows INT;
BEGIN
  UPDATE comments
  SET deleted_at = NOW(),
      content = '[deleted]'
  WHERE id = comment_id
  AND (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = comments.project_id
      AND projects.user_id = auth.uid()
    )
  );

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get threaded comments for a project
CREATE OR REPLACE FUNCTION get_threaded_comments(p_project_id UUID)
RETURNS TABLE (
  id UUID,
  project_id UUID,
  user_id UUID,
  parent_id UUID,
  content TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  depth INT
) AS $$
WITH RECURSIVE comment_tree AS (
  -- Base case: top-level comments (no parent)
  SELECT
    c.id,
    c.project_id,
    c.user_id,
    c.parent_id,
    c.content,
    c.created_at,
    c.updated_at,
    c.deleted_at,
    p.username,
    p.display_name,
    p.avatar_url,
    0 AS depth
  FROM comments c
  JOIN profiles p ON c.user_id = p.id
  WHERE c.project_id = p_project_id
    AND c.parent_id IS NULL
    AND c.deleted_at IS NULL

  UNION ALL

  -- Recursive case: replies
  SELECT
    c.id,
    c.project_id,
    c.user_id,
    c.parent_id,
    c.content,
    c.created_at,
    c.updated_at,
    c.deleted_at,
    p.username,
    p.display_name,
    p.avatar_url,
    ct.depth + 1
  FROM comments c
  JOIN profiles p ON c.user_id = p.id
  JOIN comment_tree ct ON c.parent_id = ct.id
  WHERE c.deleted_at IS NULL
)
SELECT * FROM comment_tree
ORDER BY depth, created_at;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE comments IS 'User comments on projects with threading support';
COMMENT ON COLUMN comments.parent_id IS 'Reference to parent comment for threaded replies';
COMMENT ON COLUMN comments.deleted_at IS 'Soft delete timestamp - NULL means not deleted';
COMMENT ON FUNCTION soft_delete_comment IS 'Soft deletes a comment while preserving thread structure';
COMMENT ON FUNCTION get_threaded_comments IS 'Returns threaded comments for a project with user info and depth';
-- Migration: 005_notifications
-- Description: Create notifications table with RLS policies
-- Dependencies: 001_profiles, 002_projects, 004_comments

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'fork', 'follow', 'comment', 'mention', 'reply')),
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Create notification when someone likes a project
CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  project_owner_id UUID;
BEGIN
  -- Get the project owner
  SELECT user_id INTO project_owner_id FROM projects WHERE id = NEW.project_id;

  -- Don't notify if user likes their own project
  IF project_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, project_id)
    VALUES (project_owner_id, 'like', NEW.user_id, NEW.project_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_like_create_notification
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION create_like_notification();

-- Create notification when someone forks a project
CREATE OR REPLACE FUNCTION create_fork_notification()
RETURNS TRIGGER AS $$
DECLARE
  original_owner_id UUID;
BEGIN
  -- Only if this is a fork
  IF NEW.forked_from_id IS NOT NULL THEN
    -- Get the original project owner
    SELECT user_id INTO original_owner_id FROM projects WHERE id = NEW.forked_from_id;

    -- Don't notify if user forks their own project
    IF original_owner_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, actor_id, project_id)
      VALUES (original_owner_id, 'fork', NEW.user_id, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_fork_create_notification
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_fork_notification();

-- Create notification when someone follows a user
CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'follow', NEW.follower_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_follow_create_notification
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION create_follow_notification();

-- Create notification when someone comments on a project
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  project_owner_id UUID;
  parent_comment_user_id UUID;
BEGIN
  -- Get the project owner
  SELECT user_id INTO project_owner_id FROM projects WHERE id = NEW.project_id;

  -- If this is a reply, notify the parent comment author
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_comment_user_id FROM comments WHERE id = NEW.parent_id;

    -- Don't notify if replying to own comment
    IF parent_comment_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, actor_id, project_id, comment_id)
      VALUES (parent_comment_user_id, 'reply', NEW.user_id, NEW.project_id, NEW.id);
    END IF;
  END IF;

  -- Also notify project owner (if different from commenter and parent comment author)
  IF project_owner_id != NEW.user_id AND (parent_comment_user_id IS NULL OR project_owner_id != parent_comment_user_id) THEN
    INSERT INTO notifications (user_id, type, actor_id, project_id, comment_id)
    VALUES (project_owner_id, 'comment', NEW.user_id, NEW.project_id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_comment_create_notification
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_notification();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- System creates notifications (via triggers), users cannot insert directly
-- This policy allows the trigger functions (which run as SECURITY DEFINER) to insert
CREATE POLICY "System can create notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (true);  -- Controlled via trigger functions

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INT AS $$
DECLARE
  affected_rows INT;
BEGIN
  UPDATE notifications
  SET read_at = NOW()
  WHERE user_id = auth.uid()
    AND read_at IS NULL;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark a single notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  affected_rows INT;
BEGIN
  UPDATE notifications
  SET read_at = NOW()
  WHERE id = notification_id
    AND user_id = auth.uid()
    AND read_at IS NULL;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INT AS $$
  SELECT COUNT(*)::INT
  FROM notifications
  WHERE user_id = auth.uid()
    AND read_at IS NULL;
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to get notifications with actor and project details
CREATE OR REPLACE FUNCTION get_notifications_with_details(
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  actor_username TEXT,
  actor_display_name TEXT,
  actor_avatar_url TEXT,
  project_id UUID,
  project_name TEXT,
  project_thumbnail_url TEXT,
  comment_id UUID,
  comment_content TEXT
) AS $$
  SELECT
    n.id,
    n.type,
    n.read_at,
    n.created_at,
    a.username AS actor_username,
    a.display_name AS actor_display_name,
    a.avatar_url AS actor_avatar_url,
    p.id AS project_id,
    p.name AS project_name,
    p.thumbnail_url AS project_thumbnail_url,
    c.id AS comment_id,
    CASE
      WHEN c.deleted_at IS NOT NULL THEN '[deleted]'
      ELSE LEFT(c.content, 100)
    END AS comment_content
  FROM notifications n
  LEFT JOIN profiles a ON n.actor_id = a.id
  LEFT JOIN projects p ON n.project_id = p.id
  LEFT JOIN comments c ON n.comment_id = c.id
  WHERE n.user_id = auth.uid()
  ORDER BY n.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE notifications IS 'User notifications for social activity';
COMMENT ON COLUMN notifications.type IS 'Type of notification: like, fork, follow, comment, mention, reply';
COMMENT ON COLUMN notifications.actor_id IS 'The user who performed the action';
COMMENT ON COLUMN notifications.read_at IS 'NULL if unread, timestamp when read';

COMMENT ON FUNCTION mark_all_notifications_read IS 'Marks all unread notifications as read for current user';
COMMENT ON FUNCTION mark_notification_read IS 'Marks a single notification as read';
COMMENT ON FUNCTION get_unread_notification_count IS 'Returns count of unread notifications for current user';
COMMENT ON FUNCTION get_notifications_with_details IS 'Returns notifications with actor and project details';
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
