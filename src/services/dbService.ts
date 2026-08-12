import { VpnServer } from '../types/vpn';

const STORAGE_KEY = 'sentinel_servers_db_v1';

export class DbService {
  /**
   * Get all saved server profiles from local DB
   */
  static getAllServers(): VpnServer[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed: VpnServer[] = JSON.parse(data);
      // Filter out old demo/hardcoded servers
      return parsed.filter(s => !s.id.startsWith('default_'));
    } catch (err) {
      console.error('Failed to read servers from DB:', err);
      return [];
    }
  }

  /**
   * Save or update list of servers in DB
   */
  static saveAllServers(servers: VpnServer[]): void {
    try {
      const cleaned = servers.filter(s => !s.id.startsWith('default_'));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    } catch (err) {
      console.error('Failed to write servers to DB:', err);
    }
  }

  /**
   * Insert new server profile into DB
   */
  static addServer(server: VpnServer): VpnServer[] {
    const servers = this.getAllServers();
    // Filter out duplicates by address & port if matching
    const filtered = servers.filter(s => !(s.address === server.address && s.port === server.port));
    const updated = [server, ...filtered];
    this.saveAllServers(updated);
    return updated;
  }

  /**
   * Add multiple servers (batch import)
   */
  static addServers(newServers: VpnServer[]): VpnServer[] {
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
    this.saveAllServers(updated);
    return updated;
  }

  /**
   * Remove server profile by ID
   */
  static deleteServer(id: string): VpnServer[] {
    const servers = this.getAllServers();
    const updated = servers.filter(s => s.id !== id);
    this.saveAllServers(updated);
    return updated;
  }

  /**
   * Toggle favorite state of a server
   */
  static toggleFavorite(id: string): VpnServer[] {
    const servers = this.getAllServers();
    const updated = servers.map(s => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s);
    this.saveAllServers(updated);
    return updated;
  }

  /**
   * Clear all servers from DB
   */
  static clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('xpc_servers');
  }
}
