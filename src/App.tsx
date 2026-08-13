import React, { useState } from 'react';
import { Header } from './components/Header';
import { Sidebar, TabType } from './components/Sidebar';
import { ServerList } from './components/ServerList';
import { SettingsView } from './components/SettingsView';
import { RoutingManagerView } from './components/RoutingManagerView';
import { CoreManagerView } from './components/CoreManagerView';
import { LogsView } from './components/LogsView';
import { HotspotView } from './components/HotspotView';
import { DashboardView } from './components/DashboardView';
import { AppModals } from './components/AppModals';
import {
  useToasts,
  useWindowVisibility,
  useVpnServers,
  useAppSettings,
  useVpnConnection,
  useVpnLogs,
  useTrafficStats,
  useModals,
} from './hooks';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const isWindowVisible = useWindowVisibility();

  // 1. Toast notifications
  const { toasts, addToast, dismissToast } = useToasts();

  // 2. Server profiles management & persistence
  const {
    servers,
    selectedServer,
    setSelectedServer,
    isPinging,
    handleToggleFavorite,
    handleDeleteServer,
    handleAddServers,
    handleDuplicateServer,
    handleUpdateServer,
    handleExportServerLink,
    handlePingAll,
  } = useVpnServers({ addToast });

  // 3. Application settings
  const {
    settings,
    settingsRef,
    handleUpdateSettings,
  } = useAppSettings({
    onCoreSettingsChanged: async (updatedSettings) => {
      if (status === 'connected') {
        await handleReloadConfig(updatedSettings);
      }
    },
  });

  // 4. VPN connection lifecycle
  const {
    status,
    handleToggleConnect,
    handleReloadConfig,
  } = useVpnConnection({
    selectedServer,
    settings,
    addToast,
  });

  // 5. Real-time core logs
  const { logs, handleClearLogs } = useVpnLogs({
    settingsRef,
    isWindowVisible,
  });

  // 6. Network traffic statistics
  const stats = useTrafficStats({
    status,
    isWindowVisible,
    selectedServer,
  });

  // 7. Modal dialogs management
  const {
    isSubscriptionOpen,
    setIsSubscriptionOpen,
    isExportOpen,
    setIsExportOpen,
    editingServer,
    isEditModalOpen,
    handleEditServer,
    handleCloseEditModal,
  } = useModals();

  return (
    <div
      className={`flex h-screen text-slate-100 overflow-hidden font-sans select-none ${
        settings.theme === 'cosmic' ? 'bg-glow-cosmic' : 'bg-[#060812] bg-glow-mesh'
      }`}
    >
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        status={status}
        activeCore={settings.activeCore}
      />

      {/* Main Workspace Right Container */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-[#060812]">
        {/* Top Header */}
        <Header
          status={status}
          activeCore={settings.activeCore}
          onOpenCoreManager={() => setActiveTab('cores')}
          onOpenHotspot={() => setActiveTab('hotspot')}
          onOpenSettings={() => setActiveTab('settings')}
        />

        {/* Tab View Content Switcher */}
        {activeTab === 'dashboard' && (
          <DashboardView
            status={status}
            selectedServer={selectedServer}
            servers={servers}
            stats={stats}
            isPinging={isPinging}
            onToggleConnect={handleToggleConnect}
            onSelectServer={setSelectedServer}
            onToggleFavorite={handleToggleFavorite}
            onDeleteServer={handleDeleteServer}
            onEditServer={handleEditServer}
            onDuplicateServer={handleDuplicateServer}
            onExportServerLink={handleExportServerLink}
            onOpenAddSubscription={() => setIsSubscriptionOpen(true)}
            onOpenHotspotModal={() => setActiveTab('hotspot')}
            onOpenExportModal={() => setIsExportOpen(true)}
            onPingAll={handlePingAll}
          />
        )}

        {activeTab === 'servers' && (
          <main className="flex-1 flex flex-col overflow-hidden relative p-4 bg-[#060812]">
            <ServerList
              servers={servers}
              selectedServer={selectedServer}
              onSelectServer={setSelectedServer}
              onToggleFavorite={handleToggleFavorite}
              onDeleteServer={handleDeleteServer}
              onEditServer={handleEditServer}
              onDuplicateServer={handleDuplicateServer}
              onExportServerLink={handleExportServerLink}
              onOpenAddSubscription={() => setIsSubscriptionOpen(true)}
              onOpenHotspotModal={() => setActiveTab('hotspot')}
              onOpenExportModal={() => setIsExportOpen(true)}
              onPingAll={handlePingAll}
              isPinging={isPinging}
            />
          </main>
        )}

        {activeTab === 'routing' && (
          <RoutingManagerView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {activeTab === 'cores' && (
          <CoreManagerView
            activeCore={settings.activeCore}
            onSelectActiveCore={(core) => handleUpdateSettings({ activeCore: core })}
            includePrereleases={settings.includePrereleases}
            onToggleIncludePrereleases={(val) => handleUpdateSettings({ includePrereleases: val })}
            onShowToast={addToast}
          />
        )}

        {activeTab === 'logs' && (
          <LogsView
            logs={logs}
            onClearLogs={handleClearLogs}
            status={status}
            activeCore={settings.activeCore}
          />
        )}

        {activeTab === 'hotspot' && (
          <HotspotView
            onAddHotspotServer={(srv) => handleAddServers([srv])}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onOpenRoutingManager={() => setActiveTab('routing')}
          />
        )}
      </div>

      {/* Modals & Toasts Layer */}
      <AppModals
        isSubscriptionOpen={isSubscriptionOpen}
        onCloseSubscription={() => setIsSubscriptionOpen(false)}
        onAddServers={handleAddServers}
        isEditModalOpen={isEditModalOpen}
        editingServer={editingServer}
        onCloseEdit={handleCloseEditModal}
        onSaveServer={handleUpdateServer}
        isExportOpen={isExportOpen}
        onCloseExport={() => setIsExportOpen(false)}
        servers={servers}
        selectedServer={selectedServer}
        settings={settings}
        onShowToast={addToast}
        toasts={toasts}
        onDismissToast={dismissToast}
      />
    </div>
  );
}
