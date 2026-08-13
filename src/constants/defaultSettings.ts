import { AppSettings } from '../types/vpn';
import { IP_CHECK_DOMAINS } from './routingDomains';

export const DEFAULT_SETTINGS: AppSettings = {
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
    { id: 'local_ip', name: 'Локальные IP адреса (LAN)', description: 'Прямой доступ к домашней сети (192.168.x, 10.x, 172.16.x, 127.0.0.1, geoip:private)', enabled: true, action: 'DIRECT' },
    { id: 'local_domains', name: 'Локальные сайты и домены', description: 'Роутеры, .local, .lan, .home, .internal, веб-интерфейсы NAS/IoT', enabled: true, action: 'DIRECT' },
    { id: 'bt', name: 'BitTorrent трафик', description: 'Торрент-трафик и трекеры', enabled: false, action: 'BLOCKED' },
    { id: 'ads', name: 'Реклама и трекеры', description: 'AdBlock geosite категории', enabled: false, action: 'BLOCKED' },
    { id: 'cn', name: 'Сайты Китая (CN)', description: 'Все IP и сайты Китая', enabled: false, action: 'BLOCKED' },
    { id: 'ru', name: 'Сайты России (RU)', description: 'Все IP и сайты России', enabled: false, action: 'DIRECT' },
    { id: 'us', name: 'Сайты США (US)', description: 'Все IP и сайты США', enabled: false, action: 'BLOCKED' },
    { id: 'ip_service', name: 'Сервисы определения IP', description: '2ip, ipify, ifconfig, ipinfo, whoer, browserleaks и др. (47 сервисов)', enabled: false, action: 'DIRECT' },
  ],
  customRouteRules: [
    { id: 'rule_local_ip', name: 'Local Private IPs', domains: [], ips: ['geoip:private', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'], action: 'DIRECT', enabled: true },
    { id: 'rule_local_domains', name: 'Local Domains & Routers', domains: ['domain:.local', 'domain:.lan', 'domain:.home', 'domain:.internal', 'domain:router.asus.com', 'domain:tplinkwifi.net', 'domain:keenetic.io', 'domain:miwifi.com'], ips: [], action: 'DIRECT', enabled: true },
    { id: 'rule_bt', name: 'Block BitTorrent', domains: ['domain:torrent', 'domain:tracker', 'keyword:torrent'], ips: [], action: 'BLOCKED', enabled: false },
    { id: 'rule_ip_service', name: 'Сервисы определения IP', domains: IP_CHECK_DOMAINS, ips: [], action: 'DIRECT', enabled: false },
    { id: 'rule_ru', name: 'RU Sites', domains: ['geosite:ru'], ips: ['geoip:ru'], action: 'DIRECT', enabled: false },
  ],
  theme: 'cosmic',
};

/**
 * Settings keys that directly impact the VPN core configuration.
 * Changing any of these requires reconnecting / restarting the core.
 * UI-only settings (theme, language) will not trigger core reload.
 */
export const CORE_SETTINGS_KEYS: ReadonlyArray<keyof AppSettings> = [
  'activeCore',
  'tunMode',
  'systemProxy',
  'socksPort',
  'httpPort',
  'dnsServer',
  'routingRules',
  'quickSecurityRules',
  'customRouteRules',
  'lanSharing',
  'logLevel',
];
