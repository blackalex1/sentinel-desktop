import React, { useState, useEffect } from 'react';
import { ArrowDownRight, ArrowUpRight, Activity, RefreshCw } from 'lucide-react';
import { TrafficStats, ConnectionStatus } from '../types/vpn';
import { useI18n } from '../i18n/i18nContext';

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

const formatSpeed = (bytesPerSec: number) => {
  if (!(bytesPerSec > 0)) return '0 KB/s';
  if (bytesPerSec > 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
};

export const StatsWidget: React.FC<StatsWidgetProps> = ({ stats, status }) => {
  const { t } = useI18n();
  const isConnected = status === 'connected';

  const [ipInfo, setIpInfo] = useState<IpInfo | null>(null);
  const [isLoadingIp, setIsLoadingIp] = useState(false);

  const fetchPublicIp = async (signal?: AbortSignal) => {
    setIsLoadingIp(true);

    // Provider 1: ipwho.is (CORS free, rich Geo data)
    try {
      const res = await fetch('https://ipwho.is/', { signal });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success !== false && data.ip) {
          if (!signal?.aborted) {
            setIpInfo({
              ip: data.ip,
              countryCode: data.country_code || '',
              countryName: data.country || '',
              city: data.city || '',
            });
            setIsLoadingIp(false);
          }
          return;
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }

    // Provider 2: api.ipify.org (100% CORS enabled)
    try {
      const res = await fetch('https://api.ipify.org?format=json', { signal });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ip) {
          if (!signal?.aborted) {
            setIpInfo({
              ip: data.ip,
            });
            setIsLoadingIp(false);
          }
          return;
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }

    // Provider 3: icanhazip.com (in IP_CHECK_DOMAINS)
    try {
      const res = await fetch('https://icanhazip.com', { signal });
      if (res.ok) {
        const text = (await res.text()).trim();
        if (text && text.length >= 7 && text.length <= 45) {
          if (!signal?.aborted) {
            setIpInfo({
              ip: text,
            });
            setIsLoadingIp(false);
          }
          return;
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }

    if (!signal?.aborted) {
      setIpInfo({ ip: 'Не определен' });
      setIsLoadingIp(false);
    }
  };

  useEffect(() => {
    if (status === 'connecting' || status === 'disconnecting') return;
    const controller = new AbortController();
    fetchPublicIp(controller.signal);
    return () => controller.abort();
  }, [status]);



  const getCountryEmoji = (code?: string): string => {
    if (!code || code.length !== 2) return '🌐';
    return [...code.toUpperCase()]
      .map(c => String.fromCodePoint(0x1F1E0 - 65 + c.charCodeAt(0)))
      .join('');
  };

  return (
    <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-2 bg-[#060812]">
      {/* Download Speed Card */}
      <div className="double-bezel-shell">
        <div className="double-bezel-core p-3 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-mono tracking-wider uppercase">{t('dash_download')}</span>
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
            <span className="text-[10px] font-mono tracking-wider uppercase">{t('dash_upload')}</span>
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
            <span className="text-[10px] font-mono tracking-wider uppercase">{t('dash_ping')}</span>
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
              <span className="text-[10px] font-mono tracking-wider uppercase">IP</span>
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
              onClick={() => fetchPublicIp()}
              disabled={isLoadingIp}
              className="text-slate-400 hover:text-purple-300 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIp ? 'animate-spin text-purple-400' : ''}`} />
            </button>
          </div>

          <div className="mt-1 flex items-center justify-between">
            <div className="min-w-0 pr-1">
              <span className="text-xs font-bold font-mono text-slate-100 block truncate">
                {isLoadingIp ? '...' : ipInfo?.ip || '...'}
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
