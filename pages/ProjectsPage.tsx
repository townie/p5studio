import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProjects } from '@/hooks/useProject';
import { useFolders } from '@/hooks/useFolders';
import { useCollections } from '@/hooks/useCollections';
import {
  FoldersSidebar,
  CollectionsSidebar,
  ProjectGrid,
  ProjectList,
  RenameModal,
  FolderModal,
  CollectionModal,
  MoveToFolderModal,
  AddToCollectionModal,
  VisibilityModal,
  DeleteConfirmModal,
} from '@/components/projects';
import type { Project, Folder, Collection, Visibility } from '@/types';
import {
  updateProjectVisibility,
  deleteProject,
} from '@/services/projectService';
import { moveProjectToFolder } from '@/services/folderService';
import {
  updateProjectCollections,
  getProjectCollections,
} from '@/services/collectionService';

/**
 * ProjectsPage - Main project management page
 * Shows user's projects with filtering, sorting, and organization features
 */
const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects, isLoading, error, reload: reloadProjects, removeProject } = useUserProjects(user?.id);
  const { folders, addFolder, editFolder, removeFolder } = useFolders(user?.id);
  const { collections, addCollection, editCollection, removeCollection } = useCollections(user?.id);

  // View and filter state
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'likes'>('recent');
  const [filterBy, setFilterBy] = useState<'all' | 'public' | 'private' | 'unlisted'>('all');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);

  // Modal state
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; project: Project | null }>({
    isOpen: false,
    project: null,
  });
  const [folderModal, setFolderModal] = useState<{ isOpen: boolean; folder: Folder | null }>({
    isOpen: false,
    folder: null,
  });
  const [collectionModal, setCollectionModal] = useState<{ isOpen: boolean; collection: Collection | null }>({
    isOpen: false,
    collection: null,
  });
  const [moveToFolderModal, setMoveToFolderModal] = useState<{
    isOpen: boolean;
    projects: Project[];
  }>({ isOpen: false, projects: [] });
  const [addToCollectionModal, setAddToCollectionModal] = useState<{
    isOpen: boolean;
    projects: Project[];
    selectedCollectionIds: Set<string>;
  }>({ isOpen: false, projects: [], selectedCollectionIds: new Set() });
  const [visibilityModal, setVisibilityModal] = useState<{
    isOpen: boolean;
    projects: Project[];
  }>({ isOpen: false, projects: [] });
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    projects: Project[];
  }>({ isOpen: false, projects: [] });

  // Calculate unfiled count (projects not in any folder)
  const unfolderedCount = useMemo(() => {
    return projects.filter((p) => !p.folder_id).length;
  }, [projects]);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let filtered = [...projects];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.tags?.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Visibility filter
    if (filterBy !== 'all') {
      filtered = filtered.filter((p) => p.visibility === filterBy);
    }

    // Folder filter
    if (activeFolder === 'unfiled') {
      filtered = filtered.filter((p) => !p.folder_id);
    } else if (activeFolder) {
      filtered = filtered.filter((p) => p.folder_id === activeFolder);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'likes':
          return b.likes_count - a.likes_count;
        case 'recent':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return filtered;
  }, [projects, searchQuery, filterBy, sortBy, activeFolder]);

  // Selection handlers
  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedProjects(new Set(filteredProjects.map((p) => p.id)));
    } else {
      setSelectedProjects(new Set());
    }
  }, [filteredProjects]);

  const handleSelectProject = useCallback((projectId: string, selected: boolean) => {
    setSelectedProjects((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(projectId);
      } else {
        newSet.delete(projectId);
      }
      return newSet;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedProjects(new Set());
  }, []);

  // Project actions
  const handleProjectClick = useCallback((project: Project) => {
    navigate(`/project/${project.id}`);
  }, [navigate]);

  const handleNewProject = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // Rename handler
  const handleRename = useCallback((project: Project) => {
    setRenameModal({ isOpen: true, project });
  }, []);

  const handleRenameSubmit = useCallback(async (newName: string) => {
    // TODO: Implement rename via projectService
    console.log('Rename project to:', newName);
    setRenameModal({ isOpen: false, project: null });
    await reloadProjects();
  }, [reloadProjects]);

  // Duplicate handler
  const handleDuplicate = useCallback((project: Project) => {
    // TODO: Implement duplicate via forkProject
    console.log('Duplicate project:', project.id);
  }, []);

  // Visibility handler
  const handleChangeVisibility = useCallback((project: Project) => {
    setVisibilityModal({ isOpen: true, projects: [project] });
  }, []);

  const handleVisibilitySubmit = useCallback(async (visibility: Visibility) => {
    if (!user?.id) return;

    for (const project of visibilityModal.projects) {
      await updateProjectVisibility(project.id, user.id, visibility);
    }
    setVisibilityModal({ isOpen: false, projects: [] });
    handleClearSelection();
    await reloadProjects();
  }, [user?.id, visibilityModal.projects, handleClearSelection, reloadProjects]);

  // Move to folder handler
  const handleMoveToFolder = useCallback((project: Project) => {
    setMoveToFolderModal({ isOpen: true, projects: [project] });
  }, []);

  const handleMoveToFolderSubmit = useCallback(async (folderId: string | null) => {
    if (!user?.id) return;

    for (const project of moveToFolderModal.projects) {
      await moveProjectToFolder(project.id, user.id, folderId);
    }
    setMoveToFolderModal({ isOpen: false, projects: [] });
    handleClearSelection();
    await reloadProjects();
  }, [user?.id, moveToFolderModal.projects, handleClearSelection, reloadProjects]);

  // Add to collection handler
  const handleAddToCollection = useCallback(async (project: Project) => {
    if (!user?.id) return;

    const existingCollections = await getProjectCollections(project.id, user.id);
    setAddToCollectionModal({
      isOpen: true,
      projects: [project],
      selectedCollectionIds: new Set(existingCollections.map((c) => c.id)),
    });
  }, [user?.id]);

  const handleAddToCollectionSubmit = useCallback(async (collectionIds: string[]) => {
    if (!user?.id) return;

    for (const project of addToCollectionModal.projects) {
      await updateProjectCollections(project.id, user.id, collectionIds);
    }
    setAddToCollectionModal({ isOpen: false, projects: [], selectedCollectionIds: new Set() });
    handleClearSelection();
  }, [user?.id, addToCollectionModal.projects, handleClearSelection]);

  // Delete handler
  const handleDelete = useCallback((project: Project) => {
    setDeleteModal({ isOpen: true, projects: [project] });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    for (const project of deleteModal.projects) {
      await removeProject(project.id);
    }
    setDeleteModal({ isOpen: false, projects: [] });
    handleClearSelection();
  }, [deleteModal.projects, removeProject, handleClearSelection]);

  // Bulk actions
  const handleBulkAction = useCallback((action: string) => {
    const selectedProjectsList = filteredProjects.filter((p) => selectedProjects.has(p.id));

    switch (action) {
      case 'move':
        setMoveToFolderModal({ isOpen: true, projects: selectedProjectsList });
        break;
      case 'visibility':
        setVisibilityModal({ isOpen: true, projects: selectedProjectsList });
        break;
      case 'delete':
        setDeleteModal({ isOpen: true, projects: selectedProjectsList });
        break;
    }
  }, [filteredProjects, selectedProjects]);

  // Folder handlers
  const handleCreateFolder = useCallback(() => {
    setFolderModal({ isOpen: true, folder: null });
  }, []);

  const handleEditFolder = useCallback((folder: Folder) => {
    setFolderModal({ isOpen: true, folder });
  }, []);

  const handleDeleteFolder = useCallback(async (folderId: string) => {
    await removeFolder(folderId);
    if (activeFolder === folderId) {
      setActiveFolder(null);
    }
  }, [removeFolder, activeFolder]);

  const handleFolderSubmit = useCallback(async (name: string, color?: string, icon?: string) => {
    if (folderModal.folder) {
      await editFolder(folderModal.folder.id, { name, color, icon });
    } else {
      await addFolder(name, color, icon);
    }
    setFolderModal({ isOpen: false, folder: null });
  }, [folderModal.folder, addFolder, editFolder]);

  // Collection handlers
  const handleCreateCollection = useCallback(() => {
    setCollectionModal({ isOpen: true, collection: null });
  }, []);

  const handleEditCollection = useCallback((collection: Collection) => {
    setCollectionModal({ isOpen: true, collection });
  }, []);

  const handleDeleteCollection = useCallback(async (collectionId: string) => {
    await removeCollection(collectionId);
    if (activeCollection === collectionId) {
      setActiveCollection(null);
    }
  }, [removeCollection, activeCollection]);

  const handleCollectionSubmit = useCallback(async (name: string, description?: string, isPublic?: boolean) => {
    if (collectionModal.collection) {
      await editCollection(collectionModal.collection.id, { name, description, is_public: isPublic });
    } else {
      await addCollection(name, description, isPublic);
    }
    setCollectionModal({ isOpen: false, collection: null });
  }, [collectionModal.collection, addCollection, editCollection]);

  // Get current folder for move modal
  const getCurrentFolderId = useCallback(() => {
    if (moveToFolderModal.projects.length === 1) {
      return moveToFolderModal.projects[0].folder_id;
    }
    return null;
  }, [moveToFolderModal.projects]);

  // Get current visibility for visibility modal
  const getCurrentVisibility = useCallback((): Visibility => {
    if (visibilityModal.projects.length === 1) {
      return visibilityModal.projects[0].visibility;
    }
    return 'private';
  }, [visibilityModal.projects]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 p-4 flex flex-col gap-6 overflow-y-auto">
        {/* Folders Section */}
        <FoldersSidebar
          folders={folders}
          activeFolder={activeFolder}
          unfolderedCount={unfolderedCount}
          onFolderSelect={setActiveFolder}
          onCreateFolder={handleCreateFolder}
          onEditFolder={handleEditFolder}
          onDeleteFolder={handleDeleteFolder}
        />

        {/* Collections Section */}
        <CollectionsSidebar
          collections={collections}
          activeCollection={activeCollection}
          onCollectionSelect={setActiveCollection}
          onCreateCollection={handleCreateCollection}
          onEditCollection={handleEditCollection}
          onDeleteCollection={handleDeleteCollection}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-zinc-100">My Projects</h1>
          <button
            onClick={handleNewProject}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-purple-500 hover:to-indigo-500 transition-colors flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Project
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-6">
          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 pl-10 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Filter Dropdown */}
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as typeof filterBy)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500 transition-colors"
          >
            <option value="all">All Projects</option>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-purple-500 transition-colors"
          >
            <option value="recent">Recently Updated</option>
            <option value="name">Name</option>
            <option value="likes">Most Liked</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-100'
              }`}
              title="Grid view"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-100'
              }`}
              title="List view"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedProjects.size > 0 && (
          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSelectAll(selectedProjects.size !== filteredProjects.length)}
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                {selectedProjects.size === filteredProjects.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-sm text-zinc-400">
                {selectedProjects.size} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkAction(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-purple-500 transition-colors"
              >
                <option value="">Actions</option>
                <option value="move">Move to Folder</option>
                <option value="visibility">Change Visibility</option>
                <option value="delete">Delete</option>
              </select>

              <button
                onClick={handleClearSelection}
                className="p-1.5 text-zinc-500 hover:text-zinc-100 transition-colors"
                title="Clear selection"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Projects Display */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-zinc-500">Failed to load projects</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-8 h-8 text-zinc-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <p className="text-zinc-500 mb-2">
                {searchQuery ? 'No projects found' : "You haven't created any projects yet"}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleNewProject}
                  className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
                >
                  Create your first project
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <ProjectGrid
              projects={filteredProjects}
              selectedIds={selectedProjects}
              onSelectProject={handleSelectProject}
              onSelectAll={handleSelectAll}
              onProjectClick={handleProjectClick}
              onRename={handleRename}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onChangeVisibility={handleChangeVisibility}
              onMoveToFolder={handleMoveToFolder}
              onAddToCollection={handleAddToCollection}
            />
          ) : (
            <ProjectList
              projects={filteredProjects}
              selectedIds={selectedProjects}
              onSelectProject={handleSelectProject}
              onSelectAll={handleSelectAll}
              onProjectClick={handleProjectClick}
              onRename={handleRename}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onChangeVisibility={handleChangeVisibility}
              onMoveToFolder={handleMoveToFolder}
              onAddToCollection={handleAddToCollection}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      <RenameModal
        isOpen={renameModal.isOpen}
        onClose={() => setRenameModal({ isOpen: false, project: null })}
        currentName={renameModal.project?.name ?? ''}
        onRename={handleRenameSubmit}
      />

      <FolderModal
        isOpen={folderModal.isOpen}
        onClose={() => setFolderModal({ isOpen: false, folder: null })}
        folder={folderModal.folder}
        onSave={handleFolderSubmit}
      />

      <CollectionModal
        isOpen={collectionModal.isOpen}
        onClose={() => setCollectionModal({ isOpen: false, collection: null })}
        collection={collectionModal.collection}
        onSave={handleCollectionSubmit}
      />

      <MoveToFolderModal
        isOpen={moveToFolderModal.isOpen}
        onClose={() => setMoveToFolderModal({ isOpen: false, projects: [] })}
        folders={folders}
        currentFolderId={getCurrentFolderId()}
        projectCount={moveToFolderModal.projects.length}
        onMove={handleMoveToFolderSubmit}
      />

      <AddToCollectionModal
        isOpen={addToCollectionModal.isOpen}
        onClose={() => setAddToCollectionModal({ isOpen: false, projects: [], selectedCollectionIds: new Set() })}
        collections={collections}
        selectedCollectionIds={addToCollectionModal.selectedCollectionIds}
        projectCount={addToCollectionModal.projects.length}
        onSave={handleAddToCollectionSubmit}
        onCreateCollection={handleCreateCollection}
      />

      <VisibilityModal
        isOpen={visibilityModal.isOpen}
        onClose={() => setVisibilityModal({ isOpen: false, projects: [] })}
        currentVisibility={getCurrentVisibility()}
        projectCount={visibilityModal.projects.length}
        onSave={handleVisibilitySubmit}
      />

      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, projects: [] })}
        projectCount={deleteModal.projects.length}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default ProjectsPage;
