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
