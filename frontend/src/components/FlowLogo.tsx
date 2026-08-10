import React from 'react';
import { useAuth } from '../context/AuthContext';

interface FlowLogoProps {
  className?: string;
  size?: number;
  variant?: 'transparent' | 'square';
  isRotating?: boolean;
}

export const FlowLogo: React.FC<FlowLogoProps> = ({
  className = 'w-8 h-8',
  size,
  isRotating,
}) => {
  let authLoading = false;
  try {
    const auth = useAuth();
    authLoading = auth?.loading ?? false;
  } catch {
    authLoading = false;
  }

  const shouldRotate = isRotating !== undefined ? isRotating : authLoading;
  const style = size ? { width: size, height: size } : undefined;
  const logoSrc = 'https://i.ibb.co/QjFk1LzP/f20a48b70d0a3be29d3a62cb04d70909.jpg';

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 border-none outline-none bg-transparent p-0 overflow-visible ${className}`}
      style={style}
    >
      <img
        src={logoSrc}
        alt="Flow AI Logo"
        className={`w-full h-full object-contain pointer-events-none select-none border-none outline-none shadow-none mix-blend-screen origin-center transform-gpu ${
          shouldRotate ? 'animate-flow-rotate' : 'scale-[1.18]'
        }`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export const FlowLogoText: React.FC<{ className?: string; logoSize?: string; isRotating?: boolean }> = ({
  className = '',
  logoSize = 'w-7 h-7',
  isRotating,
}) => {
  return (
    <div className={`flex items-center gap-2.5 font-sans ${className}`}>
      <FlowLogo className={logoSize} isRotating={isRotating} />
      <span className="font-semibold text-white tracking-tight text-lg">Flow AI</span>
    </div>
  );
};
