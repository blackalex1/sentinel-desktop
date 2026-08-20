/**
 * Sentinel Secure Desktop - Diagnostics View
 */

class DiagnosticsView {
  init() {
    const btnRunDiag = document.getElementById('btn-run-diag');
    const btnTestProxyPing = document.getElementById('btn-test-proxy-ping');
    const btnGenKeys = document.getElementById('btn-generate-keys');

    if (btnRunDiag) {
      btnRunDiag.addEventListener('click', () => this.runFullDiagnostics());
    }

    if (btnTestProxyPing) {
      btnTestProxyPing.addEventListener('click', () => this.testProxyPing());
    }

    if (btnGenKeys) {
      btnGenKeys.addEventListener('click', () => this.generateCryptoKeys());
    }

    this.runFullDiagnostics();
  }

  async runFullDiagnostics() {
    window.toasts.info('Запуск диагностики сети...');
    const ipVal = document.getElementById('diag-ip-val');
    const geoVal = document.getElementById('diag-geo-val');
    const ispVal = document.getElementById('diag-isp-val');
    const asnVal = document.getElementById('diag-asn-val');

    if (ipVal) ipVal.textContent = 'Проверка...';
    if (geoVal) geoVal.textContent = 'Проверка...';
    if (ispVal) ispVal.textContent = 'Проверка...';
    if (asnVal) asnVal.textContent = 'Проверка...';

    try {
      const info = await window.bridge.fetchPublicIPInfo();
      if (info && info.ip) {
        if (ipVal) ipVal.textContent = info.ip;
        if (geoVal) geoVal.textContent = `${info.city ? info.city + ', ' : ''}${info.country || 'N/A'}`;
        if (ispVal) ispVal.textContent = info.org || info.isp || 'N/A';
        if (asnVal) asnVal.textContent = info.asn || 'N/A';
        window.toasts.success('Данные публичного IP обновлены');
      } else {
        if (ipVal) ipVal.textContent = 'Ошибка';
      }
    } catch (e) {
      window.toasts.error('Ошибка проверки IP: ' + e);
    }

    if (window.state.status === 'connected') {
      this.testProxyPing();
    }
  }

  async testProxyPing() {
    const pingVal = document.getElementById('diag-proxy-ping-val');
    const pingStatus = document.getElementById('diag-proxy-ping-status');

    if (pingVal) pingVal.textContent = 'Замер...';
    if (pingStatus) pingStatus.textContent = 'Отправка HTTP GET через SOCKS5...';

    try {
      const res = await window.bridge.proxyPingActive(window.state.settings.socksPort || 10808);
      if (res && res.success) {
        if (pingVal) pingVal.textContent = `${Math.round(res.latencyMs)} ms`;
        if (pingStatus) {
          pingStatus.textContent = 'Успешное рукопожатие (204 No Content)';
          pingStatus.style.color = 'var(--accent-emerald)';
        }
      } else {
        if (pingVal) pingVal.textContent = 'Таймаут';
        if (pingStatus) {
          pingStatus.textContent = res?.error || 'Прокси не отвечает или ядро выключено';
          pingStatus.style.color = 'var(--accent-rose)';
        }
      }
    } catch (e) {
      if (pingVal) pingVal.textContent = 'Ошибка';
      if (pingStatus) pingStatus.textContent = String(e);
    }
  }

  async generateCryptoKeys() {
    const privEl = document.getElementById('diag-priv-key');
    const pubEl = document.getElementById('diag-pub-key');

    if (privEl) privEl.textContent = 'Генерация...';
    if (pubEl) pubEl.textContent = 'Генерация...';

    try {
      const keys = await window.bridge.generateCryptoKeys();
      if (keys && keys.x25519) {
        if (privEl) privEl.textContent = keys.x25519.privateKey || '—';
        if (pubEl) pubEl.textContent = keys.x25519.publicKey || '—';
        window.toasts.success('Новая пара ключей X25519 / Reality сгенерирована!');
      } else {
        window.toasts.error('Ошибка генерации ключей');
      }
    } catch (e) {
      window.toasts.error('Ошибка: ' + e);
    }
  }
}

window.diagnosticsView = new DiagnosticsView();
