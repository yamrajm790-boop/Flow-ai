import React from 'react';

interface FlowLogoProps {
  className?: string;
  size?: number;
  variant?: 'transparent' | 'square';
}

export const FlowLogo: React.FC<FlowLogoProps> = ({
  className = 'w-8 h-8',
  size,
}) => {
  const style = size ? { width: size, height: size } : undefined;
  const logoSrc = 'https://i.ibb.co/QjFk1LzP/f20a48b70d0a3be29d3a62cb04d70909.jpg';

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 border-none outline-none ${className}`} style={style}>
      <img
        src={logoSrc}
        alt="Flow AI Logo"
        className="w-full h-full object-contain pointer-events-none select-none border-none outline-none shadow-none mix-blend-screen"
        referrerPolicy="no-referrer"
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


