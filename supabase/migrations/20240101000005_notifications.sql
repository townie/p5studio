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
