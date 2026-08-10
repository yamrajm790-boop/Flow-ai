import { Conversation, Message, UserProfile } from '../types';
import { getFirebaseIdToken } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = await getFirebaseIdToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchHealthStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch (error) {
    console.warn('Backend server connecting...', error);
    return { status: 'offline' };
  }
}

export async function sendChatMessageStream({
  conversationId,
  message,
  model = 'Flow AI',
  userId,
  onToken,
  onComplete,
  onError,
}: {
  conversationId: string;
  message: string;
  model?: string;
  userId?: string;
  onToken: (token: string) => void;
  onComplete: (fullText: string, updatedTitle?: string) => void;
  onError: (error: string) => void;
}) {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        conversationId,
        message,
        model,
        userId,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const rawMsg = errData.message || '';
      if (
        !rawMsg ||
        rawMsg.toLowerCase().includes('groq') ||
        rawMsg.toLowerCase().includes('firebase admin') ||
        rawMsg.toLowerCase().includes('supabase') ||
        rawMsg.toLowerCase().includes('render') ||
        rawMsg.toLowerCase().includes('500') ||
        rawMsg.toLowerCase().includes('401')
      ) {
        throw new Error('Something went wrong. Please try again.');
      }
      throw new Error(rawMsg);
    }

    if (!response.body) {
      throw new Error('Something went wrong. Please try again.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let updatedTitle: string | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') {
            break;
          }
          try {
            const data = JSON.parse(dataStr);
            if (data.token) {
              accumulatedText += data.token;
              onToken(data.token);
            }
            if (data.title) {
              updatedTitle = data.title;
            }
            if (data.error) {
              onError('Something went wrong. Please try again.');
              return;
            }
          } catch {
            accumulatedText += dataStr;
            onToken(dataStr);
          }
        }
      }
    }

    onComplete(accumulatedText, updatedTitle);
  } catch (err: any) {
    console.error('Chat stream error:', err);
    let msg = err.message || 'Something went wrong. Please try again.';
    if (
      msg.toLowerCase().includes('groq') ||
      msg.toLowerCase().includes('firebase admin') ||
      msg.toLowerCase().includes('supabase') ||
      msg.toLowerCase().includes('render')
    ) {
      msg = 'Something went wrong. Please try again.';
    }
    onError(msg);
  }
}

export async function fetchConversations(userId?: string): Promise<Conversation[]> {
  try {
    const headers = await getAuthHeaders();
    const url = userId 
      ? `${API_BASE_URL}/api/conversations?userId=${encodeURIComponent(userId)}`
      : `${API_BASE_URL}/api/conversations`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return await res.json();
  } catch (err) {
    console.warn('API fetchConversations fallback:', err);
    return [];
  }
}

export async function createConversation(title?: string, userId?: string): Promise<Conversation> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/api/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, userId }),
    });
    if (!res.ok) throw new Error('Failed to create conversation');
    return await res.json();
  } catch (err) {
    console.warn('API createConversation fallback:', err);
    return {
      id: 'conv-' + Date.now(),
      user_id: userId || 'guest',
      title: title || 'New Chat',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, { headers });
    if (!res.ok) throw new Error('Failed to fetch messages');
    return await res.json();
  } catch (err) {
    console.warn('API fetchMessages fallback:', err);
    return [];
  }
}

export async function deleteConversationApi(conversationId: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers,
    });
    return res.ok;
  } catch (err) {
    console.warn('API deleteConversation error:', err);
    return false;
  }
}

export async function updateConversationTitleApi(conversationId: string, title: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ title }),
    });
    return res.ok;
  } catch (err) {
    console.warn('API updateConversationTitle error:', err);
    return false;
  }
}

// ============================================================================
// ADMIN CLIENT API HELPERS
// ============================================================================

let adminTokenInMemory: string | null = null;

export function setAdminTokenInMemory(token: string | null) {
  adminTokenInMemory = token;
}

export function getAdminHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (adminTokenInMemory) {
    headers['X-Admin-Token'] = adminTokenInMemory;
    headers['Authorization'] = `Bearer ${adminTokenInMemory}`;
  }
  return headers;
}

export async function adminLogin(password: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return { success: false, error: 'Too many login attempts. Please try again later.' };
      }
      return { success: false, error: 'Invalid admin credentials.' };
    }

    const data = await res.json();
    if (data.token) {
      setAdminTokenInMemory(data.token);
    }
    return { success: true, token: data.token };
  } catch {
    return { success: false, error: 'Unable to connect to authentication service.' };
  }
}

export async function checkAdminSession(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/session`, {
      headers: getAdminHeaders(),
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function adminLogout(): Promise<boolean> {
  try {
    await fetch(`${API_BASE_URL}/api/admin/logout`, {
      method: 'POST',
      headers: getAdminHeaders(),
      credentials: 'include',
    });
    setAdminTokenInMemory(null);
    return true;
  } catch {
    setAdminTokenInMemory(null);
    return false;
  }
}

export async function getAdminSystemPrompt(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/system-prompt`, {
      headers: getAdminHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to load system prompt');
    const data = await res.json();
    return data.systemPrompt || '';
  } catch {
    throw new Error('Unable to load system prompt.');
  }
}

export async function updateAdminSystemPrompt(systemPrompt: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/system-prompt`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      credentials: 'include',
      body: JSON.stringify({ systemPrompt }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getAdminSystemStatus(): Promise<{
  aiEngine: string;
  systemPromptLength: number;
  databaseConnected: boolean;
  activeAdminSessionsCount: number;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/system-status`, {
      headers: getAdminHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to load status');
    return await res.json();
  } catch {
    return {
      aiEngine: 'Offline',
      systemPromptLength: 0,
      databaseConnected: false,
      activeAdminSessionsCount: 0,
    };
  }
}
