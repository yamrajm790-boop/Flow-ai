export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  conversation_id: string;
  user_id?: string;
  role: Role;
  content: string;
  created_at: string;
  liked?: boolean;
  disliked?: boolean;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserPreferences {
  id?: string;
  user_id: string;
  theme: 'dark' | 'light' | 'system';
  model_preference: string;
  created_at?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  isPopular?: boolean;
}

export interface HealthStatus {
  status: string;
  timestamp?: string;
}
