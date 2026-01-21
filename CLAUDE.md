# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

P5.AI Studio is a creative coding environment for p5.js powered by Google Gemini AI. Users can write, edit, and iterate on p5.js sketches with AI assistance. Features include local project management, cloud sync via Supabase, and a public gallery for sharing and discovering sketches.

## Commands

```bash
pnpm install        # Install dependencies
pnpm dev            # Start dev server on port 3000
pnpm build          # Build for production
pnpm preview        # Preview production build
```

## Configuration

### Required
- `GEMINI_API_KEY` in `.env.local` for AI code generation

### Optional (for cloud features)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

The `@` path alias maps to the project root for imports (e.g., `@/components/CodeEditor`).

## Architecture

### State Management

`App.tsx` manages a branching history system where each edit creates a new `HistoryEntry`. When navigating to a past state and making changes, the history forks (truncates forward history and appends new entry). This enables full undo/redo with time-travel semantics.

### Key Components

**Core Editor:**
- **CodeEditor**: Simple textarea-based editor for p5.js code
- **Preview**: Renders sketches in a sandboxed iframe by injecting code into a blob URL with p5.js loaded from CDN
- **HistoryTimeline**: Visual timeline for navigating version history, shows AI vs manual edits

**Save/Share/Gallery System:**
- **SaveDialog**: Save projects locally or to cloud with metadata (title, description, tags, thumbnail)
- **ShareDialog**: Publish sketches to gallery, generate share links, embed codes, social sharing
- **Gallery**: Browse public sketches with live preview thumbnails, search, sort, like, and fork
- **SketchCard**: Gallery card component with live p5.js preview on hover
- **SketchDetailModal**: Full sketch view with journey playback (watch sketch evolve through history)
- **ProjectSidebar**: Manage local projects, switch between saved work
- **UserMenu**: Authentication and user profile dropdown

### Services

- **geminiService.ts**: Gemini AI API calls for code generation
- **supabase.ts**: Supabase client initialization
- **authService.ts**: Authentication (GitHub/Google OAuth), user profiles, follows
- **projectService.ts**: Local storage, cloud sync, publishing, gallery queries, likes, forks

### Contexts

- **AuthContext**: Manages authentication state, provides user info and auth methods to components

### AI Integration

`services/geminiService.ts` handles Gemini API calls. Takes current code + user prompt and returns modified/new p5.js sketch code. System prompt in `constants.tsx` instructs the model to return complete, self-contained sketches.

### View Modes

Five layouts controlled by `ViewMode` enum: Code, Split, Preview, Timeline, Gallery

### Data Flow

1. **Local-first**: Projects save to localStorage/IndexedDB immediately
2. **Optional cloud sync**: If authenticated and enabled, projects sync to Supabase
3. **Publishing**: Users can publish sketches to public gallery with shareable links
4. **Forking**: Users can fork any public sketch from any point in its history

### Database Schema

See `supabase/schema.sql` for the complete database schema including:
- `profiles` - User profiles linked to Supabase Auth
- `projects` - User's saved projects with full history
- `published_sketches` - Public gallery entries with short IDs for sharing
- `likes` - User likes on published sketches
- `follows` - User following relationships
- `challenges` - Weekly community challenges

### Project Export/Import

Projects serialize to JSON with full history array and current position index. Works offline without Supabase.
