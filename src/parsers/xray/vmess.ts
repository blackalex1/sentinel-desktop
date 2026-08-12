import { VpnServer } from '../../types/vpn';
import { detectCountryCode } from '../utils';

export function parseVmess(link: string): VpnServer {
  const rawB64 = link.replace('vmess://', '');
  const jsonStr = atob(rawB64);
  const config = JSON.parse(jsonStr);

  const address = config.add;
  const port = parseInt(config.port, 10);
  const name = config.ps || `VMess ${address}`;

  return {
    id: `vmess_${address}_${port}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    protocol: 'VMESS',
    address,
    port,
    uuid: config.id,
    network: config.net || 'tcp',
    path: config.path || undefined,
    security: config.tls ? 'tls' : 'none',
    sni: config.sni || config.host || undefined,
    rawLink: link,
    countryCode: detectCountryCode(name),
  };
}
