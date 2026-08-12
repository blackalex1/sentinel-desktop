import { VpnServer } from '../../types/vpn';

export function parseSocks(link: string): VpnServer {
  const cleanLink = link.replace('socks5://', 'http://').replace('socks://', 'http://');
  const url = new URL(cleanLink);
  const address = url.hostname;
  const port = parseInt(url.port || '1080', 10);
  const name = decodeURIComponent(url.hash.replace('#', '')) || `SOCKS5 ${address}`;

  return {
    id: `socks5_${address}_${port}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    protocol: 'SOCKS5',
    address,
    port,
    uuid: url.username || undefined,
    password: url.password || undefined,
    isHotspot: address.startsWith('192.168.') || address.startsWith('10.') || address === '127.0.0.1',
    rawLink: link,
    countryCode: 'LAN',
  };
}
