import { VpnServer } from '../../types/vpn';
import { detectCountryCode } from '../utils';

export function parseWireGuard(link: string): VpnServer {
  const cleanLink = link.replace('wireguard://', 'http://').replace('wg://', 'http://');
  const url = new URL(cleanLink);
  const address = url.hostname;
  const port = parseInt(url.port || '51820', 10);
  const name = decodeURIComponent(url.hash.replace('#', '')) || `WireGuard ${address}`;

  const params = url.searchParams;
  const privateKey = url.username || params.get('private_key') || undefined;
  const publicKey = params.get('public_key') || undefined;

  return {
    id: `wg_${address}_${port}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    protocol: 'WIREGUARD',
    address,
    port,
    uuid: privateKey,
    pbk: publicKey,
    rawLink: link,
    countryCode: detectCountryCode(name),
  };
}
