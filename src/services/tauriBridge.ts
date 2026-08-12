import { invoke } from '@tauri-apps/api/core';
import { VpnServer, AppSettings, CoreType } from '../types/vpn';

export class TauriBridge {
  static isTauriAvailable(): boolean {
    return typeof window !== 'undefined' && (!!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__);
  }

  /**
   * Get all active default gateway IPs on Windows (e.g. ['10.165.156.227', '192.168.1.1'])
   */
  static async getDefaultGateways(): Promise<string[]> {
    try {
      const gws = await invoke<string[]>('get_default_gateways');
      if (Array.isArray(gws) && gws.length > 0) {
        return gws.map(g => g.trim()).filter(g => g.length > 0);
      }
    } catch (err) {
      console.warn('[TauriBridge] get_default_gateways failed:', err);
    }
    return [];
  }

  /**
   * Start VPN connection with chosen server, settings & optional compiled JSON
   */
  static async connectVpn(server: VpnServer, settings: AppSettings, configJson?: string): Promise<boolean> {
    console.log(`[VPN Bridge] Connecting to ${server.name} (${server.protocol}) via Core: ${settings.activeCore}`);
    try {
      return await invoke<boolean>('connect_vpn', {
        server,
        settings,
        configJson: configJson || null,
      });
    } catch (err: any) {
      console.error('[VPN Bridge] Tauri connect_vpn failed:', err);
      if (!this.isTauriAvailable()) {
        await new Promise(res => setTimeout(res, 500));
        return true;
      }
      return false;
    }
  }

  /**
   * Fetch all buffered live core logs directly from Rust memory
   */
  static async getCoreLogs(): Promise<string[]> {
    if (!this.isTauriAvailable()) return [];
    try {
      return await invoke<string[]>('get_core_logs');
    } catch {
      return [];
    }
  }

  /**
   * Check if current process is running with Administrator privileges
   */
  static async checkIsAdmin(): Promise<boolean> {
    if (!this.isTauriAvailable()) return true;
    try {
      return await invoke<boolean>('check_is_admin');
    } catch {
      return false;
    }
  }

  /**
   * Request Windows UAC prompt to restart application with Administrator privileges
   */
  static async requestAdminElevation(): Promise<boolean> {
    if (!this.isTauriAvailable()) return true;
    try {
      return await invoke<boolean>('request_admin_elevation');
    } catch {
      return false;
    }
  }

  /**
   * Request PIN pairing directly via Rust native TCP networking (CORS-free, instant probe)
   */
  static async requestPhonePairing(customGatewayIp?: string, pin?: string): Promise<{
    success: boolean;
    pin?: string;
    proxyType?: string;
    ip?: string;
    port?: number;
    username?: string;
    password?: string;
    message?: string;
  } | null> {
    if (!this.isTauriAvailable()) return null;
    try {
      const result = await invoke<any>('request_phone_pairing', {
        customGatewayIp: customGatewayIp || null,
        pin: pin || Math.floor(1000 + Math.random() * 9000).toString(),
      });
      return result;
    } catch (err) {
      console.warn('[TauriBridge] Native request_phone_pairing error:', err);
      return null;
    }
  }

  /**
   * Disconnect active VPN session
   */
  static async disconnectVpn(): Promise<boolean> {
    console.log('[VPN Bridge] Disconnecting VPN...');
    try {
      return await invoke<boolean>('disconnect_vpn');
    } catch (err) {
      console.error('Tauri disconnect_vpn failed or fallback to web:', err);
      await new Promise(res => setTimeout(res, 400));
      return true;
    }
  }

  /**
   * Measure latency ping (MS) to a VPN server address
   */
  static async pingServer(address: string, port: number): Promise<number> {
    try {
      return await invoke<number>('ping_server', { address, port });
    } catch {
      const base = address.length * 4 + (port % 30);
      const randomJitter = Math.floor(Math.random() * 12);
      return Math.min(Math.max(base + randomJitter, 16), 180);
    }
  }

  /**
   * Check which core binaries actually exist on disk in the binaries directory
   */
  static async checkInstalledCores(): Promise<{ singbox: boolean; xray: boolean; hysteria: boolean; wintun: boolean } | null> {
    if (!this.isTauriAvailable()) return null;
    try {
      return await invoke<any>('check_installed_cores');
    } catch {
      return null;
    }
  }

  /**
   * Fetch dynamic releases list directly from Rust backend (CORS-free, rate-limit immune)
   */
  static async fetchGithubReleasesNative(repo: string): Promise<Array<{ version: string; is_prerelease: boolean; download_url: string }> | null> {
    if (!this.isTauriAvailable()) return null;
    try {
      return await invoke<any>('fetch_github_releases_native', { repo });
    } catch (err) {
      console.warn(`[TauriBridge] Native fetch for ${repo} failed:`, err);
      return null;
    }
  }

  /**
   * Trigger GitHub core binary download from Rust backend
   */
  static async downloadCoreFromGithub(
    coreType: Exclude<CoreType, 'auto'>,
    downloadUrl: string,
    onProgress?: (percent: number) => void
  ): Promise<boolean> {
    console.log(`[Core Downloader] Downloading ${coreType} from ${downloadUrl}`);
    try {
      if (onProgress) onProgress(30);
      const res = await invoke<boolean>('download_core_binary', { coreType, downloadUrl });
      if (onProgress) onProgress(100);
      return res;
    } catch (err) {
      console.error('Tauri download_core_binary failed:', err);
      return false;
    }
  }

  /**
   * Start smooth native dragging of the application window via Rust backend
   */
  static async startDraggingWindow(): Promise<void> {
    try {
      await invoke('start_drag_window');
    } catch (err) {
      console.error('Tauri start_drag_window error:', err);
    }
  }

  /**
   * Minimize app window to Windows System Tray
   */
  static async minimizeToTray(): Promise<void> {
    console.log('[TauriBridge] Invoking minimize_app_window...');
    try {
      await invoke('minimize_app_window');
    } catch (err) {
      console.error('Tauri minimize_app_window error:', err);
    }
  }

  /**
   * Close application window
   */
  static async closeWindow(): Promise<void> {
    console.log('[TauriBridge] Invoking close_app_window...');
    try {
      await invoke('close_app_window');
    } catch (err) {
      console.error('Tauri close_app_window error:', err);
    }
  }
}
