import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, Copy, Check, Search, Pause, Play } from 'lucide-react';
import { ConnectionStatus, CoreType } from '../types/vpn';
import { useI18n } from '../i18n/i18nContext';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  core?: string;
}

interface LogsViewProps {
  logs: LogEntry[];
  onClearLogs: () => void;
  status: ConnectionStatus;
  activeCore: CoreType;
}

export const LogsView: React.FC<LogsViewProps> = ({ logs, onClearLogs, status, activeCore }) => {
  const { t } = useI18n();
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterCore, setFilterCore] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Instant auto-scroll without expensive GPU smooth animation calculations
  useEffect(() => {
    if (autoScroll && !isPaused && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs.length, autoScroll, isPaused]);

  const handleCopyLogs = () => {
    const text = logs.map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.core || 'core'}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (filterCore !== 'all' && (log.core || 'xray').toLowerCase() !== filterCore) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.timestamp.toLowerCase().includes(q) ||
        log.level.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'warn': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'debug': return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      default: return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 overflow-hidden bg-[#060812] select-none flex flex-col space-y-4 animate-fadeIn max-w-6xl mx-auto h-full">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-4 flex-shrink-0">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-glow-violet flex-shrink-0">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-base font-extrabold text-slate-100 font-sans tracking-wide">
                {t('logs_title')} ({activeCore.toUpperCase()})
              </h1>
              <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-widest font-bold rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 whitespace-nowrap">
                Real-time Stream
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center space-x-2 flex-shrink-0 font-mono text-xs">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl border font-bold transition-all cursor-pointer ${
              isPaused
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? t('logs_stream_pause') : t('logs_stream_live')}</span>
          </button>

          <button
            onClick={handleCopyLogs}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl font-semibold transition-colors cursor-pointer"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? '✓' : t('logs_copy')}</span>
          </button>

          <button
            onClick={onClearLogs}
            className="flex items-center space-x-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl font-semibold transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('logs_clear')}</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex items-center justify-between gap-3 flex-shrink-0 font-mono text-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('logs_search_ph')}
            className="w-full pl-9 pr-3 py-2 bg-[#0a0d1a] border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500/50"
          />
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          <label className="text-slate-400 text-[11px]">{t('logs_core_label')}</label>
          <select
            value={filterCore}
            onChange={(e) => setFilterCore(e.target.value)}
            className="px-3 py-2 bg-[#0a0d1a] border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500/50 cursor-pointer font-bold"
          >
            <option value="all" className="bg-[#0e1324] text-slate-200">{t('logs_all_cores')}</option>
            <option value="singbox" className="bg-[#0e1324] text-emerald-300">SING-BOX</option>
            <option value="xray" className="bg-[#0e1324] text-purple-300">XRAY</option>
            <option value="hysteria" className="bg-[#0e1324] text-cyan-300">HYSTERIA</option>
          </select>

          <label className="text-slate-400 text-[11px]">{t('logs_level_label')}</label>
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-3 py-2 bg-[#0a0d1a] border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500/50 cursor-pointer font-bold"
          >
            <option value="all" className="bg-[#0e1324] text-slate-200">{t('logs_all_levels')}</option>
            <option value="info" className="bg-[#0e1324] text-emerald-300">INFO</option>
            <option value="warn" className="bg-[#0e1324] text-amber-300">WARN</option>
            <option value="error" className="bg-[#0e1324] text-rose-300">ERROR</option>
            <option value="debug" className="bg-[#0e1324] text-purple-300">DEBUG</option>
          </select>
        </div>
      </div>

      {/* Terminal Console View Container */}
      <div ref={containerRef} className="flex-1 overflow-y-auto bg-[#050711] border border-white/10 rounded-2xl p-4 font-mono text-xs space-y-1.5 shadow-2xl relative min-h-[380px]">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 py-16">
            <Terminal className="w-8 h-8 text-slate-600" />
            <p>Логи консоли пока отсутствуют ({activeCore}.exe).</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start space-x-2.5 hover:bg-white/[0.03] p-1 rounded transition-colors">
              <span className="text-slate-500 flex-shrink-0 font-medium">[{log.timestamp}]</span>
              <span
                className={`px-1.5 py-0.2 text-[9px] font-bold rounded border uppercase flex-shrink-0 ${getLevelColor(
                  log.level
                )}`}
              >
                {log.level}
              </span>
              <span className="text-purple-400/80 font-bold flex-shrink-0">[{log.core || activeCore}]</span>
              <span className="break-all text-slate-200">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
