import { TauriBridge } from './tauriBridge';
import { VpnServer } from '../types/vpn';

export interface PairRequestResult {
  success: boolean;
  pin?: string;
  proxyType?: 'SOCKS5' | 'HTTP';
  ip?: string;
  port?: number;
  username?: string;
  password?: string;
  message?: string;
  server?: VpnServer;
}

export class SentinelPairingService {
  /**
   * Send pairing request to Android x-prox gateway IP (auto-detects real default gateways e.g., 10.165.156.227)
   */
  static async requestPairing(customGatewayIp?: string, providedPin?: string): Promise<PairRequestResult> {
    const pin = providedPin || Math.floor(1000 + Math.random() * 9000).toString();
    const pcName = typeof window !== 'undefined' ? (window.navigator.userAgent.includes('Windows') ? 'Windows 11 PC' : 'PC') : 'Desktop PC';

    // 1. Try Rust native TCP socket pairing first (100% immune to CORS, instant concurrent probing)
    const nativeResult = await TauriBridge.requestPhonePairing(customGatewayIp, pin);
    if (nativeResult) {
      console.log('[Sentinel Pairing] Native Rust pairing returned:', nativeResult);
      const serverIp = (nativeResult.ip || customGatewayIp || '').trim();
      const serverPort = nativeResult.port || 10808;
      const proxyType = ((nativeResult.proxyType as any) || 'SOCKS5').toUpperCase() as 'SOCKS5' | 'HTTP';
      const username = nativeResult.username?.trim();
      const password = nativeResult.password?.trim();

      const server: VpnServer = {
        id: `hotspot_${serverIp}_${serverPort}`,
        name: `Sentinel Hotspot (${serverIp})`,
        protocol: proxyType,
        address: serverIp,
        port: serverPort,
        username: username || undefined,
        password: password || undefined,
        isHotspot: true,
        countryCode: 'LAN',
        rawLink: `${proxyType.toLowerCase()}://${username && password ? `${username}:${password}@` : ''}${serverIp}:${serverPort}#Sentinel%20Hotspot`,
      };

      return {
        success: nativeResult.success,
        pin: nativeResult.pin || pin,
        proxyType,
        ip: serverIp,
        port: serverPort,
        username: username || undefined,
        password: password || undefined,
        message: nativeResult.message || (nativeResult.success ? `Сопряжение подтверждено на смартфоне (${serverIp})!` : 'Ошибка сопряжения'),
        server: nativeResult.success ? server : undefined,
      };
    }

    // 2. Web fallback: Auto-detect real default gateways from Windows OS
    const detectedGateways = await TauriBridge.getDefaultGateways();
    console.log('[Sentinel Pairing] Detected OS Default Gateways:', detectedGateways);

    const targetIps: string[] = [];
    if (customGatewayIp && customGatewayIp.trim().length > 0) {
      targetIps.push(customGatewayIp.trim());
    }
    for (const gw of detectedGateways) {
      if (!targetIps.includes(gw)) {
        targetIps.push(gw);
      }
    }

    const portsToTry = [18080, 18081, 18082, 19080, 19081];
    console.log('[Sentinel Pairing] Dynamically discovered gateway candidate IPs:', targetIps);

    // Fast parallel ping discovery to find active pairing server endpoint without 30s hangs
    let activeEndpoint: { ip: string; port: number } | null = null;
    const probePromises: Promise<{ ip: string; port: number } | null>[] = [];

    for (const ip of targetIps) {
      if (!ip) continue;
      for (const port of portsToTry) {
        probePromises.push(
          (async () => {
            try {
              const probeCtrl = new AbortController();
              const probeTimer = setTimeout(() => probeCtrl.abort(), 1200);
              const r = await fetch(`http://${ip}:${port}/pair/ping`, {
                method: 'GET',
                signal: probeCtrl.signal,
              });
              clearTimeout(probeTimer);
              if (r.ok) return { ip, port };
            } catch {}
            return null;
          })()
        );
      }
    }

    const probeResults = await Promise.all(probePromises);
    activeEndpoint = probeResults.find((res): res is { ip: string; port: number } => res !== null) || null;

    // If fast ping found an endpoint, target it directly. Otherwise, try candidate list.
    const candidatesToTry = activeEndpoint
      ? [activeEndpoint]
      : targetIps.flatMap(ip => portsToTry.map(port => ({ ip, port })));

    for (const { ip, port } of candidatesToTry) {
      try {
        console.log(`[Sentinel Pairing] Sending pair request to http://${ip}:${port}/pair/request with PIN: ${pin}`);
        const controller = new AbortController();
        // Allow 30 seconds for user to confirm on their phone screen
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`http://${ip}:${port}/pair/request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientName: pcName,
            pinCode: pin,
            timestamp: Date.now(),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data && data.success) {
            const serverIp = data.ip || ip;
            const serverPort = data.port || data.socksPort || 10808;
            const proxyType = ((data.proxyType as any) || 'SOCKS5').toUpperCase() as 'SOCKS5' | 'HTTP';
            const username = data.username?.trim();
            const password = data.password?.trim();

            const server: VpnServer = {
              id: `hotspot_${serverIp}_${serverPort}`,
              name: `Sentinel Hotspot (${serverIp})`,
              protocol: proxyType,
              address: serverIp,
              port: serverPort,
              username: username || undefined,
              password: password || undefined,
              isHotspot: true,
              countryCode: 'LAN',
              rawLink: `${proxyType.toLowerCase()}://${username && password ? `${username}:${password}@` : ''}${serverIp}:${serverPort}#Sentinel%20Hotspot`,
            };

            return {
              success: true,
              pin,
              proxyType,
              ip: serverIp,
              port: serverPort,
              username: username || undefined,
              password: password || undefined,
              message: `Сопряжение подтверждено на смартфоне (${serverIp})!`,
              server,
            };
          }
        } else if (response.status === 403) {
          const data = await response.json().catch(() => ({}));
          return {
            success: false,
            message: data.error || 'Запрос сопряжения был отклонен на смартфоне.',
          };
        }
      } catch (err: any) {
        // If port/IP is unreachable, continue probe
      }
    }

    return {
      success: false,
      message: `Не удалось связаться со смартфоном (проверены адреса: ${targetIps.join(', ')}). Убедитесь, что VPN в x-prox активен.`,
    };
  }

  /**
   * Directly query active phone proxy config without PIN dialog
   */
  static async fetchLiveConfig(customGatewayIp?: string): Promise<PairRequestResult> {
    const candidatePorts = [18080, 18081, 18082, 19080, 19081];
    const targetIps: string[] = [];

    if (customGatewayIp && customGatewayIp.trim()) {
      targetIps.push(customGatewayIp.trim());
    } else {
      const gws = await TauriBridge.getDefaultGateways();
      if (gws && gws.length > 0) {
        targetIps.push(...gws);
      }
    }

    for (const ip of targetIps) {
      for (const port of candidatePorts) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1200);

          const res = await fetch(`http://${ip}:${port}/pair/config`, {
            method: 'GET',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            if (data.success || data.status === 'ok') {
              const serverPort = data.port || data.socksPort || 10808;
              const proxyType = ((data.proxyType as any) || 'SOCKS5').toUpperCase() as 'SOCKS5' | 'HTTP';
              const username = data.authRequired ? data.username?.trim() : undefined;
              const password = data.authRequired ? data.password?.trim() : undefined;

              const server: VpnServer = {
                id: `hotspot_${ip}_${serverPort}`,
                name: `Sentinel Hotspot (${ip})`,
                protocol: proxyType,
                address: ip,
                port: serverPort,
                username: username || undefined,
                password: password || undefined,
                isHotspot: true,
                countryCode: 'LAN',
                rawLink: `${proxyType.toLowerCase()}://${username && password ? `${username}:${password}@` : ''}${ip}:${serverPort}#Sentinel%20Hotspot`,
              };

              return {
                success: true,
                proxyType,
                ip,
                port: serverPort,
                username,
                password,
                message: `Активный конфиг получен с телефона (${ip}:${serverPort})!`,
                server,
              };
            }
          }
        } catch {
          // continue probe
        }
      }
    }

    return {
      success: false,
      message: 'Не удалось получить конфиг от телефона. Убедитесь, что VPN запущен в приложении на телефоне.',
    };
  }
}
