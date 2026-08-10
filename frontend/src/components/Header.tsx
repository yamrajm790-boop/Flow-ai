import React from 'react';
import { Menu, User } from 'lucide-react';
import { UserProfile } from '../types';
import { FlowLogoText } from './FlowLogo';

interface HeaderProps {
  user: UserProfile | null;
  onToggleSidebar: () => void;
  onOpenUpgrade: () => void;
  onOpenProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onToggleSidebar,
  onOpenUpgrade,
  onOpenProfile,
}) => {
  return (
    <header className="sticky top-0 z-20 w-full h-16 bg-[#0D0D0D]/90 backdrop-blur-md border-b border-white/5 px-4 sm:px-8 flex items-center justify-between transition-all">
      {/* Left: Sidebar Toggle & Flow AI Brand Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle Navigation Sidebar"
          className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center pl-1 border-l border-white/10">
          <FlowLogoText logoSize="w-6 h-6" />
        </div>
      </div>

      {/* Center: Plan Status Badge (Immersive UI style) */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span className="text-[11px] font-medium text-white/70 tracking-wide uppercase">FREE PLAN</span>
          <span className="text-[10px] text-white/30">•</span>
          <button
            onClick={onOpenUpgrade}
            className="text-[11px] font-semibold text-white hover:underline transition-colors"
          >
            UPGRADE
          </button>
        </div>
      </div>

      {/* Right: User Profile / Avatar */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenProfile}
          aria-label="User Account Menu"
          className="relative p-1 rounded-full border border-white/10 hover:border-white/30 transition-all focus:outline-none focus:ring-2 focus:ring-white/20 bg-[#161616]"
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.full_name || 'User profile'}
              className="w-7 h-7 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70">
              <User className="w-4 h-4" />
            </div>
          )}
        </button>
      </div>
    </header>
  );
};
