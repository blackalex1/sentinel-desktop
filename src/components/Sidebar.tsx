import React from 'react';
import { LayoutDashboard, Radio, Cpu, SlidersHorizontal, Settings, Wifi, Terminal } from 'lucide-react';
import { ConnectionStatus } from '../types/vpn';
import { SentinelLogo } from './SentinelLogo';
import { TauriBridge } from '../services/tauriBridge';

import { useI18n } from '../i18n/i18nContext';

export type TabType = 'dashboard' | 'servers' | 'routing' | 'cores' | 'logs' | 'hotspot' | 'settings';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  status: ConnectionStatus;
  activeCore: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  status,
  activeCore,
}) => {
  const { t } = useI18n();

  const menuItems: { id: TabType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: t('nav_dashboard'), icon: LayoutDashboard },
    { id: 'servers', label: t('nav_connections'), icon: Radio },
    { id: 'routing', label: t('nav_routing'), icon: SlidersHorizontal },
    { id: 'cores', label: t('nav_cores'), icon: Cpu },
    { id: 'logs', label: t('nav_logs'), icon: Terminal },
    { id: 'hotspot', label: t('nav_hotspot'), icon: Wifi },
    { id: 'settings', label: t('nav_settings'), icon: Settings },
  ];

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    TauriBridge.startDraggingWindow();
  };

  return (
    <aside className="w-60 bg-[#080914] border-r border-white/10 flex flex-col justify-between h-full select-none flex-shrink-0">
      <div>
        {/* Top Unique Cyber Logo & App Title (Draggable) */}
        <div
          data-tauri-drag-region
          onMouseDown={handleHeaderMouseDown}
          className="p-4 border-b border-white/10 flex items-center space-x-3 cursor-default"
        >
          <SentinelLogo status={status} className="w-9 h-9" />
          <div>
            <h1 className="text-xs font-extrabold text-slate-100 font-sans tracking-wide">
              Sentinel Secure
            </h1>
            <span className="text-[10px] text-purple-400 font-mono block">
              Desktop Edition v1.0
            </span>
          </div>
        </div>

        {/* Sidebar Vertical Navigation Menu */}
        <nav className="p-2.5 space-y-1 mt-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-purple-600/20 text-purple-200 border-l-4 border-purple-500 font-bold shadow-[inset_4px_0_15px_rgba(139,92,246,0.25)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-purple-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Info (Core & Status) */}
      <div className="p-3.5 border-t border-white/10 bg-[#060710]">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
          <span>{t('nav_active_core')}</span>
          <span className="text-purple-300 font-bold uppercase">{activeCore}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>{t('nav_vpn_status')}</span>
          <span className={`font-bold ${status === 'connected' ? 'text-emerald-400' : 'text-slate-400'}`}>
            {status === 'connected' ? t('status_connected') : t('status_disconnected')}
          </span>
        </div>
      </div>
    </aside>
  );
};
