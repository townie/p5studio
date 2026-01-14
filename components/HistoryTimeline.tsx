
import React from 'react';
import { HistoryEntry } from '../types';

interface HistoryTimelineProps {
  history: HistoryEntry[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

const HistoryTimeline: React.FC<HistoryTimelineProps> = ({ history, currentIndex, onSelect }) => {
  return (
    <div className="p-4 flex flex-col gap-2">
      <div className="mb-4">
        <h2 className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Project Timeline</h2>
        <p className="text-[10px] text-zinc-600">Click any version to travel back in time. New edits will fork the path.</p>
      </div>
      
      <div className="flex flex-col-reverse gap-3 relative">
        {/* Connector Line */}
        <div className="absolute left-[11px] top-3 bottom-3 w-px bg-zinc-800" />
        
        {history.map((entry, index) => {
          const isActive = index === currentIndex;
          const isAI = entry.type === 'ai';
          const isInitial = entry.type === 'initial';
          
          return (
            <button
              key={entry.id}
              onClick={() => onSelect(index)}
              className={`relative z-10 flex items-start gap-4 p-2 rounded-lg text-left transition-all ${
                isActive ? 'bg-zinc-800/50 border border-zinc-700 shadow-xl' : 'hover:bg-zinc-900 border border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <div className={`mt-1.5 w-[7px] h-[7px] rounded-full shrink-0 ${
                isActive ? 'bg-white ring-4 ring-white/10' : 
                isAI ? 'bg-purple-500' : 
                isInitial ? 'bg-indigo-500' : 'bg-zinc-600'
              }`} />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[11px] font-semibold truncate ${isActive ? 'text-white' : 'text-zinc-400'}`}>
                    {entry.label}
                  </span>
                  <span className="text-[9px] text-zinc-600 mono">
                    v{index + 1}
                  </span>
                </div>
                <div className="text-[9px] text-zinc-500 mono flex items-center gap-2">
                   {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   {isAI && <span className="text-[8px] bg-purple-500/10 text-purple-400 px-1 rounded uppercase tracking-tighter">AI</span>}
                </div>
                {entry.prompt && isActive && (
                  <p className="mt-2 text-[10px] text-zinc-400 italic leading-relaxed border-l-2 border-zinc-700 pl-2">
                    "{entry.prompt}"
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default HistoryTimeline;
