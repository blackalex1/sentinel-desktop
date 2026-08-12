import React from 'react';

interface SpectreLogoProps {
  className?: string;
  status?: string;
}

export const SpectreLogo: React.FC<SpectreLogoProps> = ({ className = "w-8 h-8", status }) => {
  return (
    <div className={`relative flex items-center justify-center flex-shrink-0 ${className}`}>
      <svg
        viewBox="-40 -40 592 592"
        className="w-full h-full drop-shadow-[0_0_12px_rgba(124,58,237,0.7)]"
        shapeRendering="geometricPrecision"
      >
        <defs>
          <radialGradient id="reactBgAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.3"/>
            <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.12"/>
            <stop offset="100%" stopColor="#0b0f19" stopOpacity="0"/>
          </radialGradient>

          <linearGradient id="reactGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc"/>
            <stop offset="40%" stopColor="#7c3aed"/>
            <stop offset="80%" stopColor="#38bdf8"/>
            <stop offset="100%" stopColor="#06b6d4"/>
          </linearGradient>

          <linearGradient id="reactPlatGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff"/>
            <stop offset="100%" stopColor="#a5b4fc"/>
          </linearGradient>

          <linearGradient id="reactCarbon" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e1b4b"/>
            <stop offset="50%" stopColor="#0f172a"/>
            <stop offset="100%" stopColor="#090d16"/>
          </linearGradient>

          <linearGradient id="reactBeam" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff"/>
            <stop offset="50%" stopColor="#38bdf8"/>
            <stop offset="100%" stopColor="#c084fc"/>
          </linearGradient>
        </defs>

        <circle cx="256" cy="256" r="275" fill="url(#reactBgAura)"/>

        {/* Outer Stealth Shield Frame */}
        <path
          d="M 256 24 L 440 96 L 440 264 C 440 380 256 480 256 480 C 256 480 72 380 72 264 L 72 96 Z"
          fill="none"
          stroke="url(#reactGrad)"
          strokeWidth="14"
          strokeLinejoin="miter"
        />

        {/* Inner Carbon Fiber Shell */}
        <path
          d="M 256 46 L 420 112 L 420 256 C 420 360 256 452 256 452 C 256 452 92 360 92 256 L 92 112 Z"
          fill="url(#reactCarbon)"
          stroke="#7c3aed"
          strokeWidth="4"
          opacity="0.98"
        />

        {/* Side Wings */}
        <path d="M 92 112 L 170 160 L 170 280 L 120 310 L 92 256 Z" fill="url(#reactGrad)" opacity="0.35"/>
        <path d="M 420 112 L 342 160 L 342 280 L 392 310 L 420 256 Z" fill="url(#reactGrad)" opacity="0.35"/>

        {/* SPECTRE PHANTOM MASK */}
        <g>
          <path
            d="M 256 110 L 348 160 L 364 250 L 330 325 L 256 395 L 182 325 L 148 250 L 164 160 Z"
            fill="#0a0f1d"
            stroke="url(#reactGrad)"
            strokeWidth="6"
          />

          <path d="M 180 170 L 256 135 L 332 170" fill="none" stroke="url(#reactPlatGrad)" strokeWidth="4" strokeLinecap="round"/>

          {/* Sharp Eyes Visor */}
          <polygon points="178,212 240,234 234,254 190,242" fill="url(#reactBeam)"/>
          <polygon points="334,212 272,234 278,254 322,242" fill="url(#reactBeam)"/>

          {/* Diamond Plasma Reactor */}
          <polygon points="256,150 290,210 256,330 222,210" fill="url(#reactGrad)" opacity="0.85"/>
          <polygon points="256,185 278,225 256,300 234,225" fill="url(#reactBeam)"/>
          <polygon points="256,205 268,232 256,268 244,232" fill="#ffffff"/>
        </g>
      </svg>

      {/* Online/Offline LED Status Dot */}
      {status && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#080914] ${
            status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
          }`}
        />
      )}
    </div>
  );
};
