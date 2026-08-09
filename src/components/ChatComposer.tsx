import React, { useState, useRef, useEffect } from 'react';
import { Plus, Mic, MicOff, ChevronDown, AudioWaveform, ArrowUp, Paperclip } from 'lucide-react';
import { ModelOption } from '../types';

interface ChatComposerProps {
  onSendMessage: (messageText: string) => void;
  isLoading: boolean;
  selectedModel: string;
  onSelectModel: (modelName: string) => void;
}

const FRIENDLY_MODELS: ModelOption[] = [
  { id: 'Flow AI 3', name: 'Flow AI 3', description: 'Default high-intelligence reasoning model', isPopular: true },
  { id: 'Flow AI Fast', name: 'Flow AI Fast', description: 'Ultra-fast low-latency responses' },
  { id: 'Flow AI Pro', name: 'Flow AI Pro', description: 'Advanced complex task analysis' },
];

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  isLoading,
  selectedModel,
  onSelectModel,
}) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Web Speech API Voice Recognition
  const toggleSpeechRecognition = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser tab.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn('Speech recognition error:', e);
      setIsListening(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-8 pb-6 pt-2 sticky bottom-0 z-10 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/90 to-transparent">
      {/* Container matching Immersive UI rounded dark card style */}
      <div className="relative bg-[#161616] border border-white/10 rounded-3xl p-3 shadow-2xl transition-all focus-within:border-white/20">
        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="How can I help you today?"
          rows={1}
          className="w-full bg-transparent text-white placeholder-white/20 text-sm sm:text-base px-3 py-1 focus:outline-none focus:ring-0 resize-none leading-relaxed font-sans max-h-40 overflow-y-auto"
        />

        {/* Bottom Control Bar Inside Composer */}
        <div className="flex items-center justify-between pt-2 px-1 mt-1 border-t border-white/5">
          {/* Left: Plus Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAttachments(!showAttachments)}
              className="p-2 text-white/40 hover:text-white rounded-full hover:bg-white/5 transition-colors focus:outline-none"
              title="Add attachment or action"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Quick Attachment Dropdown */}
            {showAttachments && (
              <div className="absolute left-0 bottom-12 w-48 bg-[#1a1a1d] border border-white/10 rounded-2xl shadow-xl p-1.5 z-30 text-xs text-white/80">
                <button
                  onClick={() => {
                    setInput((p) => p + ' [File attachment demo]');
                    setShowAttachments(false);
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <Paperclip className="w-4 h-4 text-purple-400" />
                  <span>Attach Document</span>
                </button>
              </div>
            )}
          </div>

          {/* Center: Friendly Model Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-xs font-medium transition-colors border border-white/5"
            >
              <span>{selectedModel}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {/* Model Selector Popover */}
            {showModelMenu && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-12 w-56 bg-[#1a1a1d] border border-white/10 rounded-2xl shadow-2xl p-1.5 z-30 space-y-1">
                {FRIENDLY_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onSelectModel(m.name);
                      setShowModelMenu(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors ${
                      selectedModel === m.name
                        ? 'bg-white/10 text-white font-medium'
                        : 'text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{m.name}</span>
                      {m.isPopular && (
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5 font-normal">{m.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Voice Mic & Waveform / Send Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`p-2 rounded-full transition-colors ${
                isListening
                  ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
              title={isListening ? 'Listening...' : 'Voice Input'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`p-2.5 rounded-full transition-all duration-200 flex items-center justify-center ${
                input.trim() && !isLoading
                  ? 'bg-white text-black hover:bg-neutral-200 shadow-md scale-100'
                  : 'bg-white/10 text-white/20 cursor-not-allowed scale-95'
              }`}
              title="Send Message"
            >
              {isLoading ? (
                <AudioWaveform className="w-4 h-4 animate-spin text-black" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Disclaimer sub-text */}
      <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] text-center mt-3 font-medium">
        Flow AI can make mistakes. Verify important information.
      </p>
    </div>
  );
};
