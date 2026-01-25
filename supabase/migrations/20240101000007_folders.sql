-- Migration: Add folders support for organizing projects
-- Created: 2026-01-20

-- 1. Create folders table
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,  -- Optional UI color (e.g., hex color code)
    icon TEXT,   -- Optional UI icon (e.g., emoji or icon name)
    position INT NOT NULL DEFAULT 0,  -- For ordering folders in UI
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT folders_name_not_empty CHECK (char_length(name) > 0),
    CONSTRAINT folders_name_length CHECK (char_length(name) <= 100),
    CONSTRAINT folders_color_format CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT folders_position_non_negative CHECK (position >= 0)
);

-- 2. Add folder_id to projects table
ALTER TABLE projects
    ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- Add comment to explain nullable folder_id
COMMENT ON COLUMN projects.folder_id IS 'Optional folder assignment - NULL means project is not in any folder';

-- 3. Create indexes for performance
-- Index for querying user's folders
CREATE INDEX idx_folders_user_id ON folders(user_id);

-- Composite index for efficiently ordering user's folders
CREATE INDEX idx_folders_user_position ON folders(user_id, position);

-- Index for finding projects in a folder (partial index for efficiency)
CREATE INDEX idx_projects_folder_id ON projects(folder_id) WHERE folder_id IS NOT NULL;

-- 4. Enable Row Level Security
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for folders

-- Policy: Users can view their own folders
CREATE POLICY "Users can view their own folders"
    ON folders
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own folders
CREATE POLICY "Users can insert their own folders"
    ON folders
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own folders
CREATE POLICY "Users can update their own folders"
    ON folders
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own folders
CREATE POLICY "Users can delete their own folders"
    ON folders
    FOR DELETE
    USING (auth.uid() = user_id);

-- 6. Add updated_at trigger to folders table
CREATE TRIGGER update_folders_updated_at
    BEFORE UPDATE ON folders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Create helper function to get folder with project count
CREATE OR REPLACE FUNCTION get_folders_with_project_count(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name TEXT,
    color TEXT,
    icon TEXT,
    position INT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    project_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT
        f.id,
        f.user_id,
        f.name,
        f.color,
        f.icon,
        f.position,
        f.created_at,
        f.updated_at,
        COUNT(p.id) AS project_count
    FROM folders f
    LEFT JOIN projects p ON p.folder_id = f.id
    WHERE f.user_id = p_user_id
    GROUP BY f.id, f.user_id, f.name, f.color, f.icon, f.position, f.created_at, f.updated_at
    ORDER BY f.position, f.created_at;
$$;

-- Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION get_folders_with_project_count(UUID) TO authenticated;

-- 8. Add comments for documentation
COMMENT ON TABLE folders IS 'User-created folders for organizing projects';
COMMENT ON COLUMN folders.id IS 'Unique identifier for the folder';
COMMENT ON COLUMN folders.user_id IS 'User who owns this folder';
COMMENT ON COLUMN folders.name IS 'Display name for the folder';
COMMENT ON COLUMN folders.color IS 'Optional hex color code for UI customization (e.g., #FF5733)';
COMMENT ON COLUMN folders.icon IS 'Optional icon identifier for UI (e.g., emoji or icon name)';
COMMENT ON COLUMN folders.position IS 'Sort order for displaying folders (lower values appear first)';
COMMENT ON COLUMN folders.created_at IS 'Timestamp when folder was created';
COMMENT ON COLUMN folders.updated_at IS 'Timestamp when folder was last modified';
