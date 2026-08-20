/**
 * Sentinel Hotspot - Client Pairing & Node Discovery
 */
class HotspotClientModule {
  constructor(view) {
    this.view = view;
    this.isProbing = false;
    this.isPairing = false;
    this.lastFoundConfig = null;
  }

  generatePIN() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  regenPIN() {
    this.view.currentPin = this.generatePIN();
    const pinEl = document.getElementById('hotspot-display-pin');
    if (pinEl) pinEl.textContent = this.view.currentPin;
    if (window.toasts) {
      window.toasts.info(`Сгенерирован новый код сопряжения: ${this.view.currentPin}`);
    }
  }

  async probePhoneHotspot() {
    if (this.isProbing) {
      console.log('[HotspotClient] Probe already in progress, skipping duplicate.');
      return;
    }
    this.isProbing = true;

    const input = document.getElementById('hotspot-target-ip');
    const select = document.getElementById('hotspot-adapter-select');
    const btnProbe = document.getElementById('btn-probe-hotspot');

    let targetIP = (input?.value || select?.value || '').trim();
    if (!targetIP) {
      targetIP = '10.60.133.124';
    }

    if (window.toasts) {
      window.toasts.info(`🔍 Поиск телефона на ${targetIP}...`);
    }

    if (btnProbe) {
      btnProbe.disabled = true;
      btnProbe.innerHTML = `<span>⏳ Поиск телефона на ${targetIP}...</span>`;
    }

    try {
      const res = await window.bridge.probeHotspotPairingServer(targetIP);
      console.log('[HotspotClient] Probe response:', res);
      if (res && res.found) {
        this.lastFoundConfig = res;
        this.view.currentPin = this.generatePIN();
        this.renderDiscoveryResult(res);
        if (window.toasts) {
          window.toasts.info(`📱 Телефон найден! Отправка запроса с кодом [ ${this.view.currentPin} ]...`);
        }
        // Immediately start interactive PIN confirmation
        await this.connectDirect(true);
      } else {
        this.renderDiscoveryNotFound(targetIP, res ? res.error : null);
        if (window.toasts) {
          window.toasts.warning(`Телефон не найден на шлюзе ${targetIP}. Убедитесь, что на телефоне включена точка доступа и раздача прокси (LAN Sharing).`);
        }
      }
    } catch (err) {
      console.error('[HotspotClient] Probe error:', err);
      this.renderDiscoveryNotFound(targetIP, err.message || String(err));
      if (window.toasts) {
        window.toasts.error(`Ошибка связи: ${err.message || err}`);
      }
    } finally {
      this.isProbing = false;
      if (btnProbe) {
        btnProbe.disabled = false;
        btnProbe.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span>🔍 Найти телефон (Автосопряжение)</span>
        `;
      }
    }
  }

  renderDiscoveryResult(config) {
    const box = document.getElementById('hotspot-phone-status-box');
    const dot = document.getElementById('hotspot-probe-state-dot');
    const text = document.getElementById('hotspot-probe-state-text');
    const ipEl = document.getElementById('hotspot-found-ip');
    const portEl = document.getElementById('hotspot-found-port');
    const protoEl = document.getElementById('hotspot-found-proto');
    const authEl = document.getElementById('hotspot-found-auth');
    const pinEl = document.getElementById('hotspot-display-pin');

    if (!box) return;

    box.classList.remove('hidden');
    if (dot) {
      dot.style.background = '#10b981';
      dot.style.boxShadow = '0 0 8px #10b981';
    }
    if (text) text.textContent = `🟢 Sentinel Phone обнаружен (${config.gatewayIP}:${config.pairingPort || 18080})`;

    if (ipEl) ipEl.textContent = config.gatewayIP || '192.168.43.1';
    if (portEl) portEl.textContent = `${config.pairingPort || 18080}`;
    
    const protoName = config.proxyType || 'SOCKS5';
    const proxyPort = config.socksPort || config.port || 10808;
    if (protoEl) protoEl.textContent = `${protoName} (порт ${proxyPort})`;

    if (authEl) {
      authEl.textContent = config.authRequired ? 'Защищено (Требуется подтверждение)' : 'Свободный доступ (PIN код для сопряжения)';
    }

    if (pinEl) {
      pinEl.textContent = this.view.currentPin;
    }
  }

  renderDiscoveryNotFound(targetIP, errMsg) {
    const box = document.getElementById('hotspot-phone-status-box');
    const dot = document.getElementById('hotspot-probe-state-dot');
    const text = document.getElementById('hotspot-probe-state-text');
    const ipEl = document.getElementById('hotspot-found-ip');
    const portEl = document.getElementById('hotspot-found-port');
    const protoEl = document.getElementById('hotspot-found-proto');
    const authEl = document.getElementById('hotspot-found-auth');

    if (!box) return;
    box.classList.remove('hidden');

    if (dot) {
      dot.style.background = '#ef4444';
      dot.style.boxShadow = '0 0 8px #ef4444';
    }
    if (text) text.textContent = `🔴 Телефон не найден на ${targetIP}`;
    if (ipEl) ipEl.textContent = targetIP;
    if (portEl) portEl.textContent = '18080 (Закрыт)';
    if (protoEl) protoEl.textContent = '—';
    if (authEl) authEl.textContent = errMsg || 'Нет ответа от сервера сопряжения';
  }

  async connectDirect(autoConnect = true) {
    if (this.isPairing) {
      console.log('[HotspotClient] Pairing already in progress, skipping duplicate.');
      return;
    }
    this.isPairing = true;

    if (!this.lastFoundConfig) {
      if (window.toasts) window.toasts.warning('Сначала выполните поиск телефона');
      this.isPairing = false;
      return;
    }

    const cfg = this.lastFoundConfig;
    const btnConnect = document.getElementById('btn-connect-hotspot-direct');
    const pinCode = this.view.currentPin;

    let finalUser = cfg.username || '';
    let finalPass = cfg.password || '';

    if (btnConnect) {
      btnConnect.disabled = true;
      btnConnect.innerHTML = `<span>⏳ Подтвердите код [ ${pinCode} ] на телефоне...</span>`;
    }

    if (window.toasts) {
      window.toasts.info(`📲 На экране телефона открыт запрос на сопряжение. Код: [ ${pinCode} ]. Нажмите [РАЗРЕШИТЬ] на телефоне...`);
    }

    let finalProto = (cfg.proxyType || 'SOCKS5').toLowerCase().includes('http') ? 'http' : 'socks';
    let finalPort = cfg.socksPort || cfg.port || 10808;

    try {
      const pairRes = await window.bridge.requestHotspotPairingWithPIN(cfg.gatewayIP, cfg.pairingPort || 18080, pinCode);
      console.log('[HotspotClient] Pair result from phone:', pairRes);
      if (pairRes && (pairRes.success || pairRes.status === 'ok')) {
        finalUser = pairRes.username || finalUser;
        finalPass = pairRes.password || finalPass;
        finalPort = pairRes.socksPort || pairRes.port || finalPort;
        if (pairRes.proxyType) {
          finalProto = pairRes.proxyType.toLowerCase().includes('http') ? 'http' : 'socks';
        }
        if (window.toasts) window.toasts.success('✅ Сопряжение подтверждено на телефоне!');
      } else {
        if (window.toasts) window.toasts.error(pairRes?.error || 'Сопряжение отклонено на телефоне');
        return;
      }
    } catch (err) {
      console.warn('[HotspotClient] Pair request error:', err);
      if (window.toasts) window.toasts.error(`Ошибка сопряжения: ${err.message || err}`);
      return;
    } finally {
      this.isPairing = false;
      if (btnConnect) {
        btnConnect.disabled = false;
        btnConnect.textContent = '⚡ Запросить сопряжение и подключиться';
      }
    }

    // Create / update hotspot server profile
    const hotspotNode = {
      id: `hotspot-phone-${Date.now()}`,
      name: `📱 Sentinel Phone (${cfg.gatewayIP})`,
      protocol: finalProto,
      address: cfg.gatewayIP,
      port: finalPort,
      username: finalUser,
      password: finalPass,
      ping: '1 ms',
      country: 'LAN',
      flag: '📱',
      isHotspot: true,
    };

    // Keep all existing non-hotspot servers intact, only replace previous hotspot phone node
    if (!Array.isArray(window.state.servers)) {
      window.state.servers = [];
    }
    const otherServers = window.state.servers.filter(s => !s.isHotspot && !s.name?.includes('Sentinel Phone'));
    window.state.servers = [hotspotNode, ...otherServers];
    window.state.saveServers();
    window.state.setSelectedServerId(hotspotNode.id);

    if (window.serversView) {
      window.serversView.render();
    }

    if (autoConnect) {
      if (window.toasts) window.toasts.success(`Узел [${hotspotNode.name}] добавлен и выбран! Подключение...`);
      if (window.sidebarView) {
        window.sidebarView.switchTab('dashboard');
      }
      setTimeout(() => {
        const btnConnect = document.getElementById('btn-connect-main');
        if (btnConnect && !window.state.isConnected) {
          btnConnect.click();
        }
      }, 300);
    } else {
      if (window.toasts) window.toasts.success(`Узел [${hotspotNode.name}] успешно сохранен в список серверов!`);
    }
  }
}

window.HotspotClientModule = HotspotClientModule;
