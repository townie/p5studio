import React, { useState, useEffect, useRef } from 'react';
import { SaveStatus as SaveStatusType } from '@/types';

interface SaveStatusProps {
  status: SaveStatusType;
  lastSaved?: Date;
  onRetry?: () => void;
}

/**
 * Formats a relative time string (e.g., "2 minutes ago")
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 5) return 'just now';
  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
}

/**
 * SaveStatus - A compact status indicator for auto-save functionality
 *
 * Shows different states:
 * - idle: Subtle cloud icon
 * - saving: Animated spinner with "Saving..." text
 * - saved: Green checkmark with "Saved" text (fades to idle after 2s)
 * - error: Red warning icon with "Error" text, clickable to retry
 */
const SaveStatus: React.FC<SaveStatusProps> = ({ status, lastSaved, onRetry }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [displayStatus, setDisplayStatus] = useState<SaveStatusType>(status);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle auto-fade from 'saved' to 'idle' after 2 seconds
  useEffect(() => {
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
    }

    setDisplayStatus(status);

    if (status === 'saved') {
      fadeTimeoutRef.current = setTimeout(() => {
        setDisplayStatus('idle');
      }, 2000);
    }

    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [status]);

  const handleClick = () => {
    if (displayStatus === 'error' && onRetry) {
      onRetry();
    }
  };

  const tooltipText = lastSaved
    ? `Last saved ${formatTimeAgo(lastSaved)}`
    : 'Not yet saved';

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Tooltip */}
      {showTooltip && lastSaved && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-[10px] text-zinc-300 bg-zinc-900 border border-zinc-800 rounded whitespace-nowrap shadow-lg z-50 animate-fade-in">
          {tooltipText}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-zinc-800" />
        </div>
      )}

      {/* Status Indicator */}
      <button
        onClick={handleClick}
        disabled={displayStatus !== 'error'}
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all duration-300
          ${displayStatus === 'error'
            ? 'text-red-400 hover:bg-red-400/10 cursor-pointer'
            : 'cursor-default'
          }
          ${displayStatus === 'idle' ? 'text-zinc-600' : ''}
          ${displayStatus === 'saving' ? 'text-zinc-400' : ''}
          ${displayStatus === 'saved' ? 'text-emerald-400' : ''}
        `}
      >
        {/* Idle State - Cloud Icon */}
        {displayStatus === 'idle' && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-50 transition-opacity duration-300"
          >
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
          </svg>
        )}

        {/* Saving State - Spinner */}
        {displayStatus === 'saving' && (
          <>
            <svg
              className="animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <span className="text-zinc-400">Saving...</span>
          </>
        )}

        {/* Saved State - Checkmark */}
        {displayStatus === 'saved' && (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span className="transition-opacity duration-300">Saved</span>
          </>
        )}

        {/* Error State - Warning Icon */}
        {displayStatus === 'error' && (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <span>Error</span>
            {onRetry && (
              <span className="text-[10px] text-red-400/70 ml-0.5">(retry)</span>
            )}
          </>
        )}
      </button>
    </div>
  );
};

export default SaveStatus;
