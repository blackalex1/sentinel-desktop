import React from 'react';
import { Minus, X, Cpu, Smartphone, Globe } from 'lucide-react';
import { CoreType, ConnectionStatus } from '../types/vpn';
import { TauriBridge } from '../services/tauriBridge';
import { useI18n } from '../i18n/i18nContext';

interface HeaderProps {
  status: ConnectionStatus;
  activeCore: CoreType;
  onOpenCoreManager: () => void;
  onOpenHotspot: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  activeCore,
  onOpenCoreManager,
  onOpenHotspot,
}) => {
  const { language, setLanguage, t } = useI18n();
  const isConnected = status === 'connected';

  const getCoreDisplayName = (core: CoreType) => {
    switch (core) {
      case 'singbox': return 'Sing-box';
      case 'xray': return 'Xray';
      case 'hysteria': return 'Hysteria 2';
      default: return 'Core';
    }
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // If user clicked on a button or interactive child element, do not trigger window drag
    if ((e.target as HTMLElement).closest('button')) return;
    TauriBridge.startDraggingWindow();
  };

  const handleMinimize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[Header] Minimize button clicked!');
    TauriBridge.minimizeToTray();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[Header] Close button clicked!');
    TauriBridge.closeWindow();
  };

  return (
    <header
      data-tauri-drag-region
      onMouseDown={handleHeaderMouseDown}
      className="flex items-center justify-between px-4 py-2 bg-[#080914] border-b border-white/10 select-none cursor-default"
    >
      {/* Dynamic Status Indicator Breadcrumb */}
      <div data-tauri-drag-region className="flex items-center space-x-2">
        <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border transition-all ${
          isConnected
            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
            : 'bg-white/[0.03] text-slate-400 border-white/10'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
          <span>{isConnected ? t('status_connected') : t('status_disconnected')}</span>
        </div>
      </div>

      {/* Core Selector & Actions */}
      <div className="flex items-center space-x-2 flex-shrink-0">
        {/* Language Toggle Button */}
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setLanguage(language === 'ru' ? 'en' : 'ru');
          }}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-[#0e1324] border border-white/10 hover:border-purple-500/40 text-xs font-mono font-bold text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
          title="Switch Language / Сменить язык"
        >
          <Globe className="w-3.5 h-3.5 text-purple-400" />
          <span className="uppercase text-[11px] text-purple-300">{language}</span>
        </button>

        {/* Sentinel Hotspot Integration */}
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenHotspot();
          }}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-[#0e1324] border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/10 text-slate-300 hover:text-emerald-300 text-xs font-medium transition-all cursor-pointer"
          title="Интеграция с Sentinel Hotspot"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] font-mono">{t('header_hotspot_btn')}</span>
        </button>

        {/* Active Core Badge Button */}
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenCoreManager();
          }}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-[#0e1324] border border-white/10 hover:border-purple-500/40 hover:bg-purple-500/10 text-slate-300 hover:text-purple-300 text-xs font-medium transition-all cursor-pointer"
          title={t('cores_subtitle')}
        >
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[11px] font-mono font-bold">{getCoreDisplayName(activeCore)}</span>
        </button>

        {/* Window Controls (Windows 11 style) */}
        <div className="flex items-center ml-1 space-x-1 pl-1.5 border-l border-white/10 flex-shrink-0">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleMinimize}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Свернуть окно"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
            title="Закрыть окно"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
