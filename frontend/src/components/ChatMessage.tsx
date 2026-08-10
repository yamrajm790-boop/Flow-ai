import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ThumbsUp, ThumbsDown, Share2, RefreshCw } from 'lucide-react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  isLastAiMessage?: boolean;
  onRegenerate?: () => void;
  onFeedback?: (messageId: string, type: 'like' | 'dislike') => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isLastAiMessage,
  onRegenerate,
  onFeedback,
}) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [liked, setLiked] = useState(message.liked || false);
  const [disliked, setDisliked] = useState(message.disliked || false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Flow AI Response',
        text: message.content,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(message.content);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  const handleLike = () => {
    const nextState = !liked;
    setLiked(nextState);
    if (nextState) setDisliked(false);
    if (onFeedback) onFeedback(message.id, 'like');
  };

  const handleDislike = () => {
    const nextState = !disliked;
    setDisliked(nextState);
    if (nextState) setLiked(false);
    if (onFeedback) onFeedback(message.id, 'dislike');
  };

  if (isUser) {
    return (
      <div className="flex justify-end my-3 sm:my-4 px-2 sm:px-4">
        <div className="bg-[#161616] text-white px-4 py-3 rounded-2xl max-w-[85%] sm:max-w-[75%] text-sm sm:text-base leading-relaxed font-sans border border-white/10 whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start my-4 px-2 sm:px-4 max-w-full">
      {/* AI Response Text Body */}
      <div className="text-[#E5E5E5] text-sm sm:text-base leading-relaxed font-sans w-full max-w-none pr-2">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="mb-3.5 last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
            ul: ({ children }) => <ul className="list-disc pl-5 my-3 space-y-1.5">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 my-3 space-y-1.5">{children}</ol>,
            li: ({ children }) => <li className="text-[#E5E5E5]">{children}</li>,
            h1: ({ children }) => <h1 className="text-xl font-semibold text-white mt-4 mb-2">{children}</h1>,
            h2: ({ children }) => <h2 className="text-lg font-semibold text-white mt-3.5 mb-2">{children}</h2>,
            h3: ({ children }) => <h3 className="text-base font-semibold text-white mt-3 mb-1.5">{children}</h3>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-white/20 pl-4 italic text-white/60 my-3">
                {children}
              </blockquote>
            ),
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              const codeString = String(children).replace(/\n$/, '');

              if (!inline) {
                return (
                  <div className="my-3 rounded-xl overflow-hidden bg-black border border-white/10 font-mono text-xs sm:text-sm">
                    <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#161616] text-white/50 border-b border-white/5">
                      <span>{match ? match[1] : 'code'}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(codeString);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <pre className="p-3.5 overflow-x-auto text-[#E5E5E5]">
                      <code>{codeString}</code>
                    </pre>
                  </div>
                );
              }
              return (
                <code className="bg-[#161616] px-1.5 py-0.5 rounded text-amber-200 font-mono text-xs border border-white/5" {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>

      {/* Action Toolbar under AI response */}
      <div className="flex items-center gap-1.5 mt-2.5 text-white/40">
        <button
          onClick={handleCopy}
          title="Copy message"
          className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>

        <button
          onClick={handleLike}
          title="Good response"
          className={`p-1.5 hover:bg-white/5 rounded-lg transition-colors ${
            liked ? 'text-emerald-400' : 'hover:text-white'
          }`}
        >
          <ThumbsUp className="w-4 h-4" />
        </button>

        <button
          onClick={handleDislike}
          title="Poor response"
          className={`p-1.5 hover:bg-white/5 rounded-lg transition-colors ${
            disliked ? 'text-rose-400' : 'hover:text-white'
          }`}
        >
          <ThumbsDown className="w-4 h-4" />
        </button>

        <button
          onClick={handleShare}
          title="Share response"
          className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          {shared ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
        </button>

        {isLastAiMessage && onRegenerate && (
          <button
            onClick={onRegenerate}
            title="Regenerate response"
            className="p-1.5 hover:text-white hover:bg-white/5 rounded-lg transition-colors ml-1"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
