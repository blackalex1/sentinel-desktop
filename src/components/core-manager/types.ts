import { CoreType } from '../../types/vpn';

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

export interface GeoDatabasesInfoState {
  geoip_dat_exists: boolean;
  geoip_dat_size: number;
  geoip_dat_mtime?: number;
  geosite_dat_exists: boolean;
  geosite_dat_size: number;
  geosite_dat_mtime?: number;
  geoip_db_exists: boolean;
  geoip_db_size: number;
  geoip_db_mtime?: number;
  geosite_db_exists: boolean;
  geosite_db_size: number;
  geosite_db_mtime?: number;
}

export const cleanTagVersion = (v: string): string => {
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

export const formatFileDate = (mtimeSec?: number): string => {
  if (!mtimeSec || mtimeSec === 0) return '';
  const date = new Date(mtimeSec * 1000);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month} ${hours}:${mins}`;
};

export const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '—';
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  return `${mb} MB`;
};

export const DEFAULT_CORES: ExtendedCoreInfo[] = [
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
        downloadUrl: 'https://fastly.jsdelivr.net/gh/WireGuard/wintun@master/builds/wintun-0.14.1.zip',
      }
    ],
    repo: 'WireGuard/wintun',
    binaryName: 'wintun.dll',
  },
];

export const CACHE_KEY = 'xpc_cores_github_cache_v2';
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours
