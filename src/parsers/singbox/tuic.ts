import { VpnServer } from '../../types/vpn';
import { detectCountryCode } from '../utils';

export function parseTuic(link: string): VpnServer {
  const url = new URL(link);
  const uuid = url.username;
  const password = url.password;
  const address = url.hostname;
  const port = parseInt(url.port || '8443', 10);
  const name = decodeURIComponent(url.hash.replace('#', '')) || `TUIC ${address}`;

  const params = url.searchParams;
  const sni = params.get('sni') || undefined;
  const alpn = params.get('alpn') || undefined;

  return {
    id: `tuic_${address}_${port}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    protocol: 'TUIC',
    address,
    port,
    uuid,
    password,
    sni,
    alpn,
    rawLink: link,
    countryCode: detectCountryCode(name),
  };
}
