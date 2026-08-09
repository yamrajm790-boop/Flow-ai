import React from 'react';
import { FlowLogo } from './FlowLogo';
import { UserProfile } from '../types';

interface EmptyChatStateProps {
  user: UserProfile | null;
  onSelectPrompt?: (promptText: string) => void;
}

export const EmptyChatState: React.FC<EmptyChatStateProps> = ({ user }) => {
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
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto min-h-[60vh] transition-all">
      {/* Official Flow AI Logo (Clean, Borderless & Zoomed In) */}
      <div className="mb-6 flex items-center justify-center">
        <FlowLogo className="w-20 h-14 sm:w-24 sm:h-16" />
      </div>

      {/* Dynamic Greeting Title */}
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-2.5">
        {timeGreeting}, <span className="text-white">{firstName}</span>
      </h1>

      {/* Subtle Subtitle */}
      <p className="text-white/40 text-sm sm:text-base font-normal max-w-md">
        How can I help you today?
      </p>
    </div>
  );
};

