import React, { useState, useEffect } from 'react';
import { ArrowDownRight, ArrowUpRight, Activity, RefreshCw } from 'lucide-react';
import { TrafficStats, ConnectionStatus } from '../types/vpn';

interface StatsWidgetProps {
  stats: TrafficStats;
  status: ConnectionStatus;
}

interface IpInfo {
  ip: string;
  countryCode?: string;
  countryName?: string;
  city?: string;
}

export const StatsWidget: React.FC<StatsWidgetProps> = ({ stats, status }) => {
  const isConnected = status === 'connected';

  const [ipInfo, setIpInfo] = useState<IpInfo | null>(null);
  const [isLoadingIp, setIsLoadingIp] = useState(false);

  const fetchPublicIp = async () => {
    setIsLoadingIp(true);

    // Provider 1: ipwho.is (CORS free, rich Geo data)
    try {
      const res = await fetch('https://ipwho.is/');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success !== false && data.ip) {
          setIpInfo({
            ip: data.ip,
            countryCode: data.country_code || '',
            countryName: data.country || '',
            city: data.city || '',
          });
          setIsLoadingIp(false);
          return;
        }
      }
    } catch (e) {}

    // Provider 2: api.ipify.org (100% CORS enabled)
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      if (res.ok) {
        const data = await res.json();
        if (data && data.ip) {
          setIpInfo({
            ip: data.ip,
          });
          setIsLoadingIp(false);
          return;
        }
      }
    } catch (e) {}

    // Provider 3: Cloudflare 1.1.1.1 cdn trace
    try {
      const res = await fetch('https://1.1.1.1/cdn-cgi/trace');
      if (res.ok) {
        const text = await res.text();
        const ipMatch = text.match(/ip=(.+)/);
        const locMatch = text.match(/loc=(.+)/);
        if (ipMatch && ipMatch[1]) {
          setIpInfo({
            ip: ipMatch[1].trim(),
            countryCode: locMatch ? locMatch[1].trim() : '',
          });
          setIsLoadingIp(false);
          return;
        }
      }
    } catch (e) {}

    setIpInfo({ ip: 'Не определен' });
    setIsLoadingIp(false);
  };

  useEffect(() => {
    fetchPublicIp();
  }, [status]);

  const formatSpeed = (bytesPerSec: number) => {
    if (!isConnected) return '0 KB/s';
    if (bytesPerSec > 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  };

  const getCountryEmoji = (code?: string) => {
    if (!code) return '🌐';
    const clean = code.toUpperCase();
    switch (clean) {
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
      default: return '🌐';
    }
  };

  return (
    <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-2 bg-[#060812]">
      {/* Download Speed Card */}
      <div className="double-bezel-shell">
        <div className="double-bezel-core p-3 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono tracking-wider uppercase">Входящий</span>
            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-1">
            <span className="text-sm font-extrabold font-mono text-slate-100">
              {formatSpeed(stats.downloadSpeed)}
            </span>
          </div>
        </div>
      </div>

      {/* Upload Speed Card */}
      <div className="double-bezel-shell">
        <div className="double-bezel-core p-3 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono tracking-wider uppercase">Исходящий</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-1">
            <span className="text-sm font-extrabold font-mono text-slate-100">
              {formatSpeed(stats.uploadSpeed)}
            </span>
          </div>
        </div>
      </div>

      {/* Ping / Latency Card */}
      <div className="double-bezel-shell">
        <div className="double-bezel-core p-3 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono tracking-wider uppercase">Пинг / MS</span>
            <Activity className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="mt-1">
            <span className="text-sm font-extrabold font-mono text-slate-100">
              {isConnected ? `${stats.pingMs} ms` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Real-time IP Address & Geo Detector Card */}
      <div className="double-bezel-shell">
        <div className="double-bezel-core p-3 flex flex-col justify-between h-full relative group">
          <div className="flex items-center justify-between text-slate-400">
            <div className="flex items-center space-x-1">
              <span className="text-[10px] font-mono tracking-wider uppercase">Внешний IP</span>
              {isConnected ? (
                <span className="px-1 py-0.2 text-[8px] font-mono bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                  VPN
                </span>
              ) : (
                <span className="px-1 py-0.2 text-[8px] font-mono bg-slate-500/20 text-slate-400 rounded border border-slate-500/30">
                  DIRECT
                </span>
              )}
            </div>
            <button
              onClick={fetchPublicIp}
              disabled={isLoadingIp}
              className="text-slate-400 hover:text-purple-300 transition-colors cursor-pointer"
              title="Обновить IP адрес"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIp ? 'animate-spin text-purple-400' : ''}`} />
            </button>
          </div>

          <div className="mt-1 flex items-center justify-between">
            <div className="min-w-0 pr-1">
              <span className="text-xs font-bold font-mono text-slate-100 block truncate">
                {isLoadingIp ? 'Проверка...' : ipInfo?.ip || 'Определение...'}
              </span>
              {ipInfo?.countryName && (
                <span className="text-[9px] font-mono text-slate-400 truncate block">
                  {ipInfo.city ? `${ipInfo.city}, ` : ''}{ipInfo.countryName}
                </span>
              )}
            </div>
            <span className="text-base flex-shrink-0">
              {getCountryEmoji(ipInfo?.countryCode)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
