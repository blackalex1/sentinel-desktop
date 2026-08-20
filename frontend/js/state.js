/**
 * Sentinel Secure Desktop - Centralized Reactive State Store
 */

class AppState {
  constructor() {
    this.servers = [];
    this.selectedServerId = null;
    this.status = 'disconnected';
    this.settings = {
      activeCore: 'singbox',
      tunMode: false,
      systemProxy: true,
      bypassRu: true,
      killSwitch: false,
      lanSharing: false,
      socksPort: 10808,
      httpPort: 10809,
      dnsServer: '1.1.1.1',
      theme: 'cyber',
      language: 'ru',
      autoStart: false,
      closeToTray: true,
    };
    this.stats = {
      downloadSpeed: 0,
      uploadSpeed: 0,
      totalDownload: 0,
      totalUpload: 0,
      pingMs: null,
      publicIP: '...',
      publicGeo: 'Определение...',
      countryCode: '',
      activeProtocol: '',
    };
    this.logs = [];
    this.routingRules = [];
    this.quickRules = {};
    this.listeners = new Set();
  }

  async loadInitialData() {
    // 1. Load settings
    const savedSettings = await window.bridge.readStoreData('xpc_settings');
    if (savedSettings && typeof savedSettings === 'object') {
      this.settings = { ...this.settings, ...savedSettings };
    }

    // 2. Load servers
    const savedServers = await window.bridge.readStoreData('sentinel_servers_db_v1');
    if (Array.isArray(savedServers)) {
      this.servers = savedServers;
    } else {
      this.servers = [];
    }

    // 3. Load selected server ID
    const savedSelected = await window.bridge.readStoreData('xpc_selected_server_id');
    if (savedSelected && this.servers.some(s => s.id === savedSelected)) {
      this.selectedServerId = savedSelected;
    } else if (this.servers.length > 0) {
      this.selectedServerId = this.servers[0].id;
    } else {
      this.selectedServerId = null;
    }

    // 4. Load Routing Rules & Quick Rules
    const savedRoutingRules = await window.bridge.readStoreData('xpc_routing_rules');
    if (Array.isArray(savedRoutingRules) && savedRoutingRules.length > 0) {
      this.routingRules = savedRoutingRules;
    } else {
      this.routingRules = await window.bridge.getDefaultRoutingRules();
    }

    const savedQuickRules = await window.bridge.readStoreData('xpc_quick_rules');
    if (savedQuickRules && typeof savedQuickRules === 'object') {
      this.quickRules = savedQuickRules;
    } else {
      const presets = await window.bridge.fetchRoutingPresets();
      this.quickRules = {};
      if (Array.isArray(presets)) {
        presets.forEach(p => {
          this.quickRules[p.id] = {
            enabled: p.defaultTarget === 'block' || p.id === 'ru' || p.id === 'lan' || p.id === 'ip_checkers',
            outbound: (p.defaultTarget === 'block' ? 'BLOCKED' : (p.defaultTarget || 'DIRECT')).toUpperCase(),
          };
        });
      }
    }

    this.notify();
  }

  saveRoutingRules(rules) {
    this.routingRules = rules;
    window.bridge.saveStoreData('xpc_routing_rules', this.routingRules);
    this.notify('routing');
  }

  saveQuickRules(quickRules) {
    this.quickRules = quickRules;
    window.bridge.saveStoreData('xpc_quick_rules', this.quickRules);
    this.notify('quick_rules');
  }

  getSelectedServer() {
    if (!this.servers || this.servers.length === 0) {
      return null;
    }
    return this.servers.find(s => s.id === this.selectedServerId) || this.servers[0] || null;
  }

  setSelectedServerId(id) {
    this.selectedServerId = id;
    window.bridge.saveStoreData('xpc_selected_server_id', id || '');
    this.notify();
  }

  setStatus(status) {
    this.status = status;
    this.notify();
  }

  updateSettings(partial) {
    this.settings = { ...this.settings, ...partial };
    window.bridge.saveStoreData('xpc_settings', this.settings);
    this.notify();
  }

  addServer(server) {
    if (!server.id) {
      server.id = 'srv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    }
    this.servers.push(server);
    if (!this.selectedServerId) {
      this.selectedServerId = server.id;
    }
    this.saveServers();
    this.notify();
  }

  updateServer(id, updatedData) {
    const idx = this.servers.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.servers[idx] = { ...this.servers[idx], ...updatedData };
      this.saveServers();
      this.notify();
    }
  }

  deleteServer(id) {
    this.servers = this.servers.filter(s => s.id !== id);
    if (this.selectedServerId === id) {
      this.selectedServerId = this.servers.length > 0 ? this.servers[0].id : null;
      window.bridge.saveStoreData('xpc_selected_server_id', this.selectedServerId || '');
    }
    this.saveServers();
    this.notify();
  }

  toggleFavorite(id) {
    const srv = this.servers.find(s => s.id === id);
    if (srv) {
      srv.isFavorite = !srv.isFavorite;
      this.saveServers();
      this.notify();
    }
  }

  saveServers() {
    window.bridge.saveStoreData('sentinel_servers_db_v1', this.servers);
  }

  saveState() {
    this.saveServers();
    this.notify();
  }

  updateStats(partial) {
    this.stats = { ...this.stats, ...partial };
    this.notify();
  }

  addLog(line) {
    if (this.logs.length >= 1000) {
      this.logs.shift();
    }
    this.logs.push(line);
    this.notify('log');
  }

  clearLogs() {
    this.logs = [];
    this.notify('log');
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event = 'state') {
    this.listeners.forEach(l => {
      try { l(this, event); } catch (e) { console.error('State listener error:', e); }
    });
  }
}

window.state = new AppState();
