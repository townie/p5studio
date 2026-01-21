import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

/**
 * AuthCallback - Handles OAuth redirect after authentication
 * Extracts tokens from URL and redirects to home or previous page
 */
const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the code from URL params (used by some OAuth providers)
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Check for OAuth errors
        if (errorParam) {
          setError(errorDescription || errorParam);
          return;
        }

        // If there's a code, exchange it for a session
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setError(exchangeError.message);
            return;
          }
        }

        // Check if we have a session (handles hash-based tokens too)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        if (!session) {
          // No session and no code - might be hash-based flow
          // Supabase should handle this automatically via onAuthStateChange
          // Wait a moment and check again
          await new Promise(resolve => setTimeout(resolve, 1000));

          const { data: { session: retrySession } } = await supabase.auth.getSession();

          if (!retrySession) {
            setError('Authentication failed. Please try again.');
            return;
          }
        }

        // Get the redirect URL from localStorage or default to home
        const redirectTo = localStorage.getItem('auth_redirect') || '/';
        localStorage.removeItem('auth_redirect');

        // Navigate to the stored redirect URL or home
        navigate(redirectTo, { replace: true });
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-center px-4">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-medium text-zinc-200 mb-2">Authentication Error</h2>
        <p className="text-zinc-500 mb-6 max-w-md">{error}</p>
        <button
          onClick={() => navigate('/', { replace: true })}
          className="px-4 py-2 bg-zinc-800 text-zinc-100 rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-900/20">
            <span className="text-white font-bold text-sm">P5</span>
          </div>
          <div className="absolute inset-0 animate-ping rounded-full bg-purple-500/30" />
        </div>
        <p className="text-zinc-400 text-sm">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
