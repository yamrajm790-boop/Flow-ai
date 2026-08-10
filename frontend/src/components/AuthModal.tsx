import React from 'react';
import { FlowLogo } from './FlowLogo';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { defaultGuestProfile, saveLocalUser } from '../lib/storage';
import { X, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const { loginWithGoogle, loading, error, user } = useAuth();

  React.useEffect(() => {
    if (isOpen && user && user.id !== 'guest') {
      onAuthSuccess(user);
      onClose();
    }
  }, [user, isOpen, onAuthSuccess, onClose]);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    await loginWithGoogle();
  };

  const handleGuestContinue = () => {
    saveLocalUser(defaultGuestProfile);
    onAuthSuccess(defaultGuestProfile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#161618] border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Official Flow AI Logo */}
        <div className="flex justify-center mb-5">
          <FlowLogo className="w-16 h-11" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-serif text-white font-normal mb-1">Welcome to Flow AI</h2>
        <p className="text-neutral-400 text-sm font-light mb-8">
          Your intelligent AI workspace.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-left">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {/* Continue with Google Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-neutral-100 text-black font-medium rounded-2xl text-sm transition-all shadow-md active:scale-98 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
          </button>

          {/* Guest fallback button */}
          <button
            onClick={handleGuestContinue}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#222226] hover:bg-[#2c2c32] text-neutral-300 hover:text-white font-medium rounded-2xl text-xs transition-colors border border-white/5"
          >
            <span>Continue as Guest Demo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Terms notice */}
        <p className="text-[11px] text-neutral-500 mt-6 leading-relaxed">
          By continuing, you agree to our <span className="underline cursor-pointer hover:text-neutral-400">Terms</span> and{' '}
          <span className="underline cursor-pointer hover:text-neutral-400">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
};
