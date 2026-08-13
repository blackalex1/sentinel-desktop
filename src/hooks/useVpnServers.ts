import { useState, useEffect, useCallback } from 'react';
import { VpnServer } from '../types/vpn';
import { DbService } from '../services/dbService';
import { TauriBridge } from '../services/tauriBridge';
import { ProxyParser } from '../services/proxyParser';

interface UseVpnServersProps {
  addToast: (title: string, message?: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export function useVpnServers({ addToast }: UseVpnServersProps) {
  const [servers, setServers] = useState<VpnServer[]>(() => DbService.getAllServers());
  const [selectedServer, setSelectedServer] = useState<VpnServer | null>(() => {
    const all = DbService.getAllServers();
    const savedId = localStorage.getItem('xpc_selected_server_id');
    if (savedId) {
      const found = all.find(s => s.id === savedId);
      if (found) return found;
    }
    return all[0] || null;
  });
  const [isPinging, setIsPinging] = useState(false);

  // Initial sync from persistent Rust store
  useEffect(() => {
    DbService.getAllServersAsync().then(loadedServers => {
      if (loadedServers && loadedServers.length > 0) {
        setServers(loadedServers);
        const savedId = localStorage.getItem('xpc_selected_server_id');
        if (savedId) {
          const found = loadedServers.find(s => s.id === savedId);
          if (found) {
            setSelectedServer(found);
            return;
          }
        }
        setSelectedServer(prev => {
          if (prev && loadedServers.some(s => s.id === prev.id)) return prev;
          return loadedServers[0] || null;
        });
      }
    });

    TauriBridge.readStoreData<string>('xpc_selected_server_id').then(savedId => {
      if (savedId) {
        localStorage.setItem('xpc_selected_server_id', savedId);
        setServers(curr => {
          const found = curr.find(s => s.id === savedId);
          if (found) {
            setSelectedServer(found);
          }
          return curr;
        });
      }
    });
  }, []);

  // Save changes to dbService and keep selected server valid
  useEffect(() => {
    DbService.saveAllServers(servers);
    if (servers.length > 0) {
      if (!selectedServer || !servers.find(s => s.id === selectedServer.id)) {
        const savedId = localStorage.getItem('xpc_selected_server_id');
        const found = savedId ? servers.find(s => s.id === savedId) : null;
        setSelectedServer(found || servers[0]);
      }
    } else {
      setSelectedServer(null);
    }
  }, [servers]);

  // Persist selected server ID
  useEffect(() => {
    if (selectedServer) {
      localStorage.setItem('xpc_selected_server_id', selectedServer.id);
      TauriBridge.saveStoreData('xpc_selected_server_id', selectedServer.id);
    }
  }, [selectedServer]);

  const handleToggleFavorite = useCallback(async (id: string) => {
    const updated = await DbService.toggleFavorite(id);
    setServers(updated);
  }, []);

  const handleDeleteServer = useCallback(async (id: string) => {
    const updated = await DbService.deleteServer(id);
    setServers(updated);
    if (selectedServer?.id === id) {
      setSelectedServer(updated[0] || null);
    }
    addToast('Подключение удалено', 'Сервер успешно удален из списка', 'info');
  }, [selectedServer, addToast]);

  const handleAddServers = useCallback(async (newServers: VpnServer[]) => {
    const updated = await DbService.addServers(newServers);
    setServers(updated);
    if (newServers[0]) {
      setSelectedServer(newServers[0]);
    }
    addToast('Сервера добавлены', `Успешно импортировано ${newServers.length} профилей`, 'success');
  }, [addToast]);

  const handleDuplicateServer = useCallback(async (serverToDuplicate: VpnServer) => {
    const duplicated: VpnServer = {
      ...serverToDuplicate,
      id: `server_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: `${serverToDuplicate.name} (Копия)`,
      isFavorite: false,
    };
    const updated = await DbService.addServers([duplicated]);
    setServers(updated);
    addToast('Профиль продублирован', `Создана копия "${duplicated.name}"`, 'success');
  }, [addToast]);

  const handleUpdateServer = useCallback(async (updatedServer: VpnServer) => {
    const updated = await DbService.updateServer(updatedServer);
    setServers(updated);
    if (selectedServer?.id === updatedServer.id) {
      setSelectedServer(updatedServer);
    }
    addToast('Подключение обновлено', `${updatedServer.name} (${updatedServer.address}:${updatedServer.port})`, 'success');
  }, [selectedServer, addToast]);

  const handleExportServerLink = useCallback(async (serverToExport: VpnServer) => {
    const link = ProxyParser.generateLink(serverToExport);
    try {
      await navigator.clipboard.writeText(link);
      addToast('Ссылка скопирована', `Ссылка для "${serverToExport.name}" скопирована в буфер обмена`, 'success');
    } catch {
      addToast('Ошибка копирования', 'Не удалось получить доступ к буферу обмена', 'error');
    }
  }, [addToast]);

  const handlePingAll = useCallback(async () => {
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
  }, [servers, addToast]);

  return {
    servers,
    setServers,
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
  };
}
