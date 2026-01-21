
import React, { useState, useEffect, useRef } from 'react';
import CodeEditor from './components/CodeEditor';
import Preview from './components/Preview';
import HistoryTimeline from './components/HistoryTimeline';
import SaveDialog from './components/SaveDialog';
import ShareDialog from './components/ShareDialog';
import Gallery from './components/Gallery';
import ProjectSidebar from './components/ProjectSidebar';
import UserMenu from './components/UserMenu';
import { AuthProvider } from './contexts/AuthContext';
import { generateSketch } from './services/geminiService';
import {
  getLocalProjects,
  saveLocalProject,
  createLocalProject,
  getCurrentProjectId,
  setCurrentProjectId,
} from './services/projectService';
import { DEFAULT_SKETCH_CODE } from './constants';
import { ViewMode, HistoryEntry, ProjectData, LocalProject, GallerySketch } from './types';

const AppContent: React.FC = () => {
  const [history, setHistory] = useState<HistoryEntry[]>([{
    id: crypto.randomUUID(),
    code: DEFAULT_SKETCH_CODE,
    timestamp: Date.now(),
    label: 'Initial Sketch',
    type: 'initial'
  }]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Split);
  const [error, setError] = useState<string | null>(null);

  // Project state
  const [currentProject, setCurrentProject] = useState<LocalProject | null>(null);
  const [projectTitle, setProjectTitle] = useState('Untitled Sketch');

  // Dialog states
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showProjectSidebar, setShowProjectSidebar] = useState(false);

  const currentCode = history[currentIndex].code;
  const isInternalChange = useRef(false);

  // Load saved project on mount
  useEffect(() => {
    const savedProjectId = getCurrentProjectId();
    if (savedProjectId) {
      const projects = getLocalProjects();
      const project = projects.find(p => p.id === savedProjectId);
      if (project) {
        loadProject(project);
      }
    }
  }, []);

  // Auto-save current project
  useEffect(() => {
    if (currentProject) {
      const updatedProject: LocalProject = {
        ...currentProject,
        history,
        current_index: currentIndex,
        updated_at: Date.now(),
      };
      saveLocalProject(updatedProject);
    }
  }, [history, currentIndex, currentProject]);

  const loadProject = (project: LocalProject) => {
    setHistory(project.history);
    setCurrentIndex(project.current_index);
    setCurrentProject(project);
    setProjectTitle(project.title);
    setCurrentProjectId(project.id);
  };

  // Push new state to history
  const pushToHistory = (code: string, label: string, type: HistoryEntry['type'], promptText?: string) => {
    const newEntry: HistoryEntry = {
      id: crypto.randomUUID(),
      code,
      timestamp: Date.now(),
      label,
      type,
      prompt: promptText
    };

    // Fork: remove everything after currentIndex and add new entry
    const newHistory = [...history.slice(0, currentIndex + 1), newEntry];
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  // Debounced manual edit tracking
  const editTimer = useRef<NodeJS.Timeout | null>(null);
  const handleCodeChange = (newCode: string) => {
    isInternalChange.current = true;

    // We update the current entry's code immediately for UI responsiveness
    const updatedHistory = [...history];
    updatedHistory[currentIndex] = { ...updatedHistory[currentIndex], code: newCode };
    setHistory(updatedHistory);

    if (editTimer.current) clearTimeout(editTimer.current);
    editTimer.current = setTimeout(() => {
      pushToHistory(newCode, 'Manual Edit', 'manual');
    }, 2000);
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    try {
      const newCode = await generateSketch(prompt, currentCode);
      pushToHistory(newCode, `AI: ${prompt.slice(0, 20)}...`, 'ai', prompt);
      setPrompt('');
    } catch (err) {
      setError('Failed to generate code. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const undo = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const redo = () => {
    if (currentIndex < history.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const jumpToHistory = (index: number) => {
    setCurrentIndex(index);
  };

  const handleReset = () => {
    if (confirm('Reset to default sketch? All history will be cleared.')) {
      const initialEntry: HistoryEntry = {
        id: crypto.randomUUID(),
        code: DEFAULT_SKETCH_CODE,
        timestamp: Date.now(),
        label: 'Reset to Default',
        type: 'initial'
      };
      setHistory([initialEntry]);
      setCurrentIndex(0);
      setCurrentProject(null);
      setProjectTitle('Untitled Sketch');
      setCurrentProjectId(null);
      setError(null);
    }
  };

  const handleNewProject = () => {
    if (history.length > 1 || history[0].code !== DEFAULT_SKETCH_CODE) {
      if (!confirm('Create a new project? Unsaved changes will be lost.')) {
        return;
      }
    }

    const initialEntry: HistoryEntry = {
      id: crypto.randomUUID(),
      code: DEFAULT_SKETCH_CODE,
      timestamp: Date.now(),
      label: 'Initial Sketch',
      type: 'initial'
    };
    setHistory([initialEntry]);
    setCurrentIndex(0);
    setCurrentProject(null);
    setProjectTitle('Untitled Sketch');
    setCurrentProjectId(null);
    setError(null);
  };

  const handleSaved = (project: LocalProject) => {
    setCurrentProject(project);
    setProjectTitle(project.title);
    setCurrentProjectId(project.id);
  };

  const handleForkFromGallery = async (sketch: GallerySketch, historyIndex?: number) => {
    const forkIndex = historyIndex ?? sketch.current_index;
    const forkedHistory = sketch.history.slice(0, forkIndex + 1);

    // Add a fork entry
    const forkEntry: HistoryEntry = {
      id: crypto.randomUUID(),
      code: forkedHistory[forkedHistory.length - 1].code,
      timestamp: Date.now(),
      label: `Forked from @${sketch.author_username}`,
      type: 'initial',
    };

    const newHistory = [...forkedHistory, forkEntry];
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
    setProjectTitle(`Fork of ${sketch.title}`);
    setCurrentProject(null);
    setCurrentProjectId(null);
    setShowGallery(false);
  };

  const exportProject = () => {
    const project: ProjectData = {
      name: projectTitle,
      history,
      currentIndex
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectTitle.replace(/[^a-z0-9]/gi, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as ProjectData;
        if (data.history && Array.isArray(data.history)) {
          setHistory(data.history);
          setCurrentIndex(data.currentIndex ?? data.history.length - 1);
          setProjectTitle(data.name || 'Imported Project');
          setCurrentProject(null);
          setCurrentProjectId(null);
        }
      } catch (err) {
        alert('Invalid project file');
      }
    };
    reader.readAsText(file);
  };

  // Create a temporary project for sharing if none exists
  const getProjectForShare = (): LocalProject => {
    if (currentProject) {
      return {
        ...currentProject,
        history,
        current_index: currentIndex,
      };
    }
    return createLocalProject(projectTitle, history, currentIndex);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0a0a] text-zinc-100 selection:bg-zinc-800">
      {/* Header */}
      <header className="h-14 border-b border-[#222] flex items-center justify-between px-6 bg-[#0d0d0d] z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowProjectSidebar(true)}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            title="Your Projects"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-900/20">
              <span className="text-white font-bold text-xs">P5</span>
            </div>
            <div>
              <h1 className="font-medium tracking-tight text-zinc-200 text-sm">P5.AI <span className="text-zinc-500 font-light">Studio</span></h1>
              <p className="text-[10px] text-zinc-600 truncate max-w-[150px]">{projectTitle}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Undo/Redo */}
          <div className="flex items-center bg-zinc-900 rounded-lg p-1 mr-2 border border-zinc-800">
            <button
              onClick={undo}
              disabled={currentIndex === 0}
              className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-20 text-zinc-400"
              title="Undo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
            </button>
            <button
              onClick={redo}
              disabled={currentIndex === history.length - 1}
              className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-20 text-zinc-400"
              title="Redo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13"/></svg>
            </button>
          </div>

          <button
            onClick={() => setViewMode(ViewMode.Code)}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${viewMode === ViewMode.Code ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Code
          </button>
          <button
            onClick={() => setViewMode(ViewMode.Split)}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${viewMode === ViewMode.Split ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Split
          </button>
          <button
            onClick={() => setViewMode(ViewMode.Preview)}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${viewMode === ViewMode.Preview ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Preview
          </button>
          <button
            onClick={() => setViewMode(ViewMode.Timeline)}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${viewMode === ViewMode.Timeline ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Timeline
          </button>

          <div className="w-px h-4 bg-zinc-800 mx-2" />

          {/* Save Button */}
          <button
            onClick={() => setShowSaveDialog(true)}
            className="px-3 py-1.5 text-xs rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Save
          </button>

          {/* Share Button */}
          <button
            onClick={() => setShowShareDialog(true)}
            className="px-3 py-1.5 text-xs rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
          </button>

          {/* Gallery Button */}
          <button
            onClick={() => setShowGallery(true)}
            className="px-3 py-1.5 text-xs rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
            Gallery
          </button>

          <div className="w-px h-4 bg-zinc-800 mx-2" />

          <button
            onClick={exportProject}
            className="px-3 py-1.5 text-xs rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            Export
          </button>

          <label className="px-3 py-1.5 text-xs rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-1.5 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            Import
            <input type="file" className="hidden" accept=".json" onChange={importProject} />
          </label>

          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs rounded text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
          >
            Reset
          </button>

          <div className="w-px h-4 bg-zinc-800 mx-2" />

          {/* User Menu */}
          <UserMenu
            onOpenGallery={() => setShowGallery(true)}
            onOpenProjects={() => setShowProjectSidebar(true)}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Editor Area */}
        {(viewMode === ViewMode.Split || viewMode === ViewMode.Code) && (
          <div className={`${viewMode === ViewMode.Split ? 'w-1/2' : 'w-full'} h-full transition-all duration-300`}>
            <CodeEditor code={currentCode} onChange={handleCodeChange} />
          </div>
        )}

        {/* Preview Area */}
        {(viewMode === ViewMode.Split || viewMode === ViewMode.Preview) && (
          <div className={`${viewMode === ViewMode.Split ? 'w-1/2' : 'w-full'} h-full transition-all duration-300`}>
            <Preview code={currentCode} />
          </div>
        )}

        {/* Timeline View */}
        {viewMode === ViewMode.Timeline && (
          <div className="w-full h-full bg-[#0d0d0d] flex overflow-hidden">
             <div className="w-64 border-r border-zinc-800 overflow-y-auto">
               <HistoryTimeline
                history={history}
                currentIndex={currentIndex}
                onSelect={jumpToHistory}
               />
             </div>
             <div className="flex-1">
               <Preview code={currentCode} />
             </div>
          </div>
        )}
      </main>

      {/* Floating AI Prompt Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-30">
        <form
          onSubmit={handleGenerate}
          className="relative group"
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative flex items-center bg-[#111] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Evolve this sketch... (e.g. 'Make it reactive to audio')"
              disabled={isGenerating}
              className="flex-1 bg-transparent px-6 py-4 text-sm focus:outline-none placeholder:text-zinc-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              className="mr-3 px-6 py-2 bg-white text-black text-xs font-semibold rounded-xl hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-3 w-3 text-zinc-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Forging...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                  Magic
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="absolute -top-10 left-0 right-0 text-center">
              <span className="text-red-400 text-xs bg-red-400/10 px-3 py-1 rounded-full border border-red-400/20">{error}</span>
            </div>
          )}
        </form>
      </div>

      {/* Quick Status */}
      <div className="fixed bottom-4 left-6 z-30 pointer-events-none flex items-center gap-4">
        <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em]">P5.JS Bootstrap</p>
        <div className="w-px h-2 bg-zinc-800" />
        <p className="text-[10px] text-zinc-500 font-medium">VERSION {currentIndex + 1} OF {history.length}</p>
        {currentProject?.synced && (
          <>
            <div className="w-px h-2 bg-zinc-800" />
            <p className="text-[10px] text-green-500 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
              </svg>
              SYNCED
            </p>
          </>
        )}
      </div>

      {/* Dialogs */}
      <SaveDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        history={history}
        currentIndex={currentIndex}
        existingProject={currentProject || undefined}
        onSaved={handleSaved}
      />

      <ShareDialog
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        project={getProjectForShare()}
        history={history}
        currentIndex={currentIndex}
      />

      {showGallery && (
        <Gallery
          onFork={handleForkFromGallery}
          onClose={() => setShowGallery(false)}
        />
      )}

      <ProjectSidebar
        isOpen={showProjectSidebar}
        onClose={() => setShowProjectSidebar(false)}
        onSelectProject={loadProject}
        onNewProject={handleNewProject}
        currentProjectId={currentProject?.id || null}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
