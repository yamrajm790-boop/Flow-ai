import { Conversation, Message, UserProfile } from '../types';
import { getFirebaseIdToken } from './firebase';

export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').trim();
  if (envUrl) {
    const clean = envUrl.replace(/\/+$/, '');
    // In production browsers, prevent accidental routing to localhost/127.0.0.1
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      if (clean.includes('localhost') || clean.includes('127.0.0.1')) {
        return '';
      }
    }
    return clean;
  }
  return '';
}

const API_BASE_URL = getApiBaseUrl();

export async function getAuthHeaders(): Promise<Record<string, string>> {
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
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch (error) {
    console.warn('[API] Health check notice:', error);
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
  signal,
}: {
  conversationId: string;
  message: string;
  model?: string;
  userId?: string;
  onToken: (token: string) => void;
  onComplete: (fullText: string, updatedTitle?: string) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}) {
  const baseUrl = getApiBaseUrl();
  const endpoint = `${baseUrl}/api/chat`;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        conversationId,
        message,
        model,
        userId,
      }),
      signal,
    });

    if (!response.ok) {
      let rawMsg = '';
      try {
        const errData = await response.json();
        rawMsg = errData.message || errData.error || '';
      } catch {
        rawMsg = `Server returned status ${response.status}`;
      }
      console.error('[API] /api/chat error response:', response.status, rawMsg);
      throw new Error(rawMsg || 'Failed to connect to backend service.');
    }

    if (!response.body) {
      throw new Error('Response body is empty or readable stream not available.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulatedText = '';
    let updatedTitle: string | undefined;
    let lineBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const dataStr = trimmed.slice(6).trim();
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
            onError(data.error);
            return;
          }
        } catch {
          if (dataStr) {
            accumulatedText += dataStr;
            onToken(dataStr);
          }
        }
      }
    }

    if (lineBuffer.trim().startsWith('data: ')) {
      const dataStr = lineBuffer.trim().slice(6).trim();
      if (dataStr && dataStr !== '[DONE]') {
        try {
          const data = JSON.parse(dataStr);
          if (data.token) {
            accumulatedText += data.token;
            onToken(data.token);
          }
          if (data.title) {
            updatedTitle = data.title;
          }
        } catch {
          accumulatedText += dataStr;
          onToken(dataStr);
        }
      }
    }

    onComplete(accumulatedText, updatedTitle);
  } catch (err: any) {
    console.error('[API] Chat stream error:', err);
    let msg = err.message || 'Something went wrong. Please try again.';
    if (msg === 'Failed to fetch') {
      msg = 'Unable to reach backend server. Please check your network connection.';
    }
    onError(msg);
  }
}

export async function fetchConversations(userId?: string): Promise<Conversation[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const headers = await getAuthHeaders();
    const url = userId 
      ? `${baseUrl}/api/conversations?userId=${encodeURIComponent(userId)}`
      : `${baseUrl}/api/conversations`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return await res.json();
  } catch (err) {
    console.warn('API fetchConversations fallback:', err);
    return [];
  }
}

export async function createConversation(title?: string, userId?: string): Promise<Conversation> {
  const baseUrl = getApiBaseUrl();
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${baseUrl}/api/conversations`, {
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
  const baseUrl = getApiBaseUrl();
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${baseUrl}/api/conversations/${conversationId}/messages`, { headers });
    if (!res.ok) throw new Error('Failed to fetch messages');
    return await res.json();
  } catch (err) {
    console.warn('API fetchMessages fallback:', err);
    return [];
  }
}

export async function deleteConversationApi(conversationId: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${baseUrl}/api/conversations/${conversationId}`, {
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
  const baseUrl = getApiBaseUrl();
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${baseUrl}/api/conversations/${conversationId}`, {
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
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/admin/login`, {
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
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/admin/session`, {
      headers: getAdminHeaders(),
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function adminLogout(): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  try {
    await fetch(`${baseUrl}/api/admin/logout`, {
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
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/admin/system-prompt`, {
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
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/admin/system-prompt`, {
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
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/admin/system-status`, {
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
