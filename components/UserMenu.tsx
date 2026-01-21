import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface UserMenuProps {
  onNavigate?: (path: string) => void;
}

/**
 * UserMenu - Dropdown menu for authenticated users
 *
 * Features:
 * - User avatar with initials placeholder
 * - Username display (larger screens)
 * - Dropdown with profile info, navigation links, and sign out
 * - Click outside / Escape to close
 * - Keyboard navigation with arrow keys
 */
export default function UserMenu({ onNavigate }: UserMenuProps) {
  const { user, profile, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Menu items configuration
  const menuItems = [
    { id: 'projects', label: 'My Projects', path: `/profile/${profile?.username || user?.id}` },
    { id: 'settings', label: 'Settings', path: '/settings' },
    { id: 'divider', label: '', path: '' },
    { id: 'signout', label: 'Sign Out', path: '' },
  ];

  const navigableItems = menuItems.filter(item => item.id !== 'divider');

  // Get user display info
  const displayName = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'User';
  const email = user?.email || '';
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;

  // Generate initials from display name
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(displayName);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return;

    switch (event.key) {
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        triggerRef.current?.focus();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => {
          const nextIndex = prev < navigableItems.length - 1 ? prev + 1 : 0;
          return nextIndex;
        });
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => {
          const nextIndex = prev > 0 ? prev - 1 : navigableItems.length - 1;
          return nextIndex;
        });
        break;
      case 'Enter':
      case ' ':
        if (focusedIndex >= 0 && focusedIndex < navigableItems.length) {
          event.preventDefault();
          handleItemClick(navigableItems[focusedIndex]);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
    }
  }, [isOpen, focusedIndex, navigableItems]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Focus item when focusedIndex changes
  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  const handleItemClick = async (item: typeof menuItems[0]) => {
    if (item.id === 'signout') {
      try {
        await signOut();
      } catch (error) {
        console.error('Error signing out:', error);
      }
    } else if (item.path && onNavigate) {
      onNavigate(item.path);
    }
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const toggleMenu = () => {
    setIsOpen(prev => !prev);
    if (!isOpen) {
      setFocusedIndex(-1);
    }
  };

  if (!user) return null;

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={toggleMenu}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-600"
      >
        {/* Avatar */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-7 h-7 rounded-full object-cover border border-zinc-700"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center border border-zinc-700">
            <span className="text-[10px] font-semibold text-white">{initials}</span>
          </div>
        )}

        {/* Username (hidden on small screens) */}
        <span className="hidden md:block text-sm text-zinc-300 max-w-[120px] truncate">
          {displayName}
        </span>

        {/* Dropdown Arrow */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      <div
        role="menu"
        aria-orientation="vertical"
        className={`absolute right-0 top-full mt-2 w-64 bg-[#111] border border-zinc-800 rounded-xl shadow-xl shadow-black/50 overflow-hidden z-50 origin-top-right transition-all duration-200 ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        {/* User Info Header */}
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover border border-zinc-700"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center border border-zinc-700">
                <span className="text-sm font-semibold text-white">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-100 truncate">{displayName}</p>
              <p className="text-xs text-zinc-500 truncate">{email}</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="py-1">
          {menuItems.map((item, index) => {
            if (item.id === 'divider') {
              return <div key={item.id} className="my-1 border-t border-zinc-800" />;
            }

            const navigableIndex = navigableItems.findIndex(i => i.id === item.id);
            const isFocused = focusedIndex === navigableIndex;
            const isSignOut = item.id === 'signout';

            return (
              <button
                key={item.id}
                ref={el => { itemRefs.current[navigableIndex] = el; }}
                role="menuitem"
                tabIndex={isFocused ? 0 : -1}
                onClick={() => handleItemClick(item)}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-3 ${
                  isSignOut
                    ? 'text-red-400 hover:bg-red-500/10 focus:bg-red-500/10'
                    : 'text-zinc-300 hover:bg-zinc-800 focus:bg-zinc-800'
                } ${isFocused ? (isSignOut ? 'bg-red-500/10' : 'bg-zinc-800') : ''} focus:outline-none`}
              >
                {/* Icon */}
                {item.id === 'projects' && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
                    <path d="M3 3v18h18" />
                    <path d="m19 9-5 5-4-4-3 3" />
                  </svg>
                )}
                {item.id === 'settings' && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
                {item.id === 'signout' && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" x2="9" y1="12" y2="12" />
                  </svg>
                )}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
