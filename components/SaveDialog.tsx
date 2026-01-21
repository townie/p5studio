import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { HistoryEntry, LocalProject } from '@/types';
import {
  saveProject,
  saveLocalProject,
  createLocalProject,
  generateThumbnail,
} from '@/services/projectService';

interface SaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  currentIndex: number;
  existingProject?: LocalProject;
  onSaved: (project: LocalProject) => void;
}

const SaveDialog: React.FC<SaveDialogProps> = ({
  isOpen,
  onClose,
  history,
  currentIndex,
  existingProject,
  onSaved,
}) => {
  const { user, isAuthenticated, signInWithGitHub, signInWithGoogle } = useAuth();
  const [title, setTitle] = useState(existingProject?.title || 'Untitled Sketch');
  const [description, setDescription] = useState(existingProject?.description || '');
  const [tags, setTags] = useState<string[]>(existingProject?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [saveToCloud, setSaveToCloud] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(existingProject?.thumbnail || null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);

  useEffect(() => {
    if (isOpen && !thumbnail && history.length > 0) {
      generateThumbnailPreview();
    }
  }, [isOpen]);

  useEffect(() => {
    if (existingProject) {
      setTitle(existingProject.title);
      setDescription(existingProject.description || '');
      setTags(existingProject.tags);
      setThumbnail(existingProject.thumbnail);
    }
  }, [existingProject]);

  const generateThumbnailPreview = async () => {
    setIsGeneratingThumbnail(true);
    const code = history[currentIndex]?.code;
    if (code) {
      const thumb = await generateThumbnail(code);
      setThumbnail(thumb);
    }
    setIsGeneratingThumbnail(false);
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Create or update local project
      const localProject: LocalProject = existingProject
        ? {
            ...existingProject,
            title,
            description: description || null,
            tags,
            history,
            current_index: currentIndex,
            is_public: isPublic,
            thumbnail,
            updated_at: Date.now(),
          }
        : createLocalProject(title, history, currentIndex);

      localProject.title = title;
      localProject.description = description || null;
      localProject.tags = tags;
      localProject.thumbnail = thumbnail;
      localProject.is_public = isPublic;

      // Save to local storage
      saveLocalProject(localProject);

      // If authenticated and saving to cloud
      if (saveToCloud && isAuthenticated && user) {
        const { project, error } = await saveProject(user.id, {
          id: localProject.remote_id,
          title,
          description: description || null,
          tags,
          history,
          current_index: currentIndex,
          is_public: isPublic,
          thumbnail,
          forked_from_id: localProject.forked_from_id,
          forked_from_index: localProject.forked_from_index,
        });

        if (error) {
          console.error('Error saving to cloud:', error);
        } else if (project) {
          localProject.remote_id = project.id;
          localProject.synced = true;
          saveLocalProject(localProject);
        }
      }

      onSaved(localProject);
      onClose();
    } catch (error) {
      console.error('Error saving project:', error);
    } finally {
      setIsSaving(false);
    }
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
      <div className="relative w-full max-w-lg bg-[#111] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-medium text-white">Save Project</h2>
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
        <div className="p-6 space-y-5">
          {/* Thumbnail Preview */}
          <div className="flex gap-4">
            <div className="w-32 h-32 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 flex-shrink-0">
              {isGeneratingThumbnail ? (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="animate-spin h-6 w-6 text-zinc-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : thumbnail ? (
                <img src={thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Project Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Awesome Sketch"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50"
                />
              </div>
              <button
                onClick={generateThumbnailPreview}
                disabled={isGeneratingThumbnail}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                Regenerate thumbnail
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this sketch do?"
              rows={2}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Tags (up to 5)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full"
                >
                  #{tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            {tags.length < 5 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add a tag..."
                  className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50"
                />
                <button
                  onClick={addTag}
                  disabled={!tagInput.trim()}
                  className="px-3 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Cloud Save Options */}
          <div className="pt-3 border-t border-zinc-800 space-y-3">
            {isAuthenticated ? (
              <>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveToCloud}
                    onChange={(e) => setSaveToCloud(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-purple-500 focus:ring-purple-500/50"
                  />
                  <span className="text-sm text-zinc-300">Save to cloud</span>
                  <span className="text-xs text-zinc-600">Sync across devices</span>
                </label>

                {saveToCloud && (
                  <label className="flex items-center gap-3 cursor-pointer ml-7">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-purple-500 focus:ring-purple-500/50"
                    />
                    <span className="text-sm text-zinc-300">Make public</span>
                    <span className="text-xs text-zinc-600">Visible in gallery</span>
                  </label>
                )}

                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="w-5 h-5 rounded-full overflow-hidden bg-zinc-800">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        {user?.display_name?.[0] || user?.username?.[0] || '?'}
                      </div>
                    )}
                  </span>
                  Signed in as @{user?.username}
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-zinc-400 mb-3">Sign in to save to cloud & share</p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={signInWithGitHub}
                    className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    GitHub
                  </button>
                  <button
                    onClick={signInWithGoogle}
                    className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm hover:bg-zinc-700 transition-colors flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <p className="text-xs text-zinc-500">
            {history.length} version{history.length !== 1 ? 's' : ''} in history
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-medium rounded-lg hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveDialog;
