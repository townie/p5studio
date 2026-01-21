import React from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import EditorPage from '@/pages/EditorPage';
import ViewPage from '@/pages/ViewPage';
import AuthCallback from '@/pages/AuthCallback';
import ProfilePage from '@/components/ProfilePage';
import ProfileSettings from '@/components/ProfileSettings';

/**
 * ProfilePageWrapper - Extracts username from route params and passes to ProfilePage
 */
const ProfilePageWrapper: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <ProfilePage
        username={username}
        onProjectClick={(project) => {
          navigate(`/s/${project.id}`);
        }}
        onOpenSettings={() => {
          navigate('/settings');
        }}
      />
    </div>
  );
};

/**
 * SettingsPageWrapper - Wraps ProfileSettings with navigation
 */
const SettingsPageWrapper: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <ProfileSettings
          onClose={() => {
            navigate(-1);
          }}
          onSaved={() => {
            // Stay on page after save
          }}
        />
      </div>
    </div>
  );
};

/**
 * App - Main application component with routing
 *
 * Routes:
 * /                    - EditorPage (new project)
 * /project/:projectId  - EditorPage (existing project)
 * /s/:projectId        - ViewPage (shared view)
 * /@:username          - ProfilePage
 * /settings            - ProfileSettings
 * /auth/callback       - OAuth callback handler
 */
const App: React.FC = () => {
  return (
    <Routes>
      {/* Editor routes */}
      <Route path="/" element={<EditorPage />} />
      <Route path="/project/:projectId" element={<EditorPage />} />

      {/* Shared view route */}
      <Route path="/s/:projectId" element={<ViewPage />} />

      {/* Profile routes */}
      <Route path="/@:username" element={<ProfilePageWrapper />} />
      <Route path="/settings" element={<SettingsPageWrapper />} />

      {/* Auth callback */}
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* 404 fallback - redirect to home */}
      <Route path="*" element={<EditorPage />} />
    </Routes>
  );
};

export default App;
