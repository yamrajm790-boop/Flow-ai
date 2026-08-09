import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { EmptyChatState } from './components/EmptyChatState';
import { ChatMessage } from './components/ChatMessage';
import { ChatComposer } from './components/ChatComposer';
import { AuthModal } from './components/AuthModal';
import { SettingsModal } from './components/SettingsModal';
import { UpgradeModal } from './components/UpgradeModal';
import {
  UserProfile,
  Conversation,
  Message,
  HealthStatus,
} from './types';
import {
  fetchHealthStatus,
  sendChatMessageStream,
  fetchConversations,
  fetchMessages,
  createConversation,
  deleteConversationApi,
  updateConversationTitleApi,
} from './lib/api';
import {
  getLocalUser,
  saveLocalUser,
  getLocalConversations,
  saveLocalConversations,
  getLocalMessages,
  saveLocalMessages,
  deleteLocalConversation,
  defaultGuestProfile,
} from './lib/storage';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { AudioWaveform } from 'lucide-react';

export default function App() {
  // State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('Flow AI 3');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);

  // Modals & UI Layout
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Initial Load
  useEffect(() => {
    // 1. Fetch backend health status
    fetchHealthStatus().then((h) => setHealthStatus(h));

    // 2. Load User Profile with Firebase Auth listener
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const u: UserProfile = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          full_name:
            firebaseUser.displayName ||
            firebaseUser.email?.split('@')[0] ||
            'Mithila',
          avatar_url: firebaseUser.photoURL || undefined,
        };
        setUser(u);
        saveLocalUser(u);
      } else {
        setUser(getLocalUser());
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync Conversations whenever user changes or on mount
  useEffect(() => {
    loadConversations();
  }, [user]);

  const loadConversations = async () => {
    const userId = user?.id || 'guest';
    const remoteConvs = await fetchConversations(userId);

    if (remoteConvs && remoteConvs.length > 0) {
      setConversations(remoteConvs);
      saveLocalConversations(remoteConvs);
    } else {
      const localConvs = getLocalConversations();
      setConversations(localConvs);
    }
  };

  // Load Messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    const loadMsgs = async () => {
      const remoteMsgs = await fetchMessages(activeConversationId);
      if (remoteMsgs && remoteMsgs.length > 0) {
        setMessages(remoteMsgs);
        saveLocalMessages(activeConversationId, remoteMsgs);
      } else {
        const localMsgs = getLocalMessages(activeConversationId);
        setMessages(localMsgs);
      }
    };

    loadMsgs();

    // Setup Supabase Realtime Subscription for active conversation messages
    if (isSupabaseConfigured && activeConversationId) {
      const channel = supabase
        .channel(`messages:${activeConversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${activeConversationId}`,
          },
          (payload) => {
            const newMsg = payload.new as Message;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeConversationId]);

  // Start New Chat
  const handleNewChat = async () => {
    const userId = user?.id || 'guest';
    const newConv = await createConversation('New Chat', userId);

    const updatedConvs = [newConv, ...conversations];
    setConversations(updatedConvs);
    saveLocalConversations(updatedConvs);
    setActiveConversationId(newConv.id);
    setMessages([]);
  };

  // Select Conversation
  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
  };

  // Send Message & Stream AI Response
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isGenerating) return;

    let targetConvId = activeConversationId;

    // If no active conversation, create one first
    if (!targetConvId) {
      const userId = user?.id || 'guest';
      const newConv = await createConversation('New Chat', userId);
      targetConvId = newConv.id;
      setActiveConversationId(targetConvId);
      setConversations((prev) => [newConv, ...prev]);
    }

    // 1. Add User Message to UI instantly
    const userMsg: Message = {
      id: 'usr-' + Date.now(),
      conversation_id: targetConvId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    saveLocalMessages(targetConvId, updatedMsgs);

    // 2. Prepare Placeholder AI Message for streaming
    const aiMsgId = 'ai-' + Date.now();
    const initialAiMsg: Message = {
      id: aiMsgId,
      conversation_id: targetConvId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, initialAiMsg]);
    setIsGenerating(true);

    // 3. Stream from Backend API
    let streamedContent = '';

    await sendChatMessageStream({
      conversationId: targetConvId,
      message: text,
      model: selectedModel,
      userId: user?.id,
      onToken: (token) => {
        streamedContent += token;
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: streamedContent } : m))
        );
      },
      onComplete: (fullText, updatedTitle) => {
        setIsGenerating(false);

        // Update final assistant message
        setMessages((prev) => {
          const finalMsgs = prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: fullText } : m
          );
          saveLocalMessages(targetConvId!, finalMsgs);
          return finalMsgs;
        });

        // Update conversation title if provided
        if (updatedTitle) {
          setConversations((prev) => {
            const nextConvs = prev.map((c) =>
              c.id === targetConvId ? { ...c, title: updatedTitle, updated_at: new Date().toISOString() } : c
            );
            saveLocalConversations(nextConvs);
            return nextConvs;
          });
        }
      },
      onError: (errMessage) => {
        setIsGenerating(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content: `*(Flow AI stream error: ${errMessage}. Please try again.)*`,
                }
              : m
          )
        );
      },
    });
  };

  // Regenerate last AI response
  const handleRegenerate = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      // Remove last AI message if present
      const filtered = messages.filter(
        (m, idx) => !(idx === messages.length - 1 && m.role === 'assistant')
      );
      setMessages(filtered);
      handleSendMessage(lastUserMsg.content);
    }
  };

  // Delete Conversation
  const handleDeleteConversation = async (id: string) => {
    await deleteConversationApi(id);
    deleteLocalConversation(id);

    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);

    if (activeConversationId === id) {
      setActiveConversationId(updated.length > 0 ? updated[0].id : null);
    }
  };

  // Rename Conversation
  const handleRenameConversation = async (id: string, newTitle: string) => {
    await updateConversationTitleApi(id, newTitle);

    setConversations((prev) => {
      const nextConvs = prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c));
      saveLocalConversations(nextConvs);
      return nextConvs;
    });
  };

  // Clear All Conversations
  const handleClearAllConversations = () => {
    conversations.forEach((c) => deleteLocalConversation(c.id));
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
  };

  // Logout
  const handleLogout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Firebase logout error:', e);
    }
    setUser(defaultGuestProfile);
    saveLocalUser(defaultGuestProfile);
    setActiveConversationId(null);
    setMessages([]);
  };

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0D0D0D] text-[#E5E5E5] font-sans antialiased selection:bg-white/20">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenProfile={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        user={user}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Header */}
        <Header
          user={user}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenUpgrade={() => setIsUpgradeModalOpen(true)}
          onOpenProfile={() => setIsAuthModalOpen(true)}
        />

        {/* Chat Area Body */}
        <main className="flex-1 overflow-y-auto px-2 sm:px-6 py-4 flex flex-col justify-between">
          {!activeConversationId || messages.length === 0 ? (
            <EmptyChatState user={user} onSelectPrompt={handleSendMessage} />
          ) : (
            <div className="w-full max-w-3xl mx-auto space-y-4 pb-12">
              {messages.map((msg, idx) => {
                const isLastAi =
                  msg.role === 'assistant' &&
                  idx === messages.findLastIndex((m) => m.role === 'assistant');

                return (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isLastAiMessage={isLastAi}
                    onRegenerate={handleRegenerate}
                  />
                );
              })}

              {/* Streaming Loading Pulse Indicator */}
              {isGenerating && (
                <div className="flex items-center gap-2 text-neutral-400 text-xs py-2 px-4 animate-pulse">
                  <AudioWaveform className="w-4 h-4 text-purple-400 animate-spin" />
                  <span>Flow AI is thinking...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Bottom Composer Bar */}
        <ChatComposer
          onSendMessage={handleSendMessage}
          isLoading={isGenerating}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
        />
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(u) => setUser(u)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        user={user}
        health={healthStatus}
        onClearAllConversations={handleClearAllConversations}
        onUpdateProfile={(updated) => {
          if (user) {
            const newU = { ...user, ...updated };
            setUser(newU);
            saveLocalUser(newU);
          }
        }}
      />

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </div>
  );
}
