/**
 * Sentinel Hotspot - Local Proxy Sharing (LAN Server)
 */
class HotspotServerModule {
  constructor(view) {
    this.view = view;
    this.isActive = false;
  }

  async loadInterfaces() {
    const select = document.getElementById('hotspot-ip-select');
    const guideIP = document.getElementById('hotspot-guide-ip');

    try {
      const gws = await window.bridge.getDefaultGateways();
      if (Array.isArray(gws) && gws.length > 0 && select) {
        select.innerHTML = '<option value="0.0.0.0">Все интерфейсы (0.0.0.0)</option>';
        gws.forEach(ip => {
          const opt = document.createElement('option');
          opt.value = ip;
          opt.textContent = `Интерфейс: ${ip}`;
          select.appendChild(opt);
        });
        if (guideIP) guideIP.textContent = gws[0];
      }
    } catch (e) {
      console.warn('[HotspotServer] Error loading interfaces:', e);
    }
  }

  async toggleHotspot() {
    const btn = document.getElementById('btn-toggle-hotspot');
    const portInput = document.getElementById('hotspot-port-input');
    const port = parseInt(portInput?.value || '10811', 10);

    if (this.isActive) {
      if (window.go && window.go.main && window.go.main.App && window.go.main.App.StopLANProxy) {
        await window.go.main.App.StopLANProxy();
      }
      this.isActive = false;
      if (btn) {
        btn.textContent = 'Запустить раздачу';
        btn.className = 'btn btn-primary mt-2 w-full';
      }
      if (window.toasts) window.toasts.info('LAN раздача остановлена');
    } else {
      if (window.go && window.go.main && window.go.main.App && window.go.main.App.StartLANProxy) {
        const res = await window.go.main.App.StartLANProxy(port, window.state?.settings?.httpPort || 10809);
        if (res && res.success) {
          this.isActive = true;
          if (btn) {
            btn.textContent = 'Остановить раздачу';
            btn.className = 'btn btn-secondary mt-2 w-full';
          }
          if (window.toasts) window.toasts.success(`LAN раздача активна на порту ${port}!`);
        } else {
          if (window.toasts) window.toasts.error('Ошибка запуска LAN раздачи');
        }
      } else {
        this.isActive = true;
        if (btn) btn.textContent = 'Остановить раздачу';
        if (window.toasts) window.toasts.success(`LAN раздача активна на порту ${port}!`);
      }
    }
  }
}

window.HotspotServerModule = HotspotServerModule;
