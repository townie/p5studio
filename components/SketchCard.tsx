import React, { useState, useRef, useEffect } from 'react';
import type { GallerySketch } from '@/types';

interface SketchCardProps {
  sketch: GallerySketch;
  isLiked: boolean;
  onLike: () => void;
  onFork: () => void;
  onClick: () => void;
  featured?: boolean;
}

const SketchCard: React.FC<SketchCardProps> = ({
  sketch,
  isLiked,
  onLike,
  onFork,
  onClick,
  featured = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);

  const currentCode = sketch.history[sketch.current_index]?.code || '';

  useEffect(() => {
    if (isHovered) {
      // Delay showing live preview to avoid flicker on quick hovers
      hoverTimeout.current = setTimeout(() => {
        setShowLivePreview(true);
      }, 300);
    } else {
      if (hoverTimeout.current) {
        clearTimeout(hoverTimeout.current);
      }
      setShowLivePreview(false);
    }

    return () => {
      if (hoverTimeout.current) {
        clearTimeout(hoverTimeout.current);
      }
    };
  }, [isHovered]);

  const createPreviewHtml = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
          <style>
            body { margin: 0; overflow: hidden; background: #0a0a0a; }
            canvas { display: block; }
          </style>
        </head>
        <body>
          <script>
            // Throttle frame rate for thumbnails
            window._targetFrameRate = ${isHovered ? 60 : 15};
            ${currentCode}
          </script>
        </body>
      </html>
    `;
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLike();
  };

  const handleForkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFork();
  };

  return (
    <div
      className={`group relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 hover:border-purple-500/50 transition-all duration-300 cursor-pointer ${
        featured ? 'ring-2 ring-yellow-500/20' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Preview Area */}
      <div className="aspect-square relative overflow-hidden bg-zinc-950">
        {sketch.thumbnail && !showLivePreview ? (
          <img
            src={sketch.thumbnail}
            alt={sketch.title}
            className="w-full h-full object-cover"
          />
        ) : showLivePreview ? (
          <iframe
            ref={iframeRef}
            srcDoc={createPreviewHtml()}
            className="w-full h-full border-0"
            sandbox="allow-scripts"
            title={sketch.title}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-800">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
          </div>
        )}

        {/* Hover Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          {/* Play indicator */}
          {showLivePreview && (
            <div className="absolute top-3 left-3">
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                Live
              </span>
            </div>
          )}

          {/* Quick Actions */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <button
              onClick={handleLikeClick}
              className={`p-2 rounded-full transition-colors ${
                isLiked
                  ? 'bg-red-500 text-white'
                  : 'bg-black/50 text-white hover:bg-black/70'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              </svg>
            </button>
            <button
              onClick={handleForkClick}
              className="p-2 bg-black/50 text-white rounded-full hover:bg-purple-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="18" r="3"/>
                <circle cx="6" cy="6" r="3"/>
                <circle cx="18" cy="6" r="3"/>
                <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/>
                <path d="M12 12v3"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Featured Badge */}
        {featured && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Featured
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-medium text-white truncate mb-1">{sketch.title}</h3>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
            {sketch.author_avatar_url ? (
              <img
                src={sketch.author_avatar_url}
                alt={sketch.author_username}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                {sketch.author_display_name?.[0] || sketch.author_username?.[0] || '?'}
              </div>
            )}
          </div>
          <span className="text-sm text-zinc-500 truncate">
            @{sketch.author_username}
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
            {sketch.likes}
          </span>
          <span className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="18" r="3"/>
              <circle cx="6" cy="6" r="3"/>
              <circle cx="18" cy="6" r="3"/>
              <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/>
              <path d="M12 12v3"/>
            </svg>
            {sketch.forks}
          </span>
          <span className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            {sketch.views}
          </span>
        </div>

        {/* Tags */}
        {sketch.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {sketch.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded-full"
              >
                #{tag}
              </span>
            ))}
            {sketch.tags.length > 3 && (
              <span className="px-2 py-0.5 text-zinc-500 text-xs">
                +{sketch.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SketchCard;
