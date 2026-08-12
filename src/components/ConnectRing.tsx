import React, { useState, useEffect, useRef } from 'react';
import { Power, Radio, ChevronDown, Check } from 'lucide-react';
import { ConnectionStatus, VpnServer } from '../types/vpn';

interface ConnectRingProps {
  status: ConnectionStatus;
  selectedServer: VpnServer | null;
  servers: VpnServer[];
  onToggleConnect: () => void;
  onSelectServer: (server: VpnServer) => void;
}

export const ConnectRing: React.FC<ConnectRingProps> = ({
  status,
  selectedServer,
  servers,
  onToggleConnect,
  onSelectServer,
}) => {
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: any = null;
    if (status === 'connected') {
      timer = setInterval(() => {
        setDurationSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setDurationSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getCountryEmoji = (code?: string) => {
    switch (code) {
      case 'RU': return '🇷🇺';
      case 'US': return '🇺🇸';
      case 'DE': return '🇩🇪';
      case 'NL': return '🇳🇱';
      case 'FI': return '🇫🇮';
      case 'FR': return '🇫🇷';
      case 'GB': return '🇬🇧';
      case 'TR': return '🇹🇷';
      case 'SG': return '🇸🇬';
      case 'JP': return '🇯🇵';
      case 'LAN': return '📱';
      default: return '🌐';
    }
  };

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'disconnecting';

  return (
    <div className={`relative flex flex-col items-center justify-center pt-6 pb-2 select-none ${isDropdownOpen ? 'z-40' : 'z-10'}`}>
      {/* Background Neon Pulse Wave Effects (Strictly contained within button boundaries) */}
      <div className="relative flex items-center justify-center my-1">
        {isConnected && (
          <>
            <div className="absolute w-40 h-40 rounded-full bg-emerald-500/10 animate-radar-ping pointer-events-none" />
            <div className="absolute w-44 h-44 rounded-full bg-cyan-500/5 animate-pulse-slow pointer-events-none" />
          </>
        )}

        {/* Outer Bezel Enclosure */}
        <div className={`p-2.5 rounded-full spring-transition ${
          isConnected
            ? 'bg-gradient-to-b from-emerald-500/20 to-cyan-500/10 border border-emerald-500/40 glow-ring-active'
            : isConnecting
            ? 'bg-amber-500/10 border border-amber-500/30'
            : 'bg-white/[0.02] border border-white/10 glow-ring-idle'
        }`}>
          {/* Inner Interactive Button Core */}
          <button
            onClick={onToggleConnect}
            disabled={isConnecting}
            className={`group relative flex flex-col items-center justify-center w-36 h-36 rounded-full font-sans cursor-pointer active:scale-95 spring-transition ${
              isConnected
                ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-glow-emerald border border-emerald-400/40'
                : isConnecting
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                : 'bg-gradient-to-br from-[#12121e] to-[#0c0c14] text-slate-300 border border-white/10 hover:border-purple-500/40 hover:text-purple-300'
            }`}
          >
            {/* Power Icon with micro-rotation */}
            <div className="relative mb-1">
              <Power className={`w-9 h-9 spring-transition group-hover:scale-110 ${
                isConnected ? 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]' : 'text-slate-400 group-hover:text-purple-400'
              }`} />
            </div>

            {/* Status Label */}
            <span className="text-[11px] font-bold tracking-wider uppercase font-mono mt-0.5">
              {status === 'connected' && 'ЗАЩИЩЕНО'}
              {status === 'connecting' && 'ПОДКЛЮЧЕНИЕ...'}
              {status === 'disconnecting' && 'ОТКЛЮЧЕНИЕ...'}
              {status === 'disconnected' && 'ПОДКЛЮЧИТЬ'}
              {status === 'error' && 'ОШИБКА'}
            </span>

            {/* Active Duration Timer */}
            {isConnected && (
              <span className="text-[10px] font-mono text-emerald-100/90 tracking-widest mt-0.5 bg-black/20 px-2 py-0.5 rounded-full border border-white/10">
                {formatTime(durationSeconds)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Server Selector Dropdown Pill */}
      {selectedServer && (
        <div className="relative mt-3 mb-1 z-50" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-2 px-4 py-1.5 rounded-full bg-surface-elevated/90 border border-surface-border hover:border-purple-500/40 text-xs font-medium text-slate-300 backdrop-blur-md shadow-lg transition-all active:scale-98 cursor-pointer group"
          >
            <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-purple-400'}`} />
            <span className="font-semibold text-slate-100 max-w-[180px] truncate">{selectedServer.name}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300">
              {selectedServer.protocol}
            </span>
            {selectedServer.pingMs && (
              <span className="text-[10px] font-mono text-slate-400">
                {selectedServer.pingMs} ms
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isDropdownOpen ? 'rotate-180 text-purple-400' : 'group-hover:text-slate-200'
            }`} />
          </button>

          {/* Floating Glass Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-80 max-h-64 overflow-y-auto rounded-2xl bg-[#0c0c16]/98 border border-purple-500/30 shadow-[0_15px_45px_rgba(0,0,0,0.9)] backdrop-blur-2xl p-1.5 z-50 animate-fadeIn">
              <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-white/5 mb-1">
                Выберите сервер подключения
              </div>
              <div className="space-y-1">
                {servers.map(server => {
                  const isCurSelected = selectedServer.id === server.id;
                  return (
                    <button
                      key={server.id}
                      onClick={() => {
                        onSelectServer(server);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                        isCurSelected
                          ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30 font-bold'
                          : 'hover:bg-white/[0.05] text-slate-300 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                        <span className="text-base flex-shrink-0">{getCountryEmoji(server.countryCode)}</span>
                        <div className="min-w-0">
                          <div className="truncate font-sans font-medium">{server.name}</div>
                          <div className="flex items-center space-x-1.5 text-[9px] font-mono text-slate-400">
                            <span className="text-purple-300">{server.protocol}</span>
                            <span>•</span>
                            <span className="truncate">{server.address}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {server.pingMs && (
                          <span className="text-[10px] font-mono text-slate-400">
                            {server.pingMs}ms
                          </span>
                        )}
                        {isCurSelected && (
                          <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
