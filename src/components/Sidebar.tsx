import React, { useState } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, Settings, User, LogOut, X, Sparkles, Search } from 'lucide-react';
import { Conversation, UserProfile } from '../types';
import { FlowLogoText } from './FlowLogo';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  user: UserProfile | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onOpenSettings,
  onOpenProfile,
  onLogout,
  user,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartRename = (e: React.MouseEvent, c: Conversation) => {
    e.stopPropagation();
    setEditingId(c.id);
    setEditingTitle(c.title);
  };

  const handleSaveRename = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (editingTitle.trim()) {
      onRenameConversation(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 w-72 bg-[#090909] border-r border-white/5 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${!isOpen ? 'lg:w-0 lg:overflow-hidden lg:border-none' : 'lg:w-72'}`}
      >
        {/* Top Header & New Chat Button */}
        <div className="p-4 flex flex-col gap-4 border-b border-white/5">
          <div className="flex items-center justify-between">
            <FlowLogoText />
            <button
              onClick={onClose}
              className="p-1 text-white/40 hover:text-white rounded-lg hover:bg-white/5 lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 1024) onClose();
            }}
            className="w-full py-2.5 px-4 rounded-xl border border-white/10 flex items-center justify-center gap-2 text-sm font-medium hover:bg-white/5 transition-colors text-white shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-white/5 text-xs text-white placeholder-white/30 pl-8 pr-3 py-2 rounded-xl border border-white/5 focus:outline-none focus:border-white/20 transition-all"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-2 py-1 text-[10px] font-semibold tracking-widest text-white/30 uppercase">
            Recent Conversations
          </div>

          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-white/30 font-light">
              {searchQuery ? 'No matching conversations' : 'No chats yet. Start a new chat!'}
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isActive = c.id === activeConversationId;
              const isEditing = editingId === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelectConversation(c.id);
                    if (window.innerWidth < 1024) onClose();
                  }}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-white/5 text-white font-medium border border-white/10'
                      : 'text-white/50 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-white/30'}`} />
                    {isEditing ? (
                      <form
                        onSubmit={(e) => handleSaveRename(e, c.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1"
                      >
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={(e) => handleSaveRename(e, c.id)}
                          autoFocus
                          className="w-full bg-black text-white text-xs px-1.5 py-0.5 rounded border border-white/20 focus:outline-none"
                        />
                      </form>
                    ) : (
                      <span className="truncate leading-tight">{c.title || 'Untitled Chat'}</span>
                    )}
                  </div>

                  {/* Actions on hover */}
                  {!isEditing && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                      <button
                        onClick={(e) => handleStartRename(e, c)}
                        title="Rename"
                        className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(c.id);
                        }}
                        title="Delete"
                        className="p-1 text-white/40 hover:text-rose-400 hover:bg-white/10 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Menu: Settings, Profile & Logout */}
        <div className="p-3 border-t border-white/5 bg-[#090909] space-y-1">
          <button
            onClick={() => {
              onOpenSettings();
              if (window.innerWidth < 1024) onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs sm:text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <Settings className="w-4 h-4 text-white/40" />
            <span>Settings</span>
          </button>

          <button
            onClick={() => {
              onOpenProfile();
              if (window.innerWidth < 1024) onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
              ) : (
                <User className="w-4 h-4 text-white/40 shrink-0" />
              )}
              <span className="truncate">{user?.full_name || 'Account'}</span>
            </div>
            <span className="text-[10px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">Pro</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs sm:text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
