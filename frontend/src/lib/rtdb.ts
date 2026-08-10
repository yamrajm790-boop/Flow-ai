import { ref, get, set, update, remove, child } from 'firebase/database';
import { database } from './firebase';
import { Conversation, Message, UserProfile } from '../types';

export interface UserDbProfile {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

// 1. Sync User Profile to Realtime Database (`users/{uid}/profile`)
export async function syncUserProfileToRTDB(user: {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}): Promise<UserProfile> {
  if (!user.uid) throw new Error('Cannot sync profile without UID');

  const fallback: UserProfile = {
    id: user.uid,
    email: user.email || '',
    full_name: user.displayName || user.email?.split('@')[0] || 'User',
    avatar_url: user.photoURL || undefined,
  };

  try {
    const profileRef = ref(database, `users/${user.uid}/profile`);
    const snapshot = await get(profileRef);
    const now = new Date().toISOString();

    let profileData: UserDbProfile;

    if (snapshot.exists()) {
      const existing = snapshot.val() as UserDbProfile;
      profileData = {
        ...existing,
        name: user.displayName || existing.name || user.email?.split('@')[0] || 'User',
        email: user.email || existing.email || '',
        photoURL: user.photoURL || existing.photoURL || '',
        updatedAt: now,
        lastLoginAt: now,
      };
      await update(profileRef, {
        name: profileData.name,
        email: profileData.email,
        photoURL: profileData.photoURL,
        updatedAt: now,
        lastLoginAt: now,
      }).catch((e) => console.warn('[RTDB] Profile update warning:', e));
    } else {
      profileData = {
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        photoURL: user.photoURL || '',
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      };
      await set(profileRef, profileData).catch((e) => console.warn('[RTDB] Profile set warning:', e));
    }

    return {
      id: profileData.uid,
      email: profileData.email,
      full_name: profileData.name,
      avatar_url: profileData.photoURL || undefined,
    };
  } catch (err) {
    console.warn('[Realtime DB] syncUserProfileToRTDB warning, using fallback:', err);
    return fallback;
  }
}

// 2. Fetch User Profile from Realtime Database
export async function fetchUserProfileFromRTDB(uid: string): Promise<UserProfile | null> {
  try {
    const profileRef = ref(database, `users/${uid}/profile`);
    const snapshot = await get(profileRef);
    if (snapshot.exists()) {
      const p = snapshot.val() as UserDbProfile;
      return {
        id: p.uid,
        email: p.email,
        full_name: p.name,
        avatar_url: p.photoURL || undefined,
      };
    }
  } catch (err) {
    console.warn('[Realtime DB] Fetch profile error:', err);
  }
  return null;
}

// 3. Fetch User Conversations from Realtime Database (`users/{uid}/conversations`)
export async function fetchUserConversationsFromRTDB(uid: string): Promise<Conversation[]> {
  try {
    const convsRef = ref(database, `users/${uid}/conversations`);
    const snapshot = await get(convsRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      const conversations: Conversation[] = Object.keys(data).map((convId) => {
        const item = data[convId];
        return {
          id: item.id || convId,
          user_id: uid,
          title: item.title || 'New Chat',
          created_at: item.createdAt || new Date().toISOString(),
          updated_at: item.updatedAt || new Date().toISOString(),
        };
      });

      return conversations.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }
  } catch (err) {
    console.warn('[Realtime DB] Fetch conversations error:', err);
  }
  return [];
}

// 4. Save/Update Conversation in Realtime Database
export async function saveConversationToRTDB(
  uid: string,
  conversation: Partial<Conversation> & { id: string }
): Promise<void> {
  try {
    const convRef = ref(database, `users/${uid}/conversations/${conversation.id}`);
    const snapshot = await get(convRef);
    const now = new Date().toISOString();

    if (snapshot.exists()) {
      await update(convRef, {
        title: conversation.title || snapshot.val().title || 'New Chat',
        updatedAt: conversation.updated_at || now,
      });
    } else {
      await set(convRef, {
        id: conversation.id,
        title: conversation.title || 'New Chat',
        createdAt: conversation.created_at || now,
        updatedAt: conversation.updated_at || now,
      });
    }
  } catch (err) {
    console.warn('[Realtime DB] Save conversation error:', err);
  }
}

// 5. Fetch Messages for a Conversation (`users/{uid}/conversations/{convId}/messages`)
export async function fetchConversationMessagesFromRTDB(
  uid: string,
  conversationId: string
): Promise<Message[]> {
  try {
    const msgsRef = ref(database, `users/${uid}/conversations/${conversationId}/messages`);
    const snapshot = await get(msgsRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      const messages: Message[] = Object.keys(data).map((msgId) => {
        const m = data[msgId];
        return {
          id: m.id || msgId,
          conversation_id: conversationId,
          user_id: uid,
          role: m.role || 'user',
          content: m.content || '',
          created_at: m.createdAt || new Date().toISOString(),
        };
      });

      return messages.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
  } catch (err) {
    console.warn('[Realtime DB] Fetch messages error:', err);
  }
  return [];
}

// 6. Save Message to Realtime Database
export async function saveMessageToRTDB(
  uid: string,
  conversationId: string,
  message: Message
): Promise<void> {
  try {
    const msgRef = ref(
      database,
      `users/${uid}/conversations/${conversationId}/messages/${message.id}`
    );
    await set(msgRef, {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.created_at || new Date().toISOString(),
    });

    // Touch conversation updatedAt timestamp
    const convRef = ref(database, `users/${uid}/conversations/${conversationId}`);
    await update(convRef, {
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Realtime DB] Save message error:', err);
  }
}

// 7. Delete Conversation from Realtime Database
export async function deleteConversationFromRTDB(
  uid: string,
  conversationId: string
): Promise<void> {
  try {
    const convRef = ref(database, `users/${uid}/conversations/${conversationId}`);
    await remove(convRef);
  } catch (err) {
    console.warn('[Realtime DB] Delete conversation error:', err);
  }
}
