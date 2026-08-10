import React from 'react';
import { X, Check, Sparkles, Zap, Shield, Cpu } from 'lucide-react';
import { FlowLogo } from './FlowLogo';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-[#161618] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header */}
        <div className="flex items-center gap-3 mb-6">
          <FlowLogo className="w-10 h-8" />
          <div>
            <h2 className="text-xl font-serif text-white">Flow AI Pro</h2>
            <p className="text-xs text-neutral-400">Unlock maximum speed and intelligence</p>
          </div>
        </div>

        {/* Features List */}
        <div className="space-y-3 mb-8 text-xs sm:text-sm text-neutral-300">
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#222226]/60 border border-white/5">
            <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-white">Ultra-Fast Reasoning Stream</div>
              <p className="text-neutral-400 text-xs mt-0.5">Sub-second response tokens powered by Groq Llama-3.3 hardware acceleration.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#222226]/60 border border-white/5">
            <Cpu className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-white">Extended Context Window</div>
              <p className="text-neutral-400 text-xs mt-0.5">Analyze longer documents, codebases, and multi-turn conversations.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#222226]/60 border border-white/5">
            <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-white">Priority Server Capacity</div>
              <p className="text-neutral-400 text-xs mt-0.5">Guaranteed uptime with zero waiting queues during peak usage hours.</p>
            </div>
          </div>
        </div>

        {/* Price & Action */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 via-[#222226] to-[#222226] border border-purple-500/20">
          <div>
            <div className="text-2xl font-semibold text-white">$15<span className="text-xs font-normal text-neutral-400">/month</span></div>
            <div className="text-[11px] text-purple-300">Cancel anytime. 7-day money-back guarantee.</div>
          </div>

          <button
            onClick={() => {
              alert('Thank you for choosing Flow AI Pro!');
              onClose();
            }}
            className="py-2.5 px-5 bg-white hover:bg-neutral-200 text-black font-semibold text-sm rounded-xl transition-all shadow-lg active:scale-98"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
};
