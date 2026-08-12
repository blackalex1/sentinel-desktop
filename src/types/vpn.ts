export type ProtocolType = 
  | 'VLESS' 
  | 'VMESS' 
  | 'TROJAN' 
  | 'SHADOWSOCKS' 
  | 'HYSTERIA2' 
  | 'SOCKS5' 
  | 'HTTP'
  | 'TUIC' 
  | 'WIREGUARD';

export type CoreType = 'singbox' | 'xray' | 'hysteria';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error';

export type RouteAction = 'BLOCKED' | 'DIRECT' | 'VPN';

export interface QuickSecurityRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  action: RouteAction;
}

export interface CustomRouteRule {
  id: string;
  name: string;
  domains?: string[];
  ips?: string[];
  action: RouteAction;
  enabled: boolean;
}

export interface VpnServer {
  id: string;
  name: string;
  protocol: ProtocolType;
  address: string;
  port: number;
  uuid?: string;
  password?: string;
  path?: string;
  security?: string; // tls, reality, none
  sni?: string;
  pbk?: string; // reality public key
  sid?: string; // reality short id
  fp?: string; // fingerprint (chrome, safari, etc.)
  alpn?: string;
  obfs?: string;
  network?: string; // ws, grpc, tcp
  pingMs?: number;
  isFavorite?: boolean;
  isHotspot?: boolean; // From x-prox android hotspot
  countryCode?: string;
  rawLink?: string;
}

export interface HotspotSettings {
  enabled: boolean;
  ip: string;
  port: number;
  username?: string;
  password?: string;
  autoDetect: boolean;
}

export interface AppSettings {
  activeCore: CoreType;
  logLevel: LogLevel;
  tunMode: boolean;
  systemProxy: boolean;
  autoConnect: boolean;
  autoStart: boolean;
  includePrereleases: boolean;
  lanSharing: boolean;
  dnsServer: string;
  socksPort: number;
  httpPort: number;
  routingRules: 'all' | 'bypass_ru' | 'only_ru' | 'custom';
  customDirectDomains?: string;
  customVpnDomains?: string;
  quickSecurityRules: QuickSecurityRule[];
  customRouteRules: CustomRouteRule[];
  theme: 'oled' | 'cosmic';
}

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
  download_count: number;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  prerelease: boolean;
  draft: boolean;
  published_at: string;
  body: string;
  assets: GitHubAsset[];
  html_url: string;
}

export interface CoreInfo {
  type: CoreType;
  name: string;
  installedVersion?: string;
  latestVersion?: string;
  latestPrerelease?: string;
  repo: string;
  binaryName: string;
  isDownloading?: boolean;
  downloadProgress?: number;
}

export interface TrafficStats {
  downloadSpeed: number; // Bytes per second
  uploadSpeed: number;   // Bytes per second
  totalDownloaded: number; // Total Bytes
  totalUploaded: number;   // Total Bytes
  pingMs: number;
}
