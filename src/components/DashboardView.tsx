import React from 'react';
import { ConnectRing } from './ConnectRing';
import { StatsWidget } from './StatsWidget';
import { ServerList } from './ServerList';
import { ConnectionStatus, VpnServer, TrafficStats } from '../types/vpn';

interface DashboardViewProps {
  status: ConnectionStatus;
  selectedServer: VpnServer | null;
  servers: VpnServer[];
  stats: TrafficStats;
  isPinging: boolean;
  onToggleConnect: () => void;
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
}

export function DashboardView({
  status,
  selectedServer,
  servers,
  stats,
  isPinging,
  onToggleConnect,
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
}: DashboardViewProps) {
  return (
    <main className="flex-1 flex flex-col overflow-hidden relative">
      <div className="bg-gradient-to-b from-[#080812] to-transparent border-b border-white/[0.04]">
        <ConnectRing
          status={status}
          selectedServer={selectedServer}
          servers={servers}
          onToggleConnect={onToggleConnect}
          onSelectServer={onSelectServer}
        />
        <StatsWidget stats={stats} status={status} />
      </div>

      <div className="flex-1 overflow-hidden relative">
        <ServerList
          servers={servers}
          selectedServer={selectedServer}
          onSelectServer={onSelectServer}
          onToggleFavorite={onToggleFavorite}
          onDeleteServer={onDeleteServer}
          onEditServer={onEditServer}
          onDuplicateServer={onDuplicateServer}
          onExportServerLink={onExportServerLink}
          onOpenAddSubscription={onOpenAddSubscription}
          onOpenHotspotModal={onOpenHotspotModal}
          onOpenExportModal={onOpenExportModal}
          onPingAll={onPingAll}
          isPinging={isPinging}
        />
      </div>
    </main>
  );
}
