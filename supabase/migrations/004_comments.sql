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
