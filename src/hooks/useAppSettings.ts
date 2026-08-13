import { useState, useEffect, useRef, useCallback } from 'react';
import { AppSettings, CustomRouteRule } from '../types/vpn';
import { DEFAULT_SETTINGS, CORE_SETTINGS_KEYS } from '../constants/defaultSettings';
import { IP_CHECK_DOMAINS } from '../constants/routingDomains';
import { TauriBridge } from '../services/tauriBridge';

interface UseAppSettingsProps {
  onCoreSettingsChanged?: (updatedSettings: AppSettings) => Promise<void> | void;
}

export function useAppSettings({
  onCoreSettingsChanged,
}: UseAppSettingsProps = {}) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('xpc_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const customRulesMigrated = (parsed.customRouteRules && parsed.customRouteRules.length > 0
          ? parsed.customRouteRules
          : DEFAULT_SETTINGS.customRouteRules).map((r: CustomRouteRule) => {
            if (r.id === 'rule_ip_service' || r.name.toLowerCase().includes('сервисы определения ip')) {
              if (!r.domains || r.domains.length < IP_CHECK_DOMAINS.length) {
                return { ...r, domains: IP_CHECK_DOMAINS };
              }
            }
            return r;
          });

        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          quickSecurityRules:
            parsed.quickSecurityRules && parsed.quickSecurityRules.length > 0
              ? parsed.quickSecurityRules
              : DEFAULT_SETTINGS.quickSecurityRules,
          customRouteRules: customRulesMigrated,
        };
      } catch (e) {}
    }
    return DEFAULT_SETTINGS;
  });

  // Stable ref to settings — lets stable callbacks/listeners read current settings
  const settingsRef = useRef<AppSettings>(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Initial sync from portable store
  useEffect(() => {
    TauriBridge.readStoreData<AppSettings>('xpc_settings').then(loadedSettings => {
      if (loadedSettings) {
        setSettings(prev => ({ ...prev, ...loadedSettings }));
      }
    });
  }, []);

  // Save settings on update
  useEffect(() => {
    localStorage.setItem('xpc_settings', JSON.stringify(settings));
    TauriBridge.saveStoreData('xpc_settings', settings);
  }, [settings]);

  const handleUpdateSettings = useCallback(async (newSet: Partial<AppSettings>) => {
    const updatedSettings: AppSettings = { ...settingsRef.current, ...newSet };
    setSettings(updatedSettings);

    // Only restart core if a core-affecting key changed (theme/language don't restart VPN)
    const coreSettingChanged = (Object.keys(newSet) as (keyof AppSettings)[]).some(k =>
      CORE_SETTINGS_KEYS.includes(k)
    );

    if (coreSettingChanged && onCoreSettingsChanged) {
      await onCoreSettingsChanged(updatedSettings);
    }
  }, [onCoreSettingsChanged]);

  return {
    settings,
    setSettings,
    settingsRef,
    handleUpdateSettings,
  };
}
