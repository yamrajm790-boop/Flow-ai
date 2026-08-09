import { Conversation, Message, UserProfile } from '../types';

const CONVERSATIONS_KEY = 'flow_ai_conversations';
const MESSAGES_KEY = 'flow_ai_messages';
const USER_KEY = 'flow_ai_current_user';

export const defaultGuestProfile: UserProfile = {
  id: 'user-guest-101',
  email: 'mithila@flow.ai',
  full_name: 'Mithila',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  created_at: new Date().toISOString(),
};

export function getLocalUser(): UserProfile {
  try {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : defaultGuestProfile;
  } catch {
    return defaultGuestProfile;
  }
}

export function saveLocalUser(user: UserProfile) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('Failed to save user to localStorage', e);
  }
}

export function getLocalConversations(): Conversation[] {
  try {
    const data = localStorage.getItem(CONVERSATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveLocalConversations(convs: Conversation[]) {
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(convs));
  } catch (e) {
    console.warn('Failed to save conversations to localStorage', e);
  }
}

export function getLocalMessages(conversationId: string): Message[] {
  try {
    const data = localStorage.getItem(`${MESSAGES_KEY}_${conversationId}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveLocalMessages(conversationId: string, messages: Message[]) {
  try {
    localStorage.setItem(`${MESSAGES_KEY}_${conversationId}`, JSON.stringify(messages));
  } catch (e) {
    console.warn('Failed to save messages to localStorage', e);
  }
}

export function deleteLocalConversation(conversationId: string) {
  try {
    const convs = getLocalConversations().filter((c) => c.id !== conversationId);
    saveLocalConversations(convs);
    localStorage.removeItem(`${MESSAGES_KEY}_${conversationId}`);
  } catch (e) {
    console.warn('Failed to delete local conversation', e);
  }
}
