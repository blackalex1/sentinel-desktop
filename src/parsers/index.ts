import { VpnServer } from '../types/vpn';
import { parseVless } from './xray/vless';
import { parseVmess } from './xray/vmess';
import { parseTrojan } from './xray/trojan';
import { parseShadowsocks } from './xray/shadowsocks';
import { parseTuic } from './singbox/tuic';
import { parseWireGuard } from './singbox/wireguard';
import { parseHysteria2 } from './hysteria/hysteria2';
import { parseSocks } from './common/socks';
import { parseHttp } from './common/http';

export class ProxyParser {
  /**
   * Parse single URI link for any supported core protocol
   */
  static parseLink(link: string): VpnServer | null {
    const trimmed = link.trim();
    if (!trimmed) return null;

    try {
      if (trimmed.startsWith('vless://')) {
        return parseVless(trimmed);
      } else if (trimmed.startsWith('vmess://')) {
        return parseVmess(trimmed);
      } else if (trimmed.startsWith('trojan://')) {
        return parseTrojan(trimmed);
      } else if (trimmed.startsWith('ss://')) {
        return parseShadowsocks(trimmed);
      } else if (trimmed.startsWith('hy2://') || trimmed.startsWith('hysteria2://')) {
        return parseHysteria2(trimmed);
      } else if (trimmed.startsWith('socks5://') || trimmed.startsWith('socks://')) {
        return parseSocks(trimmed);
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return parseHttp(trimmed);
      } else if (trimmed.startsWith('tuic://')) {
        return parseTuic(trimmed);
      } else if (trimmed.startsWith('wireguard://') || trimmed.startsWith('wg://')) {
        return parseWireGuard(trimmed);
      }
    } catch (err) {
      console.error('Failed to parse proxy link:', link, err);
    }
    return null;
  }

  /**
   * Parse batch input (multi-line text or base64 subscription payload)
   */
  static parseSubscription(payload: string): VpnServer[] {
    let text = payload.trim();

    // Check if it's base64 encoded
    if (!text.includes('://') && !text.includes('\n')) {
      try {
        text = atob(text);
      } catch {
        // Not base64, continue as plain text
      }
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const servers: VpnServer[] = [];

    for (const line of lines) {
      const server = this.parseLink(line);
      if (server) {
        servers.push(server);
      }
    }

    return servers;
  }
}
