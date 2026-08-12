import { VpnServer } from '../../types/vpn';
import { detectCountryCode } from '../utils';

export function parseShadowsocks(link: string): VpnServer {
  // Supports SIP002 (ss://base64@host:port#name) and legacy formats
  const urlStr = link.replace('ss://', 'http://');
  const url = new URL(urlStr);
  const address = url.hostname;
  const port = parseInt(url.port || '8388', 10);
  const name = decodeURIComponent(url.hash.replace('#', '')) || `Shadowsocks ${address}`;

  let password = '';
  if (url.username) {
    try {
      password = atob(url.username);
    } catch {
      password = url.username;
    }
  }

  return {
    id: `ss_${address}_${port}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    protocol: 'SHADOWSOCKS',
    address,
    port,
    password,
    rawLink: link,
    countryCode: detectCountryCode(name),
  };
}
