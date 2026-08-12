import { VpnServer, AppSettings, CoreType } from '../types/vpn';

// Full 47 IP Checkers matched with Spectre Panel backend specs (backend/database/crud/routing.py)
const IP_CHECK_DOMAINS = [
  "api.ipify.org", "ipify.org", "checkip.amazonaws.com", "ifconfig.me", "ifconfig.co", "ifconfig.io",
  "telega.me", "2ip.ru", "2ip.io", "2ip.ua", "2ip.me",
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
        output: '',
        timestamp: true
      },
      dns: {
        servers: [
          { tag: 'dns-remote', address: settings.dnsServer || 'https://1.1.1.1/dns-query' },
          { tag: 'dns-direct', address: '8.8.8.8', detour: 'direct' }
        ]
      },
      inbounds: [
        {
          type: 'socks',
          tag: 'socks-in',
          listen: '127.0.0.1',
          listen_port: settings.socksPort || 10808,
          sniff: true,
          sniff_override_destination: true
        },
        {
          type: 'http',
          tag: 'http-in',
          listen: '127.0.0.1',
          listen_port: settings.httpPort || 10809,
          sniff: true,
          sniff_override_destination: true
        },
        ...(settings.tunMode ? [{
          type: 'tun',
          tag: 'tun-in',
          interface_name: 'sentinel-tun',
          inet4_address: ['172.19.0.1/30'],
          auto_route: true,
          strict_route: true,
          stack: 'mixed',
          sniff: true,
          sniff_override_destination: true
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
        access: '',
        error: '',
        loglevel: xrayLevel
      },
      inbounds: [
        {
          tag: 'socks-in',
          port: settings.socksPort || 10808,
          listen: '127.0.0.1',
          protocol: 'socks',
          settings: { auth: 'noauth', udp: true },
          sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic'], routeOnly: true }
        },
        {
          tag: 'http-in',
          port: settings.httpPort || 10809,
          listen: '127.0.0.1',
          protocol: 'http',
          sniffing: { enabled: true, destOverride: ['http', 'tls', 'quic'], routeOnly: true }
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
      { ip_cidr: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'], outbound: 'direct' }
    ];

    // Apply Quick Security Rules (BitTorrent, Ads, CN, RU, US, IP Services)
    if (settings.quickSecurityRules) {
      for (const qr of settings.quickSecurityRules) {
        if (!qr.enabled) continue;
        const outbound = qr.action === 'BLOCKED' ? 'block' : (qr.action === 'DIRECT' ? 'direct' : 'proxy');

        if (qr.id === 'bt') {
          rules.push({ protocol: ['bittorrent'], outbound });
          rules.push({ domain_keyword: ['torrent', 'tracker'], outbound });
        } else if (qr.id === 'ads') {
          rules.push({ domain_keyword: ['ad', 'ads', 'tracker', 'telemetry', 'analytics'], outbound });
        } else if (qr.id === 'cn') {
          rules.push({ domain_suffix: ['.cn'], outbound });
        } else if (qr.id === 'ru') {
          rules.push({ domain_suffix: ['.ru', '.su', '.xn--p1ai'], outbound });
        } else if (qr.id === 'us') {
          rules.push({ domain_suffix: ['.gov', '.us', '.mil'], outbound });
        } else if (qr.id === 'ip_service') {
          rules.push({ domain_suffix: IP_CHECK_DOMAINS, outbound });
          rules.push({ domain_keyword: ['ipify', '2ip', 'ipwhois', 'icanhazip', 'ifconfig', 'checkip', 'browserleaks', 'whoer', 'ipleak'], outbound });
          rules.push({ ip_cidr: ['1.1.1.1/32', '1.0.0.1/32'], outbound });
        }
      }
    }

    // Apply Custom Table Rules
    if (settings.customRouteRules) {
      for (const cr of settings.customRouteRules) {
        if (!cr.enabled) continue;
        const outbound = cr.action === 'BLOCKED' ? 'block' : (cr.action === 'DIRECT' ? 'direct' : 'proxy');

        const rawDomains = (cr.domains || [])
          .map(d => d.replace(/^(domain:|geosite:|keyword:)/, ''))
          .filter(Boolean);
        
        const rawIps = (cr.ips || [])
          .map(i => i.replace(/^geoip:/, ''))
          .filter(i => i.includes('.') || i.includes(':') || i.includes('/'));

        if (rawDomains.length > 0) {
          rules.push({ domain_suffix: rawDomains, outbound });
        }
        if (rawIps.length > 0) {
          rules.push({ ip_cidr: rawIps, outbound });
        }
      }
    }

    return rules;
  }

  // --- Xray Routing Rules Builder ---

  private static buildXrayRouteRules(settings: AppSettings): any[] {
    const rules: any[] = [
      { type: 'field', ip: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'], outboundTag: 'direct' }
    ];

    // Apply Quick Security Rules
    if (settings.quickSecurityRules) {
      for (const qr of settings.quickSecurityRules) {
        if (!qr.enabled) continue;
        const outboundTag = qr.action === 'BLOCKED' ? 'block' : (qr.action === 'DIRECT' ? 'direct' : 'proxy');

        if (qr.id === 'bt') {
          rules.push({ type: 'field', protocol: ['bittorrent'], outboundTag });
          rules.push({ type: 'field', domain: ['keyword:torrent', 'keyword:tracker'], outboundTag });
        } else if (qr.id === 'ads') {
          rules.push({ type: 'field', domain: ['keyword:ad', 'keyword:ads', 'keyword:tracker', 'keyword:telemetry', 'keyword:analytics'], outboundTag });
        } else if (qr.id === 'cn') {
          rules.push({ type: 'field', domain: ['domain:.cn'], outboundTag });
        } else if (qr.id === 'ru') {
          rules.push({ type: 'field', domain: ['domain:.ru', 'domain:.su', 'domain:.xn--p1ai'], outboundTag });
        } else if (qr.id === 'us') {
          rules.push({ type: 'field', domain: ['domain:.gov', 'domain:.us', 'domain:.mil'], outboundTag });
        } else if (qr.id === 'ip_service') {
          rules.push({ type: 'field', domain: IP_CHECK_DOMAINS.map(d => `domain:${d}`), outboundTag });
          rules.push({ type: 'field', domain: ['keyword:ipify', 'keyword:2ip', 'keyword:ipwhois', 'keyword:icanhazip', 'keyword:ifconfig', 'keyword:checkip', 'keyword:browserleaks', 'keyword:whoer', 'keyword:ipleak'], outboundTag });
          rules.push({ type: 'field', ip: ['1.1.1.1/32', '1.0.0.1/32'], outboundTag });
        }
      }
    }

    // Apply Custom Table Rules
    if (settings.customRouteRules) {
      for (const cr of settings.customRouteRules) {
        if (!cr.enabled) continue;
        const outboundTag = cr.action === 'BLOCKED' ? 'block' : (cr.action === 'DIRECT' ? 'direct' : 'proxy');

        const rawDomains = (cr.domains || [])
          .map(d => {
            if (d.startsWith('geosite:')) {
              const tag = d.replace(/^geosite:/, '').toLowerCase();
              if (tag === 'ru') return ['domain:.ru', 'domain:.su', 'domain:.xn--p1ai'];
              if (tag === 'cn') return ['domain:.cn'];
              if (tag === 'us') return ['domain:.us', 'domain:.gov'];
              return [`domain:.${tag}`];
            }
            return [d];
          })
          .flat()
          .filter(Boolean);

        const rawIps = (cr.ips || [])
          .map(i => i.replace(/^geoip:/, ''))
          .filter(i => i.includes('.') || i.includes(':') || i.includes('/'));

        if (rawDomains.length > 0) {
          rules.push({ type: 'field', domain: rawDomains, outboundTag });
        }
        if (rawIps.length > 0) {
          rules.push({ type: 'field', ip: rawIps, outboundTag });
        }
      }
    }

    return rules;
  }

  // --- Sing-box Outbound Compiler ---

  private static buildSingboxOutbound(server: VpnServer): any {
    switch (server.protocol) {
      case 'VLESS': {
        const isTls = server.security === 'tls' || server.security === 'reality';
        return {
          type: 'vless',
          tag: 'proxy',
          server: server.address,
          server_port: server.port,
          uuid: server.uuid || '',
          ...(isTls ? { flow: 'xtls-rprx-vision' } : {}),
          tls: isTls ? {
            enabled: true,
            server_name: server.sni || server.address,
            utls: {
              enabled: true,
              fingerprint: server.fp || 'chrome'
            },
            ...(server.security === 'reality' ? {
              reality: {
                enabled: true,
                public_key: server.pbk || '',
                short_id: server.sid || ''
              }
            } : {})
          } : undefined
        };
      }

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
