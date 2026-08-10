import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { EmptyChatState } from './components/EmptyChatState';
import { ChatMessage } from './components/ChatMessage';
import { ChatComposer } from './components/ChatComposer';
import { AuthModal } from './components/AuthModal';
import { SettingsModal } from './components/SettingsModal';
import { UpgradeModal } from './components/UpgradeModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FlowLogo } from './components/FlowLogo';
import { Conversation, Message, HealthStatus } from './types';
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
  getLocalConversations,
  saveLocalConversations,
  getLocalMessages,
  saveLocalMessages,
  deleteLocalConversation,
  defaultGuestProfile,
  saveLocalUser,
} from './lib/storage';
import {
  fetchUserConversationsFromRTDB,
  saveConversationToRTDB,
  fetchConversationMessagesFromRTDB,
  saveMessageToRTDB,
  deleteConversationFromRTDB,
} from './lib/rtdb';
import { AudioWaveform } from 'lucide-react';

function MainApp() {
  const { user, firebaseUser, logout, loginWithGoogle, loading: authLoading, error: authError, retryAuth, clearError } = useAuth();

  // State
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

  // Mobile Keyboard & VisualViewport Handling
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      if (!window.visualViewport) return;
      const vvHeight = window.visualViewport.height;
      const windowHeight = window.innerHeight;

      // If visualViewport height is substantially smaller than window height, keyboard is open
      const keyboardActive = windowHeight - vvHeight > 120;
      setIsKeyboardOpen(keyboardActive);
      setViewportHeight(vvHeight);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
    };
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Initial Load Health Check
  useEffect(() => {
    fetchHealthStatus().then((h) => setHealthStatus(h));
  }, []);

  // Sync Conversations whenever user changes or on mount
  useEffect(() => {
    loadConversations();
  }, [user]);

  const loadConversations = async () => {
    const userId = user?.id || 'guest';

    // First try Realtime Database if user is authenticated with Firebase
    if (firebaseUser) {
      const rtdbConvs = await fetchUserConversationsFromRTDB(firebaseUser.uid);
      if (rtdbConvs && rtdbConvs.length > 0) {
        setConversations(rtdbConvs);
        saveLocalConversations(rtdbConvs);
        return;
      }
    }

    // Fallback to API / LocalStorage
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
      if (firebaseUser) {
        const rtdbMsgs = await fetchConversationMessagesFromRTDB(firebaseUser.uid, activeConversationId);
        if (rtdbMsgs && rtdbMsgs.length > 0) {
          setMessages(rtdbMsgs);
          saveLocalMessages(activeConversationId, rtdbMsgs);
          return;
        }
      }

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
  }, [activeConversationId, firebaseUser]);

  // Start New Chat
  const handleNewChat = async () => {
    const userId = user?.id || 'guest';
    const newConv = await createConversation('New Chat', userId);

    const updatedConvs = [newConv, ...conversations];
    setConversations(updatedConvs);
    saveLocalConversations(updatedConvs);
    setActiveConversationId(newConv.id);
    setMessages([]);

    if (firebaseUser) {
      await saveConversationToRTDB(firebaseUser.uid, newConv);
    }
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

      if (firebaseUser) {
        await saveConversationToRTDB(firebaseUser.uid, newConv);
      }
    }

    // 1. Add User Message to UI & RTDB
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

    if (firebaseUser) {
      await saveMessageToRTDB(firebaseUser.uid, targetConvId, userMsg);
    }

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
      onComplete: async (fullText, updatedTitle) => {
        setIsGenerating(false);

        const finalAiMsg: Message = {
          id: aiMsgId,
          conversation_id: targetConvId!,
          role: 'assistant',
          content: fullText,
          created_at: new Date().toISOString(),
        };

        // Update final assistant message
        setMessages((prev) => {
          const finalMsgs = prev.map((m) => (m.id === aiMsgId ? finalAiMsg : m));
          saveLocalMessages(targetConvId!, finalMsgs);
          return finalMsgs;
        });

        if (firebaseUser) {
          await saveMessageToRTDB(firebaseUser.uid, targetConvId!, finalAiMsg);
        }

        // Update conversation title if provided
        if (updatedTitle) {
          setConversations((prev) => {
            const nextConvs = prev.map((c) =>
              c.id === targetConvId
                ? { ...c, title: updatedTitle, updated_at: new Date().toISOString() }
                : c
            );
            saveLocalConversations(nextConvs);
            return nextConvs;
          });

          if (firebaseUser) {
            await saveConversationToRTDB(firebaseUser.uid, {
              id: targetConvId!,
              title: updatedTitle,
              updated_at: new Date().toISOString(),
            });
          }
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

    if (firebaseUser) {
      await deleteConversationFromRTDB(firebaseUser.uid, id);
    }

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

    if (firebaseUser) {
      await saveConversationToRTDB(firebaseUser.uid, {
        id,
        title: newTitle,
        updated_at: new Date().toISOString(),
      });
    }
  };

  // Clear All Conversations
  const handleClearAllConversations = () => {
    conversations.forEach((c) => {
      deleteLocalConversation(c.id);
      if (firebaseUser) {
        deleteConversationFromRTDB(firebaseUser.uid, c.id);
      }
    });
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
  };

  // Logout
  const handleLogout = async () => {
    await logout();
    setActiveConversationId(null);
    setMessages([]);
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0D0D0D] text-white">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <FlowLogo className="w-12 h-12 animate-pulse" />
          <span className="text-sm font-medium text-neutral-400">Loading Flow AI Workspace...</span>
        </div>
      </div>
    );
  }

  if (authError && !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0D0D0D] text-white p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm bg-[#161618] border border-white/10 p-8 rounded-3xl shadow-2xl">
          <FlowLogo className="w-12 h-12" />
          <h3 className="text-lg font-serif text-white">Unable to verify your session</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">{authError}</p>
          <button
            onClick={() => retryAuth()}
            className="mt-2 w-full py-2.5 px-4 bg-white text-black font-medium rounded-xl text-xs hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0D0D0D] text-white p-4 selection:bg-white/20">
        <div className="relative w-full max-w-md bg-[#161618] border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
          {/* Official Flow AI Logo */}
          <div className="flex justify-center mb-5">
            <FlowLogo className="w-16 h-11" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-serif text-white font-normal mb-1">Welcome to Flow AI</h2>
          <p className="text-neutral-400 text-sm font-light mb-8">
            Your intelligent AI workspace.
          </p>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-left">
              {authError}
            </div>
          )}

          <div className="space-y-3">
            {/* Continue with Google Button */}
            <button
              onClick={() => loginWithGoogle()}
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-neutral-100 text-black font-medium rounded-2xl text-sm transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer"
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
              <span>{authLoading ? 'Connecting...' : 'Continue with Google'}</span>
            </button>

            {/* Guest Option */}
            <button
              onClick={() => {
                saveLocalUser(defaultGuestProfile);
                window.location.reload();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#222226] hover:bg-[#2c2c32] text-neutral-300 hover:text-white font-medium rounded-2xl text-xs transition-colors border border-white/5 cursor-pointer"
            >
              <span>Continue as Guest</span>
            </button>
          </div>

          <p className="text-[11px] text-neutral-500 mt-6 leading-relaxed">
            By continuing, you agree to our Terms and Privacy Policy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex w-screen overflow-hidden bg-[#0D0D0D] text-[#E5E5E5] font-sans antialiased selection:bg-white/20"
      style={{
        height: viewportHeight ? `${viewportHeight}px` : '100dvh',
      }}
    >
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
      <div className="flex-1 flex flex-col h-full overflow-hidden relative min-h-0">
        {/* Top Header */}
        <Header
          user={user}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenUpgrade={() => setIsUpgradeModalOpen(true)}
          onOpenProfile={() => setIsAuthModalOpen(true)}
        />

        {/* Auth Error Banner with Retry button */}
        {authError && (
          <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2.5 flex items-center justify-between text-xs text-red-200 z-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
              <span>{authError}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => retryAuth()}
                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-100 rounded-md transition-colors font-medium cursor-pointer"
              >
                Retry
              </button>
              <button
                onClick={() => clearError()}
                className="px-2 py-1 text-red-300/60 hover:text-red-200 transition-colors"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Chat Area Body */}
        <main className="flex-1 overflow-y-auto px-2 sm:px-6 py-2 flex flex-col min-h-0">
          {!activeConversationId || messages.length === 0 ? (
            <EmptyChatState user={user} onSelectPrompt={handleSendMessage} isKeyboardOpen={isKeyboardOpen} />
          ) : (
            <div className="w-full max-w-3xl mx-auto space-y-4 pb-6 my-auto">
              {(() => {
                let lastAiIdx = -1;
                for (let i = messages.length - 1; i >= 0; i--) {
                  if (messages[i].role === 'assistant') {
                    lastAiIdx = i;
                    break;
                  }
                }
                return messages.map((msg, idx) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isLastAiMessage={idx === lastAiIdx}
                    onRegenerate={handleRegenerate}
                  />
                ));
              })()}

              {/* Streaming Loading Indicator */}
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
          isKeyboardOpen={isKeyboardOpen}
        />
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={() => setIsAuthModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        user={user}
        health={healthStatus}
        onClearAllConversations={handleClearAllConversations}
        onUpdateProfile={() => {}}
      />

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
