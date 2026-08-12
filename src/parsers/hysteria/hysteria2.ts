import { VpnServer } from '../../types/vpn';
import { detectCountryCode } from '../utils';

export function parseHysteria2(link: string): VpnServer {
  const cleanLink = link.replace('hysteria2://', 'hy2://');
  const url = new URL(cleanLink);
  const password = url.username;
  const address = url.hostname;
  const port = parseInt(url.port || '443', 10);
  const name = decodeURIComponent(url.hash.replace('#', '')) || `Hysteria2 ${address}`;

  const params = url.searchParams;
  const sni = params.get('sni') || undefined;
  const obfs = params.get('obfs') || undefined;

  return {
    id: `hy2_${address}_${port}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    protocol: 'HYSTERIA2',
    address,
    port,
    password,
    sni,
    obfs,
    security: 'tls',
    rawLink: link,
    countryCode: detectCountryCode(name),
  };
}
