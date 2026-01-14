
import React, { useState, useEffect, useCallback, useRef } from 'react';
import CodeEditor from './components/CodeEditor';
import Preview from './components/Preview';
import HistoryTimeline from './components/HistoryTimeline';
import { generateSketch } from './services/geminiService';
import { DEFAULT_SKETCH_CODE } from './constants';
import { ViewMode, HistoryEntry, ProjectData } from './types';

const App: React.FC = () => {
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

  const currentCode = history[currentIndex].code;
  const isInternalChange = useRef(false);

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
      // Only push a new history entry if the code actually changed from the PREVIOUS history entry
      // and it wasn't just a cursor move (though textarea doesn't give us that)
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
      setError(null);
    }
  };

  const exportProject = () => {
    const project: ProjectData = {
      name: 'P5-AI-Project-' + new Date().toISOString().split('T')[0],
      history,
      currentIndex
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}.json`;
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
        }
      } catch (err) {
        alert('Invalid project file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0a0a] text-zinc-100 selection:bg-zinc-800">
      {/* Header */}
      <header className="h-14 border-b border-[#222] flex items-center justify-between px-6 bg-[#0d0d0d] z-20">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-900/20">
            <span className="text-white font-bold text-xs">P5</span>
          </div>
          <h1 className="font-medium tracking-tight text-zinc-200">P5.AI <span className="text-zinc-500 font-light">Studio</span></h1>
        </div>

        <div className="flex items-center gap-1">
          {/* Undo/Redo */}
          <div className="flex items-center bg-zinc-900 rounded-lg p-1 mr-4 border border-zinc-800">
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

        {/* Timeline View Overlay/Side */}
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
                    <path className="opacity-75" fill="currentColor" d="4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
      </div>
    </div>
  );
};

export default App;
