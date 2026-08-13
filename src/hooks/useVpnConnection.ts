import { useState, useCallback } from 'react';
import { ConnectionStatus, VpnServer, AppSettings } from '../types/vpn';
import { ConfigBuilder } from '../services/configBuilder';
import { TauriBridge } from '../services/tauriBridge';

interface UseVpnConnectionProps {
  selectedServer: VpnServer | null;
  settings: AppSettings;
  addToast: (title: string, message?: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export function useVpnConnection({
  selectedServer,
  settings,
  addToast,
}: UseVpnConnectionProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  const handleToggleConnect = useCallback(async () => {
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
      const validation = ConfigBuilder.validateCompatibility(selectedServer, settings.activeCore);
      if (!validation.valid) {
        setStatus('error');
        addToast('Несовместимое ядро прокси', validation.reason, 'error');
        return;
      }

      setStatus('connecting');
      try {
        const compiled = ConfigBuilder.buildConfig(selectedServer, settings);
        const success = await TauriBridge.connectVpn(selectedServer, settings, compiled.configJson);
        if (success) {
          setStatus('connected');
          addToast('VPN подключен!', `Успешное соединение с ${selectedServer.name}`, 'success');
        } else {
          setStatus('error');
          addToast('Ошибка подключения', 'Не удалось запустить ядро VPN', 'error');
        }
      } catch (err) {
        setStatus('error');
        addToast('Ошибка конфигурации', String(err), 'error');
      }
    }
  }, [selectedServer, status, settings, addToast]);

  const handleReloadConfig = useCallback(async (updatedSettings: AppSettings) => {
    if (!selectedServer) return false;

    const validation = ConfigBuilder.validateCompatibility(selectedServer, updatedSettings.activeCore);
    if (!validation.valid) {
      setStatus('error');
      await TauriBridge.disconnectVpn();
      addToast('Ошибка несовместимости ядра', validation.reason, 'error');
      return false;
    }

    addToast('Пересборка конфигурации', 'Применение настроек к активному туннелю...', 'info');
    try {
      const compiled = ConfigBuilder.buildConfig(selectedServer, updatedSettings);
      const success = await TauriBridge.connectVpn(selectedServer, updatedSettings, compiled.configJson);
      if (success) {
        addToast('Ядро перезагружено', 'Настройки применены на лету', 'success');
        return true;
      } else {
        setStatus('error');
        addToast('Ошибка пересборки', 'Не удалось применить новые настройки к активному ядру', 'error');
        return false;
      }
    } catch (err) {
      setStatus('error');
      addToast('Ошибка конфигурации', String(err), 'error');
      return false;
    }
  }, [selectedServer, addToast]);

  return {
    status,
    setStatus,
    handleToggleConnect,
    handleReloadConfig,
  };
}
