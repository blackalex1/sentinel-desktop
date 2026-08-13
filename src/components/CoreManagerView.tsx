import React, { useState, useEffect } from 'react';
import { CoreType } from '../types/vpn';
import { TauriBridge } from '../services/tauriBridge';
import { useI18n } from '../i18n/i18nContext';

import {
  CoreVersionItem,
  ExtendedCoreInfo,
  GeoDatabasesInfoState,
  DEFAULT_CORES,
  CACHE_KEY,
  CACHE_TTL_MS,
  cleanTagVersion,
} from './core-manager/types';

import { CoreManagerHeader } from './core-manager/CoreManagerHeader';
import { PrereleaseToggleCard } from './core-manager/PrereleaseToggleCard';
import { CoreCard } from './core-manager/CoreCard';
import { GeoDatabasesCard } from './core-manager/GeoDatabasesCard';

export type { CoreVersionItem, ExtendedCoreInfo };

interface CoreManagerViewProps {
  activeCore: CoreType;
  onSelectActiveCore: (core: CoreType) => void;
  includePrereleases: boolean;
  onToggleIncludePrereleases: (val: boolean) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
}

export const CoreManagerView: React.FC<CoreManagerViewProps> = ({
  activeCore,
  onSelectActiveCore,
  includePrereleases,
  onToggleIncludePrereleases,
  onShowToast,
}) => {
  const { t } = useI18n();

  const [cores, setCores] = useState<ExtendedCoreInfo[]>(() => {
    try {
      const cachedStr = localStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        if (parsed?.cores && Array.isArray(parsed.cores)) {
          return parsed.cores.map((c: ExtendedCoreInfo) => ({
            ...c,
            isDownloading: false,
            downloadProgress: undefined,
          }));
        }
      }
    } catch {}
    return DEFAULT_CORES;
  });

  const [lastCheckTime, setLastCheckTime] = useState<string>(() => {
    try {
      const cachedStr = localStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        if (parsed?.timestamp) {
          return new Date(parsed.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      }
    } catch {}
    return 'Сегодня';
  });

  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({});
  const [isChecking, setIsChecking] = useState(false);

  const [geoInfo, setGeoInfo] = useState<GeoDatabasesInfoState | null>(null);
  const [isUpdatingGeo, setIsUpdatingGeo] = useState(false);
  const [geoProgress, setGeoProgress] = useState<number | undefined>(undefined);

  const fetchGithubReleases = async (force: boolean = false) => {
    try {
      const cachedStr = localStorage.getItem(CACHE_KEY);
      if (!force && cachedStr) {
        const parsed = JSON.parse(cachedStr);
        const age = Date.now() - (parsed.timestamp || 0);
        if (age < CACHE_TTL_MS && parsed.cores && parsed.cores.length > 0) {
          const cleanedCores = parsed.cores.map((c: ExtendedCoreInfo) => ({
            ...c,
            isDownloading: false,
            downloadProgress: undefined,
          }));
          setCores(cleanedCores);
          return;
        }
      }
    } catch (e) {
      console.warn('[CoreManager] Cache read error:', e);
    }

    setIsChecking(true);
    try {
      const updatedCores = await Promise.all(
        cores.map(async (core) => {
          try {
            // 1. Try native Rust fetch
            const nativeReleases = await TauriBridge.fetchGithubReleasesNative(core.repo);
            if (nativeReleases && nativeReleases.length > 0) {
              const realVersions: CoreVersionItem[] = nativeReleases.map(item => ({
                version: cleanTagVersion(item.version),
                isPrerelease: !!item.is_prerelease,
                downloadUrl: item.download_url,
              }));

              const latestObj = realVersions.find(v => !v.isPrerelease) || realVersions[0];

              return {
                ...core,
                latestVersion: latestObj ? latestObj.version : core.latestVersion,
                availableVersions: realVersions,
                isDownloading: false,
                downloadProgress: undefined,
              };
            }

            // 2. Fallback to web fetch
            const url = `https://api.github.com/repos/${core.repo}/releases?per_page=20`;
            const res = await fetch(url, {
              headers: { 'User-Agent': 'SentinelConnect/1.0' },
            });
            if (!res.ok) return core;

            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              const realVersions: CoreVersionItem[] = data.map((item: any) => {
                const rawTag = item.tag_name || item.name || '';
                const winAsset = item.assets?.find((a: any) => 
                  a.name?.toLowerCase().includes('windows') && (a.name?.toLowerCase().includes('64') || a.name?.toLowerCase().includes('amd64'))
                ) || item.assets?.[0];

                return {
                  version: cleanTagVersion(rawTag),
                  isPrerelease: !!item.prerelease,
                  downloadUrl: winAsset?.browser_download_url,
                };
              });

              const latestObj = realVersions.find(v => !v.isPrerelease) || realVersions[0];

              return {
                ...core,
                latestVersion: latestObj ? latestObj.version : core.latestVersion,
                availableVersions: realVersions.length > 0 ? realVersions : core.availableVersions,
                isDownloading: false,
                downloadProgress: undefined,
              };
            }
          } catch (err) {
            console.error(`Failed to fetch GitHub releases for ${core.repo}:`, err);
          }
          return {
            ...core,
            isDownloading: false,
            downloadProgress: undefined,
          };
        })
      );

      setCores(updatedCores);

      const nowTs = Date.now();
      setLastCheckTime(new Date(nowTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      const coresToCache = updatedCores.map(c => ({
        ...c,
        isDownloading: false,
        downloadProgress: undefined,
      }));

      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: nowTs,
        cores: coresToCache,
      }));

      if (force) {
        onShowToast(t('cores_toast_github_updated_title'), t('cores_toast_github_updated_desc'), 'info');
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const syncInstalledCoresWithDisk = async () => {
    const installedStatus = await TauriBridge.checkInstalledCores();
    if (!installedStatus) return;

    setCores(prev => prev.map(c => {
      let isPresent = false;
      if (c.type === 'singbox') isPresent = installedStatus.singbox;
      else if (c.type === 'xray') isPresent = installedStatus.xray;
      else if (c.type === 'hysteria') isPresent = installedStatus.hysteria;
      else if ((c.type as string) === 'wintun') isPresent = installedStatus.wintun;

      return {
        ...c,
        installedVersion: isPresent ? (c.installedVersion || t('cores_installed_label')) : undefined,
      };
    }));
  };

  const loadGeoInfo = async () => {
    const info = await TauriBridge.checkGeoDatabases();
    if (info) setGeoInfo(info);
  };

  useEffect(() => {
    setCores(prev => prev.map(c => ({ ...c, isDownloading: false, downloadProgress: undefined })));
    syncInstalledCoresWithDisk();
    fetchGithubReleases(false);
    loadGeoInfo();
  }, []);

  const handleUpdateGeo = async () => {
    setIsUpdatingGeo(true);
    setGeoProgress(0);
    try {
      const ok = await TauriBridge.updateGeoDatabases((percent) => setGeoProgress(percent));
      setIsUpdatingGeo(false);
      setGeoProgress(undefined);
      if (ok) {
        onShowToast(t('cores_geo_title'), t('cores_geo_updated_success'), 'success');
        loadGeoInfo();
      } else {
        onShowToast(t('cores_geo_title'), 'Failed to update Geo databases', 'error');
      }
    } catch (err) {
      setIsUpdatingGeo(false);
      setGeoProgress(undefined);
      onShowToast(t('cores_geo_title'), `Error: ${err}`, 'error');
    }
  };

  const handleSelectVersionForCore = (coreType: string, version: string) => {
    setSelectedVersions(prev => ({ ...prev, [coreType]: cleanTagVersion(version) }));
  };

  const handleDownloadCore = async (coreType: Exclude<CoreType, 'auto'>) => {
    const coreObj = cores.find(c => c.type === coreType);
    const targetVersion = selectedVersions[coreType] 
                       || coreObj?.latestVersion 
                       || coreObj?.availableVersions[0]?.version 
                       || 'latest';
    
    const verItem = coreObj?.availableVersions.find(v => cleanTagVersion(v.version) === cleanTagVersion(targetVersion)) 
                 || coreObj?.availableVersions[0];

    const v = verItem ? cleanTagVersion(verItem.version) : cleanTagVersion(targetVersion);
    const verNum = v.replace(/^v/i, '');

    let targetUrl = verItem?.downloadUrl || '';
    if (!targetUrl || targetUrl.includes('/download/latest/') || targetUrl.includes('/download/beta/')) {
      const tagWithV = v.startsWith('v') ? v : `v${v}`;
      if (coreType === 'singbox') {
        targetUrl = `https://github.com/SagerNet/sing-box/releases/download/${tagWithV}/sing-box-${verNum}-windows-amd64.zip`;
      } else if (coreType === 'xray') {
        targetUrl = `https://github.com/XTLS/Xray-core/releases/download/${tagWithV}/Xray-windows-64.zip`;
      } else if (coreType === 'hysteria') {
        targetUrl = `https://github.com/apernet/hysteria/releases/download/app%2F${tagWithV}/hysteria-windows-amd64.exe`;
      } else if ((coreType as string) === 'wintun') {
        targetUrl = 'https://fastly.jsdelivr.net/gh/WireGuard/wintun@master/builds/wintun-0.14.1.zip';
      }
    }

    setCores(prev => prev.map(c => c.type === coreType ? { ...c, isDownloading: true, downloadProgress: 10 } : c));

    try {
      const success = await TauriBridge.downloadCoreFromGithub(coreType, targetUrl, (p) => {
        setCores(prev => prev.map(c => c.type === coreType ? { ...c, downloadProgress: p } : c));
      });

      const installedStatus = await TauriBridge.checkInstalledCores();
      const isInstalledOnDisk = installedStatus ? (
        coreType === 'singbox' ? installedStatus.singbox :
        coreType === 'xray' ? installedStatus.xray :
        coreType === 'hysteria' ? installedStatus.hysteria :
        installedStatus.wintun
      ) : false;

      const isSuccess = success || isInstalledOnDisk;

      setCores(prev => prev.map(c => c.type === coreType ? {
        ...c,
        isDownloading: false,
        installedVersion: isSuccess ? v : c.installedVersion,
        downloadProgress: undefined,
      } : c));

      if (isSuccess) {
        onShowToast(t('cores_toast_installed_title', { name: coreObj?.name || coreType }), t('cores_toast_installed_desc', { v }), 'success');
      } else {
        onShowToast(t('cores_toast_download_error_title', { name: coreObj?.name || coreType }), t('cores_toast_download_error_desc', { v }), 'error');
      }
    } catch (err) {
      setCores(prev => prev.map(c => c.type === coreType ? {
        ...c,
        isDownloading: false,
        downloadProgress: undefined,
      } : c));
      onShowToast(t('cores_toast_download_error_title', { name: coreObj?.name || coreType }), t('cores_toast_install_error', { err: String(err) }), 'error');
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-[#060812] select-none animate-fadeIn space-y-6 max-w-6xl mx-auto">
      {/* View Header */}
      <CoreManagerHeader
        lastCheckTime={lastCheckTime}
        isChecking={isChecking}
        onRefresh={() => fetchGithubReleases(true)}
      />

      {/* Pre-releases Toggle Switch */}
      <PrereleaseToggleCard
        includePrereleases={includePrereleases}
        onToggle={onToggleIncludePrereleases}
      />

      {/* Cores & Geo Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 min-w-0">
        {cores.map((core) => (
          <CoreCard
            key={core.type}
            core={core}
            activeCore={activeCore}
            includePrereleases={includePrereleases}
            selectedVersion={selectedVersions[core.type] || ''}
            onSelectVersion={handleSelectVersionForCore}
            onDownloadCore={handleDownloadCore}
            onSelectActiveCore={onSelectActiveCore}
          />
        ))}

        {/* GeoIP & Geosite Database Management Card */}
        <GeoDatabasesCard
          geoInfo={geoInfo}
          isUpdatingGeo={isUpdatingGeo}
          geoProgress={geoProgress}
          onUpdateGeo={handleUpdateGeo}
        />
      </div>
    </div>
  );
};
