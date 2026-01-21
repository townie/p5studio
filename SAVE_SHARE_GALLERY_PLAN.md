# P5.AI Studio: Save/Share/Gallery System Design

## Vision

Transform P5.AI Studio from a personal creative tool into a **vibrant community platform** where artists can save their work, share creative sketches, explore others' creations, and even **fork and remix** projects - all while preserving the powerful branching history model.

---

## Core Experience Pillars

### 1. **Instant Cloud Save** - Never Lose Your Work
- Auto-save to cloud as you create (debounced)
- Full history preserved in the cloud
- Access your projects from any device
- Offline-first with background sync

### 2. **One-Click Sharing** - Share Your Art Instantly
- Generate beautiful shareable links
- Animated preview cards for social media
- Embeddable sketches for blogs/portfolios
- QR codes for gallery exhibitions

### 3. **Discover & Explore** - A Gallery of Generative Art
- Browse trending and new sketches
- Curated collections and featured artists
- Search by tags, prompts, or visual similarity
- "Surprise Me" - random discovery mode

### 4. **Fork & Remix** - Build on Others' Creativity
- One-click fork to your workspace
- See the full AI prompt history that created it
- Attribution chain shows remix lineage
- "Made with" badges for remixed works

### 5. **Social Layer** - Connect with Creators
- Like, comment, and bookmark sketches
- Follow your favorite artists
- Activity feed of followed creators
- Artist profiles with portfolio view

---

## User Experience Flows

### Flow 1: First-Time Save
```
User creates sketch → Clicks "Save" →
  → If not logged in: Beautiful auth modal (Google/GitHub/Email)
  → Creates profile automatically
  → Project saved with generated name
  → Success toast with share link
```

### Flow 2: Sharing a Sketch
```
User clicks "Share" →
  → Modal with options:
    • Copy link (instant)
    • Social cards (Twitter, Discord, etc.)
    • Embed code for websites
    • QR code (downloadable)
  → Toggle: Public/Unlisted/Private
  → Optional: Add description, tags
```

### Flow 3: Browsing the Gallery
```
User opens Gallery (new tab/view) →
  → Grid of animated sketch thumbnails (live p5.js!)
  → Filter: Trending / New / Following / Tags
  → Click sketch → Full-screen preview modal
    → Play/pause animation
    → View code (read-only)
    → See AI prompts used
    → Fork / Like / Bookmark / Share
    → View comments
```

### Flow 4: Forking a Project
```
User finds inspiring sketch → Clicks "Fork" →
  → Full project with history copied to their account
  → Opens in editor with "Forked from @artist" badge
  → They modify → Their version is a new branch
  → Original creator gets notification (optional)
```

---

## Database Schema (Supabase)

### Tables

```sql
-- Users table (extends Supabase auth.users)
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

-- Projects (sketches)
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

-- Project history (preserves the branching model)
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

-- Likes
CREATE TABLE likes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

-- Bookmarks (private saves)
CREATE TABLE bookmarks (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

-- Follows
CREATE TABLE follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Comments
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

-- Views (for trending algorithm)
CREATE TABLE views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL for anonymous
  viewer_ip_hash TEXT,  -- Hashed IP for anonymous rate limiting
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags (normalized for search)
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  projects_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collections (curated groups)
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

CREATE TABLE collection_projects (
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  position INT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, project_id)
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'like', 'fork', 'follow', 'comment', 'mention'
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_visibility ON projects(visibility) WHERE visibility = 'public';
CREATE INDEX idx_projects_published_at ON projects(published_at DESC) WHERE visibility = 'public';
CREATE INDEX idx_projects_likes_count ON projects(likes_count DESC) WHERE visibility = 'public';
CREATE INDEX idx_projects_forked_from ON projects(forked_from_id);
CREATE INDEX idx_project_history_project_id ON project_history(project_id);
CREATE INDEX idx_likes_project_id ON likes(project_id);
CREATE INDEX idx_comments_project_id ON comments(project_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id, read_at);
CREATE INDEX idx_views_project_created ON views(project_id, created_at);

-- Full-text search
ALTER TABLE projects ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'C')
  ) STORED;
CREATE INDEX idx_projects_search ON projects USING gin(search_vector);
```

### Row Level Security (RLS) Policies

```sql
-- Profiles: Public read, own write
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are publicly viewable" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Projects: Visibility-based access
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public projects are viewable by all" ON projects
  FOR SELECT USING (
    visibility = 'public' OR
    visibility = 'unlisted' OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (user_id = auth.uid());

-- Similar policies for other tables...
```

### Supabase Functions (Edge Functions)

```typescript
// supabase/functions/generate-thumbnail/index.ts
// Uses Puppeteer/Playwright to screenshot the sketch

// supabase/functions/trending-score/index.ts
// Cron job to calculate trending scores based on recent activity

// supabase/functions/og-image/index.ts
// Generates Open Graph images for social sharing
```

---

## Feature Details

### Auto-Save System

```typescript
// Debounced auto-save (2 seconds after last change)
const autoSave = useDebouncedCallback(async (projectData: ProjectData) => {
  if (!user) return;

  setSaveStatus('saving');

  try {
    await supabase.from('projects').upsert({
      id: projectId,
      user_id: user.id,
      current_code: projectData.history[projectData.currentIndex].code,
      current_index: projectData.currentIndex,
      updated_at: new Date().toISOString()
    });

    // Sync history entries
    await syncHistory(projectId, projectData.history);

    setSaveStatus('saved');
  } catch (error) {
    setSaveStatus('error');
  }
}, 2000);
```

### Share Link Structure

```
https://p5.ai/s/{shortId}         # Short share link
https://p5.ai/@{username}/{slug}  # User's project page
https://p5.ai/embed/{shortId}     # Embeddable iframe
```

### Embeddable Widget

```html
<!-- Embed code users can copy -->
<iframe
  src="https://p5.ai/embed/abc123"
  width="400"
  height="400"
  frameborder="0"
  allow="accelerometer; autoplay; encrypted-media; gyroscope"
></iframe>
```

### Gallery Grid Component

```tsx
// Live animated thumbnails using actual p5.js
const GalleryCard = ({ project }: { project: Project }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group relative aspect-square rounded-xl overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Static thumbnail by default, live preview on hover */}
      {isHovered ? (
        <Preview code={project.current_code} />
      ) : (
        <img src={project.thumbnail_url} alt={project.name} />
      )}

      {/* Overlay with info */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent
                      opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-0 p-4">
          <h3 className="text-white font-medium">{project.name}</h3>
          <p className="text-white/70 text-sm">@{project.author.username}</p>
          <div className="flex gap-3 mt-2 text-white/60 text-sm">
            <span>❤️ {project.likes_count}</span>
            <span>🔀 {project.forks_count}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Trending Algorithm

```sql
-- Calculate trending score (run hourly via cron)
CREATE OR REPLACE FUNCTION calculate_trending_score(project_id UUID)
RETURNS FLOAT AS $$
DECLARE
  score FLOAT;
  age_hours FLOAT;
  recent_views INT;
  recent_likes INT;
  recent_forks INT;
BEGIN
  -- Get project age in hours
  SELECT EXTRACT(EPOCH FROM (NOW() - published_at)) / 3600
  INTO age_hours
  FROM projects WHERE id = project_id;

  -- Count recent activity (last 24 hours)
  SELECT COUNT(*) INTO recent_views
  FROM views
  WHERE project_id = project_id
    AND created_at > NOW() - INTERVAL '24 hours';

  SELECT COUNT(*) INTO recent_likes
  FROM likes
  WHERE project_id = project_id
    AND created_at > NOW() - INTERVAL '24 hours';

  SELECT COUNT(*) INTO recent_forks
  FROM projects
  WHERE forked_from_id = project_id
    AND created_at > NOW() - INTERVAL '24 hours';

  -- Hacker News-style gravity algorithm
  -- score = (likes*3 + forks*5 + views*0.1) / (age_hours + 2)^1.8
  score := (recent_likes * 3 + recent_forks * 5 + recent_views * 0.1)
           / POWER(age_hours + 2, 1.8);

  RETURN score;
END;
$$ LANGUAGE plpgsql;
```

### Fork Lineage Display

```tsx
// Shows the remix chain
const ForkLineage = ({ project }: { project: Project }) => {
  if (!project.forked_from) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-zinc-400">
      <GitFork className="w-4 h-4" />
      <span>Forked from</span>
      <Link
        href={`/@${project.forked_from.author.username}/${project.forked_from.slug}`}
        className="text-purple-400 hover:underline"
      >
        {project.forked_from.name}
      </Link>
      <span>by</span>
      <Link
        href={`/@${project.forked_from.author.username}`}
        className="text-purple-400 hover:underline"
      >
        @{project.forked_from.author.username}
      </Link>
    </div>
  );
};
```

---

## New UI Components

### 1. AuthModal
- Sleek modal for sign in/sign up
- Social auth (Google, GitHub, Discord)
- Magic link email option
- Animated p5.js background

### 2. SaveButton
- Cloud icon with save status indicator
- Shows: Saving... / Saved / Error
- Click to force save
- Dropdown for: Save as new / Export JSON

### 3. ShareModal
- Copy link button with animation
- Social sharing buttons
- Embed code with preview
- QR code generator
- Privacy toggle

### 4. GalleryView (new ViewMode)
- Masonry grid of sketches
- Infinite scroll pagination
- Filter tabs: Trending / New / Following
- Search bar with tag suggestions

### 5. ProfilePage
- Avatar, bio, social links
- Portfolio grid of public sketches
- Stats: projects, likes, followers
- Follow button
- Activity feed

### 6. SketchModal
- Full-screen preview
- Sidebar with: code view, history, comments
- Action bar: Like, Fork, Bookmark, Share
- Related sketches carousel

### 7. NotificationDropdown
- Bell icon with unread count
- Grouped notifications
- Mark all as read
- Link to notification settings

### 8. CommentThread
- Nested replies
- Markdown support
- @mentions with autocomplete
- Edit/delete own comments

---

## Navigation Updates

```tsx
// Updated header with new navigation
<header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
  <div className="flex items-center gap-4">
    <Logo />

    {/* New: Gallery link */}
    <Link href="/gallery" className="text-zinc-400 hover:text-white">
      Explore
    </Link>
  </div>

  <div className="flex items-center gap-3">
    {/* Save status indicator */}
    <SaveStatus status={saveStatus} />

    {/* Share button */}
    <Button onClick={openShareModal} variant="secondary">
      <Share className="w-4 h-4 mr-2" />
      Share
    </Button>

    {/* User menu or auth */}
    {user ? (
      <>
        <NotificationDropdown />
        <UserMenu user={user} />
      </>
    ) : (
      <Button onClick={openAuthModal}>
        Sign In
      </Button>
    )}
  </div>
</header>
```

---

## Real-time Features (Supabase Realtime)

### Live View Count
```typescript
// Show real-time viewers on a sketch
const useRealtimeViewers = (projectId: string) => {
  const [viewers, setViewers] = useState<number>(0);

  useEffect(() => {
    const channel = supabase.channel(`project:${projectId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setViewers(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user?.id });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  return viewers;
};
```

### Live Comments
```typescript
// Real-time comment updates
useEffect(() => {
  const channel = supabase
    .channel(`comments:${projectId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'comments',
      filter: `project_id=eq.${projectId}`
    }, (payload) => {
      setComments(prev => [...prev, payload.new]);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [projectId]);
```

---

## Mobile Experience

### Responsive Gallery
- 2-column grid on mobile
- Swipe gestures for navigation
- Bottom sheet for sketch details
- PWA support for "Add to Home Screen"

### Touch-Optimized Preview
- Pinch to zoom
- Double-tap to reset
- Gesture hints overlay

---

## Advanced Features (Future)

### 1. AI-Powered Discovery
- "Similar sketches" using code embeddings
- "You might like" based on interaction history
- Visual similarity search (upload an image)

### 2. Collaborative Editing
- Real-time multiplayer editing (like Figma)
- Cursor presence indicators
- Chat sidebar
- Version branching for each collaborator

### 3. Sketch Challenges
- Weekly prompts from the community
- Time-limited challenges
- Voting and prizes
- Hall of fame

### 4. Learning Paths
- Curated collections for learning p5.js
- Difficulty ratings on sketches
- "Learn from this" mode showing AI prompts
- Progress tracking

### 5. API Access
- Developer API for power users
- Webhooks for automations
- CLI for publishing from terminal
- GitHub integration (sync sketches to repo)

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Set up Supabase project
- [ ] Implement authentication (Google OAuth)
- [ ] Create database schema and RLS policies
- [ ] Build profile page and settings
- [ ] Implement cloud save/load for projects
- [ ] Add save status indicator to UI

### Phase 2: Sharing
- [ ] Generate unique share links
- [ ] Build ShareModal component
- [ ] Implement unlisted/public visibility
- [ ] Create standalone view page (/s/{id})
- [ ] Add Open Graph meta tags
- [ ] Build embed page (/embed/{id})

### Phase 3: Gallery
- [ ] Create GalleryView component
- [ ] Implement project listing API
- [ ] Add thumbnail generation (Edge Function)
- [ ] Build search and filtering
- [ ] Implement infinite scroll
- [ ] Add trending algorithm

### Phase 4: Social
- [ ] Implement likes system
- [ ] Add bookmarks
- [ ] Build follow system
- [ ] Create notification system
- [ ] Add comments with threading
- [ ] Build activity feed

### Phase 5: Forking
- [ ] Implement fork functionality
- [ ] Show fork lineage
- [ ] Add "Forked from" attribution
- [ ] Notify original creator
- [ ] Build remix tree visualization

### Phase 6: Polish
- [ ] Mobile responsive design
- [ ] Performance optimization
- [ ] Analytics dashboard (for creators)
- [ ] Moderation tools
- [ ] Abuse prevention

---

## Technical Stack

```
Frontend:
├── React 19 (existing)
├── Tailwind CSS 4 (existing)
├── @supabase/supabase-js (new)
├── @supabase/auth-ui-react (new)
├── react-router-dom (new - for routing)
├── react-query (new - for data fetching)
├── framer-motion (new - for animations)
└── lucide-react (new - for icons)

Backend (Supabase):
├── PostgreSQL database
├── Row Level Security
├── Edge Functions (Deno)
├── Realtime subscriptions
├── Storage (for thumbnails)
└── Auth (OAuth providers)

Infrastructure:
├── Vercel/Netlify (frontend hosting)
├── Supabase (backend-as-a-service)
└── Cloudflare (CDN, optional)
```

---

## Success Metrics

- **Engagement**: Daily active creators, sketches created per day
- **Sharing**: Share link clicks, embeds created
- **Social**: Likes per sketch, comments per sketch, follows
- **Retention**: Weekly returning users, average sketches per user
- **Discovery**: Gallery views, search usage, trending page engagement
- **Community**: Forks created, fork depth (remix chains)

---

This design creates a compelling creative community around P5.AI Studio while preserving the powerful branching history model that makes the tool unique. The Supabase integration provides a robust, scalable backend with real-time capabilities that enhance the social experience.
