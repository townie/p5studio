import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { GallerySketch, GallerySortBy } from '@/types';
import {
  getGallerySketches,
  getFeaturedSketches,
  likeSketch,
  unlikeSketch,
  hasUserLiked,
  forkSketch,
} from '@/services/projectService';
import SketchCard from './SketchCard';
import SketchDetailModal from './SketchDetailModal';

interface GalleryProps {
  onFork: (sketch: GallerySketch, historyIndex?: number) => void;
  onClose: () => void;
}

const Gallery: React.FC<GalleryProps> = ({ onFork, onClose }) => {
  const { user, isAuthenticated } = useAuth();
  const [sketches, setSketches] = useState<GallerySketch[]>([]);
  const [featuredSketches, setFeaturedSketches] = useState<GallerySketch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<GallerySortBy>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedSketch, setSelectedSketch] = useState<GallerySketch | null>(null);
  const [likedSketches, setLikedSketches] = useState<Set<string>>(new Set());

  const loadSketches = useCallback(async (reset = false) => {
    setIsLoading(true);
    try {
      const newPage = reset ? 0 : page;
      const { sketches: newSketches, hasMore: more } = await getGallerySketches({
        sortBy,
        searchQuery,
        page: newPage,
        pageSize: 12,
      });

      if (reset) {
        setSketches(newSketches);
        setPage(0);
      } else {
        setSketches(prev => [...prev, ...newSketches]);
      }
      setHasMore(more);

      // Check which sketches the user has liked
      if (isAuthenticated && user) {
        const likedSet = new Set<string>();
        for (const sketch of newSketches) {
          const liked = await hasUserLiked(user.id, sketch.id);
          if (liked) likedSet.add(sketch.id);
        }
        setLikedSketches(prev => new Set([...prev, ...likedSet]));
      }
    } catch (error) {
      console.error('Error loading gallery:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, searchQuery, page, isAuthenticated, user]);

  const loadFeatured = useCallback(async () => {
    try {
      const featured = await getFeaturedSketches();
      setFeaturedSketches(featured);
    } catch (error) {
      console.error('Error loading featured:', error);
    }
  }, []);

  useEffect(() => {
    loadSketches(true);
    loadFeatured();
  }, [sortBy]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery !== '') {
        loadSketches(true);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleLike = async (sketch: GallerySketch) => {
    if (!isAuthenticated || !user) return;

    const isLiked = likedSketches.has(sketch.id);

    if (isLiked) {
      await unlikeSketch(user.id, sketch.id);
      setLikedSketches(prev => {
        const next = new Set(prev);
        next.delete(sketch.id);
        return next;
      });
      // Update sketch likes count in state
      setSketches(prev => prev.map(s =>
        s.id === sketch.id ? { ...s, likes: s.likes - 1 } : s
      ));
    } else {
      await likeSketch(user.id, sketch.id);
      setLikedSketches(prev => new Set([...prev, sketch.id]));
      setSketches(prev => prev.map(s =>
        s.id === sketch.id ? { ...s, likes: s.likes + 1 } : s
      ));
    }
  };

  const handleFork = async (sketch: GallerySketch, historyIndex?: number) => {
    onFork(sketch, historyIndex);
    onClose();
  };

  const loadMore = () => {
    if (!isLoading && hasMore) {
      setPage(prev => prev + 1);
      loadSketches();
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-[#0a0a0a] overflow-hidden flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-[#0d0d0d] flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center">
              <span className="text-white font-bold text-xs">P5</span>
            </div>
            <h1 className="text-lg font-medium text-white">Gallery</h1>
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sketches..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50"
            />
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          {(['recent', 'trending', 'most_liked'] as GallerySortBy[]).map((sort) => (
            <button
              key={sort}
              onClick={() => setSortBy(sort)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                sortBy === sort
                  ? 'bg-purple-500 text-white'
                  : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {sort === 'recent' && 'Recent'}
              {sort === 'trending' && 'Trending'}
              {sort === 'most_liked' && 'Popular'}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Featured Section */}
          {featuredSketches.length > 0 && !searchQuery && sortBy === 'recent' && (
            <section className="mb-12">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Featured
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredSketches.map((sketch) => (
                  <SketchCard
                    key={sketch.id}
                    sketch={sketch}
                    isLiked={likedSketches.has(sketch.id)}
                    onLike={() => handleLike(sketch)}
                    onFork={() => handleFork(sketch)}
                    onClick={() => setSelectedSketch(sketch)}
                    featured
                  />
                ))}
              </div>
            </section>
          )}

          {/* Main Grid */}
          <section>
            {!searchQuery && sortBy === 'recent' && featuredSketches.length > 0 && (
              <h2 className="text-xl font-semibold text-white mb-4">All Sketches</h2>
            )}

            {isLoading && sketches.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <svg className="animate-spin h-8 w-8 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : sketches.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                </div>
                <p className="text-zinc-400">No sketches found</p>
                {searchQuery && (
                  <p className="text-zinc-600 text-sm mt-1">Try a different search term</p>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {sketches.map((sketch) => (
                    <SketchCard
                      key={sketch.id}
                      sketch={sketch}
                      isLiked={likedSketches.has(sketch.id)}
                      onLike={() => handleLike(sketch)}
                      onFork={() => handleFork(sketch)}
                      onClick={() => setSelectedSketch(sketch)}
                    />
                  ))}
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="flex justify-center mt-8">
                    <button
                      onClick={loadMore}
                      disabled={isLoading}
                      className="px-6 py-3 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Loading...
                        </>
                      ) : (
                        'Load More'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* Sketch Detail Modal */}
      {selectedSketch && (
        <SketchDetailModal
          sketch={selectedSketch}
          isLiked={likedSketches.has(selectedSketch.id)}
          onLike={() => handleLike(selectedSketch)}
          onFork={(historyIndex) => handleFork(selectedSketch, historyIndex)}
          onClose={() => setSelectedSketch(null)}
        />
      )}
    </div>
  );
};

export default Gallery;
