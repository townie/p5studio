import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { HistoryEntry, LocalProject, ShareMode, PublishedSketch } from '@/types';
import {
  publishSketch,
  getShareUrl,
  getEmbedCode,
  generateThumbnail,
} from '@/services/projectService';
import Preview from './Preview';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: LocalProject;
  history: HistoryEntry[];
  currentIndex: number;
}

const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  project,
  history,
  currentIndex,
}) => {
  const { user, isAuthenticated, signInWithGitHub, signInWithGoogle } = useAuth();
  const [shareMode, setShareMode] = useState<ShareMode>('snapshot');
  const [publishedSketch, setPublishedSketch] = useState<PublishedSketch | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [embedWidth, setEmbedWidth] = useState(400);
  const [embedHeight, setEmbedHeight] = useState(400);

  const currentCode = history[currentIndex]?.code || '';

  const handlePublish = async () => {
    if (!isAuthenticated || !user) return;

    setIsPublishing(true);
    try {
      // Generate thumbnail if not exists
      let thumbnail = project.thumbnail;
      if (!thumbnail) {
        thumbnail = await generateThumbnail(currentCode);
      }

      const projectWithThumbnail = { ...project, thumbnail };

      const { sketch, error } = await publishSketch(
        user.id,
        projectWithThumbnail,
        project.title,
        project.description,
        project.tags
      );

      if (error) {
        console.error('Error publishing:', error);
        return;
      }

      if (sketch) {
        setPublishedSketch(sketch);
      }
    } catch (error) {
      console.error('Error publishing:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  const shareUrl = publishedSketch
    ? getShareUrl(publishedSketch.short_id, shareMode === 'journey' ? 'journey' : 'snapshot')
    : '';

  const embedCode = publishedSketch
    ? getEmbedCode(publishedSketch.short_id, embedWidth, embedHeight)
    : '';

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToTwitter = () => {
    const text = `Check out my p5.js sketch: "${project.title}"`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };

  const shareToLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };

  const shareToReddit = () => {
    const url = `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(project.title)}`;
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl bg-[#111] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-medium text-white">Share "{project.title}"</h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-zinc-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!isAuthenticated ? (
            /* Sign in prompt */
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </div>
              <h3 className="text-xl font-medium text-white mb-2">Sign in to share</h3>
              <p className="text-zinc-400 mb-6 max-w-sm mx-auto">
                Create an account to publish your sketch to the gallery and share it with the world.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={signInWithGitHub}
                  className="px-6 py-3 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-colors flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  Sign in with GitHub
                </button>
                <button
                  onClick={signInWithGoogle}
                  className="px-6 py-3 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-colors flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </button>
              </div>
            </div>
          ) : !publishedSketch ? (
            /* Publish prompt */
            <div className="space-y-6">
              {/* Live Preview */}
              <div className="aspect-square max-w-xs mx-auto rounded-xl overflow-hidden border border-zinc-800">
                <Preview code={currentCode} />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-medium text-white mb-2">Ready to share?</h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Publish your sketch to get a shareable link. Your work will be visible in the public gallery.
                </p>
                <button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="px-8 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-medium rounded-xl hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 transition-all flex items-center gap-2 mx-auto"
                >
                  {isPublishing ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Publishing...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                        <polyline points="16 6 12 2 8 6"/>
                        <line x1="12" y1="2" x2="12" y2="15"/>
                      </svg>
                      Publish to Gallery
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Share options after publishing */
            <div className="space-y-6">
              {/* Preview */}
              <div className="aspect-video max-w-sm mx-auto rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
                <Preview code={currentCode} />
              </div>

              {/* Share Mode Tabs */}
              <div className="flex gap-2 justify-center">
                {(['snapshot', 'journey', 'embed'] as ShareMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setShareMode(mode)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      shareMode === mode
                        ? 'bg-purple-500 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                    }`}
                  >
                    {mode === 'snapshot' && 'Snapshot'}
                    {mode === 'journey' && 'Journey'}
                    {mode === 'embed' && 'Embed'}
                  </button>
                ))}
              </div>

              {/* Mode description */}
              <p className="text-center text-sm text-zinc-500">
                {shareMode === 'snapshot' && 'Share the current state of your sketch'}
                {shareMode === 'journey' && 'Let viewers explore your creative process through history'}
                {shareMode === 'embed' && 'Embed your sketch on any website'}
              </p>

              {/* URL / Embed Code */}
              {shareMode === 'embed' ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Width</label>
                      <input
                        type="number"
                        value={embedWidth}
                        onChange={(e) => setEmbedWidth(Number(e.target.value))}
                        className="w-24 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Height</label>
                      <input
                        type="number"
                        value={embedHeight}
                        onChange={(e) => setEmbedHeight(Number(e.target.value))}
                        className="w-24 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white"
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <textarea
                      value={embedCode}
                      readOnly
                      rows={3}
                      className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 font-mono resize-none"
                    />
                    <button
                      onClick={() => copyToClipboard(embedCode)}
                      className="absolute top-2 right-2 p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                    >
                      {copied ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="w-full px-4 py-3 pr-24 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300"
                  />
                  <button
                    onClick={() => copyToClipboard(shareUrl)}
                    className="absolute top-1/2 -translate-y-1/2 right-2 px-4 py-1.5 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}

              {/* Social Share Buttons */}
              <div className="flex justify-center gap-3">
                <button
                  onClick={shareToTwitter}
                  className="p-3 bg-zinc-800 rounded-xl text-zinc-400 hover:text-[#1DA1F2] hover:bg-zinc-700 transition-colors"
                  title="Share on Twitter"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </button>
                <button
                  onClick={shareToFacebook}
                  className="p-3 bg-zinc-800 rounded-xl text-zinc-400 hover:text-[#1877F2] hover:bg-zinc-700 transition-colors"
                  title="Share on Facebook"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </button>
                <button
                  onClick={shareToLinkedIn}
                  className="p-3 bg-zinc-800 rounded-xl text-zinc-400 hover:text-[#0A66C2] hover:bg-zinc-700 transition-colors"
                  title="Share on LinkedIn"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </button>
                <button
                  onClick={shareToReddit}
                  className="p-3 bg-zinc-800 rounded-xl text-zinc-400 hover:text-[#FF4500] hover:bg-zinc-700 transition-colors"
                  title="Share on Reddit"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                  </svg>
                </button>
              </div>

              {/* Stats */}
              <div className="flex justify-center gap-6 pt-4 border-t border-zinc-800">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{publishedSketch.views}</p>
                  <p className="text-xs text-zinc-500">Views</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{publishedSketch.likes}</p>
                  <p className="text-xs text-zinc-500">Likes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{publishedSketch.forks}</p>
                  <p className="text-xs text-zinc-500">Forks</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareDialog;
