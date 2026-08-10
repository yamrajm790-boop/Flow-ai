import React, { useState } from 'react';
import { X, User, Moon, Trash2, CheckCircle2 } from 'lucide-react';
import { UserProfile, HealthStatus } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  health?: HealthStatus | null;
  onClearAllConversations: () => void;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onClearAllConversations,
  onUpdateProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance'>('profile');
  const [nameInput, setNameInput] = useState(user?.full_name || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      onUpdateProfile({ full_name: nameInput.trim() });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#161618] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#1c1c20]">
          <h2 className="text-lg font-medium text-white">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/5 px-6 pt-2 bg-[#161618] gap-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 transition-colors border-b-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`pb-2.5 transition-colors border-b-2 cursor-pointer ${
              activeTab === 'appearance'
                ? 'border-white text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Appearance
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-neutral-300">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="flex items-center gap-4 p-3 rounded-2xl bg-[#222226] border border-white/5">
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white/70">
                      <User className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-white text-sm">{user?.full_name || 'Account'}</div>
                    <div className="text-neutral-400 text-xs">{user?.email || 'Flow AI User'}</div>
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 font-medium text-neutral-300">Display Name</label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full bg-[#222226] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-white/30"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  {savedSuccess ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Profile updated
                    </span>
                  ) : (
                    <span />
                  )}
                  <button
                    type="submit"
                    className="px-4 py-2 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>

              {/* Data & Privacy Section */}
              <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="font-medium text-white text-xs">Data & Privacy</div>
                <div className="p-4 rounded-2xl bg-[#222226] border border-white/5 space-y-3">
                  <div className="text-neutral-400 text-xs leading-relaxed">
                    Clear your chat history on this device and connected account.
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to clear all chat history?')) {
                        onClearAllConversations();
                        onClose();
                      }
                    }}
                    className="flex items-center gap-2 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-xl border border-rose-500/20 transition-colors cursor-pointer text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All Chat History</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div>
                <div className="font-medium text-white mb-1">Theme</div>
                <p className="text-neutral-400 mb-3">Flow AI features a dark premium interface inspired by modern AI apps.</p>
                <div className="flex gap-3">
                  <div className="flex-1 p-3.5 rounded-2xl bg-[#222226] border border-white/20 text-center font-medium text-white flex flex-col items-center gap-2">
                    <Moon className="w-5 h-5 text-purple-400" />
                    <span>Dark Premium</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

