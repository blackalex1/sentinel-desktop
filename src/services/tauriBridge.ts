import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { VpnServer, AppSettings, CoreType } from '../types/vpn';

export interface DownloadProgressPayload {
  core_type: string;
  percent: number;
  bytes_downloaded: number;
  total_bytes: number;
}

// Cached at module load time — avoids repeated property lookups on every call
const IS_TAURI_AVAILABLE = typeof window !== 'undefined' &&
  (!!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__);

export class TauriBridge {
  static isTauriAvailable(): boolean {
    return IS_TAURI_AVAILABLE;
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
        return false; // Dev/browser mode — VPN not available
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
   * Clear all buffered live core logs from Rust memory
   */
  static async clearCoreLogs(): Promise<void> {
    if (!this.isTauriAvailable()) return;
    try {
      await invoke('clear_core_logs');
    } catch (err) {
      console.warn('[TauriBridge] clear_core_logs error:', err);
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
      return false;
    }
  }

  /**
   * Measure latency ping (MS) to a VPN server address
   */
  static async pingServer(address: string, port: number): Promise<number> {
    try {
      return await invoke<number>('ping_server', { address, port });
    } catch {
      return -1; // Indicates ping failed — UI should show "—" not a fabricated number
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
    let unlisten: (() => void) | undefined;
    try {
      if (onProgress) onProgress(5);

      if (onProgress && this.isTauriAvailable()) {
        try {
          unlisten = await listen<DownloadProgressPayload>('download-progress', (event) => {
            const ct = event.payload.core_type;
            if (ct === coreType || (coreType === 'singbox' && (ct === 'singbox' || ct === 'sing-box'))) {
              onProgress(event.payload.percent);
            }
          });
        } catch (e) {
          console.warn('[Core Downloader] Failed setting up progress listener:', e);
        }
      }

      const res = await invoke<boolean>('download_core_binary', { coreType, downloadUrl });
      if (onProgress) onProgress(100);
      return res;
    } catch (err) {
      console.error('Tauri download_core_binary failed:', err);
      return false;
    } finally {
      if (unlisten) unlisten();
    }
  }

  /**
   * Check status and sizes of local GeoIP and Geosite database files
   */
  static async checkGeoDatabases(): Promise<{
    geoip_dat_exists: boolean;
    geoip_dat_size: number;
    geoip_dat_mtime: number;
    geosite_dat_exists: boolean;
    geosite_dat_size: number;
    geosite_dat_mtime: number;
    geoip_db_exists: boolean;
    geoip_db_size: number;
    geoip_db_mtime: number;
    geosite_db_exists: boolean;
    geosite_db_size: number;
    geosite_db_mtime: number;
  } | null> {
    try {
      return await invoke('check_geo_databases');
    } catch (err) {
      console.error('checkGeoDatabases error:', err);
      return null;
    }
  }

  /**
   * Update GeoIP and Geosite database files directly from Fastly CDN mirrors
   */
  static async updateGeoDatabases(onProgress?: (percent: number) => void): Promise<boolean> {
    let unlisten: (() => void) | null = null;
    try {
      if (onProgress && this.isTauriAvailable()) {
        try {
          unlisten = await listen<DownloadProgressPayload>('download-progress', (event) => {
            if (event.payload.core_type.startsWith('geo')) {
              onProgress(event.payload.percent);
            }
          });
        } catch (e) {
          console.warn('[Geo Updater] Failed setting up progress listener:', e);
        }
      }

      const res = await invoke<boolean>('update_geo_databases');
      if (onProgress) onProgress(100);
      return res;
    } catch (err) {
      console.error('Tauri update_geo_databases failed:', err);
      return false;
    } finally {
      if (unlisten) unlisten();
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

  /**
   * Open web URL in native system browser
   */
  static async openUrl(url: string): Promise<void> {
    if (!url) return;
    if (this.isTauriAvailable()) {
      try {
        await invoke('open_url', { url });
        return;
      } catch (err) {
        console.warn('[TauriBridge] open_url command failed, falling back to window.open:', err);
      }
    }
    window.open(url, '_blank');
  }

  /**
   * Write data directly into binaries/<key>.json portable store
   */
  static async saveStoreData(key: string, data: any): Promise<boolean> {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    if (!this.isTauriAvailable()) return true;
    try {
      return await invoke<boolean>('save_store_data', { key, dataJson: jsonStr });
    } catch (err) {
      console.warn(`[TauriBridge] saveStoreData failed for key ${key}:`, err);
      return false;
    }
  }

  /**
   * Read data directly from binaries/<key>.json portable store
   */
  static async readStoreData<T = any>(key: string): Promise<T | null> {
    if (!this.isTauriAvailable()) {
      const local = localStorage.getItem(key);
      if (!local) return null;
      try { return JSON.parse(local) as T; } catch { return local as any; }
    }
    try {
      const jsonStr = await invoke<string>('read_store_data', { key });
      if (jsonStr && jsonStr.trim().length > 0) {
        localStorage.setItem(key, jsonStr);
        try { return JSON.parse(jsonStr) as T; } catch { return jsonStr as any; }
      }
      const local = localStorage.getItem(key);
      if (!local) return null;
      try { return JSON.parse(local) as T; } catch { return local as any; }
    } catch (err) {
      console.warn(`[TauriBridge] readStoreData failed for key ${key}:`, err);
      const local = localStorage.getItem(key);
      if (!local) return null;
      try { return JSON.parse(local) as T; } catch { return local as any; }
    }
  }
}
