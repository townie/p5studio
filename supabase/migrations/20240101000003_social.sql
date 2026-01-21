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
