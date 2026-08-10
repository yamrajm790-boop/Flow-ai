import React from 'react';

interface FlowLogoProps {
  className?: string;
  size?: number;
  variant?: 'transparent' | 'square';
}

export const FlowLogo: React.FC<FlowLogoProps> = ({
  className = 'w-8 h-8',
  size,
  variant = 'transparent',
}) => {
  const style = size ? { width: size, height: size } : undefined;
  const logoSrc = variant === 'square' ? '/flow-logo-square.png' : '/flow-logo-transparent.png';

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`} style={style}>
      <img
        src={logoSrc}
        alt="Flow AI Logo"
        className="w-full h-full object-contain pointer-events-none select-none"
      />
    </div>
  );
};

export const FlowLogoText: React.FC<{ className?: string; logoSize?: string }> = ({
  className = '',
  logoSize = 'w-7 h-7',
}) => {
  return (
    <div className={`flex items-center gap-2.5 font-sans ${className}`}>
      <FlowLogo className={logoSize} />
      <span className="font-semibold text-white tracking-tight text-lg">Flow AI</span>
    </div>
  );
};

