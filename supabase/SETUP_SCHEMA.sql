-- ============================================================================
-- P5.AI Studio - Complete Database Schema
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to create all required tables.
-- Go to: https://supabase.com/dashboard/project/kffweujxwhztzvjlnzln/sql/new
-- ============================================================================

-- ============================================================================
-- PART 1: PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
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

-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are publicly viewable" ON profiles;
CREATE POLICY "Profiles are publicly viewable"
  ON profiles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
CREATE POLICY "Users can delete own profile"
  ON profiles
  FOR DELETE
  USING (auth.uid() = id);

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
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- PART 2: PROJECTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
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
  thumbnail_url TEXT,
  preview_gif_url TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,

  -- Stats (denormalized)
  likes_count INT DEFAULT 0,
  forks_count INT DEFAULT 0,
  views_count INT DEFAULT 0,
  comments_count INT DEFAULT 0
);

-- ============================================================================
-- PROJECT HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- Matches HistoryEntry interface
  entry_id TEXT NOT NULL,
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

-- Add unique constraint for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_history_project_id_entry_id_key'
  ) THEN
    ALTER TABLE project_history ADD CONSTRAINT project_history_project_id_entry_id_key UNIQUE (project_id, entry_id);
  END IF;
END $$;

-- ============================================================================
-- VIEWS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  viewer_ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TAGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  projects_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PROJECT TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update user's projects_count
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

DROP TRIGGER IF EXISTS on_project_created_or_deleted ON projects;
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

DROP TRIGGER IF EXISTS on_project_fork_changed ON projects;
CREATE TRIGGER on_project_fork_changed
  AFTER INSERT OR DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_fork_count();

-- Update views_count
CREATE OR REPLACE FUNCTION update_views_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects SET views_count = views_count + 1 WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_view_created ON views;
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

DROP TRIGGER IF EXISTS on_project_published ON projects;
CREATE TRIGGER on_project_published
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION set_published_at();

-- ============================================================================
-- PROJECTS RLS
-- ============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public projects are viewable by all" ON projects;
CREATE POLICY "Public projects are viewable by all"
  ON projects
  FOR SELECT
  USING (
    visibility = 'public' OR
    visibility = 'unlisted' OR
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
CREATE POLICY "Users can insert own projects"
  ON projects
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own projects" ON projects;
CREATE POLICY "Users can update own projects"
  ON projects
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
CREATE POLICY "Users can delete own projects"
  ON projects
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- PROJECT HISTORY RLS
-- ============================================================================

ALTER TABLE project_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project history viewable with project" ON project_history;
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

DROP POLICY IF EXISTS "Users can insert history for own projects" ON project_history;
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

DROP POLICY IF EXISTS "Users can update history for own projects" ON project_history;
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

DROP POLICY IF EXISTS "Users can delete history for own projects" ON project_history;
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

-- ============================================================================
-- VIEWS RLS
-- ============================================================================

ALTER TABLE views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can record a view" ON views;
CREATE POLICY "Anyone can record a view"
  ON views
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Project owner can view analytics" ON views;
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

-- ============================================================================
-- TAGS RLS
-- ============================================================================

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tags are publicly viewable" ON tags;
CREATE POLICY "Tags are publicly viewable"
  ON tags
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create tags" ON tags;
CREATE POLICY "Authenticated users can create tags"
  ON tags
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- PART 3: SOCIAL TABLES (likes, bookmarks, follows, collections)
-- ============================================================================

CREATE TABLE IF NOT EXISTS likes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collection_projects (
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  position INT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, project_id)
);

-- Collections trigger
DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Likes count trigger
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE projects SET likes_count = likes_count + 1 WHERE id = NEW.project_id;
    UPDATE profiles SET total_likes_received = total_likes_received + 1
    WHERE id = (SELECT user_id FROM projects WHERE id = NEW.project_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE projects SET likes_count = likes_count - 1 WHERE id = OLD.project_id;
    UPDATE profiles SET total_likes_received = total_likes_received - 1
    WHERE id = (SELECT user_id FROM projects WHERE id = OLD.project_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_changed ON likes;
CREATE TRIGGER on_like_changed
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW
  EXECUTE FUNCTION update_likes_count();

-- Follow counts trigger
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

DROP TRIGGER IF EXISTS on_follow_changed ON follows;
CREATE TRIGGER on_follow_changed
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_counts();

-- Social RLS
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Likes are publicly viewable" ON likes;
CREATE POLICY "Likes are publicly viewable"
  ON likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can like projects" ON likes;
CREATE POLICY "Authenticated users can like projects"
  ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike projects" ON likes;
CREATE POLICY "Users can unlike projects"
  ON likes FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bookmarks" ON bookmarks;
CREATE POLICY "Users can view own bookmarks"
  ON bookmarks FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add bookmarks" ON bookmarks;
CREATE POLICY "Users can add bookmarks"
  ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove own bookmarks" ON bookmarks;
CREATE POLICY "Users can remove own bookmarks"
  ON bookmarks FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Follow relationships are publicly viewable" ON follows;
CREATE POLICY "Follow relationships are publicly viewable"
  ON follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can follow others" ON follows;
CREATE POLICY "Users can follow others"
  ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow" ON follows;
CREATE POLICY "Users can unfollow"
  ON follows FOR DELETE USING (auth.uid() = follower_id);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public and own collections are viewable" ON collections;
CREATE POLICY "Public and own collections are viewable"
  ON collections FOR SELECT USING (is_public = TRUE OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create collections" ON collections;
CREATE POLICY "Users can create collections"
  ON collections FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own collections" ON collections;
CREATE POLICY "Users can update own collections"
  ON collections FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own collections" ON collections;
CREATE POLICY "Users can delete own collections"
  ON collections FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE collection_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Collection projects viewable with collection" ON collection_projects;
CREATE POLICY "Collection projects viewable with collection"
  ON collection_projects FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_projects.collection_id
      AND (collections.is_public = TRUE OR collections.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can add to own collections" ON collection_projects;
CREATE POLICY "Users can add to own collections"
  ON collection_projects FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_projects.collection_id
      AND collections.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own collection projects" ON collection_projects;
CREATE POLICY "Users can update own collection projects"
  ON collection_projects FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_projects.collection_id
      AND collections.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can remove from own collections" ON collection_projects;
CREATE POLICY "Users can remove from own collections"
  ON collection_projects FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_projects.collection_id
      AND collections.user_id = auth.uid()
    )
  );

-- ============================================================================
-- PART 4: COMMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

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

DROP TRIGGER IF EXISTS on_comment_changed ON comments;
CREATE TRIGGER on_comment_changed
  AFTER INSERT OR DELETE OR UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comments_count();

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comments viewable on viewable projects" ON comments;
CREATE POLICY "Comments viewable on viewable projects"
  ON comments FOR SELECT USING (
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

DROP POLICY IF EXISTS "Users can comment on accessible projects" ON comments;
CREATE POLICY "Users can comment on accessible projects"
  ON comments FOR INSERT WITH CHECK (
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

DROP POLICY IF EXISTS "Users can update own comments" ON comments;
CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments or project owners can moderate" ON comments;
CREATE POLICY "Users can delete own comments or project owners can moderate"
  ON comments FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = comments.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- ============================================================================
-- PART 5: NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'fork', 'follow', 'comment', 'mention', 'reply')),
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification triggers
CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  project_owner_id UUID;
BEGIN
  SELECT user_id INTO project_owner_id FROM projects WHERE id = NEW.project_id;
  IF project_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, project_id)
    VALUES (project_owner_id, 'like', NEW.user_id, NEW.project_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_create_notification ON likes;
CREATE TRIGGER on_like_create_notification
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION create_like_notification();

CREATE OR REPLACE FUNCTION create_fork_notification()
RETURNS TRIGGER AS $$
DECLARE
  original_owner_id UUID;
BEGIN
  IF NEW.forked_from_id IS NOT NULL THEN
    SELECT user_id INTO original_owner_id FROM projects WHERE id = NEW.forked_from_id;
    IF original_owner_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, actor_id, project_id)
      VALUES (original_owner_id, 'fork', NEW.user_id, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_fork_create_notification ON projects;
CREATE TRIGGER on_fork_create_notification
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_fork_notification();

CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'follow', NEW.follower_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_follow_create_notification ON follows;
CREATE TRIGGER on_follow_create_notification
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION create_follow_notification();

CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  project_owner_id UUID;
  parent_comment_user_id UUID;
BEGIN
  SELECT user_id INTO project_owner_id FROM projects WHERE id = NEW.project_id;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_comment_user_id FROM comments WHERE id = NEW.parent_id;
    IF parent_comment_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, actor_id, project_id, comment_id)
      VALUES (parent_comment_user_id, 'reply', NEW.user_id, NEW.project_id, NEW.id);
    END IF;
  END IF;
  IF project_owner_id != NEW.user_id AND (parent_comment_user_id IS NULL OR project_owner_id != parent_comment_user_id) THEN
    INSERT INTO notifications (user_id, type, actor_id, project_id, comment_id)
    VALUES (project_owner_id, 'comment', NEW.user_id, NEW.project_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_create_notification ON comments;
CREATE TRIGGER on_comment_create_notification
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_notification();

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- DONE! Your database is now set up for P5.AI Studio
-- ============================================================================
