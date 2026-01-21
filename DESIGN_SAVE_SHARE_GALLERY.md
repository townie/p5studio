# P5.AI Studio: Save/Share/Gallery System Design

## Vision

Transform P5.AI from a single-session creative tool into a **living creative community** where sketches evolve, inspire, and connect artists. Every sketch has a story—the prompts that shaped it, the iterations that refined it, and the community that celebrates it.

---

## Core Concepts

### 1. **Evolution Stories**
Unlike traditional save systems, we preserve the entire creative journey. When you share a sketch, you're sharing not just code, but the conversation with AI that created it—every prompt, every iteration, every "aha!" moment.

### 2. **Living Gallery**
The gallery isn't a graveyard of screenshots. Every thumbnail is a live-rendering p5.js sketch, breathing and moving. Hover to see it come alive. Click to dive in.

### 3. **Remix Culture**
Every shared sketch is a seed. "Remix" isn't just copying—it's forking with attribution. Watch remix chains grow into forests of creativity.

### 4. **Prompt Discovery**
The prompts are as valuable as the code. Browse by prompt patterns, learn what works, and discover the magic words that unlock stunning visuals.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | **Supabase** (PostgreSQL + Auth + Storage + Realtime) |
| Auth | Supabase Auth (GitHub, Google, Magic Link) |
| Database | PostgreSQL with Row Level Security |
| Storage | Supabase Storage (thumbnails, exports) |
| Realtime | Supabase Realtime (live gallery, presence) |
| Frontend | React + TypeScript (existing) |

---

## Database Schema

### Tables

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  github_username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Stats (denormalized for performance)
  sketch_count INTEGER DEFAULT 0,
  remix_count INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0
);

-- Projects (a collection of sketch versions)
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Metadata
  title TEXT NOT NULL DEFAULT 'Untitled Sketch',
  description TEXT,

  -- Current state
  current_code TEXT NOT NULL,
  current_version INTEGER DEFAULT 1,

  -- Visibility & Sharing
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),
  share_slug TEXT UNIQUE, -- Short shareable ID like "aB3kZ9"

  -- Remix lineage
  forked_from UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  remix_count INTEGER DEFAULT 0,

  -- Stats
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ, -- When first made public

  -- Feature flags
  is_featured BOOLEAN DEFAULT FALSE,
  is_staff_pick BOOLEAN DEFAULT FALSE
);

-- Project History (full evolution timeline)
CREATE TABLE public.project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Version info
  version_number INTEGER NOT NULL,
  code TEXT NOT NULL,

  -- Type of change
  change_type TEXT NOT NULL CHECK (change_type IN ('initial', 'manual', 'ai')),

  -- For AI-generated versions
  prompt TEXT,

  -- Metadata
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Thumbnail captured at this version
  thumbnail_url TEXT,

  UNIQUE(project_id, version_number)
);

-- Tags for discovery
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#8B5CF6', -- Default purple
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project-Tag junction
CREATE TABLE public.project_tags (
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, tag_id)
);

-- Likes
CREATE TABLE public.likes (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collections (user-curated playlists of sketches)
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),
  cover_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  project_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collection items
CREATE TABLE public.collection_items (
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (collection_id, project_id)
);

-- Daily Challenges
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  prompt_suggestion TEXT, -- Optional starting prompt
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  submission_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Challenge submissions
CREATE TABLE public.challenge_submissions (
  challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (challenge_id, project_id)
);

-- View tracking (for analytics, rate-limited)
CREATE TABLE public.project_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  viewer_ip TEXT, -- Hashed for privacy
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_projects_user ON public.projects(user_id);
CREATE INDEX idx_projects_visibility ON public.projects(visibility) WHERE visibility = 'public';
CREATE INDEX idx_projects_featured ON public.projects(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_projects_share_slug ON public.projects(share_slug) WHERE share_slug IS NOT NULL;
CREATE INDEX idx_projects_forked_from ON public.projects(forked_from) WHERE forked_from IS NOT NULL;
CREATE INDEX idx_project_versions_project ON public.project_versions(project_id);
CREATE INDEX idx_likes_project ON public.likes(project_id);
CREATE INDEX idx_comments_project ON public.comments(project_id);
CREATE INDEX idx_project_views_project ON public.project_views(project_id);
CREATE INDEX idx_profiles_username ON public.profiles(username);
```

### Row Level Security Policies

```sql
-- Profiles: Public read, own write
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Projects: Visibility-based access
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public projects are viewable by everyone"
  ON public.projects FOR SELECT
  USING (
    visibility = 'public'
    OR visibility = 'unlisted'
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can insert own projects"
  ON public.projects FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  USING (user_id = auth.uid());

-- Similar policies for other tables...
```

---

## Feature Design

### 1. Save System

#### Auto-Save (Local First)
```
┌─────────────────────────────────────────────────────┐
│  LOCAL STORAGE (Instant)                            │
│  ├── Current session state                          │
│  ├── Unsaved changes buffer                         │
│  └── Offline queue for sync                         │
├─────────────────────────────────────────────────────┤
│  SUPABASE (Background Sync)                         │
│  ├── Debounced save (5 seconds after last change)   │
│  ├── Explicit save on demand                        │
│  └── Save before close (beforeunload)               │
└─────────────────────────────────────────────────────┘
```

#### Save UI States

```
┌──────────────────────────────────────────────────────────────┐
│  ● Saved                    │ All changes synced to cloud    │
│  ◐ Saving...               │ Sync in progress               │
│  ○ Unsaved changes         │ Local changes pending          │
│  ⚠ Offline                 │ Will sync when online          │
└──────────────────────────────────────────────────────────────┘
```

#### Project Management Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════════╗  │
│  ║  MY PROJECTS                                    [+ New]   ║  │
│  ╠═══════════════════════════════════════════════════════════╣  │
│  ║                                                           ║  │
│  ║  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      ║  │
│  ║  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │      ║  │
│  ║  │ Preview │  │ Preview │  │ Preview │  │ Preview │      ║  │
│  ║  └─────────┘  └─────────┘  └─────────┘  └─────────┘      ║  │
│  ║  Particle     Fractal      Wave         Untitled         ║  │
│  ║  Storm        Tree         Form         Sketch           ║  │
│  ║  ♥ 234        ♥ 89         ♥ 156        (draft)          ║  │
│  ║  Updated 2h   Updated 1d   Updated 3d   Updated now      ║  │
│  ║                                                           ║  │
│  ╚═══════════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2. Share System

#### Share Modal Design

```
┌─────────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════════╗  │
│  ║  SHARE "Particle Storm"                              [×]  ║  │
│  ╠═══════════════════════════════════════════════════════════╣  │
│  ║                                                           ║  │
│  ║  Visibility                                               ║  │
│  ║  ┌─────────┐ ┌─────────┐ ┌─────────┐                     ║  │
│  ║  │ 🔒      │ │ 🔗      │ │ 🌍      │                     ║  │
│  ║  │ Private │ │Unlisted │ │ Public  │  ← Selected         ║  │
│  ║  │         │ │         │ │         │                     ║  │
│  ║  └─────────┘ └─────────┘ └─────────┘                     ║  │
│  ║                                                           ║  │
│  ║  ─────────────────────────────────────────────────────   ║  │
│  ║                                                           ║  │
│  ║  Share Link                                               ║  │
│  ║  ┌─────────────────────────────────────────┐ ┌──────┐    ║  │
│  ║  │ p5.ai/s/aB3kZ9                          │ │ Copy │    ║  │
│  ║  └─────────────────────────────────────────┘ └──────┘    ║  │
│  ║                                                           ║  │
│  ║  ─────────────────────────────────────────────────────   ║  │
│  ║                                                           ║  │
│  ║  Share Options                                            ║  │
│  ║                                                           ║  │
│  ║  [✓] Include evolution history                           ║  │
│  ║      Let viewers see how this sketch was created         ║  │
│  ║                                                           ║  │
│  ║  [✓] Allow remixes                                       ║  │
│  ║      Others can fork and build upon this                 ║  │
│  ║                                                           ║  │
│  ║  [ ] Require attribution for remixes                     ║  │
│  ║      Remixes must credit this as the original            ║  │
│  ║                                                           ║  │
│  ║  ─────────────────────────────────────────────────────   ║  │
│  ║                                                           ║  │
│  ║  Embed Code                                               ║  │
│  ║  ┌─────────────────────────────────────────┐ ┌──────┐    ║  │
│  ║  │ <iframe src="p5.ai/embed/aB3kZ9"...     │ │ Copy │    ║  │
│  ║  └─────────────────────────────────────────┘ └──────┘    ║  │
│  ║                                                           ║  │
│  ║  Social Preview                                           ║  │
│  ║  ┌────────────────────────────────┐                      ║  │
│  ║  │  ┌──────────────────────────┐  │                      ║  │
│  ║  │  │     Animated GIF         │  │   [Regenerate]       ║  │
│  ║  │  │     Preview              │  │                      ║  │
│  ║  │  └──────────────────────────┘  │                      ║  │
│  ║  │  Particle Storm — P5.AI        │                      ║  │
│  ║  │  by @username                  │                      ║  │
│  ║  └────────────────────────────────┘                      ║  │
│  ║                                                           ║  │
│  ║  ─────────────────────────────────────────────────────   ║  │
│  ║                                                           ║  │
│  ║  Quick Share                                              ║  │
│  ║  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                      ║  │
│  ║  │ 𝕏  │ │ in │ │ fb │ │ rd │ │ QR │                      ║  │
│  ║  └────┘ └────┘ └────┘ └────┘ └────┘                      ║  │
│  ║                                                           ║  │
│  ╚═══════════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────────┘
```

#### Share URL Structure

```
# Direct view (full screen sketch)
https://p5.ai/s/aB3kZ9

# With evolution timeline visible
https://p5.ai/s/aB3kZ9?timeline=1

# Embedded version (no chrome)
https://p5.ai/embed/aB3kZ9

# Start at specific version
https://p5.ai/s/aB3kZ9?v=5

# Playback evolution automatically
https://p5.ai/s/aB3kZ9?playback=1

# User profile
https://p5.ai/@username

# User's specific project
https://p5.ai/@username/particle-storm
```

#### Embed Widget

```html
<!-- Responsive embed -->
<iframe
  src="https://p5.ai/embed/aB3kZ9"
  style="width: 100%; aspect-ratio: 16/9; border: none; border-radius: 12px;"
  allow="accelerometer; autoplay; clipboard-write"
></iframe>

<!-- With controls -->
<iframe
  src="https://p5.ai/embed/aB3kZ9?controls=1"
  ...
></iframe>
```

#### Social Preview Cards (Open Graph)

```html
<meta property="og:title" content="Particle Storm — P5.AI" />
<meta property="og:description" content="An interactive particle system by @username" />
<meta property="og:image" content="https://p5.ai/thumbnails/aB3kZ9.gif" />
<meta property="og:image:type" content="image/gif" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:player" content="https://p5.ai/embed/aB3kZ9" />
```

---

### 3. Gallery System

#### Gallery Homepage Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  P5.AI                               [Search...]   [@user] [+ New]  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  🏆 DAILY CHALLENGE: "Cosmic Dance"                    12h 34m left │    │
│  │  Create a sketch inspired by celestial bodies in motion             │    │
│  │                                                        [Join Now →] │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  FEATURED                                                      [See All →] │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  ┌─────────────┐                                                      │  │
│  │  │             │   "Bioluminescent Ocean"                            │  │
│  │  │   ▶ LIVE    │   by @marina                                         │  │
│  │  │   PREVIEW   │                                                      │  │
│  │  │  (large)    │   "I asked the AI to create something that feels    │  │
│  │  │             │    like swimming through a dream. After 12          │  │
│  │  │             │    iterations, we arrived here..."                  │  │
│  │  └─────────────┘                                                      │  │
│  │                                      ♥ 1,234    👁 12.5K    🔀 89     │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  TRENDING                                                     [See All →]  │
│                                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │          │
│  │         │  │         │  │         │  │         │  │         │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
│  Neon Grid    Fractal      Sound        Gravity      Cellular             │
│  @alex        @jordan      @sam         @taylor      @casey               │
│  ♥ 456        ♥ 398        ♥ 367        ♥ 289        ♥ 245                │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  BROWSE BY TAG                                                              │
│                                                                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │ #particles │ │ #fractals  │ │ #audio     │ │ #physics   │              │
│  │    2,345   │ │    1,892   │ │    1,456   │ │    1,234   │              │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘              │
│                                                                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │ #geometric │ │ #organic   │ │ #noise     │ │ #3d        │              │
│  │      987   │ │      876   │ │      765   │ │      654   │              │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘              │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  RECENT                                            [Filter ▼] [Sort ▼]     │
│                                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
│  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
│  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
│                                                                             │
│                           [Load More]                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Sketch Detail Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Gallery                                                          │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │                                                                       │  │
│  │                                                                       │  │
│  │                        LIVE SKETCH PREVIEW                            │  │
│  │                         (Full Width)                                  │  │
│  │                                                                       │  │
│  │                                                                       │  │
│  │                                                                       │  │
│  │  [⛶ Fullscreen]                              [⏸ Pause] [🔄 Restart]  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────┐  ┌───────────────────────────────┐│
│  │                                     │  │                               ││
│  │  Particle Storm                     │  │  EVOLUTION TIMELINE           ││
│  │  by @marina · Published 2 days ago  │  │                               ││
│  │                                     │  │  ▶ Watch Playback             ││
│  │  An emergent particle system that   │  │                               ││
│  │  responds to mouse movement with    │  │  ┌─────┐                      ││
│  │  fluid dynamics simulation.         │  │  │ v12 │ ← Current            ││
│  │                                     │  │  │     │ "Make particles      ││
│  │  ────────────────────────────────   │  │  └──┬──┘  glow more"          ││
│  │                                     │  │     │                         ││
│  │  ┌────────────┐ ┌────────────┐     │  │  ┌──┴──┐                      ││
│  │  │ #particles │ │ #physics   │     │  │  │ v11 │ "Add fluid           ││
│  │  └────────────┘ └────────────┘     │  │  │     │  dynamics"           ││
│  │  ┌────────────┐                    │  │  └──┬──┘                      ││
│  │  │ #emergent  │                    │  │     │                         ││
│  │  └────────────┘                    │  │  ┌──┴──┐                      ││
│  │                                     │  │  │ v10 │ Manual edit         ││
│  │  ────────────────────────────────   │  │  └──┬──┘                      ││
│  │                                     │  │     ⋮                         ││
│  │  ♥ 1,234  👁 12.5K  🔀 89  💬 23   │  │  ┌──┴──┐                      ││
│  │                                     │  │  │ v1  │ Initial              ││
│  │  [♥ Like] [🔀 Remix] [↗ Share]     │  │  └─────┘                      ││
│  │                                     │  │                               ││
│  └─────────────────────────────────────┘  └───────────────────────────────┘│
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  CODE                                                         [Copy] [Fork] │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  function setup() {                                                   │  │
│  │    createCanvas(windowWidth, windowHeight);                           │  │
│  │    ...                                                                │  │
│  │  }                                                                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  REMIX TREE                                                    [See All →]  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           ┌─────────┐                                 │  │
│  │                           │ Original│ ← This sketch                   │  │
│  │                           │ @marina │                                 │  │
│  │                           └────┬────┘                                 │  │
│  │              ┌─────────────────┼─────────────────┐                    │  │
│  │         ┌────┴────┐       ┌────┴────┐       ┌────┴────┐               │  │
│  │         │ Remix 1 │       │ Remix 2 │       │ Remix 3 │               │  │
│  │         │ @alex   │       │ @jordan │       │ @casey  │               │  │
│  │         └────┬────┘       └─────────┘       └─────────┘               │  │
│  │         ┌────┴────┐                                                   │  │
│  │         │Remix 1a │                                                   │  │
│  │         │ @sam    │                                                   │  │
│  │         └─────────┘                                                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  COMMENTS (23)                                                              │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  @alex · 2 hours ago                                                  │  │
│  │  This is incredible! The fluid simulation is so smooth.               │  │
│  │  What made you think to combine particles with fluid dynamics?        │  │
│  │                                                          [Reply] [♥]  │  │
│  │                                                                       │  │
│  │  └── @marina · 1 hour ago                                             │  │
│  │      Thanks! I was watching ocean waves and just typed                │  │
│  │      "make it flow like water" into the AI prompt 😄                  │  │
│  │                                                          [Reply] [♥]  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Add a comment...                                          [Post]     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### User Profile Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  ┌──────────┐                                                         │  │
│  │  │          │   @marina                                               │  │
│  │  │  Avatar  │   Marina Chen                                           │  │
│  │  │          │   Creative coder & generative artist                    │  │
│  │  └──────────┘   🌐 marina.dev · 📍 San Francisco                      │  │
│  │                                                                       │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐      │  │
│  │  │ 47         │  │ 12.5K      │  │ 2.3K       │  │ 892        │      │  │
│  │  │ Sketches   │  │ Views      │  │ Likes      │  │ Followers  │      │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘      │  │
│  │                                                                       │  │
│  │                                                     [Follow] [···]    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  [Sketches]  [Collections]  [Liked]  [Remixes]                              │
│                                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
│  Particle     Fractal      Wave         Bio          Neon                  │
│  Storm        Dreams       Form         Luminous     Pulse                 │
│                                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 4. Special Features

#### Evolution Playback

When viewing a shared sketch, users can "replay" the evolution:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │                        SKETCH MORPHING FROM v5 → v6                   │  │
│  │                        (Animated transition)                          │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  ◀◀  │  ▶  │  ▶▶  │  ████████░░░░░░░░░░░░░░░░░░░  │ v5/12  │ 1x  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  💬 "Add a subtle glow effect around each particle"                   │  │
│  │                                                    — AI prompt for v6  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### "Inspire Me" Feature

Start from gallery inspiration:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║  INSPIRE ME                                                      [×]  ║  │
│  ╠═══════════════════════════════════════════════════════════════════════╣  │
│  ║                                                                       ║  │
│  ║  ┌───────────────────────────────────────────────────────────────┐   ║  │
│  ║  │                                                               │   ║  │
│  ║  │               Particle Storm by @marina                       │   ║  │
│  ║  │               (Preview)                                       │   ║  │
│  ║  │                                                               │   ║  │
│  ║  └───────────────────────────────────────────────────────────────┘   ║  │
│  ║                                                                       ║  │
│  ║  I want something like this, but...                                  ║  │
│  ║  ┌───────────────────────────────────────────────────────────────┐   ║  │
│  ║  │ with a cosmic color palette and slower movement               │   ║  │
│  ║  └───────────────────────────────────────────────────────────────┘   ║  │
│  ║                                                                       ║  │
│  ║                                              [Create Inspired Sketch] ║  │
│  ║                                                                       ║  │
│  ║  ────────────────────────────────────────────────────────────────    ║  │
│  ║                                                                       ║  │
│  ║  This will create a new project inspired by the original.            ║  │
│  ║  Attribution will be shown: "Inspired by Particle Storm"             ║  │
│  ║                                                                       ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Collections

Users can curate collections of sketches:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  📁 "Mesmerizing Loops"                                                     │
│  Curated by @marina · 12 sketches                                          │
│                                                                             │
│  A collection of perfectly looping animations that                          │
│  you can stare at forever.                                                 │
│                                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │  │ ▶ Live  │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Foundation
- [ ] Set up Supabase project
- [ ] Implement authentication (GitHub OAuth)
- [ ] Create database schema
- [ ] Basic save/load functionality
- [ ] User profile creation

### Phase 2: Sharing
- [ ] Generate share slugs
- [ ] Public/unlisted/private visibility
- [ ] Share modal UI
- [ ] Embed widget
- [ ] Open Graph meta tags for social preview

### Phase 3: Gallery
- [ ] Gallery homepage
- [ ] Sketch detail page
- [ ] Live preview thumbnails
- [ ] Like functionality
- [ ] Tag system
- [ ] Search and filtering

### Phase 4: Community
- [ ] Remix/fork functionality
- [ ] Remix tree visualization
- [ ] Comments system
- [ ] User following
- [ ] Notifications

### Phase 5: Discovery
- [ ] Trending algorithm
- [ ] Featured/staff picks
- [ ] Collections
- [ ] Daily challenges
- [ ] Evolution playback

### Phase 6: Polish
- [ ] Thumbnail generation (canvas capture)
- [ ] GIF/video export for social
- [ ] Performance optimization
- [ ] Mobile responsive gallery
- [ ] Keyboard shortcuts

---

## API Endpoints (Supabase Edge Functions)

```typescript
// Generate share slug
POST /functions/v1/generate-share-slug
{ projectId: string }
→ { slug: string, url: string }

// Capture thumbnail
POST /functions/v1/capture-thumbnail
{ projectId: string, versionId?: string }
→ { thumbnailUrl: string }

// Track view (rate-limited)
POST /functions/v1/track-view
{ projectId: string }
→ { success: boolean }

// Get trending projects
GET /functions/v1/trending
?limit=20&offset=0
→ { projects: Project[] }

// Search projects
GET /functions/v1/search
?q=particles&tags=physics,emergent&sort=likes
→ { projects: Project[], total: number }
```

---

## Security Considerations

1. **Rate Limiting**: View tracking, likes, and API calls are rate-limited
2. **Content Moderation**: Flag system for inappropriate content
3. **XSS Prevention**: Sanitize all user-generated code before rendering
4. **RLS Policies**: All data access controlled by Row Level Security
5. **API Key Protection**: Supabase anon key is safe for client-side use

---

## Performance Optimizations

1. **Live Preview Thumbnails**: Use IntersectionObserver to only render visible sketches
2. **Lazy Loading**: Paginated gallery with infinite scroll
3. **CDN Caching**: Static assets and thumbnails cached at edge
4. **Connection Pooling**: Supabase handles connection management
5. **Realtime Throttling**: Batch updates for view counts

---

## Future Ideas

- **Collaborative Jam Sessions**: Real-time multiplayer editing
- **AI Prompt Library**: Browse successful prompts that created amazing sketches
- **NFT Integration**: Mint sketches as on-chain art (optional)
- **Audio Reactive Gallery**: Sketches that respond to ambient sound
- **VR Gallery**: Walk through a virtual gallery of living sketches
- **Sketch Battles**: Head-to-head creative competitions
- **Learning Paths**: Guided tutorials using successful sketch evolutions

---

*This design document outlines a comprehensive Save/Share/Gallery system that transforms P5.AI from a single-session tool into a thriving creative community. The phased approach allows for incremental implementation while maintaining a cohesive vision.*
