import React from 'react';

interface SentinelLogoProps {
  className?: string;
  status?: string;
}

export const SentinelLogo: React.FC<SentinelLogoProps> = ({ className = "w-8 h-8", status }) => {
  return (
    <div className={`relative flex items-center justify-center flex-shrink-0 ${className}`}>
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-[0_0_16px_rgba(168,85,247,0.75)]"
        shapeRendering="geometricPrecision"
      >
        <defs>
          {/* Futuristic Cyber Gradients */}
          <linearGradient id="sentinelShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>

          <linearGradient id="sentinelCoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#818cf8" />
            <stop offset="100%" stop-color="#c084fc" />
          </linearGradient>

          <radialGradient id="sentinelAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
            <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#060812" stopOpacity="0" />
          </radialGradient>

          <filter id="neonGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Glow background */}
        <circle cx="100" cy="100" r="95" fill="url(#sentinelAura)" />

        {/* Outer Hexagonal Tactical Ring */}
        <polygon
          points="100,12 176,56 176,144 100,188 24,144 24,56"
          fill="none"
          stroke="url(#sentinelShieldGrad)"
          strokeWidth="3"
          strokeDasharray="18 10 4 10"
          opacity="0.75"
        />

        {/* Outer Bezel Cyber Shield */}
        <path
          d="M 100 24 
             L 165 58 
             L 165 125 
             C 165 162 100 182 100 182 
             C 100 182 35 162 35 125 
             L 35 58 Z"
          fill="#0a0c1e"
          stroke="url(#sentinelShieldGrad)"
          strokeWidth="5"
          strokeLinejoin="round"
        />

        {/* Inner Tech Core Mesh Lines */}
        <path
          d="M 100 24 L 100 182 M 35 90 L 165 90 M 48 135 L 152 135"
          stroke="#38bdf8"
          strokeWidth="1.2"
          opacity="0.3"
          strokeDasharray="4 4"
        />

        {/* Central Futuristic Cyber Wings / Core Emblem */}
        <path
          d="M 100 48 
             L 142 75 
             L 132 118 
             L 100 148 
             L 68 118 
             L 58 75 Z"
          fill="url(#sentinelCoreGrad)"
          opacity="0.9"
        />

        {/* Inner Diamond Plasma Eye Visor */}
        <polygon
          points="100,65 125,95 100,125 75,95"
          fill="#060812"
          stroke="#ffffff"
          strokeWidth="2.5"
        />

        <polygon
          points="100,78 114,95 100,112 86,95"
          fill="url(#sentinelShieldGrad)"
          filter="url(#neonGlowFilter)"
        />

        <circle cx="100" cy="95" r="4" fill="#ffffff" />

        {/* Corner Cyber Nodes */}
        <circle cx="100" cy="24" r="3" fill="#c084fc" />
        <circle cx="165" cy="58" r="3" fill="#38bdf8" />
        <circle cx="35" cy="58" r="3" fill="#38bdf8" />
        <circle cx="100" cy="182" r="4" fill="#06b6d4" />
      </svg>

      {/* Online/Offline LED Status Indicator */}
      {status && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#080914] ${
            status === 'connected' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-slate-500'
          }`}
        />
      )}
    </div>
  );
};
