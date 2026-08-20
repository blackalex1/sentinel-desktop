/**
 * Sentinel Secure Desktop - Titlebar Component
 */

class TitlebarView {
  init() {
    const btnMin = document.getElementById('btn-minimize');
    const btnClose = document.getElementById('btn-close');

    if (btnMin) {
      btnMin.addEventListener('click', () => window.bridge.minimizeWindow());
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => {
        if (window.state.settings.closeToTray) {
          window.bridge.closeWindow();
        } else {
          window.bridge.closeWindow();
        }
      });
    }

    const coreSelect = document.getElementById('titlebar-core-select');
    if (coreSelect) {
      coreSelect.addEventListener('change', (e) => {
        const nextCore = e.target.value;
        window.state.updateSettings({ activeCore: nextCore });
        window.toasts.info(`Основное ядро переключено на: ${nextCore.toUpperCase()}`);
      });
    }

    // Subscribe to state changes
    window.state.subscribe((s) => this.render(s));
  }

  render(s) {
    const pill = document.getElementById('titlebar-status-pill');
    const statusText = document.getElementById('titlebar-status-text');
    const coreSelect = document.getElementById('titlebar-core-select');
    const pingBadge = document.getElementById('titlebar-ping-badge');
    const pingText = document.getElementById('titlebar-ping-text');

    if (coreSelect && coreSelect.value !== s.settings.activeCore) {
      coreSelect.value = s.settings.activeCore || 'singbox';
    }

    if (pill && statusText) {
      pill.className = `status-pill status-${s.status}`;
      if (s.status === 'connected') {
        statusText.textContent = window.i18n.t('status_connected');
      } else if (s.status === 'connecting') {
        statusText.textContent = window.i18n.t('status_connecting');
      } else if (s.status === 'disconnecting') {
        statusText.textContent = window.i18n.t('status_disconnecting');
      } else if (s.status === 'error') {
        statusText.textContent = window.i18n.t('status_error');
      } else {
        statusText.textContent = window.i18n.t('status_disconnected');
      }
    }

    if (pingBadge && pingText) {
      if (s.status === 'connected' && s.stats.pingMs != null) {
        pingBadge.classList.remove('hidden');
        pingText.textContent = `${s.stats.pingMs} ms`;
      } else {
        pingBadge.classList.add('hidden');
      }
    }
  }
}

window.titlebarView = new TitlebarView();
