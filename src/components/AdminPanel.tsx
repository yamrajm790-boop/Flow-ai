import React, { useState, useEffect } from 'react';
import {
  Shield,
  KeyRound,
  Terminal,
  Activity,
  Cpu,
  Lock,
  LogOut,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Server,
  Layers,
  Menu,
  X,
} from 'lucide-react';
import {
  adminLogin,
  adminLogout,
  checkAdminSession,
  getAdminSystemPrompt,
  updateAdminSystemPrompt,
  getAdminSystemStatus,
  getApiBaseUrl,
} from '../lib/api';

interface AdminPanelProps {
  onReturnToApp: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onReturnToApp }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Admin Dashboard State
  const [activeTab, setActiveTab] = useState<'prompt' | 'dashboard' | 'config' | 'security'>('prompt');
  const [systemPrompt, setSystemPromptState] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  // Status State
  const [status, setStatus] = useState<{
    aiEngine: string;
    systemPromptLength: number;
    databaseConnected: boolean;
    activeAdminSessionsCount: number;
  } | null>(null);

  // Test Sandbox State
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [isTestingPrompt, setIsTestingPrompt] = useState(false);

  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Check Session on Mount
  useEffect(() => {
    let isMounted = true;
    checkAdminSession().then((authenticated) => {
      if (isMounted) {
        setIsAuthenticated(authenticated);
        if (authenticated) {
          loadAdminData();
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const loadAdminData = async () => {
    setIsLoadingPrompt(true);
    try {
      const [prompt, sysStatus] = await Promise.all([
        getAdminSystemPrompt().catch(() => ''),
        getAdminSystemStatus().catch(() => null),
      ]);
      setSystemPromptState(prompt);
      setOriginalPrompt(prompt);
      if (sysStatus) setStatus(sysStatus);
    } catch {
      setPromptError('Failed to load system prompt from server.');
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    setIsLoggingIn(true);
    setLoginError(null);

    const result = await adminLogin(passwordInput);
    setIsLoggingIn(false);

    if (result.success) {
      setIsAuthenticated(true);
      setPasswordInput('');
      loadAdminData();
    } else {
      setLoginError(result.error || 'Invalid password.');
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    setIsAuthenticated(false);
  };

  const handleSavePrompt = async () => {
    if (!systemPrompt.trim()) {
      setPromptError('System prompt cannot be empty.');
      return;
    }

    setIsSavingPrompt(true);
    setPromptError(null);
    setSaveSuccess(false);

    const success = await updateAdminSystemPrompt(systemPrompt);

    if (success) {
      const freshPrompt = await getAdminSystemPrompt().catch(() => systemPrompt);
      setSystemPromptState(freshPrompt);
      setOriginalPrompt(freshPrompt);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      const sysStatus = await getAdminSystemStatus().catch(() => null);
      if (sysStatus) setStatus(sysStatus);
    } else {
      setPromptError('Failed to save system prompt to server.');
    }
    setIsSavingPrompt(false);
  };

  const handleResetPrompt = () => {
    setSystemPromptState(originalPrompt);
    setPromptError(null);
  };

  const handleTestPrompt = async () => {
    if (!testMessage.trim()) return;
    setIsTestingPrompt(true);
    setTestResponse(null);

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMessage, conversationId: 'admin-test-sandbox' }),
      });

      if (!response.ok || !response.body) {
        setTestResponse('Sandbox test failed: Server error.');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let output = '';
      let lineBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.token) {
                output += parsed.token;
                setTestResponse(output);
              }
            } catch {
              if (dataStr) {
                output += dataStr;
                setTestResponse(output);
              }
            }
          }
        }
      }
    } catch {
      setTestResponse('Sandbox test failed to connect.');
    } finally {
      setIsTestingPrompt(false);
    }
  };

  // Loading Session Check State
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#0E0E10] text-white flex items-center justify-center font-sans p-4">
        <div className="flex items-center gap-3 text-neutral-400 text-sm">
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span>Verifying admin authentication...</span>
        </div>
      </div>
    );
  }

  // Login View
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0E0E10] text-white flex flex-col items-center justify-center p-4 font-sans relative overflow-x-hidden">
        {/* Background glow */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-80 sm:w-96 h-80 sm:h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-[#161618] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 backdrop-blur-xl box-border">
          <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20 mb-4 shrink-0">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Flow AI Admin</h1>
            <p className="text-neutral-400 text-xs mt-1.5 leading-relaxed">
              Authenticate with server environment security key to manage system prompts and backend policy.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-2">Admin Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter admin key..."
                  className="w-full bg-[#222226] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition-colors pr-10 box-border"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn || !passwordInput.trim()}
              className="w-full py-3 bg-white hover:bg-neutral-200 text-black font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Access Admin Control</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between text-xs text-neutral-500">
            <button
              onClick={onReturnToApp}
              className="flex items-center gap-1.5 hover:text-neutral-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Flow AI</span>
            </button>
            <span className="text-neutral-600">v1.0.0 Admin Portal</span>
          </div>
        </div>
      </div>
    );
  }

  // Admin Dashboard View
  return (
    <div className="min-h-screen bg-[#0E0E10] text-white flex flex-col font-sans w-full max-w-full overflow-x-hidden">
      {/* Top Header */}
      <header className="h-16 border-b border-white/10 bg-[#161618] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 min-w-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Mobile Hamburger Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-neutral-300 hover:text-white hover:bg-white/5 rounded-xl border border-white/10 shrink-0 cursor-pointer"
            aria-label="Toggle Mobile Drawer"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-md shadow-purple-500/20 shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 truncate">
            <div className="font-bold text-xs sm:text-sm text-white flex items-center gap-2 truncate">
              <span className="truncate">Flow AI Admin</span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                Session Active
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 truncate hidden sm:block">
              Server-Side Environment & System Prompt Management
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={onReturnToApp}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition-colors cursor-pointer border border-white/5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Return to Workspace</span>
            <span className="sm:hidden">Exit</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition-colors cursor-pointer border border-rose-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Mobile Backdrop & Drawer */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Off-Canvas Drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-[280px] max-w-[85vw] bg-[#161618] border-r border-white/10 p-5 z-50 md:hidden flex flex-col space-y-4 shadow-2xl transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="font-bold text-sm text-white">Admin Modules</span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => {
              setActiveTab('prompt');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'prompt'
                ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>System Prompt</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('dashboard');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>System Dashboard</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('config');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'config'
                ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>AI Configuration</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('security');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'security'
                ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Security Policies</span>
          </button>
        </div>

        <div className="pt-4 border-t border-white/10">
          <div className="p-3.5 rounded-2xl bg-[#0E0E10] border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-white">
              <Server className="w-3.5 h-3.5 text-purple-400" />
              <span>Server Enforced</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              System prompts are stored server-side and injected at top-level on every AI query.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 gap-6 min-w-0 overflow-x-hidden">
        {/* Navigation Sidebar for Desktop */}
        <aside className="hidden md:block w-64 shrink-0 space-y-1">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider px-3 mb-2">
            Admin Modules
          </div>
          <button
            onClick={() => setActiveTab('prompt')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'prompt'
                ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>System Prompt</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>System Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'config'
                ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>AI Configuration</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'security'
                ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Security Policies</span>
          </button>

          <div className="pt-6 mt-6 border-t border-white/5 px-3">
            <div className="p-3.5 rounded-2xl bg-[#161618] border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-white">
                <Server className="w-3.5 h-3.5 text-purple-400" />
                <span>Server Enforced</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                System prompts are stored server-side and injected at top-level on every AI query.
              </p>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-[#161618] border border-white/10 rounded-2xl p-4 sm:p-6 flex flex-col min-h-[500px] sm:min-h-[600px] min-w-0 max-w-full overflow-x-hidden">
          {/* TAB 1: SYSTEM PROMPT EDITOR */}
          {activeTab === 'prompt' && (
            <div className="flex-1 flex flex-col space-y-4 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-white flex items-center gap-2 truncate">
                    <Terminal className="w-5 h-5 text-purple-400 shrink-0" />
                    <span className="truncate">System Prompt Editor</span>
                  </h2>
                  <p className="text-neutral-400 text-xs mt-0.5">
                    Define the core personality, instructions, and constraints for Flow AI.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleResetPrompt}
                    disabled={systemPrompt === originalPrompt || isLoadingPrompt}
                    className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>

                  <button
                    onClick={handleSavePrompt}
                    disabled={isSavingPrompt || isLoadingPrompt}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 sm:py-1.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50 shadow-md"
                  >
                    {isSavingPrompt ? (
                      <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Save System Prompt</span>
                  </button>
                </div>
              </div>

              {saveSuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs min-w-0">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="truncate">System prompt saved and active on server!</span>
                </div>
              )}

              {promptError && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs min-w-0">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span className="break-words">{promptError}</span>
                </div>
              )}

              {/* Monospaced Editor */}
              <div className="flex-1 flex flex-col relative bg-[#0E0E10] border border-white/10 rounded-2xl overflow-hidden focus-within:border-purple-500/50 transition-colors w-full min-w-0">
                <div className="bg-[#1A1A1D] px-3.5 sm:px-4 py-2 border-b border-white/5 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                  <span>role: "system"</span>
                  <span>{systemPrompt.length} characters</span>
                </div>

                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPromptState(e.target.value)}
                  placeholder="Enter custom system prompt instruction..."
                  className="w-full max-w-full box-border flex-1 p-3.5 sm:p-4 bg-transparent text-xs sm:text-sm font-mono text-purple-200 placeholder-neutral-600 focus:outline-none resize-none leading-relaxed min-h-[280px] sm:min-h-[320px]"
                />
              </div>

              {/* Prompt Testing Sandbox */}
              <div className="pt-4 border-t border-white/5 space-y-3 w-full min-w-0">
                <div className="font-semibold text-xs text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Prompt Sandbox Tester</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full min-w-0">
                  <input
                    type="text"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTestPrompt()}
                    placeholder="Test a query against the active system prompt..."
                    className="flex-1 w-full bg-[#222226] border border-white/10 rounded-xl px-3.5 py-2.5 sm:py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 min-w-0 box-border"
                  />
                  <button
                    onClick={handleTestPrompt}
                    disabled={isTestingPrompt || !testMessage.trim()}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {isTestingPrompt ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Run Test</span>
                  </button>
                </div>

                {testResponse && (
                  <div className="p-3.5 rounded-xl bg-[#0E0E10] border border-white/10 text-xs text-neutral-300 font-sans whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto w-full min-w-0 break-words">
                    {testResponse}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SYSTEM DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 min-w-0">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-400 shrink-0" />
                  <span>System Dashboard</span>
                </h2>
                <p className="text-neutral-400 text-xs mt-0.5">High-level operational overview and server metrics.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 w-full min-w-0">
                <div className="p-4 rounded-2xl bg-[#222226] border border-white/5 space-y-2 min-w-0 break-words">
                  <div className="text-neutral-400 text-xs font-medium flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>AI Stream Engine</span>
                  </div>
                  <div className="text-base sm:text-lg font-semibold text-white">{status?.aiEngine || 'Active'}</div>
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" /> Hardware acceleration online
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#222226] border border-white/5 space-y-2 min-w-0 break-words">
                  <div className="text-neutral-400 text-xs font-medium flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>System Prompt Length</span>
                  </div>
                  <div className="text-base sm:text-lg font-semibold text-white">{status?.systemPromptLength || systemPrompt.length} chars</div>
                  <div className="text-[11px] text-neutral-400">Enforced at top-level on AI chat</div>
                </div>

                <div className="p-4 rounded-2xl bg-[#222226] border border-white/5 space-y-2 min-w-0 break-words">
                  <div className="text-neutral-400 text-xs font-medium flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Database Integration</span>
                  </div>
                  <div className="text-base sm:text-lg font-semibold text-white">
                    {status?.databaseConnected ? 'Firebase Realtime DB' : 'In-Memory Server Sync'}
                  </div>
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" /> Persistent prompt store
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#222226] border border-white/5 space-y-2 min-w-0 break-words">
                  <div className="text-neutral-400 text-xs font-medium flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Active Admin Sessions</span>
                  </div>
                  <div className="text-base sm:text-lg font-semibold text-white">{status?.activeAdminSessionsCount || 1} Active</div>
                  <div className="text-[11px] text-neutral-400">HttpOnly session security</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI CONFIGURATION */}
          {activeTab === 'config' && (
            <div className="space-y-6 min-w-0">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-purple-400 shrink-0" />
                  <span>AI Pipeline Configuration</span>
                </h2>
                <p className="text-neutral-400 text-xs mt-0.5">Operational properties for chat inference and system injection.</p>
              </div>

              <div className="space-y-3 text-xs min-w-0">
                <div className="p-4 rounded-2xl bg-[#222226] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="font-semibold text-white">System Prompt Injection</div>
                    <div className="text-neutral-400 text-[11px] mt-0.5">
                      Constructs top-level system message before user input.
                    </div>
                  </div>
                  <span className="self-start sm:self-auto px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-medium text-[11px] border border-emerald-500/20 shrink-0">
                    Server Enforced
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#222226] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="font-semibold text-white">Prompt Injection Guard</div>
                    <div className="text-neutral-400 text-[11px] mt-0.5">
                      Client-side system messages are stripped and forced to user role.
                    </div>
                  </div>
                  <span className="self-start sm:self-auto px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-medium text-[11px] border border-emerald-500/20 shrink-0">
                    Active
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#222226] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="font-semibold text-white">API Key Isolation</div>
                    <div className="text-neutral-400 text-[11px] mt-0.5">
                      All hardware API keys remain exclusively on the server backend.
                    </div>
                  </div>
                  <span className="self-start sm:self-auto px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-medium text-[11px] border border-emerald-500/20 shrink-0">
                    Isolated
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY POLICIES */}
          {activeTab === 'security' && (
            <div className="space-y-6 min-w-0">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-purple-400 shrink-0" />
                  <span>Security & Policy Settings</span>
                </h2>
                <p className="text-neutral-400 text-xs mt-0.5">Server authentication, session policies, and secret protection.</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#222226] border border-white/5 space-y-4 min-w-0">
                <div className="text-xs font-semibold text-white">Security Guarantees</div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">No Frontend Secret Exposure</div>
                      <div className="text-neutral-400 text-[11px]">
                        Admin password, database credentials, and AI keys are never sent to or visible in client code.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">Rate-Limited Admin Verification</div>
                      <div className="text-neutral-400 text-[11px]">
                        Login attempts are rate limited on backend to prevent brute force attempts.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-white">Isolated Admin Route</div>
                      <div className="text-neutral-400 text-[11px]">
                        The normal Flow AI interface displays zero admin links or buttons.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

