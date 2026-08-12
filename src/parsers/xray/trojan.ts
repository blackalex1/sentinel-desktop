import { VpnServer } from '../../types/vpn';
import { detectCountryCode } from '../utils';

export function parseTrojan(link: string): VpnServer {
  const url = new URL(link);
  const password = url.username;
  const address = url.hostname;
  const port = parseInt(url.port || '443', 10);
  const name = decodeURIComponent(url.hash.replace('#', '')) || `Trojan ${address}`;

  const params = url.searchParams;
  const sni = params.get('sni') || undefined;
  const type = params.get('type') || 'tcp';

  return {
    id: `trojan_${address}_${port}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    protocol: 'TROJAN',
    address,
    port,
    password,
    network: type,
    security: 'tls',
    sni,
    rawLink: link,
    countryCode: detectCountryCode(name),
  };
}
