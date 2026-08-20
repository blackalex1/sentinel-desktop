/**
 * Sentinel Secure Desktop - Settings View
 */

class SettingsView {
  init() {
    const btnSave = document.getElementById('btn-save-settings');
    const selLang = document.getElementById('setting-language');
    const selTheme = document.getElementById('setting-theme');
    const selCore = document.getElementById('setting-active-core');

    if (btnSave) {
      btnSave.addEventListener('click', () => this.saveSettings());
    }

    if (selCore) {
      selCore.addEventListener('change', (e) => {
        window.state.updateSettings({ activeCore: e.target.value });
        window.toasts.info(`Основное ядро переключено на: ${e.target.value.toUpperCase()}`);
      });
    }

    if (selLang) {
      selLang.value = window.i18n.getLang();
      selLang.addEventListener('change', (e) => {
        window.i18n.setLang(e.target.value);
        window.state.updateSettings({ language: e.target.value });
      });
    }

    if (selTheme) {
      selTheme.value = window.state.settings.theme || 'cyber';
      selTheme.addEventListener('change', (e) => {
        this.applyTheme(e.target.value);
        window.state.updateSettings({ theme: e.target.value });
      });
    }

    this.render();
  }

  applyTheme(theme) {
    document.body.className = `theme-${theme}`;
  }

  saveSettings() {
    const activeCore = document.getElementById('setting-active-core')?.value || 'singbox';
    const logLevel = document.getElementById('setting-log-level')?.value || 'info';
    const autostart = document.getElementById('setting-autostart')?.checked;
    const closeToTray = document.getElementById('setting-close-to-tray')?.checked;
    const socksPort = parseInt(document.getElementById('setting-socks-port')?.value || '10808', 10);
    const httpPort = parseInt(document.getElementById('setting-http-port')?.value || '10809', 10);
    const dnsServer = document.getElementById('setting-dns-server')?.value || '1.1.1.1';

    window.state.updateSettings({
      activeCore: activeCore,
      logLevel: logLevel,
      autoStart: autostart,
      closeToTray: closeToTray,
      socksPort: socksPort,
      httpPort: httpPort,
      dnsServer: dnsServer,
    });

    window.toasts.success('Настройки успешно сохранены');
  }

  render() {
    const s = window.state.settings;
    const selCore = document.getElementById('setting-active-core');
    const selLogLevel = document.getElementById('setting-log-level');
    const autostart = document.getElementById('setting-autostart');
    const closeToTray = document.getElementById('setting-close-to-tray');
    const socksPort = document.getElementById('setting-socks-port');
    const httpPort = document.getElementById('setting-http-port');
    const dnsServer = document.getElementById('setting-dns-server');

    if (selCore) selCore.value = s.activeCore || 'singbox';
    if (selLogLevel) selLogLevel.value = s.logLevel || 'info';
    if (autostart) autostart.checked = !!s.autoStart;
    if (closeToTray) closeToTray.checked = s.closeToTray !== false;
    if (socksPort) socksPort.value = s.socksPort || 10808;
    if (httpPort) httpPort.value = s.httpPort || 10809;
    if (dnsServer) dnsServer.value = s.dnsServer || '1.1.1.1';
  }
}

window.settingsView = new SettingsView();
