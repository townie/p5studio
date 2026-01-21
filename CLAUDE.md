
## Project Overview

P5.AI Studio is a creative coding environment for p5.js powered by Google Gemini AI. Users can write, edit, and iterate on p5.js sketches with AI assistance.

## Commands

```bash
pnpm install        # Install dependencies
pnpm dev            # Start dev server on port 3000
pnpm build          # Build for production
pnpm preview        # Preview production build
```

## Configuration

Set `GEMINI_API_KEY` in `.env.local` for AI code generation.

The `@` path alias maps to the project root for imports (e.g., `@/components/CodeEditor`).

## Architecture

### State Management

`App.tsx` manages a branching history system where each edit creates a new `HistoryEntry`. When navigating to a past state and making changes, the history forks (truncates forward history and appends new entry). This enables full undo/redo with time-travel semantics.

### Key Components

- **CodeEditor**: Simple textarea-based editor for p5.js code
- **Preview**: Renders sketches in a sandboxed iframe by injecting code into a blob URL with p5.js loaded from CDN
- **HistoryTimeline**: Visual timeline for navigating version history, shows AI vs manual edits

### AI Integration

`services/geminiService.ts` handles Gemini API calls. Takes current code + user prompt and returns modified/new p5.js sketch code. System prompt in `constants.tsx` instructs the model to return complete, self-contained sketches.

### View Modes

Four layouts controlled by `ViewMode` enum: Code, Split, Preview, Timeline

### Project Export/Import

Projects serialize to JSON with full history array and current position index.
