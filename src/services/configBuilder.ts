import { VpnServer, AppSettings, CoreType } from '../types/vpn';

// Full 47 IP Checkers matched with Spectre Panel backend specs (backend/database/crud/routing.py)
const IP_CHECK_DOMAINS = [
  "api.ipify.org", "ipify.org", "checkip.amazonaws.com", "ifconfig.me", "ifconfig.co", "ifconfig.io",
  "telega.me", "geosite:2ip", "2ip.ru", "2ip.io", "2ip.ua", "2ip.me",
  "myip.ru", "myip.com", "icanhazip.com", "wtfismyip.com", "ip.sb",
  "ipapi.co", "ip-api.com", "ipapi.com", "db-ip.com", "whoer.net",
  "ipwhois.io", "ipwho.is", "ipaddress.my", "ipaddress.com", "check-host.net",
  "browserleaks.com", "ip2location.com", "ip2location.io", "showmyip.com",
  "whatsmyip.org", "whatismyip.com", "whatsmyipaddress.com", "whatismyipaddress.com",
  "dnsleaktest.com", "ipleak.net", "ip.me", "ip.cn", "ip138.com",
  "ident.me", "curlmyip.org", "eth0.me", "myexternalip.com", "ip.nf",
  "trackip.net", "checkip.dyndns.org"
];

export class ConfigBuilder {
  /**
   * Validate core and protocol compatibility without silent substitutions
   */
  static validateCompatibility(server: VpnServer, core: CoreType): { valid: boolean; reason?: string } {
    if (core === 'hysteria' && server.protocol !== 'HYSTERIA2') {
      return {
        valid: false,
        reason: `Ядро Hysteria 2 не поддерживает протокол ${server.protocol}. Пожалуйста, переключите ядро на Sing-box или Xray в Настройках.`
      };
    }

    if (core === 'xray') {
      if (server.protocol === 'HYSTERIA2') {
        return {
          valid: false,
          reason: `Ядро Xray-core не поддерживает протокол Hysteria 2. Пожалуйста, переключите ядро на Hysteria 2 или Sing-box.`
        };
      }
      if (server.protocol === 'TUIC' || server.protocol === 'WIREGUARD') {
        return {
          valid: false,
          reason: `Ядро Xray-core не поддерживает протокол ${server.protocol}. Пожалуйста, переключите ядро на Sing-box.`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Main entry point: Compile server configuration for the target core
   */
  static buildConfig(server: VpnServer, settings: AppSettings): { core: CoreType; configJson: string } {
    const targetCore: CoreType = settings.activeCore || 'singbox';
    let configObject: object;

    switch (targetCore) {
      case 'singbox':
        configObject = this.buildSingboxConfig(server, settings);
        break;
      case 'hysteria':
        configObject = this.buildHysteria2Config(server, settings);
        break;
      case 'xray':
      default:
        configObject = this.buildXrayConfig(server, settings);
        break;
    }

    return {
      core: targetCore,
      configJson: JSON.stringify(configObject, null, 2),
    };
  }

  /**
   * Build JSON config for Sing-box Core with Routing Rules
   */
  static buildSingboxConfig(server: VpnServer, settings: AppSettings): object {
    const outbound = this.buildSingboxOutbound(server);
    const routeRules = this.buildSingboxRouteRules(settings);
    const lvl = settings.logLevel || 'info';

    return {
      log: {
        disabled: false,
        level: lvl === 'warn' ? 'warn' : (lvl === 'error' ? 'error' : (lvl === 'debug' ? 'debug' : 'info')),
        timestamp: true
      },
      dns: {
        servers: [
          { tag: 'dns-remote', address: settings.dnsServer || 'https://1.1.1.1/dns-query' },
          { tag: 'dns-direct', address: '8.8.8.8', detours: ['direct'] }
        ]
      },
      inbounds: [
        {
          type: 'socks',
          tag: 'socks-in',
          listen: '127.0.0.1',
          listen_port: settings.socksPort || 10808
        },
        {
          type: 'http',
          tag: 'http-in',
          listen: '127.0.0.1',
          listen_port: settings.httpPort || 10809
        },
        ...(settings.tunMode ? [{
          type: 'tun',
          tag: 'tun-in',
          interface_name: 'x-pc-wintun',
          inet4_address: '172.19.0.1/30',
          auto_route: true,
          strict_route: true,
          stack: 'system'
        }] : [])
      ],
      outbounds: [
        outbound,
        { type: 'direct', tag: 'direct' },
        { type: 'block', tag: 'block' }
      ],
      route: {
        auto_detect_interface: true,
        rules: routeRules
      }
    };
  }

  /**
   * Build JSON config for Xray-core with Routing Rules
   */
  static buildXrayConfig(server: VpnServer, settings: AppSettings): object {
    const outbound = this.buildXrayOutbound(server);
    const xrayRules = this.buildXrayRouteRules(settings);
    const lvl = settings.logLevel || 'info';
    const xrayLevel = lvl === 'warn' ? 'warning' : (lvl === 'error' ? 'error' : (lvl === 'debug' ? 'debug' : 'info'));

    return {
      log: {
        loglevel: xrayLevel
      },
      inbounds: [
        {
          tag: 'socks-in',
          port: settings.socksPort || 10808,
          listen: '127.0.0.1',
          protocol: 'socks',
          settings: { auth: 'noauth', udp: true }
        },
        {
          tag: 'http-in',
          port: settings.httpPort || 10809,
          listen: '127.0.0.1',
          protocol: 'http'
        }
      ],
      outbounds: [
        outbound,
        { protocol: 'freedom', tag: 'direct' },
        { protocol: 'blackhole', tag: 'block' }
      ],
      routing: {
        domainStrategy: 'IPIfNonMatch',
        rules: xrayRules
      }
    };
  }

  /**
   * Build JSON config for Hysteria 2 Core
   */
  static buildHysteria2Config(server: VpnServer, settings: AppSettings): object {
    const lvl = settings.logLevel || 'info';
    return {
      server: `${server.address}:${server.port}`,
      auth: server.password || '',
      log: {
        level: lvl
      },
      tls: {
        sni: server.sni || server.address,
        insecure: false
      },
      ...(server.obfs ? { obfs: { type: 'salamander', salamander: { password: server.obfs } } } : {}),
      socks5: {
        listen: `127.0.0.1:${settings.socksPort || 10808}`
      },
      http: {
        listen: `127.0.0.1:${settings.httpPort || 10809}`
      }
    };
  }

  // --- Sing-box Routing Rules Builder ---

  private static buildSingboxRouteRules(settings: AppSettings): any[] {
    const rules: any[] = [
      { dns_query: true, detour: 'dns-remote' },
      { ip_is_private: true, detour: 'direct' }
    ];

    // Apply Quick Security Rules (BitTorrent, Ads, CN, RU, US, IP Services)
    if (settings.quickSecurityRules) {
      for (const qr of settings.quickSecurityRules) {
        if (!qr.enabled) continue;
        const detour = qr.action === 'BLOCKED' ? 'block' : (qr.action === 'DIRECT' ? 'direct' : 'proxy');

        if (qr.id === 'bt') {
          rules.push({ protocol: 'bittorrent', detour });
          rules.push({ domain: ['torrent', 'tracker'], detour });
        } else if (qr.id === 'ads') {
          rules.push({ geosite: ['category-ads-all'], detour });
        } else if (qr.id === 'cn') {
          rules.push({ geosite: ['cn'], detour });
          rules.push({ geoip: ['cn'], detour });
        } else if (qr.id === 'ru') {
          rules.push({ geosite: ['ru'], detour });
          rules.push({ geoip: ['ru'], detour });
        } else if (qr.id === 'us') {
          rules.push({ geosite: ['us'], detour });
          rules.push({ geoip: ['us'], detour });
        } else if (qr.id === 'ip_service') {
          rules.push({ domain: IP_CHECK_DOMAINS, detour });
        }
      }
    }

    // Apply Custom Table Rules
    if (settings.customRouteRules) {
      for (const cr of settings.customRouteRules) {
        if (!cr.enabled) continue;
        const detour = cr.action === 'BLOCKED' ? 'block' : (cr.action === 'DIRECT' ? 'direct' : 'proxy');

        const ruleObj: any = { detour };
        if (cr.domains && cr.domains.length > 0) ruleObj.domain = cr.domains;
        if (cr.ips && cr.ips.length > 0) ruleObj.ip_cidr = cr.ips;
        rules.push(ruleObj);
      }
    }

    return rules;
  }

  // --- Xray Routing Rules Builder ---

  private static buildXrayRouteRules(settings: AppSettings): any[] {
    const rules: any[] = [
      { type: 'field', ip: ['geoip:private'], outboundTag: 'direct' }
    ];

    // Apply Quick Security Rules
    if (settings.quickSecurityRules) {
      for (const qr of settings.quickSecurityRules) {
        if (!qr.enabled) continue;
        const outboundTag = qr.action === 'BLOCKED' ? 'block' : (qr.action === 'DIRECT' ? 'direct' : 'proxy');

        if (qr.id === 'bt') {
          rules.push({ type: 'field', protocol: ['bittorrent'], outboundTag });
          rules.push({ type: 'field', domain: ['torrent', 'tracker'], outboundTag });
        } else if (qr.id === 'ads') {
          rules.push({ type: 'field', domain: ['geosite:category-ads-all'], outboundTag });
        } else if (qr.id === 'cn') {
          rules.push({ type: 'field', domain: ['geosite:cn'], outboundTag });
          rules.push({ type: 'field', ip: ['geoip:cn'], outboundTag });
        } else if (qr.id === 'ru') {
          rules.push({ type: 'field', domain: ['geosite:ru'], outboundTag });
          rules.push({ type: 'field', ip: ['geoip:ru'], outboundTag });
        } else if (qr.id === 'us') {
          rules.push({ type: 'field', domain: ['geosite:us'], outboundTag });
          rules.push({ type: 'field', ip: ['geoip:us'], outboundTag });
        } else if (qr.id === 'ip_service') {
          rules.push({ type: 'field', domain: IP_CHECK_DOMAINS, outboundTag });
        }
      }
    }

    // Apply Custom Table Rules
    if (settings.customRouteRules) {
      for (const cr of settings.customRouteRules) {
        if (!cr.enabled) continue;
        const outboundTag = cr.action === 'BLOCKED' ? 'block' : (cr.action === 'DIRECT' ? 'direct' : 'proxy');

        const ruleObj: any = { type: 'field', outboundTag };
        if (cr.domains && cr.domains.length > 0) ruleObj.domain = cr.domains;
        if (cr.ips && cr.ips.length > 0) ruleObj.ip = cr.ips;
        rules.push(ruleObj);
      }
    }

    return rules;
  }

  // --- Sing-box Outbound Compiler ---

  private static buildSingboxOutbound(server: VpnServer): any {
    switch (server.protocol) {
      case 'VLESS':
        return {
          type: 'vless',
          tag: 'proxy',
          server: server.address,
          server_port: server.port,
          uuid: server.uuid,
          flow: 'xtls-rprx-vision',
          tls: {
            enabled: server.security === 'tls' || server.security === 'reality',
            server_name: server.sni || server.address,
            reality: server.security === 'reality' ? {
              enabled: true,
              public_key: server.pbk,
              short_id: server.sid
            } : undefined
          }
        };

      case 'VMESS':
        return {
          type: 'vmess',
          tag: 'proxy',
          server: server.address,
          server_port: server.port,
          uuid: server.uuid,
          security: 'auto',
          transport: server.network ? { type: server.network, path: server.path } : undefined
        };

      case 'TROJAN':
        return {
          type: 'trojan',
          tag: 'proxy',
          server: server.address,
          server_port: server.port,
          password: server.password,
          tls: {
            enabled: true,
            server_name: server.sni || server.address
          }
        };

      case 'SHADOWSOCKS':
        return {
          type: 'shadowsocks',
          tag: 'proxy',
          server: server.address,
          server_port: server.port,
          method: 'aes-256-gcm',
          password: server.password
        };

      case 'HYSTERIA2':
        return {
          type: 'hysteria2',
          tag: 'proxy',
          server: server.address,
          server_port: server.port,
          password: server.password,
          tls: {
            enabled: true,
            server_name: server.sni || server.address
          },
          obfs: server.obfs ? { type: 'salamander', password: server.obfs } : undefined
        };

      case 'TUIC':
        return {
          type: 'tuic',
          tag: 'proxy',
          server: server.address,
          server_port: server.port,
          uuid: server.uuid,
          password: server.password,
          congestion_control: 'bbr',
          tls: {
            enabled: true,
            server_name: server.sni || server.address,
            alpn: server.alpn ? [server.alpn] : ['h3']
          }
        };

      case 'WIREGUARD':
        return {
          type: 'wireguard',
          tag: 'proxy',
          server: server.address,
          server_port: server.port,
          private_key: server.uuid,
          peer_public_key: server.pbk,
          local_address: ['10.0.0.2/32']
        };

      case 'SOCKS5':
      default:
        return {
          type: 'socks',
          tag: 'proxy',
          server: server.address,
          server_port: server.port,
          username: server.uuid || undefined,
          password: server.password || undefined
        };
    }
  }

  // --- Xray Outbound Compiler ---

  private static buildXrayOutbound(server: VpnServer): any {
    switch (server.protocol) {
      case 'VMESS':
        return {
          tag: 'proxy',
          protocol: 'vmess',
          settings: {
            vnext: [
              {
                address: server.address,
                port: server.port,
                users: [{ id: server.uuid || '', alterId: 0, security: 'auto' }]
              }
            ]
          },
          streamSettings: {
            network: server.network || 'tcp',
            security: server.security || 'none'
          }
        };

      case 'TROJAN':
        return {
          tag: 'proxy',
          protocol: 'trojan',
          settings: {
            servers: [
              {
                address: server.address,
                port: server.port,
                password: server.password || ''
              }
            ]
          },
          streamSettings: {
            security: 'tls',
            tlsSettings: {
              serverName: server.sni || server.address
            }
          }
        };

      case 'SHADOWSOCKS':
        return {
          tag: 'proxy',
          protocol: 'shadowsocks',
          settings: {
            servers: [
              {
                address: server.address,
                port: server.port,
                method: 'aes-256-gcm',
                password: server.password || ''
              }
            ]
          }
        };

      case 'SOCKS5':
        return {
          tag: 'proxy',
          protocol: 'socks',
          settings: {
            servers: [
              {
                address: server.address,
                port: server.port,
                users: server.uuid && server.password ? [{ user: server.uuid, pass: server.password }] : []
              }
            ]
          }
        };

      case 'VLESS':
      default:
        return {
          tag: 'proxy',
          protocol: 'vless',
          settings: {
            vnext: [
              {
                address: server.address,
                port: server.port,
                users: [{ id: server.uuid || '', encryption: 'none' }]
              }
            ]
          },
          streamSettings: {
            network: server.network || 'tcp',
            security: server.security || 'none',
            realitySettings: server.security === 'reality' ? {
              publicKey: server.pbk,
              shortId: server.sid,
              serverName: server.sni,
              fingerprint: server.fp || 'chrome'
            } : undefined
          }
        };
    }
  }
}
