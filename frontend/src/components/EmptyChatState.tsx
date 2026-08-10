import React from 'react';
import { FlowLogo } from './FlowLogo';
import { UserProfile } from '../types';

interface EmptyChatStateProps {
  user: UserProfile | null;
  onSelectPrompt?: (promptText: string) => void;
  isKeyboardOpen?: boolean;
}

export const EmptyChatState: React.FC<EmptyChatStateProps> = ({ user, isKeyboardOpen = false }) => {
  // Determine time-of-day greeting
  const hour = new Date().getHours();
  let timeGreeting = 'Good Morning';
  if (hour >= 12 && hour < 17) {
    timeGreeting = 'Good Afternoon';
  } else if (hour >= 17) {
    timeGreeting = 'Good Evening';
  }

  // Extract first name
  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <div className={`flex-1 flex flex-col items-center justify-center p-4 text-center max-w-2xl mx-auto transition-all ${isKeyboardOpen ? 'py-2' : 'my-auto py-8 min-h-[40vh]'}`}>
      {/* Official Flow AI Logo (Clean, Borderless & Zoomed In) */}
      <div className={`${isKeyboardOpen ? 'mb-2' : 'mb-6'} flex items-center justify-center transition-all`}>
        <FlowLogo className={isKeyboardOpen ? 'w-14 h-10' : 'w-20 h-14 sm:w-24 sm:h-16'} />
      </div>

      {/* Dynamic Greeting Title */}
      <h1 className={`${isKeyboardOpen ? 'text-xl sm:text-2xl mb-1' : 'text-3xl sm:text-4xl mb-2.5'} font-semibold tracking-tight text-white transition-all`}>
        {timeGreeting}, <span className="text-white">{firstName}</span>
      </h1>

      {/* Subtle Subtitle */}
      {!isKeyboardOpen && (
        <p className="text-white/40 text-sm sm:text-base font-normal max-w-md transition-all">
          How can I help you today?
        </p>
      )}
    </div>
  );
};

