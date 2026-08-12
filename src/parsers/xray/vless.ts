import { VpnServer } from '../../types/vpn';
import { detectCountryCode } from '../utils';

export function parseVless(link: string): VpnServer {
  const url = new URL(link);
  const uuid = url.username;
  const address = url.hostname;
  const port = parseInt(url.port || '443', 10);
  const name = decodeURIComponent(url.hash.replace('#', '')) || `VLESS ${address}`;

  const params = url.searchParams;
  const type = params.get('type') || 'tcp';
  const security = params.get('security') || 'none';
  const sni = params.get('sni') || undefined;
  const pbk = params.get('pbk') || undefined;
  const sid = params.get('sid') || undefined;
  const fp = params.get('fp') || undefined;
  const path = params.get('path') || undefined;

  return {
    id: `vless_${address}_${port}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    protocol: 'VLESS',
    address,
    port,
    uuid,
    network: type,
    security,
    sni,
    pbk,
    sid,
    fp,
    path,
    rawLink: link,
    countryCode: detectCountryCode(name),
  };
}
