import { Conversation, Message, UserProfile } from '../types';
import { getFirebaseIdToken } from './firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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
    return { status: 'offline', groqConfigured: false, firebaseConfigured: false };
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
      throw new Error(errData.message || `Server error (${response.status})`);
    }

    if (!response.body) {
      throw new Error('No response body stream received');
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
              onError(data.error);
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
    onError(err.message || 'Failed to stream response from Flow AI');
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
