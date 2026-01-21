import React, { useState } from 'react';

interface ShareButtonProps {
  projectId: string;
  onShare?: () => void;
}

/**
 * ShareButton - A button that opens a share modal
 *
 * Currently a stub implementation that shows a placeholder modal.
 * Will be expanded to support full sharing functionality.
 */
const ShareButton: React.FC<ShareButtonProps> = ({ projectId, onShare }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    setIsModalOpen(true);
    onShare?.();
  };

  const handleClose = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      {/* Share Button */}
      <button
        onClick={handleClick}
        className="px-3 py-1.5 text-xs rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-1.5"
      >
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
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
          <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
        </svg>
        Share
      </button>

      {/* Share Modal (Stub) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal Content */}
          <div className="relative bg-[#111] border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-modal-enter">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-medium text-zinc-200">Share Project</h2>
              <button
                onClick={handleClose}
                className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-zinc-500"
                  >
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
                    <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
                  </svg>
                </div>
                <p className="text-zinc-400 text-sm mb-2">
                  Sharing coming soon
                </p>
                <p className="text-zinc-600 text-xs">
                  Project ID: {projectId}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-zinc-800 flex justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Animation Styles */}
      <style>{`
        @keyframes modal-enter {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-enter {
          animation: modal-enter 0.2s ease-out;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.15s ease-out;
        }
      `}</style>
    </>
  );
};

export default ShareButton;
