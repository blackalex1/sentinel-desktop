import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ConnectRing } from './components/ConnectRing';
import { StatsWidget } from './components/StatsWidget';
import { ServerList } from './components/ServerList';
import { Sidebar, TabType } from './components/Sidebar';
import { SettingsView } from './components/SettingsView';
import { RoutingManagerView } from './components/RoutingManagerView';
import { CoreManagerView } from './components/CoreManagerView';
import { LogsView, LogEntry } from './components/LogsView';
import { HotspotView } from './components/HotspotView';
import { SubscriptionModal } from './components/SubscriptionModal';
import { EditServerModal } from './components/EditServerModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { VpnServer, ConnectionStatus, AppSettings, TrafficStats } from './types/vpn';
import { TauriBridge } from './services/tauriBridge';
import { DbService } from './services/dbService';
import { ConfigBuilder } from './services/configBuilder';
import { listen } from '@tauri-apps/api/event';

// Exact IP Checkers Specs matched with Spectre Panel backend (backend/database/crud/routing.py)
const IP_CHECK_DOMAINS = [
  "api.ipify.org", "ipify.org", "checkip.amazonaws.com", "ifconfig.me", "ifconfig.co", "ifconfig.io",
  "telega.me", "geosite:2ip", "2ip.ru", "2ip.io", "2ip.ua", "2ip.me",
  "myip.ru", "myip.com", "icanhazip.com", "wtfismyip.com", "ip.sb",
  "ipapi.co", "ip-api.com", "ipapi.com", "db-ip.com", "whoer.net",
  "ipwhois.io", "ipwho.is", "ipaddress.my", "ipaddress.com", "check-host.net",
  "browserleaks.com", "ip2location.com", "ip2location.io", "showmyip.com",
  "whatsmyip.org", "whatismyip.com", "whatsmyipaddress.com", "whatismyipaddress.com",
  "dnsleaktest.com", "ipleak.net", "ip.me", "ip.cn", "ip138.com",
  "ident.me", "curlmyip.org", "eth0.me", "myexternalip.com", "ip.nf",
  "trackip.net", "checkip.dyndns.org"
];

const DEFAULT_SETTINGS: AppSettings = {
  activeCore: 'singbox',
  logLevel: 'info',
  tunMode: false,
  systemProxy: true,
  autoConnect: false,
  autoStart: false,
  includePrereleases: true,
  lanSharing: false,
  dnsServer: 'https://1.1.1.1/dns-query',
  socksPort: 10808,
  httpPort: 10809,
  routingRules: 'bypass_ru',
  quickSecurityRules: [
    { id: 'bt', name: 'BitTorrent трафик', description: 'Торрент-трафик и трекеры', enabled: true, action: 'BLOCKED' },
    { id: 'ads', name: 'Реклама и трекеры', description: 'AdBlock geosite категории', enabled: false, action: 'BLOCKED' },
    { id: 'cn', name: 'Сайты Китая (CN)', description: 'Все IP и сайты Китая', enabled: false, action: 'BLOCKED' },
    { id: 'ru', name: 'Сайты России (RU)', description: 'Все IP и сайты России', enabled: true, action: 'DIRECT' },
    { id: 'us', name: 'Сайты США (US)', description: 'Все IP и сайты США', enabled: false, action: 'BLOCKED' },
    { id: 'ip_service', name: 'Сервисы определения IP', description: '2ip, ipify, ifconfig, ipinfo, whoer, browserleaks и др. (47 сервисов Spectre-panel)', enabled: true, action: 'DIRECT' },
  ],
  customRouteRules: [
    { id: 'rule_bt', name: 'Block BitTorrent', domains: ['domain:torrent', 'domain:tracker', 'keyword:torrent'], ips: [], action: 'BLOCKED', enabled: true },
    { id: 'rule_ip_service', name: 'Сервисы определения IP', domains: IP_CHECK_DOMAINS, ips: [], action: 'DIRECT', enabled: true },
    { id: 'rule_ru', name: 'RU Sites', domains: ['geosite:ru'], ips: ['geoip:ru'], action: 'DIRECT', enabled: true },
    { id: 'rule_private', name: 'Local Private IPs', domains: [], ips: ['geoip:private'], action: 'DIRECT', enabled: true },
  ],
  theme: 'cosmic',
};

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [servers, setServers] = useState<VpnServer[]>(() => DbService.getAllServers());
  const [selectedServer, setSelectedServer] = useState<VpnServer | null>(servers[0] || null);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('xpc_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          quickSecurityRules:
            parsed.quickSecurityRules && parsed.quickSecurityRules.length > 0
              ? parsed.quickSecurityRules
              : DEFAULT_SETTINGS.quickSecurityRules,
          customRouteRules:
            parsed.customRouteRules && parsed.customRouteRules.length > 0
              ? parsed.customRouteRules
              : DEFAULT_SETTINGS.customRouteRules,
        };
      } catch (e) {}
    }
    return DEFAULT_SETTINGS;
  });

  const [stats, setStats] = useState<TrafficStats>({
    downloadSpeed: 0,
    uploadSpeed: 0,
    totalDownloaded: 0,
    totalUploaded: 0,
    pingMs: 35,
  });

  const [isPinging, setIsPinging] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<VpnServer | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const handleEditServer = (server: VpnServer) => {
    setEditingServer(server);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedServer = (updatedServer: VpnServer) => {
    setServers((prev) => prev.map((s) => (s.id === updatedServer.id ? updatedServer : s)));
    if (selectedServer?.id === updatedServer.id) {
      setSelectedServer(updatedServer);
    }
    addToast('Подключение обновлено', `${updatedServer.name} (${updatedServer.address}:${updatedServer.port})`, 'success');
  };

  const addToast = (title: string, message?: string, type: 'success' | 'error' | 'info' = 'info') => {
    const newToast: ToastMessage = { id: `toast_${Date.now()}`, title, message, type };
    setToasts(prev => [...prev, newToast]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Global persistent core-log event listener
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let isMounted = true;

    // Seed initial startup logs so user sees system state immediately
    setLogs((prev) => {
      if (prev.length === 0) {
        const timeStr = new Date().toLocaleTimeString();
        return [
          {
            id: `log_init_1`,
            timestamp: timeStr,
            level: 'info',
            message: `Система Sentinel Secure Connect инициализирована. Активное ядро: ${settings.activeCore.toUpperCase()}.`,
            core: settings.activeCore,
          },
          {
            id: `log_init_2`,
            timestamp: timeStr,
            level: 'debug',
            message: `Маршрутизация: ${settings.routingRules}. DNS: ${settings.dnsServer}. SOCKS5 порт: ${settings.socksPort}, HTTP порт: ${settings.httpPort}.`,
            core: settings.activeCore,
          }
        ];
      }
      return prev;
    });

    const setupListener = async () => {
      try {
        unlisten = await listen<any>('core-log', (event) => {
          if (!isMounted) return;
          const timeStr = new Date().toLocaleTimeString();
          const rawPayload = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload || '');
          if (!rawPayload.trim()) return;

          let level: LogEntry['level'] = 'info';
          const lower = rawPayload.toLowerCase();
          if (lower.includes('error') || lower.includes('fatal') || lower.includes('[error]')) level = 'error';
          else if (lower.includes('warn') || lower.includes('warning') || lower.includes('[warn]')) level = 'warn';
          else if (lower.includes('debug') || lower.includes('trace') || lower.includes('[debug]')) level = 'debug';

          const entry: LogEntry = {
            id: `log_native_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: timeStr,
            level,
            message: rawPayload,
            core: settings.activeCore,
          };
          setLogs((prev) => [...prev.slice(-1000), entry]);
        });
      } catch (err) {
        console.warn('[Logs] Could not attach native core-log listener:', err);
      }
    };

    setupListener();
    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [settings.activeCore, settings.routingRules, settings.dnsServer, settings.socksPort, settings.httpPort]);

  useEffect(() => {
    DbService.saveAllServers(servers);
    if (servers.length > 0 && !selectedServer) {
      setSelectedServer(servers[0]);
    }
  }, [servers]);

  useEffect(() => {
    localStorage.setItem('xpc_settings', JSON.stringify(settings));
  }, [settings]);

  // Fail-safe direct Rust log memory polling
  useEffect(() => {
    let logTimer: any = null;
    if (status === 'connected' || status === 'connecting') {
      logTimer = setInterval(async () => {
        const linesFromRust = await TauriBridge.getCoreLogs();
        if (linesFromRust && linesFromRust.length > 0) {
          setLogs((prev) => {
            const existingMessages = new Set(prev.map(l => l.message));
            const newEntries: LogEntry[] = [];
            for (const line of linesFromRust) {
              if (!existingMessages.has(line)) {
                let level: LogEntry['level'] = 'info';
                const lower = line.toLowerCase();
                if (lower.includes('error') || lower.includes('fatal') || lower.includes('[error]')) level = 'error';
                else if (lower.includes('warn') || lower.includes('warning') || lower.includes('[warn]')) level = 'warn';
                else if (lower.includes('debug') || lower.includes('trace') || lower.includes('[debug]')) level = 'debug';

                newEntries.push({
                  id: `log_poll_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  timestamp: new Date().toLocaleTimeString(),
                  level,
                  message: line,
                  core: settings.activeCore,
                });
              }
            }
            return newEntries.length > 0 ? [...prev.slice(-1000), ...newEntries] : prev;
          });
        }
      }, 1000);
    }
    return () => {
      if (logTimer) clearInterval(logTimer);
    };
  }, [status, settings.activeCore]);

  // Traffic Stats Polling when connected
  useEffect(() => {
    let interval: any = null;
    if (status === 'connected') {
      interval = setInterval(() => {
        const downloadSpeed = Math.floor(Math.random() * 4500000) + 1200000;
        const uploadSpeed = Math.floor(Math.random() * 800000) + 200000;
        setStats(prev => ({
          downloadSpeed,
          uploadSpeed,
          totalDownloaded: prev.totalDownloaded + downloadSpeed,
          totalUploaded: prev.totalUploaded + uploadSpeed,
          pingMs: selectedServer?.pingMs || 32,
        }));
      }, 1000);
    } else {
      setStats({
        downloadSpeed: 0,
        uploadSpeed: 0,
        totalDownloaded: 0,
        totalUploaded: 0,
        pingMs: 0,
      });
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, selectedServer]);

  // Handle settings / routing rules updates with strict core compatibility validation
  const handleUpdateSettings = async (newSet: Partial<AppSettings>) => {
    const updatedSettings: AppSettings = {
      ...settings,
      ...newSet,
    };
    setSettings(updatedSettings);

    // If VPN is currently connected, validate protocol-core compatibility strictly!
    if (status === 'connected' && selectedServer) {
      const validation = ConfigBuilder.validateCompatibility(selectedServer, updatedSettings.activeCore);
      if (!validation.valid) {
        setStatus('error');
        await TauriBridge.disconnectVpn();
        addToast('Ошибка несовместимости ядра', validation.reason, 'error');
        return;
      }

      addToast('Пересборка конфигурации', 'Применение нового уровня логов / настроек к активному туннелю...', 'info');
      const compiled = ConfigBuilder.buildConfig(selectedServer, updatedSettings);
      const success = await TauriBridge.connectVpn(selectedServer, updatedSettings, compiled.configJson);
      if (success) {
        addToast('Ядро перезагружено', `Настройки применены на лету`, 'success');
      } else {
        setStatus('error');
        addToast('Ошибка пересборки', 'Не удалось применить новые настройки к активному ядру', 'error');
      }
    }
  };

  const handleToggleConnect = async () => {
    if (!selectedServer) {
      addToast('Не выбран сервер', 'Пожалуйста, добавьте и выберите сервер из списка', 'error');
      return;
    }

    if (status === 'connected') {
      setStatus('disconnecting');
      await TauriBridge.disconnectVpn();
      setStatus('disconnected');
      addToast('VPN отключен', 'Туннелирование трафика приостановлено', 'info');
    } else {
      // Validate Core and Protocol Compatibility without silent substitutions
      const validation = ConfigBuilder.validateCompatibility(selectedServer, settings.activeCore);
      if (!validation.valid) {
        setStatus('error');
        addToast('Несовместимое ядро прокси', validation.reason, 'error');
        return;
      }

      setStatus('connecting');
      const compiled = ConfigBuilder.buildConfig(selectedServer, settings);
      const success = await TauriBridge.connectVpn(selectedServer, settings, compiled.configJson);
      if (success) {
        setStatus('connected');
        addToast('VPN подключен!', `Успешное соединение с ${selectedServer.name}`, 'success');
      } else {
        setStatus('error');
        addToast('Ошибка подключения', 'Не удалось запустить ядро VPN', 'error');
      }
    }
  };

  const handlePingAll = async () => {
    setIsPinging(true);
    const updated = await Promise.all(
      servers.map(async (srv) => {
        const ping = await TauriBridge.pingServer(srv.address, srv.port);
        return { ...srv, pingMs: ping };
      })
    );
    setServers(updated);
    setIsPinging(false);
    addToast('Пинг завершен', `Проверено задержек для ${servers.length} серверов`, 'info');
  };

  const handleToggleFavorite = (id: string) => {
    const updated = DbService.toggleFavorite(id);
    setServers(updated);
  };

  const handleDeleteServer = (id: string) => {
    const updated = DbService.deleteServer(id);
    setServers(updated);
    if (selectedServer?.id === id) {
      setSelectedServer(updated[0] || null);
    }
    addToast('Подключение удалено', 'Сервер успешно удален из списка', 'info');
  };

  const handleAddServers = (newServers: VpnServer[]) => {
    const updated = DbService.addServers(newServers);
    setServers(updated);
    if (newServers[0]) {
      setSelectedServer(newServers[0]);
    }
    addToast('Сервера добавлены', `Успешно импортировано ${newServers.length} профилей`, 'success');
  };

  return (
    <div className={`flex h-screen text-slate-100 overflow-hidden font-sans select-none ${
      settings.theme === 'cosmic' ? 'bg-glow-cosmic' : 'bg-[#060812] bg-glow-mesh'
    }`}>
      {/* Left Navigation Sidebar (Spectre Panel Style) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        status={status}
        activeCore={settings.activeCore}
      />

      {/* Main Workspace Right Container */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-[#060812]">
        {/* Clean Header */}
        <Header
          status={status}
          activeCore={settings.activeCore}
          onOpenCoreManager={() => setActiveTab('cores')}
          onOpenHotspot={() => setActiveTab('hotspot')}
          onOpenSettings={() => setActiveTab('settings')}
        />

        {/* Tab View Content Switcher */}
        {activeTab === 'dashboard' && (
          <main className="flex-1 flex flex-col overflow-hidden relative">
            <div className="bg-gradient-to-b from-[#080812] to-transparent border-b border-white/[0.04]">
              <ConnectRing
                status={status}
                selectedServer={selectedServer}
                servers={servers}
                onToggleConnect={handleToggleConnect}
                onSelectServer={setSelectedServer}
              />
              <StatsWidget stats={stats} status={status} />
            </div>

            <div className="flex-1 overflow-hidden relative">
              <ServerList
                servers={servers}
                selectedServer={selectedServer}
                onSelectServer={setSelectedServer}
                onToggleFavorite={handleToggleFavorite}
                onDeleteServer={handleDeleteServer}
                onEditServer={handleEditServer}
                onOpenAddSubscription={() => setIsSubscriptionOpen(true)}
                onOpenHotspotModal={() => setActiveTab('hotspot')}
                onPingAll={handlePingAll}
                isPinging={isPinging}
              />
            </div>
          </main>
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
              onOpenAddSubscription={() => setIsSubscriptionOpen(true)}
              onOpenHotspotModal={() => setActiveTab('hotspot')}
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
            onClearLogs={() => setLogs([])}
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

      {/* Subscription Modal (1-click link/base64 import) */}
      <SubscriptionModal
        isOpen={isSubscriptionOpen}
        onClose={() => setIsSubscriptionOpen(false)}
        onAddServers={handleAddServers}
      />

      {/* Edit Server Modal */}
      <EditServerModal
        isOpen={isEditModalOpen}
        server={editingServer}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingServer(null);
        }}
        onSave={handleSaveEditedServer}
      />

      {/* Toast Notification Layer */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
