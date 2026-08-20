/**
 * Sentinel Secure Desktop - Sentinel Hotspot View Controller
 * Coordinates Adapter detection, Client Phone Pairing, and LAN Proxy Server.
 */
class HotspotView {
  constructor() {
    this.adapters = new HotspotAdaptersModule(this);
    this.client = new HotspotClientModule(this);
    this.server = new HotspotServerModule(this);
    this.currentPin = this.client.generatePIN();
  }

  // Delegated Getters & Helpers
  get isActive() { return this.server.isActive; }
  set isActive(v) { this.server.isActive = v; }
  get lastFoundConfig() { return this.client.lastFoundConfig; }
  set lastFoundConfig(v) { this.client.lastFoundConfig = v; }
  get isProbing() { return this.client.isProbing; }
  get isPairing() { return this.client.isPairing; }

  generatePIN() { return this.client.generatePIN(); }
  regenPIN() { return this.client.regenPIN(); }

  init() {
    console.log('[Hotspot] Initializing Hotspot view listeners...');
    const selectAdapter = document.getElementById('hotspot-adapter-select');
    const btnDetectGw = document.getElementById('btn-detect-gateway');
    const btnProbe = document.getElementById('btn-probe-hotspot');
    const btnConnectDirect = document.getElementById('btn-connect-hotspot-direct');
    const btnAddServer = document.getElementById('btn-add-hotspot-server');
    const btnRegenPin = document.getElementById('btn-regen-pin');

    if (btnRegenPin) {
      btnRegenPin.addEventListener('click', () => this.regenPIN());
    }

    if (selectAdapter) {
      selectAdapter.addEventListener('change', (e) => {
        const val = e.target.value;
        const input = document.getElementById('hotspot-target-ip');
        if (input && val) {
          input.value = val;
        }
      });
    }

    if (btnDetectGw) {
      btnDetectGw.addEventListener('click', () => this.loadAdapters(true));
    }

    if (btnProbe) {
      btnProbe.addEventListener('click', () => {
        console.log('[Hotspot] btnProbe clicked!');
        this.probePhoneHotspot();
      });
    }

    if (btnConnectDirect) {
      btnConnectDirect.addEventListener('click', () => this.connectDirect(true));
    }

    if (btnAddServer) {
      btnAddServer.addEventListener('click', () => this.connectDirect(false));
    }

    // Subscribe to backend adapter events
    window.bridge.onEvent('adapters-detected', (data) => {
      this.adapters.renderAdapters(data);
    });

    // Server controls
    const btnToggle = document.getElementById('btn-toggle-hotspot');
    const portInput = document.getElementById('hotspot-port-input');

    if (btnToggle) {
      btnToggle.addEventListener('click', () => this.toggleHotspot());
    }

    if (portInput) {
      portInput.addEventListener('input', (e) => {
        const guidePort = document.getElementById('hotspot-guide-port');
        if (guidePort) guidePort.textContent = e.target.value;
      });
    }

    // Initial load safely
    try {
      this.loadAdapters(false);
    } catch (e) {
      console.warn('[Hotspot] initial loadAdapters error:', e);
    }
    try {
      this.loadInterfaces();
    } catch (e) {
      console.warn('[Hotspot] initial loadInterfaces error:', e);
    }
    console.log('[Hotspot] Hotspot view initialized successfully!');
  }

  // Delegated methods for backward compatibility and simplicity
  loadAdapters(showToast = false) { return this.adapters.loadAdapters(showToast); }
  renderAdapters(adapters) { return this.adapters.renderAdapters(adapters); }
  detectGateway(showToast = false) { return this.adapters.loadAdapters(showToast); }

  probePhoneHotspot() { return this.client.probePhoneHotspot(); }
  renderDiscoveryResult(config) { return this.client.renderDiscoveryResult(config); }
  renderDiscoveryNotFound(targetIP, errMsg) { return this.client.renderDiscoveryNotFound(targetIP, errMsg); }
  connectDirect(autoConnect = true) { return this.client.connectDirect(autoConnect); }

  loadInterfaces() { return this.server.loadInterfaces(); }
  toggleHotspot() { return this.server.toggleHotspot(); }
}

window.hotspotView = new HotspotView();
