import React, { useState, useMemo } from 'react';
import { Search, Plus, RefreshCw, Smartphone, Filter, Download } from 'lucide-react';
import { VpnServer } from '../types/vpn';
import { ServerCard } from './ServerCard';
import { useI18n } from '../i18n/i18nContext';

interface ServerListProps {
  servers: VpnServer[];
  selectedServer: VpnServer | null;
  onSelectServer: (server: VpnServer) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteServer: (id: string) => void;
  onEditServer: (server: VpnServer) => void;
  onDuplicateServer: (server: VpnServer) => void;
  onExportServerLink: (server: VpnServer) => void;
  onOpenAddSubscription: () => void;
  onOpenHotspotModal: () => void;
  onOpenExportModal: () => void;
  onPingAll: () => void;
  isPinging: boolean;
}

export const ServerList: React.FC<ServerListProps> = ({
  servers,
  selectedServer,
  onSelectServer,
  onToggleFavorite,
  onDeleteServer,
  onEditServer,
  onDuplicateServer,
  onExportServerLink,
  onOpenAddSubscription,
  onOpenHotspotModal,
  onOpenExportModal,
  onPingAll,
  isPinging,
}) => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProtocolFilter, setSelectedProtocolFilter] = useState<string>('ALL');

  // Dynamically compute active filter tabs based on available servers in list
  const filterTabs = useMemo(() => {
    const tabs = [{ id: 'ALL', label: t('server_tab_all') }];

    if (servers.some(s => s.isFavorite)) {
      tabs.push({ id: 'FAVORITES', label: t('server_tab_favorites') });
    }

    if (servers.some(s => s.protocol === 'VLESS')) {
      tabs.push({ id: 'VLESS', label: 'VLESS' });
    }

    if (servers.some(s => s.protocol === 'HYSTERIA2')) {
      tabs.push({ id: 'HYSTERIA2', label: 'HY2' });
    }

    if (servers.some(s => s.protocol === 'VMESS')) {
      tabs.push({ id: 'VMESS', label: 'VMess' });
    }

    if (servers.some(s => s.protocol === 'TROJAN')) {
      tabs.push({ id: 'TROJAN', label: 'Trojan' });
    }

    if (servers.some(s => s.protocol === 'SHADOWSOCKS')) {
      tabs.push({ id: 'SHADOWSOCKS', label: 'Shadowsocks' });
    }

    if (servers.some(s => s.protocol === 'SOCKS5' && !s.isHotspot)) {
      tabs.push({ id: 'SOCKS5', label: 'SOCKS5' });
    }

    if (servers.some(s => s.isHotspot)) {
      tabs.push({ id: 'HOTSPOT', label: 'Sentinel Hotspot' });
    }

    return tabs;
  }, [servers, t]);

  // Fallback to ALL if active tab is no longer in filterTabs
  const activeFilter = filterTabs.some(t => t.id === selectedProtocolFilter)
    ? selectedProtocolFilter
    : 'ALL';

  const filteredServers = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    return servers.filter(server => {
      const matchesSearch = !lowerQuery ||
        server.name.toLowerCase().includes(lowerQuery) ||
        server.address.toLowerCase().includes(lowerQuery);
      
      if (activeFilter === 'ALL') return matchesSearch;
      if (activeFilter === 'HOTSPOT') return matchesSearch && server.isHotspot;
      if (activeFilter === 'FAVORITES') return matchesSearch && server.isFavorite;
      return matchesSearch && server.protocol === activeFilter;
    });
  }, [servers, searchQuery, activeFilter]);

  return (
    <div className="flex flex-col h-full px-4 py-2 select-none">
      {/* Top Search & Actions Bar */}
      <div className="flex items-center space-x-2 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('server_search_ph')}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-elevated/70 border border-surface-border rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors font-sans"
          />
        </div>

        {/* Refresh Ping Button */}
        <button
          onClick={onPingAll}
          disabled={isPinging}
          className="p-2 bg-surface-elevated/70 border border-surface-border hover:border-purple-500/40 text-slate-300 hover:text-purple-300 rounded-xl transition-all duration-300 active:scale-95 flex-shrink-0 cursor-pointer"
          title="Проверить пинг"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-purple-400' : ''}`} />
        </button>

        {/* Export All / Backup Button */}
        <button
          onClick={onOpenExportModal}
          className="p-2 bg-surface-elevated/70 border border-surface-border hover:border-teal-500/40 text-slate-300 hover:text-teal-300 rounded-xl transition-all duration-300 active:scale-95 flex-shrink-0 cursor-pointer"
          title="Экспорт и резервное копирование"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        {/* Add Subscription Link Button */}
        <button
          onClick={onOpenAddSubscription}
          className="flex items-center space-x-1 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-medium shadow-md transition-all duration-300 active:scale-95 flex-shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('server_add_btn')}</span>
        </button>
      </div>

      {/* Dynamic Protocol Filter Pills */}
      {filterTabs.length > 1 && (
        <div className="flex items-center space-x-1.5 mb-2 overflow-x-auto pb-1 scrollbar-none">
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedProtocolFilter(tab.id)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all duration-200 whitespace-nowrap cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
                  : 'bg-white/[0.03] text-slate-400 hover:text-slate-200 border border-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Servers Scrollable Container */}
      <div className="flex-1 overflow-y-auto space-y-2 p-2">
        {filteredServers.length > 0 ? (
          filteredServers.map(server => (
            <ServerCard
              key={server.id}
              server={server}
              isSelected={selectedServer?.id === server.id}
              onSelect={() => onSelectServer(server)}
              onToggleFavorite={() => onToggleFavorite(server.id)}
              onDelete={() => onDeleteServer(server.id)}
              onEdit={() => onEditServer(server)}
              onDuplicate={() => onDuplicateServer(server)}
              onExportLink={() => onExportServerLink(server)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Filter className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs text-slate-400 font-medium">{t('server_not_found')}</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
              {t('server_empty_hint')}
            </p>
            <button
              onClick={onOpenHotspotModal}
              className="mt-3 flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/20 transition-colors cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Sentinel Hotspot</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
