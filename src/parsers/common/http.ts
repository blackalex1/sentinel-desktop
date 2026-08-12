import { VpnServer } from '../../types/vpn';

export function parseHttp(link: string): VpnServer {
  const url = new URL(link);
  const address = url.hostname;
  const port = parseInt(url.port || '8080', 10);
  const name = decodeURIComponent(url.hash.replace('#', '')) || `HTTP ${address}`;

  return {
    id: `http_${address}_${port}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    protocol: 'HTTP',
    address,
    port,
    uuid: url.username || undefined,
    password: url.password || undefined,
    rawLink: link,
    countryCode: 'LAN',
  };
}
