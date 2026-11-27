import React, { useState } from 'react';

interface BrandLogoProps {
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  light?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  logoUrl,
  size = 'md',
  light = false,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const dims =
    size === 'sm'
      ? 'w-9 h-9 rounded-lg'
      : size === 'lg'
        ? 'w-14 h-14 rounded-xl'
        : 'w-11 h-11 rounded-xl';

  if (logoUrl && !imgFailed) {
    return (
      <img
        src={logoUrl}
        alt="Sehat Ki Duniya Logo"
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${dims} object-cover shrink-0 border ${
          light ? 'border-emerald-700/60 bg-white' : 'border-slate-200 bg-white'
        }`}
      />
    );
  }

  return (
    <div
      className={`${dims} shrink-0 flex items-center justify-center ${
        light
          ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-200'
          : 'bg-emerald-900 border border-emerald-800 text-emerald-100'
      }`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 36 36"
        className={size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'}
        fill="none"
      >
        <path
          d="M18 4C11.5 8 7.5 13.8 7.5 20.2C7.5 26 12.2 30.8 18 30.8C23.8 30.8 28.5 26 28.5 20.2C28.5 13.8 24.5 8 18 4Z"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
        <path
          d="M18 10V26M13 18.5H23"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
