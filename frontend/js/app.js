/**
 * Sentinel Secure Desktop - Application Bootstrap & Event Router
 */

// Global Error Handler to catch and display any unexpected runtime errors
window.addEventListener('error', (e) => {
  console.error('[Sentinel Error]', e.message, 'at', e.filename, ':', e.lineno);
  if (window.toasts) {
    window.toasts.error(`JS Error: ${e.message}`);
  }
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Sentinel Unhandled Rejection]', e.reason);
});

const HTML_PARTIALS = [
  { targetId: 'module-titlebar', file: 'partials/titlebar.html' },
  { targetId: 'module-sidebar', file: 'partials/sidebar.html' },
  { targetId: 'container-dashboard', file: 'partials/dashboard.html' },
  { targetId: 'container-servers', file: 'partials/servers.html' },
  { targetId: 'container-routing', file: 'partials/routing.html' },
  { targetId: 'container-cores', file: 'partials/cores.html' },
  { targetId: 'container-diagnostics', file: 'partials/diagnostics.html' },
  { targetId: 'container-logs', file: 'partials/logs.html' },
  { targetId: 'container-hotspot', file: 'partials/hotspot.html' },
  { targetId: 'container-settings', file: 'partials/settings.html' },
  { targetId: 'module-modals', file: 'partials/modals.html' },
];

async function loadAllPartials() {
  await Promise.all(HTML_PARTIALS.map(async (p) => {
    const el = document.getElementById(p.targetId);
    if (!el) return;
    try {
      const resp = await fetch(p.file);
      if (resp.ok) {
        const html = await resp.text();
        el.outerHTML = html;
      } else {
        console.error(`[Loader] Failed to fetch ${p.file}: HTTP ${resp.status}`);
      }
    } catch (err) {
      console.error(`[Loader] Error loading ${p.file}:`, err);
    }
  }));
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Sentinel App] Initializing Desktop Client v2.0...');

  // 1. Load Modular HTML Partials
  try {
    await loadAllPartials();
  } catch (e) {
    console.error('[Loader] Partials error:', e);
  }

  // 2. Initialize Localization
  try {
    window.i18n.applyTranslations();
  } catch (e) {
    console.error('Localization error:', e);
  }

  // 2. Initialize UI Components safely
  const initSafe = (name, fn) => {
    try {
      fn();
    } catch (err) {
      console.error(`[Init Error] ${name}:`, err);
    }
  };

  initSafe('Toasts', () => window.toasts.init());
  initSafe('Titlebar', () => window.titlebarView.init());
  initSafe('Sidebar', () => window.sidebarView.init());
  initSafe('Dashboard', () => window.dashboardView.init());
  initSafe('Servers', () => window.serversView.init());
  try {
    await window.routingView.init();
  } catch (e) {
    console.error('[Init Error] Routing:', e);
  }
  initSafe('Cores', () => window.coresView.init());
  initSafe('Diagnostics', () => window.diagnosticsView.init());
  initSafe('Logs', () => window.logsView.init());
  initSafe('Hotspot', () => window.hotspotView.init());
  initSafe('Settings', () => window.settingsView.init());
  initSafe('Modals', () => window.modalsView.init());

  // 3. Load Saved State & Database
  try {
    await window.state.loadInitialData();
    if (window.hotspotView) {
      window.hotspotView.detectGateway(false);
    }
  } catch (e) {
    console.error('[Init Error] loadInitialData:', e);
  }

  // 4. Check Initial Connection Status from Go Backend
  try {
    const status = await window.bridge.getConnectionStatus();
    if (status && status.connected) {
      window.state.setStatus('connected');
    }
  } catch (e) {
    console.warn('Initial status check error:', e);
  }

  // 5. Subscribe to Wails Runtime Events
  window.bridge.onEvent('connection-status-changed', (newStatus) => {
    console.log('[Sentinel App] Connection status event:', newStatus);
    window.state.setStatus(newStatus);
  });

  window.bridge.onEvent('traffic-stats', (stats) => {
    if (stats) {
      window.state.updateStats(stats);
    }
  });

  window.bridge.onEvent('gateway-detected', (gw) => {
    console.log('[Sentinel App] Gateway detected event from Go:', gw);
    const input = document.getElementById('hotspot-target-ip');
    if (input && gw) {
      input.value = gw;
    }
  });

  window.bridge.onEvent('tray-toggle-connect', () => {
    console.log('[Sentinel App] Tray toggle connect event received');
    if (window.dashboardView) {
      window.dashboardView.handleToggleConnect();
    }
  });

  console.log('[Sentinel App] Ready.');
});
