-- P5.AI Studio Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- ============================================
-- Stores user profile information, linked to Supabase Auth
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles(username);

-- ============================================
-- PROJECTS TABLE
-- ============================================
-- Stores user projects (can be private or public)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Project metadata
  title TEXT NOT NULL DEFAULT 'Untitled Sketch',
  description TEXT,
  tags TEXT[] DEFAULT '{}',

  -- Project content (full history as JSONB)
  history JSONB NOT NULL DEFAULT '[]',
  current_index INTEGER NOT NULL DEFAULT 0,

  -- Visibility
  is_public BOOLEAN DEFAULT FALSE,

  -- Fork tracking
  forked_from_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  forked_from_index INTEGER, -- Which history index was forked

  -- Thumbnail (base64 or URL)
  thumbnail TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ -- When made public
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS projects_is_public_idx ON projects(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS projects_forked_from_idx ON projects(forked_from_id);

-- ============================================
-- PUBLISHED SKETCHES TABLE
-- ============================================
-- Public gallery entries with short shareable IDs
CREATE TABLE IF NOT EXISTS published_sketches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_id TEXT UNIQUE NOT NULL, -- e.g., "xK9mPq2" for short URLs
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Snapshot of project at publish time
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  history JSONB NOT NULL,
  current_index INTEGER NOT NULL DEFAULT 0,
  thumbnail TEXT,

  -- Stats
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0,

  -- Featured/challenges
  is_featured BOOLEAN DEFAULT FALSE,
  challenge_id UUID,

  -- Timestamps
  published_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS published_sketches_short_id_idx ON published_sketches(short_id);
CREATE INDEX IF NOT EXISTS published_sketches_user_id_idx ON published_sketches(user_id);
CREATE INDEX IF NOT EXISTS published_sketches_published_at_idx ON published_sketches(published_at DESC);
CREATE INDEX IF NOT EXISTS published_sketches_likes_idx ON published_sketches(likes DESC);
CREATE INDEX IF NOT EXISTS published_sketches_is_featured_idx ON published_sketches(is_featured) WHERE is_featured = TRUE;

-- ============================================
-- LIKES TABLE
-- ============================================
-- Track user likes on published sketches
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sketch_id UUID REFERENCES published_sketches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sketch_id)
);

CREATE INDEX IF NOT EXISTS likes_sketch_id_idx ON likes(sketch_id);
CREATE INDEX IF NOT EXISTS likes_user_id_idx ON likes(user_id);

-- ============================================
-- FOLLOWS TABLE
-- ============================================
-- User following relationships
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx ON follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id);

-- ============================================
-- CHALLENGES TABLE
-- ============================================
-- Weekly community challenges
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS challenges_active_idx ON challenges(is_active, end_date DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to generate short IDs for sharing
CREATE OR REPLACE FUNCTION generate_short_id(length INTEGER DEFAULT 7)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_view_count(sketch_short_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE published_sketches
  SET views = views + 1
  WHERE short_id = sketch_short_id;
END;
$$ LANGUAGE plpgsql;

-- Function to handle profile creation on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'preferred_username', 'user_' || substr(NEW.id::TEXT, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Anonymous'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update like counts
CREATE OR REPLACE FUNCTION update_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE published_sketches SET likes = likes + 1 WHERE id = NEW.sketch_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE published_sketches SET likes = likes - 1 WHERE id = OLD.sketch_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for like count updates
DROP TRIGGER IF EXISTS on_like_change ON likes;
CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_like_count();

-- Function to update fork counts
CREATE OR REPLACE FUNCTION update_fork_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.forked_from_id IS NOT NULL THEN
    UPDATE published_sketches
    SET forks = forks + 1
    WHERE project_id = NEW.forked_from_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for fork count updates
DROP TRIGGER IF EXISTS on_project_fork ON projects;
CREATE TRIGGER on_project_fork
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION update_fork_count();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_sketches ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Projects policies
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view public projects" ON projects
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Published sketches policies
CREATE POLICY "Anyone can view published sketches" ON published_sketches
  FOR SELECT USING (true);

CREATE POLICY "Users can publish own sketches" ON published_sketches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own published sketches" ON published_sketches
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own published sketches" ON published_sketches
  FOR DELETE USING (auth.uid() = user_id);

-- Likes policies
CREATE POLICY "Anyone can view likes" ON likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like sketches" ON likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike sketches" ON likes
  FOR DELETE USING (auth.uid() = user_id);

-- Follows policies
CREATE POLICY "Anyone can view follows" ON follows
  FOR SELECT USING (true);

CREATE POLICY "Users can follow others" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" ON follows
  FOR DELETE USING (auth.uid() = follower_id);

-- Challenges policies
CREATE POLICY "Anyone can view challenges" ON challenges
  FOR SELECT USING (true);

-- ============================================
-- VIEWS
-- ============================================

-- View for gallery with author info
CREATE OR REPLACE VIEW gallery_sketches AS
SELECT
  ps.*,
  p.username as author_username,
  p.display_name as author_display_name,
  p.avatar_url as author_avatar_url
FROM published_sketches ps
JOIN profiles p ON ps.user_id = p.id
ORDER BY ps.published_at DESC;

-- View for trending sketches (based on recent likes)
CREATE OR REPLACE VIEW trending_sketches AS
SELECT
  ps.*,
  p.username as author_username,
  p.display_name as author_display_name,
  p.avatar_url as author_avatar_url,
  (
    SELECT COUNT(*)
    FROM likes l
    WHERE l.sketch_id = ps.id
    AND l.created_at > NOW() - INTERVAL '7 days'
  ) as recent_likes
FROM published_sketches ps
JOIN profiles p ON ps.user_id = p.id
ORDER BY recent_likes DESC, ps.likes DESC
LIMIT 50;
