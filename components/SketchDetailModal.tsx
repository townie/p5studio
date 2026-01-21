import React, { useState, useEffect, useRef } from 'react';
import type { GallerySketch } from '@/types';
import Preview from './Preview';
import { getShareUrl, getEmbedCode } from '@/services/projectService';

interface SketchDetailModalProps {
  sketch: GallerySketch;
  isLiked: boolean;
  onLike: () => void;
  onFork: (historyIndex?: number) => void;
  onClose: () => void;
}

const SketchDetailModal: React.FC<SketchDetailModalProps> = ({
  sketch,
  isLiked,
  onLike,
  onFork,
  onClose,
}) => {
  const [viewIndex, setViewIndex] = useState(sketch.current_index);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const playInterval = useRef<NodeJS.Timeout | null>(null);

  const currentCode = sketch.history[viewIndex]?.code || '';
  const currentEntry = sketch.history[viewIndex];

  useEffect(() => {
    if (isPlaying) {
      playInterval.current = setInterval(() => {
        setViewIndex((prev) => {
          if (prev >= sketch.history.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000);
    } else {
      if (playInterval.current) {
        clearInterval(playInterval.current);
      }
    }

    return () => {
      if (playInterval.current) {
        clearInterval(playInterval.current);
      }
    };
  }, [isPlaying, sketch.history.length]);

  const togglePlay = () => {
    if (viewIndex >= sketch.history.length - 1) {
      setViewIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const copyUrl = async () => {
    const url = getShareUrl(sketch.short_id);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getEntryTypeColor = (type: string) => {
    switch (type) {
      case 'ai':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'manual':
        return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
      case 'initial':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      default:
        return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-[#0d0d0d] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800">
              {sketch.author_avatar_url ? (
                <img
                  src={sketch.author_avatar_url}
                  alt={sketch.author_username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  {sketch.author_display_name?.[0] || sketch.author_username?.[0] || '?'}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-lg font-medium text-white">{sketch.title}</h2>
              <p className="text-sm text-zinc-500">
                by @{sketch.author_username} • {formatDate(sketch.published_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onLike}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                isLiked
                  ? 'bg-red-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              </svg>
              {sketch.likes}
            </button>

            <button
              onClick={copyUrl}
              className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg hover:text-white transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  Share
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-zinc-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Preview */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 relative">
              <Preview code={currentCode} />
            </div>

            {/* Journey Controls */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setViewIndex(0)}
                  disabled={viewIndex === 0}
                  className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="19 20 9 12 19 4 19 20"/>
                    <line x1="5" y1="19" x2="5" y2="5"/>
                  </svg>
                </button>

                <button
                  onClick={() => setViewIndex(Math.max(0, viewIndex - 1))}
                  disabled={viewIndex === 0}
                  className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="19 20 9 12 19 4 19 20"/>
                  </svg>
                </button>

                <button
                  onClick={togglePlay}
                  className="p-3 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors"
                >
                  {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <rect x="6" y="4" width="4" height="16" rx="1"/>
                      <rect x="14" y="4" width="4" height="16" rx="1"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  )}
                </button>

                <button
                  onClick={() => setViewIndex(Math.min(sketch.history.length - 1, viewIndex + 1))}
                  disabled={viewIndex === sketch.history.length - 1}
                  className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 4 15 12 5 20 5 4"/>
                  </svg>
                </button>

                <button
                  onClick={() => setViewIndex(sketch.history.length - 1)}
                  disabled={viewIndex === sketch.history.length - 1}
                  className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 4 15 12 5 20 5 4"/>
                    <line x1="19" y1="5" x2="19" y2="19"/>
                  </svg>
                </button>

                {/* Progress Bar */}
                <div className="flex-1 mx-4">
                  <input
                    type="range"
                    min="0"
                    max={sketch.history.length - 1}
                    value={viewIndex}
                    onChange={(e) => setViewIndex(Number(e.target.value))}
                    className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500"
                  />
                </div>

                <span className="text-sm text-zinc-500 tabular-nums">
                  {viewIndex + 1} / {sketch.history.length}
                </span>
              </div>

              {/* Current Entry Info */}
              {currentEntry && (
                <div className="mt-3 flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs rounded-full border ${getEntryTypeColor(currentEntry.type)}`}>
                    {currentEntry.type === 'ai' && 'AI'}
                    {currentEntry.type === 'manual' && 'Manual'}
                    {currentEntry.type === 'initial' && 'Initial'}
                  </span>
                  <span className="text-sm text-zinc-400 truncate">
                    {currentEntry.label}
                  </span>
                  {currentEntry.prompt && (
                    <span className="text-sm text-purple-400 truncate flex-1">
                      "{currentEntry.prompt}"
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 border-l border-zinc-800 flex flex-col bg-zinc-900/30">
            {/* Tabs */}
            <div className="flex border-b border-zinc-800">
              <button
                onClick={() => setShowCode(false)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  !showCode ? 'text-white border-b-2 border-purple-500' : 'text-zinc-500 hover:text-white'
                }`}
              >
                Journey
              </button>
              <button
                onClick={() => setShowCode(true)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  showCode ? 'text-white border-b-2 border-purple-500' : 'text-zinc-500 hover:text-white'
                }`}
              >
                Code
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {showCode ? (
                <pre className="p-4 text-xs text-zinc-300 font-mono whitespace-pre-wrap">
                  {currentCode}
                </pre>
              ) : (
                <div className="p-4 space-y-2">
                  {sketch.history.map((entry, index) => (
                    <button
                      key={entry.id}
                      onClick={() => setViewIndex(index)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        index === viewIndex
                          ? 'bg-purple-500/20 border border-purple-500/30'
                          : 'bg-zinc-800/50 border border-transparent hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${
                          entry.type === 'ai' ? 'bg-purple-500' :
                          entry.type === 'initial' ? 'bg-indigo-500' : 'bg-zinc-500'
                        }`} />
                        <span className="text-xs text-zinc-500">v{index + 1}</span>
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${getEntryTypeColor(entry.type)}`}>
                          {entry.type}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 truncate">{entry.label}</p>
                      {entry.prompt && (
                        <p className="text-xs text-purple-400 truncate mt-1">"{entry.prompt}"</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fork Button */}
            <div className="p-4 border-t border-zinc-800">
              <button
                onClick={() => onFork(viewIndex)}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-indigo-600 transition-all flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="18" r="3"/>
                  <circle cx="6" cy="6" r="3"/>
                  <circle cx="18" cy="6" r="3"/>
                  <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/>
                  <path d="M12 12v3"/>
                </svg>
                Fork from v{viewIndex + 1}
              </button>
              <p className="text-xs text-zinc-500 text-center mt-2">
                Start your own version from this point
              </p>
            </div>
          </div>
        </div>

        {/* Description & Tags */}
        {(sketch.description || sketch.tags.length > 0) && (
          <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/30">
            {sketch.description && (
              <p className="text-sm text-zinc-400 mb-3">{sketch.description}</p>
            )}
            {sketch.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sketch.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-zinc-800 text-zinc-400 text-xs rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SketchDetailModal;
