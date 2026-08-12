import { TauriBridge } from './tauriBridge';

export interface PairRequestResult {
  success: boolean;
  pin?: string;
  proxyType?: 'SOCKS5' | 'HTTP';
  ip?: string;
  port?: number;
  username?: string;
  password?: string;
  message?: string;
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
      return {
        success: nativeResult.success,
        pin: nativeResult.pin || pin,
        proxyType: (nativeResult.proxyType as any) || 'SOCKS5',
        ip: nativeResult.ip,
        port: nativeResult.port || 10808,
        username: nativeResult.username,
        password: nativeResult.password,
        message: nativeResult.message || (nativeResult.success ? `Сопряжение подтверждено на смартфоне (${nativeResult.ip})!` : 'Ошибка сопряжения'),
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
            return {
              success: true,
              pin,
              proxyType: data.proxyType || 'SOCKS5',
              ip: data.ip || ip,
              port: data.port || data.socksPort || 10808,
              username: data.username,
              password: data.password,
              message: `Сопряжение подтверждено на смартфоне (${ip})!`,
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
}
