import React, { useState, useEffect } from 'react';
import { Cpu, Download, RefreshCw, CheckCircle, ExternalLink, Sparkles, Check, Clock } from 'lucide-react';
import { CoreType } from '../types/vpn';
import { TauriBridge } from '../services/tauriBridge';
import { GlassSelectDropdown, SelectOption } from './GlassSelectDropdown';

export interface CoreVersionItem {
  version: string;
  isPrerelease: boolean;
  downloadUrl?: string;
}

export interface ExtendedCoreInfo {
  type: Exclude<CoreType, 'auto'>;
  name: string;
  installedVersion?: string;
  latestVersion: string;
  availableVersions: CoreVersionItem[];
  repo: string;
  binaryName: string;
  isDownloading?: boolean;
  downloadProgress?: number;
}

const cleanTagVersion = (v: string) => {
  if (!v) return '';
  let cleaned = v.trim();
  if (cleaned.toLowerCase().startsWith('app/')) {
    cleaned = cleaned.substring(4);
  }
  if (!cleaned.startsWith('v') && !cleaned.startsWith('V')) {
    cleaned = `v${cleaned}`;
  }
  return cleaned;
};

// Default Fallback Releases populated dynamically from GitHub API
const DEFAULT_CORES: ExtendedCoreInfo[] = [
  {
    type: 'singbox',
    name: 'Sing-box Core',
    installedVersion: undefined,
    latestVersion: '',
    availableVersions: [],
    repo: 'SagerNet/sing-box',
    binaryName: 'sing-box.exe',
  },
  {
    type: 'xray',
    name: 'Xray-core',
    installedVersion: undefined,
    latestVersion: '',
    availableVersions: [],
    repo: 'XTLS/Xray-core',
    binaryName: 'xray.exe',
  },
  {
    type: 'hysteria',
    name: 'Hysteria 2 Core',
    installedVersion: undefined,
    latestVersion: '',
    availableVersions: [],
    repo: 'apernet/hysteria',
    binaryName: 'hysteria.exe',
  },
  {
    type: 'wintun' as any,
    name: 'Wintun TUN Driver',
    installedVersion: undefined,
    latestVersion: 'v0.14.1',
    availableVersions: [
      {
        version: 'v0.14.1',
        isPrerelease: false,
        downloadUrl: 'https://www.wintun.net/builds/wintun-0.14.1.zip',
      }
    ],
    repo: 'WireGuard/wintun',
    binaryName: 'wintun.dll',
  },
];

const CACHE_KEY = 'xpc_cores_github_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

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

  const normVer = (v: string) => cleanTagVersion(v).replace(/^v/i, '');

  // Fetch real releases from GitHub API with 24-Hour Cache Check
  const fetchGithubReleases = async (force: boolean = false) => {
    try {
      const cachedStr = localStorage.getItem(CACHE_KEY);
      if (!force && cachedStr) {
        const parsed = JSON.parse(cachedStr);
        const age = Date.now() - (parsed.timestamp || 0);
        if (age < CACHE_TTL_MS && parsed.cores && parsed.cores.length > 0) {
          setCores(parsed.cores);
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
            // 1. Try native Rust fetch (CORS-free, rate-limit immune)
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
              };
            }
          } catch (err) {
            console.error(`Failed to fetch GitHub releases for ${core.repo}:`, err);
          }
          return core;
        })
      );

      setCores(updatedCores);

      const nowTs = Date.now();
      setLastCheckTime(new Date(nowTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: nowTs,
        cores: updatedCores,
      }));

      if (force) {
        onShowToast('Релизы GitHub обновлены', 'Свежий список версий ядер успешно загружен', 'info');
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
        installedVersion: isPresent ? (c.installedVersion || 'Установлено') : undefined,
      };
    }));
  };

  useEffect(() => {
    setCores(prev => prev.map(c => ({ ...c, isDownloading: false, downloadProgress: undefined })));
    syncInstalledCoresWithDisk();
    fetchGithubReleases(false);
  }, []);

  const handleSelectVersionForCore = (coreType: string, version: string) => {
    setSelectedVersions(prev => ({ ...prev, [coreType]: cleanTagVersion(version) }));
  };

  const handleDownloadCore = async (coreType: Exclude<CoreType, 'auto'>) => {
    const coreObj = cores.find(c => c.type === coreType);
    const targetVersion = selectedVersions[coreType] 
                       || coreObj?.latestVersion 
                       || coreObj?.availableVersions[0]?.version 
                       || 'latest';
    
    // Dynamically find selected version in core's available versions from GitHub API
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
        onShowToast(`Компонент ${coreObj?.name || coreType} обновлен`, `Успешно установлен компонент ${v}`, 'success');
      } else {
        onShowToast(`Ошибка загрузки ${coreObj?.name || coreType}`, `Не удалось скачать компонент ${v}.`, 'error');
      }
    } catch (err) {
      setCores(prev => prev.map(c => c.type === coreType ? {
        ...c,
        isDownloading: false,
        downloadProgress: undefined,
      } : c));
      onShowToast(`Ошибка загрузки ${coreObj?.name || coreType}`, `Ошибка при установке: ${err}`, 'error');
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-[#060812] select-none animate-fadeIn space-y-6 max-w-6xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-white/10 gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600/30 to-indigo-700/20 border border-purple-500/30 text-purple-300 shadow-glow-violet flex-shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-base font-extrabold text-slate-100 font-sans tracking-wide">
                Управление ядрами прокси и релизов GitHub
              </h1>
              <span className="px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-widest font-bold rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 whitespace-nowrap">
                Multi-Core Engine
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono mt-1">
              <span>Автоматическое скачивание и выбор версий Xray-core, Sing-box и Hysteria 2</span>
              <span className="text-slate-600">•</span>
              <span className="text-purple-400 flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>Кэш 24ч ({lastCheckTime})</span>
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => fetchGithubReleases(true)}
          disabled={isChecking}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-glow-violet transition-all active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Загрузка...' : 'Проверить обновления'}</span>
        </button>
      </div>

      {/* Pre-releases Toggle Switch */}
      <div className="p-5 rounded-2xl bg-[#0a0d1a] border border-white/10 shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3.5 pr-4">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-100 font-sans">Включать пре-релизы (Pre-releases)</span>
              {includePrereleases && (
                <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Pre-release включены
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Отображать экспериментальные версии Pre-release в выпадающем списке выбора релизов
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleIncludePrereleases(!includePrereleases)}
          className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 flex items-center flex-shrink-0 cursor-pointer ${
            includePrereleases ? 'bg-amber-500 justify-end' : 'bg-slate-800 justify-start'
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-white shadow-md" />
        </button>
      </div>

          {/* Cores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {cores.map((core) => {
          const isSelected = activeCore === core.type;
          
          // Filter versions based on Pre-release toggle
          const filteredVersions = core.availableVersions.filter(v => includePrereleases || !v.isPrerelease);
          
          const currentVerStr = cleanTagVersion(selectedVersions[core.type] || core.latestVersion);
          const selectedVerObj = core.availableVersions.find(v => normVer(v.version) === normVer(currentVerStr));
          const isCurrentInstalled = !!core.installedVersion && normVer(currentVerStr) === normVer(core.installedVersion);

          // Convert to standardized SelectOption items
          const versionOptions: SelectOption[] = filteredVersions.map((item) => ({
            value: item.version,
            label: item.version,
            badge: item.isPrerelease ? 'Pre-release' : 'Stable',
            badgeType: item.isPrerelease ? 'prerelease' : 'stable',
            isInstalled: !!core.installedVersion && normVer(item.version) === normVer(core.installedVersion),
          }));

          return (
            <div
              key={core.type}
              className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-5 ${
                isSelected
                  ? 'bg-gradient-to-b from-[#12182e] to-[#0a0d1a] border-purple-500/40 shadow-glow-violet'
                  : 'bg-[#0a0d1a] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-slate-100 font-sans tracking-wide">{core.name}</span>
                  {isSelected ? (
                    <span className="px-2.5 py-0.5 text-[9px] font-mono font-bold rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3" />
                      <span>АКТИВНОЕ</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[9px] font-mono text-slate-500 uppercase">
                      Доступно
                    </span>
                  )}
                </div>

                <a
                  href={`https://github.com/${core.repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 text-xs text-purple-400 hover:text-purple-300 font-mono transition-colors"
                >
                  <span>{core.repo}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                {/* Installed Version Row */}
                <div className="space-y-2 pt-3 border-t border-white/5 font-mono text-xs">
                  <div className="flex justify-between items-center gap-2 text-slate-400">
                    <span className="shrink-0">Установлено:</span>
                    <span className={core.installedVersion ? "text-slate-200 font-bold truncate" : "text-amber-400 font-medium shrink-0"}>
                      {core.installedVersion ? cleanTagVersion(core.installedVersion) : 'Не установлено'}
                    </span>
                  </div>
                </div>

                {/* Standardized Glass Select Dropdown */}
                <div className="space-y-1.5 pt-1 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] text-slate-400 font-medium block">
                      Доступные версии на GitHub:
                    </label>

                    {/* Badge matched with Spectre Panel */}
                    {selectedVerObj?.isPrerelease ? (
                      <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Pre-release
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Stable
                      </span>
                    )}
                  </div>

                  <GlassSelectDropdown
                    value={currentVerStr}
                    options={versionOptions}
                    onChange={(ver) => handleSelectVersionForCore(core.type, ver)}
                  />
                </div>
              </div>

              <div className="pt-2">
                {core.isDownloading ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono text-purple-300">
                      <span>Установка {currentVerStr}...</span>
                      <span>{core.downloadProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-200"
                        style={{ width: `${core.downloadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Spectre Panel Style Install / Update Button */}
                    <button
                      onClick={() => handleDownloadCore(core.type)}
                      disabled={isCurrentInstalled}
                      className={`flex items-center justify-center space-x-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis min-w-0 ${
                        isCurrentInstalled
                          ? 'bg-white/5 text-slate-400 border border-white/10 cursor-not-allowed opacity-80'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-glow-emerald'
                      }`}
                    >
                      {isCurrentInstalled ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span className="truncate">Установлено</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">Установить {currentVerStr}</span>
                        </>
                      )}
                    </button>

                    {/* Select / Active Core Engine Button */}
                    {(core.type as string) === 'wintun' ? (
                      <div className="flex items-center justify-center py-2.5 px-2 rounded-xl text-xs font-mono font-bold text-slate-400 bg-white/5 border border-white/10 whitespace-nowrap min-w-0">
                        Драйвер TUN
                      </div>
                    ) : isSelected ? (
                      <div className="flex items-center justify-center py-2.5 px-2 rounded-xl text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 whitespace-nowrap min-w-0">
                        Включено
                      </div>
                    ) : (
                      <button
                        onClick={() => onSelectActiveCore(core.type)}
                        className="py-2.5 px-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap truncate min-w-0"
                      >
                        Выбрать
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
