/**
 * Sentinel Secure Desktop - Wails Go IPC Bridge
 */

class WailsBridge {
  isWailsAvailable() {
    return typeof window !== 'undefined' && window.go && window.go.main && window.go.main.App;
  }

  // VPN Connection Lifecycle
  async connectVPN(server, settings) {
    if (!this.isWailsAvailable()) {
      console.log('[Dev Bridge] connectVPN called with:', server, settings);
      return { success: true, core: settings.activeCore || 'singbox' };
    }
    return window.go.main.App.ConnectVPN(JSON.stringify(server), JSON.stringify(settings));
  }

  async disconnectVPN() {
    if (!this.isWailsAvailable()) {
      console.log('[Dev Bridge] disconnectVPN called');
      return { success: true };
    }
    return window.go.main.App.DisconnectVPN();
  }

  async getConnectionStatus() {
    if (!this.isWailsAvailable()) {
      return { connected: false, status: 'disconnected', activeCore: 'singbox', durationSeconds: 0 };
    }
    return window.go.main.App.GetConnectionStatus();
  }

  // Sentinel-Core DLL Operations
  async parseProxyURI(rawURI) {
    if (!this.isWailsAvailable()) {
      return { name: 'Mock Node', protocol: 'vless', address: '1.1.1.1', port: 443 };
    }
    return window.go.main.App.ParseProxyURI(rawURI);
  }

  async generateProxyURI(profile) {
    if (!this.isWailsAvailable()) {
      return 'vless://mock-generated-uri';
    }
    return window.go.main.App.GenerateProxyURI(JSON.stringify(profile));
  }

  async batchPingNodes(targets, timeoutMs = 2500) {
    if (!this.isWailsAvailable()) {
      return targets.map(t => ({ id: t.id, address: t.address, port: t.port, success: true, latencyMs: 42 }));
    }
    const jsonStr = await window.go.main.App.BatchPingNodes(JSON.stringify(targets), timeoutMs);
    try { return JSON.parse(jsonStr); } catch { return []; }
  }

  async proxyPingActive(socksPort = 10808, targetURL = 'http://cp.cloudflare.com/generate_204', timeoutMs = 3000) {
    if (!this.isWailsAvailable()) {
      return { success: true, latencyMs: 68.5 };
    }
    const jsonStr = await window.go.main.App.ProxyPingActive(socksPort, '', '', targetURL, timeoutMs);
    try { return JSON.parse(jsonStr); } catch { return { success: false, error: 'Parse error' }; }
  }

  async fetchPublicIPInfo(socksPort = 0, timeoutMs = 3500) {
    if (!this.isWailsAvailable()) {
      try {
        const res = await fetch('https://ipwho.is/');
        const data = await res.json();
        return {
          ip: data.ip || '127.0.0.1',
          country: data.country || 'Local',
          countryCode: data.country_code || 'RU',
          city: data.city || 'Moscow',
          org: data.connection?.isp || 'Localhost',
          asn: data.connection?.asn ? `AS${data.connection.asn}` : 'AS0000',
        };
      } catch {
        return { ip: '127.0.0.1', country: 'Direct', countryCode: 'RU' };
      }
    }
    const jsonStr = await window.go.main.App.FetchPublicIPInfo(socksPort, '', '', timeoutMs);
    try { return JSON.parse(jsonStr); } catch { return null; }
  }

  async fetchRoutingPresets() {
    if (!this.isWailsAvailable()) {
      return [
        { id: 'ads', name: 'Реклама и трекеры', description: 'Категории блокировки рекламы и трекеров (AdBlock)', defaultTarget: 'block' },
        { id: 'bittorrent', name: 'BitTorrent трафик', description: 'Торрент-трафик, P2P протокол и трекеры', defaultTarget: 'block' },
        { id: 'cn', name: 'Сайты Китая (CN)', description: 'Все IP-адреса и домены Китая', defaultTarget: 'block' },
        { id: 'ip_checkers', name: 'Сервисы определения IP', description: 'Сервисы проверки IP (ipify, 2ip, ifconfig, ipinfo и др.)', defaultTarget: 'direct' },
        { id: 'ru', name: 'Сайты России (RU)', description: 'Все IP-адреса и домены России', defaultTarget: 'direct' },
        { id: 'us', name: 'Сайты США (US)', description: 'Все IP-адреса и домены США', defaultTarget: 'block' },
        { id: 'lan', name: 'Локальная сеть (LAN)', description: 'Маршрутизация всех частных IP адресов', defaultTarget: 'direct' },
        { id: 'quic', name: 'Блокировка QUIC (UDP 443)', description: 'Блокировка протокола QUIC (HTTP/3)', defaultTarget: 'block' },
      ];
    }
    const jsonStr = await window.go.main.App.FetchRoutingPresets();
    try { return JSON.parse(jsonStr); } catch { return []; }
  }

  async fetchPresetDetails(presetID) {
    if (!this.isWailsAvailable()) return null;
    if (window.go?.main?.App?.FetchPresetDetails) {
      const jsonStr = await window.go.main.App.FetchPresetDetails(presetID);
      try { return JSON.parse(jsonStr); } catch { return null; }
    }
    return null;
  }

  async getDefaultRoutingRules() {
    if (!this.isWailsAvailable()) return [];
    if (window.go?.main?.App?.GetDefaultRoutingRules) {
      const jsonStr = await window.go.main.App.GetDefaultRoutingRules();
      try { return JSON.parse(jsonStr); } catch { return []; }
    }
    return [];
  }

  async generateCryptoKeys() {
    if (!this.isWailsAvailable()) {
      return { x25519: { privateKey: 'mock_priv', publicKey: 'mock_pub' } };
    }
    const jsonStr = await window.go.main.App.GenerateCryptoKeys();
    try { return JSON.parse(jsonStr); } catch { return {}; }
  }

  async getCoreDLLVersion() {
    if (!this.isWailsAvailable()) return 'v1.12.0-dev (Mock)';
    return window.go.main.App.GetCoreDLLVersion();
  }

  async reloadCoreDLL() {
    if (!this.isWailsAvailable()) return { success: true, version: 'v1.12.0-reloaded' };
    return window.go.main.App.ReloadCoreDLL();
  }

  // Core Downloader & Updates
  async checkInstalledCores() {
    if (!this.isWailsAvailable()) {
      return { singbox: true, xray: true, hysteria: true, wintun: true, sentinel_core: true, geoip: true, geosite: true };
    }
    return window.go.main.App.CheckInstalledCores();
  }

  async getInstalledCoresDetails() {
    if (!this.isWailsAvailable()) {
      return {
        sentinel_core: { installed: true, version: 'v1.12.0-dev', path: 'binaries/sentinel-core.dll' },
        singbox: { installed: true, version: 'v1.11.4', path: 'binaries/sing-box.exe' },
        xray: { installed: true, version: 'v25.1.30', path: 'binaries/xray.exe' },
        hysteria: { installed: true, version: 'v2.6.0', path: 'binaries/hysteria.exe' },
      };
    }
    return window.go.main.App.GetInstalledCoresDetails();
  }

  async fetchGitHubReleases(repo, includePrerelease = false) {
    if (!this.isWailsAvailable()) return [];
    return window.go.main.App.FetchGitHubReleasesNative(repo, includePrerelease);
  }

  async downloadCoreBinary(coreType, downloadURL) {
    if (!this.isWailsAvailable()) return true;
    return window.go.main.App.DownloadCoreBinary(coreType, downloadURL);
  }

  async updateGeoDatabases() {
    if (!this.isWailsAvailable()) return true;
    return window.go.main.App.UpdateGeoDatabases();
  }

  // Storage
  async saveStoreData(key, data) {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    localStorage.setItem(key, jsonStr);
    if (!this.isWailsAvailable()) return true;
    return window.go.main.App.SaveStoreData(key, jsonStr);
  }

  async readStoreData(key) {
    if (!this.isWailsAvailable()) {
      const val = localStorage.getItem(key);
      if (!val) return null;
      try { return JSON.parse(val); } catch { return val; }
    }
    const res = await window.go.main.App.ReadStoreData(key);
    if (res && res.trim().length > 0) {
      localStorage.setItem(key, res);
      try { return JSON.parse(res); } catch { return res; }
    }
    const val = localStorage.getItem(key);
    if (!val) return null;
    try { return JSON.parse(val); } catch { return val; }
  }

  // Logs
  async getLiveLogs() {
    if (!this.isWailsAvailable()) return [];
    return window.go.main.App.GetLiveLogs();
  }

  async clearLiveLogs() {
    if (!this.isWailsAvailable()) return;
    return window.go.main.App.ClearLiveLogs();
  }

  // Window Controls
  minimizeWindow() {
    if (this.isWailsAvailable()) window.go.main.App.MinimizeWindow();
  }

  closeWindow() {
    if (this.isWailsAvailable()) window.go.main.App.CloseWindow();
  }

  openURL(url) {
    if (this.isWailsAvailable()) {
      window.go.main.App.OpenURL(url);
    } else {
      window.open(url, '_blank');
    }
  }

  async waitForWails(timeoutMs = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.isWailsAvailable()) return true;
      await new Promise(r => setTimeout(r, 50));
    }
    return this.isWailsAvailable();
  }

  // Hotspot & Pairing
  async getNetworkAdapters() {
    if (!this.isWailsAvailable()) {
      await this.waitForWails();
    }
    if (!this.isWailsAvailable()) {
      return [];
    }
    try {
      const res = await window.go.main.App.GetNetworkAdapters();
      if (typeof res === 'string') {
        try {
          return JSON.parse(res);
        } catch {
          return [];
        }
      }
      return Array.isArray(res) ? res : [];
    } catch (e) {
      console.warn('[Bridge] GetNetworkAdapters error:', e);
      return [];
    }
  }

  async detectDefaultGateway() {
    if (!this.isWailsAvailable()) {
      await this.waitForWails();
    }
    if (!this.isWailsAvailable()) return '';
    try {
      return await window.go.main.App.DetectDefaultGateway();
    } catch (e) {
      console.warn('[Bridge] DetectDefaultGateway error:', e);
      return '';
    }
  }

  async getDefaultGateways() {
    if (!this.isWailsAvailable()) {
      await this.waitForWails();
    }
    if (!this.isWailsAvailable()) return [];
    try {
      const res = await window.go.main.App.GetDefaultGateways();
      return Array.isArray(res) ? res : [];
    } catch (e) {
      console.warn('[Bridge] GetDefaultGateways error:', e);
      return [];
    }
  }

  async probeHotspotPairingServer(gatewayIP) {
    if (!this.isWailsAvailable()) {
      await this.waitForWails();
    }
    if (!this.isWailsAvailable()) {
      return { found: false, error: 'Wails bridge unavailable' };
    }
    try {
      const res = await window.go.main.App.ProbeHotspotPairingServer(gatewayIP || '');
      if (typeof res === 'string') {
        try { return JSON.parse(res); } catch { return { found: false }; }
      }
      return res || { found: false };
    } catch (e) {
      console.warn('[Bridge] Probe error:', e);
      return { found: false, error: e.message || String(e) };
    }
  }

  async requestHotspotPairingWithPIN(gatewayIP, pairingPort, pinCode) {
    if (!this.isWailsAvailable()) {
      await this.waitForWails();
    }
    if (!this.isWailsAvailable()) {
      return { success: false, error: 'Wails bridge unavailable' };
    }
    try {
      const res = await window.go.main.App.RequestHotspotPairingWithPIN(gatewayIP || '', pairingPort || 18080, pinCode || '');
      if (typeof res === 'string') {
        try { return JSON.parse(res); } catch { return { success: false }; }
      }
      return res || { success: false };
    } catch (e) {
      console.warn('[Bridge] Pair error:', e);
      return { success: false, error: e.message || String(e) };
    }
  }

  // Events Subscription
  onEvent(eventName, callback) {
    if (typeof window !== 'undefined' && window.runtime && window.runtime.EventsOn) {
      window.runtime.EventsOn(eventName, callback);
    } else {
      const timer = setInterval(() => {
        if (typeof window !== 'undefined' && window.runtime && window.runtime.EventsOn) {
          clearInterval(timer);
          window.runtime.EventsOn(eventName, callback);
        }
      }, 50);
      setTimeout(() => clearInterval(timer), 6000);
    }
  }
}

window.bridge = new WailsBridge();
