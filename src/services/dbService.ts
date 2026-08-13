import { VpnServer } from '../types/vpn';
import { TauriBridge } from './tauriBridge';

const STORAGE_KEY = 'sentinel_servers_db_v1';

// In-memory cache — avoids repeated JSON.parse on every operation
let _serverCache: import('../types/vpn').VpnServer[] | null = null;

export class DbService {
  /**
   * Get all saved server profiles from local DB (async version for portable store)
   */
  static async getAllServersAsync(): Promise<VpnServer[]> {
    try {
      const data = await TauriBridge.readStoreData<VpnServer[]>(STORAGE_KEY);
      if (data && Array.isArray(data)) {
        const filtered = data.filter(s => !s.id.startsWith('default_'));
        _serverCache = filtered; // Populate cache from Rust store
        return filtered;
      }
      return this.getAllServers();
    } catch {
      return this.getAllServers();
    }
  }

  /**
   * Get all saved server profiles from local DB
   */
  static getAllServers(): VpnServer[] {
    if (_serverCache !== null) return _serverCache;
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        _serverCache = [];
        return _serverCache;
      }
      const parsed: VpnServer[] = JSON.parse(data);
      _serverCache = parsed.filter(s => !s.id.startsWith('default_'));
      return _serverCache;
    } catch (err) {
      console.error('Failed to read servers from DB:', err);
      _serverCache = [];
      return _serverCache;
    }
  }

  /**
   * Save or update list of servers in DB
   */
  static async saveAllServers(servers: VpnServer[]): Promise<void> {
    try {
      const cleaned = servers.filter(s => !s.id.startsWith('default_'));
      _serverCache = cleaned; // Update cache immediately
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      await TauriBridge.saveStoreData(STORAGE_KEY, cleaned);
    } catch (err) {
      console.error('Failed to write servers to DB:', err);
    }
  }

  /**
   * Insert new server profile into DB
   */
  static async addServer(server: VpnServer): Promise<VpnServer[]> {
    const servers = this.getAllServers();
    const filtered = servers.filter(s => !(s.address === server.address && s.port === server.port));
    const updated = [server, ...filtered];
    await this.saveAllServers(updated);
    return updated;
  }

  /**
   * Add multiple servers (batch import)
   */
  static async addServers(newServers: VpnServer[]): Promise<VpnServer[]> {
    const servers = this.getAllServers();
    const map = new Map<string, VpnServer>();

    // Existing servers
    for (const s of servers) {
      map.set(`${s.address}:${s.port}`, s);
    }

    // Insert new servers
    for (const ns of newServers) {
      map.set(`${ns.address}:${ns.port}`, ns);
    }

    const updated = Array.from(map.values());
    await this.saveAllServers(updated);
    return updated;
  }

  /**
   * Update an existing server profile
   */
  static async updateServer(server: VpnServer): Promise<VpnServer[]> {
    const servers = this.getAllServers();
    const updated = servers.map(s => (s.id === server.id ? server : s));
    await this.saveAllServers(updated);
    return updated;
  }

  /**
   * Remove server profile by ID
   */
  static async deleteServer(id: string): Promise<VpnServer[]> {
    const servers = this.getAllServers();
    const updated = servers.filter(s => s.id !== id);
    await this.saveAllServers(updated);
    return updated;
  }

  /**
   * Toggle favorite state of a server
   */
  static async toggleFavorite(id: string): Promise<VpnServer[]> {
    const servers = this.getAllServers();
    const updated = servers.map(s => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s);
    await this.saveAllServers(updated);
    return updated;
  }

  /**
   * Clear all servers from DB
   */
  static async clearAll(): Promise<void> {
    _serverCache = [];
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('xpc_servers');
    // Also clear the Rust-persisted .bin file
    await TauriBridge.saveStoreData(STORAGE_KEY, []);
  }
}
