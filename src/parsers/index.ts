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

  /**
   * Convert VpnServer object back to standard URI link
   */
  static generateLink(server: VpnServer): string {
    if (server.rawLink && server.rawLink.includes('://')) {
      return server.rawLink;
    }

    const name = encodeURIComponent(server.name || 'Sentinel Server');

    switch (server.protocol) {
      case 'VLESS': {
        const params = new URLSearchParams();
        if (server.network) params.set('type', server.network);
        if (server.security) params.set('security', server.security);
        if (server.pbk) params.set('pbk', server.pbk);
        if (server.sid) params.set('sid', server.sid);
        if (server.fp) params.set('fp', server.fp);
        if (server.sni) params.set('sni', server.sni);
        if (server.flow) params.set('flow', server.flow);
        if (server.path) params.set('path', server.path);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `vless://${server.uuid || '00000000-0000-0000-0000-000000000000'}@${server.address}:${server.port}${query}#${name}`;
      }
      case 'VMESS': {
        const vmessObj = {
          v: '2',
          ps: server.name,
          add: server.address,
          port: server.port,
          id: server.uuid,
          aid: 0,
          scy: 'auto',
          net: server.network || 'tcp',
          type: 'none',
          host: server.sni || '',
          path: server.path || '',
          tls: server.security === 'tls' ? 'tls' : '',
          sni: server.sni || '',
          alpn: server.alpn || ''
        };
        try {
          return `vmess://${btoa(unescape(encodeURIComponent(JSON.stringify(vmessObj))))}`;
        } catch {
          return `vmess://${btoa(JSON.stringify(vmessObj))}`;
        }
      }
      case 'TROJAN': {
        const params = new URLSearchParams();
        if (server.security) params.set('security', server.security);
        if (server.sni) params.set('sni', server.sni);
        if (server.network) params.set('type', server.network);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `trojan://${server.password || server.uuid || ''}@${server.address}:${server.port}${query}#${name}`;
      }
      case 'HYSTERIA2': {
        const params = new URLSearchParams();
        if (server.sni) params.set('sni', server.sni);
        if (server.obfs) params.set('obfs', server.obfs);
        const query = params.toString() ? `?${params.toString()}` : '';
        return `hy2://${server.password || server.uuid || ''}@${server.address}:${server.port}${query}#${name}`;
      }
      case 'SHADOWSOCKS': {
        try {
          const userinfo = btoa(`${server.security || 'aes-256-gcm'}:${server.password || ''}`);
          return `ss://${userinfo}@${server.address}:${server.port}#${name}`;
        } catch {
          return `ss://${server.address}:${server.port}#${name}`;
        }
      }
      case 'SOCKS5': {
        const user = server.username || server.uuid;
        const pass = server.password;
        const creds = user && pass
          ? `${user}:${pass}@`
          : user
          ? `${user}@`
          : '';
        return `socks5://${creds}${server.address}:${server.port}#${name}`;
      }
      case 'HTTP': {
        const user = server.username || server.uuid;
        const pass = server.password;
        const creds = user && pass
          ? `${user}:${pass}@`
          : user
          ? `${user}@`
          : '';
        return `http://${creds}${server.address}:${server.port}#${name}`;
      }
      default:
        return `${server.protocol.toLowerCase()}://${server.address}:${server.port}#${name}`;
    }
  }
}
