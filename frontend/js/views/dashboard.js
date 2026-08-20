/**
 * Sentinel Secure Desktop - Dashboard View
 */

class DashboardView {
  constructor() {
    this.timerInterval = null;
    this.durationSeconds = 0;
    this.mascot = null;
  }

  init() {
    const btnPower = document.getElementById('btn-power-connect');
    const btnQuickServer = document.getElementById('btn-quick-server');
    const btnRefreshIP = document.getElementById('btn-refresh-ip');

    // Inbound Mode Chips
    const btnModeTun = document.getElementById('btn-mode-tun');
    const btnModeSysProxy = document.getElementById('btn-mode-sysproxy');



    if (btnPower) {
      btnPower.addEventListener('click', () => {
        if (this.mascot) {
          this.mascot.triggerShock();
        }
        if (this.radar) {
          this.radar.fireSalvo();
        }
        this.handleToggleConnect();
      });
    }

    // Initialize Mascot & Tactical Radar
    this.initMascot();

    if (btnQuickServer) {
      btnQuickServer.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleServerDropdown();
      });
    }

    // Close dropdown on outside click
    document.addEventListener('click', () => {
      const dropdown = document.getElementById('quick-server-dropdown');
      if (dropdown && !dropdown.classList.contains('hidden')) {
        dropdown.classList.add('hidden');
      }
    });

    if (btnRefreshIP) {
      btnRefreshIP.addEventListener('click', (e) => {
        e.stopPropagation();
        this.refreshPublicIP(true);
      });
    }

    const ipCard = document.getElementById('stat-public-ip')?.closest('.bento-card');
    if (ipCard) {
      ipCard.style.cursor = 'pointer';
      ipCard.addEventListener('click', () => this.refreshPublicIP(true));
    }

    const pingCard = document.getElementById('stat-ping-ms')?.closest('.bento-card');
    if (pingCard) {
      pingCard.style.cursor = 'pointer';
      pingCard.addEventListener('click', () => this.measureLatency(true));
    }

    // Inbound Mode Selector listeners
    if (btnModeTun) {
      btnModeTun.addEventListener('click', () => {
        window.state.updateSettings({ tunMode: true, systemProxy: false });
        window.toasts.info('Режим TUN (Wintun) выбран');
      });
    }

    if (btnModeSysProxy) {
      btnModeSysProxy.addEventListener('click', () => {
        window.state.updateSettings({ tunMode: false, systemProxy: true });
        window.toasts.info('Режим System Proxy выбран');
      });
    }

    const dashCoreSelect = document.getElementById('dash-core-select');
    if (dashCoreSelect) {
      dashCoreSelect.addEventListener('change', (e) => {
        const nextCore = e.target.value;
        window.state.updateSettings({ activeCore: nextCore });
        window.toasts.info(`Основное ядро переключено на: ${nextCore.toUpperCase()}`);
        this.checkCoreServerCompatibility();
      });
    }

    // State subscription
    window.state.subscribe((s) => this.render(s));

    // Initial IP check
    this.refreshPublicIP();
  }

  checkCoreServerCompatibility() {
    const server = window.state.getSelectedServer();
    if (!server) return;
    const proto = (server.protocol || '').toLowerCase();
    const activeCore = (window.state.settings.activeCore || 'singbox').toLowerCase();

    if (activeCore === 'hysteria' || activeCore === 'hysteria2') {
      if (!proto.includes('hy') && !proto.includes('hysteria')) {
        window.toasts.warning(`Внимание: сервер "${server.name}" использует ${server.protocol || 'VLESS'}, который не поддерживается ядром Hysteria 2 (требуется Sing-box или Xray).`);
      }
    } else if (activeCore === 'xray') {
      if (proto.includes('hy') || proto.includes('hysteria')) {
        window.toasts.warning(`Внимание: сервер "${server.name}" использует Hysteria 2, который не поддерживается ядром Xray (требуется Sing-box или Hysteria 2).`);
      }
    }
  }

  initMascot() {
    const canvas = document.getElementById('power-mascot-canvas');
    const container = document.getElementById('btn-power-connect');
    const radarCanvas = document.getElementById('tactical-radar-canvas');

    if (radarCanvas && typeof window.TacticalRadarEngine !== 'undefined') {
      try {
        this.radar = new window.TacticalRadarEngine(radarCanvas);
        const isConnected = window.state ? window.state.status === 'connected' : false;
        const isConnecting = window.state ? window.state.status === 'connecting' : false;
        this.radar.setRunningState(isConnected, isConnecting);
        console.log('[Dashboard] Tactical Radar Scope initialized successfully');
      } catch (err) {
        console.warn('[Dashboard] Tactical Radar initialization error:', err);
      }
    }

    if (canvas && typeof window.WindowsSentinelMascot !== 'undefined') {
      try {
        this.mascot = new window.WindowsSentinelMascot(canvas, container);
        const isConnected = window.state ? window.state.status === 'connected' : false;
        const isConnecting = window.state ? window.state.status === 'connecting' : false;
        this.mascot.setRunningState(isConnected, isConnecting);
        console.log('[Dashboard] Mascot initialized successfully inside Power Button');
      } catch (err) {
        console.warn('[Dashboard] Mascot initialization error:', err);
      }
    }
  }

  async handleToggleConnect() {
    const s = window.state;
    if (s.status === 'connected' || s.status === 'connecting') {
      window.state.setStatus('disconnecting');
      try {
        await window.bridge.disconnectVPN();
      } catch (e) {
        console.warn('Disconnect error:', e);
      }
      window.state.setStatus('disconnected');
      window.toasts.info('VPN отключен');
      this.refreshPublicIP();
    } else if (s.status === 'disconnected' || s.status === 'error') {
      const server = s.getSelectedServer();
      if (!server) {
        window.toasts.error('Сначала добавьте или выберите сервер!');
        return;
      }

      // Check protocol & core compatibility before launching
      const proto = (server.protocol || '').toLowerCase();
      let activeCore = (s.settings.activeCore || 'singbox').toLowerCase();

      if (activeCore === 'hysteria' || activeCore === 'hysteria2') {
        if (!proto.includes('hy') && !proto.includes('hysteria')) {
          const fallbackCore = 'singbox';
          window.state.updateSettings({ activeCore: fallbackCore });
          window.toasts.warning(`Ядро Hysteria 2 не поддерживает протокол ${server.protocol || 'VLESS'}. Автоматически переключено на Sing-box.`);
        }
      } else if (activeCore === 'xray') {
        if (proto.includes('hy') || proto.includes('hysteria')) {
          const fallbackCore = 'singbox';
          window.state.updateSettings({ activeCore: fallbackCore });
          window.toasts.warning('Ядро Xray-core не поддерживает протокол Hysteria 2. Автоматически переключено на Sing-box.');
        }
      }

      window.state.setStatus('connecting');
      try {
        const payloadSettings = {
          ...window.state.settings,
          quickRules: s.quickRules,
          routingRules: s.routingRules,
        };
        const res = await window.bridge.connectVPN(server, payloadSettings);
        if (res && res.success) {
          window.state.setStatus('connected');
          window.toasts.success(`Подключено к ${server.name}`);
          setTimeout(() => this.refreshPublicIP(), 500);
        } else {
          window.state.setStatus('error');
          window.toasts.error(res?.error || 'Ошибка подключения');
        }
      } catch (err) {
        window.state.setStatus('error');
        window.toasts.error(`Ошибка: ${err}`);
      }
    }
  }

  toggleServerDropdown() {
    const dropdown = document.getElementById('quick-server-dropdown');
    if (!dropdown) return;

    if (dropdown.classList.contains('hidden')) {
      this.renderDropdownList();
      dropdown.classList.remove('hidden');
    } else {
      dropdown.classList.add('hidden');
    }
  }

  renderDropdownList() {
    const list = document.getElementById('quick-server-list');
    if (!list) return;
    list.innerHTML = '';

    if (!window.state.servers || window.state.servers.length === 0) {
      list.innerHTML = `
        <div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 11px;">
          Нет доступных серверов.<br>Добавьте сервер во вкладке «Серверы».
        </div>
      `;
      return;
    }

    window.state.servers.forEach(server => {
      const isSelected = server.id === window.state.selectedServerId;
      const item = document.createElement('button');
      item.className = `dropdown-item ${isSelected ? 'selected' : ''}`;
      item.innerHTML = `
        <div class="flex items-center gap-2 text-left min-w-0">
          <span>${this.getCountryEmoji(server.countryCode)}</span>
          <div class="min-w-0">
            <div class="server-title truncate font-semibold">${server.name}</div>
            <div class="text-xs text-muted font-mono">${server.protocol} • ${server.address}:${server.port}</div>
          </div>
        </div>
        <div class="font-mono text-xs text-muted">${server.pingMs ? server.pingMs + 'ms' : '—'}</div>
      `;
      item.addEventListener('click', () => {
        window.state.setSelectedServerId(server.id);
        const dropdown = document.getElementById('quick-server-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
      });
      list.appendChild(item);
    });
  }

  async refreshPublicIP(userInitiated = false) {
    const ipEl = document.getElementById('stat-public-ip');
    const geoEl = document.getElementById('stat-public-geo');
    const btn = document.getElementById('btn-refresh-ip');

    if (btn) btn.classList.add('is-spinning');
    if (ipEl) ipEl.textContent = '...';
    if (geoEl) geoEl.textContent = 'Определение...';

    const socksPort = window.state.status === 'connected' ? (window.state.settings.socksPort || 10808) : 0;
    try {
      const info = await window.bridge.fetchPublicIPInfo(socksPort);
      if (info && info.ip) {
        window.state.updateStats({
          publicIP: info.ip,
          publicGeo: `${info.city ? info.city + ', ' : ''}${info.country || ''}`,
          countryCode: info.countryCode || '',
        });
        if (userInitiated) {
          window.toasts.info(`IP обновлен: ${info.ip}`);
        }
      } else {
        if (ipEl) ipEl.textContent = '127.0.0.1';
        if (geoEl) geoEl.textContent = 'Local, Direct';
      }
    } catch (e) {
      console.warn('refreshPublicIP error:', e);
    } finally {
      if (btn) btn.classList.remove('is-spinning');
    }

    // Also measure live latency
    await this.measureLatency(userInitiated);
  }

  async measureLatency(userInitiated = false) {
    const s = window.state;
    const socksPort = s.status === 'connected' ? (s.settings.socksPort || 10808) : 0;
    try {
      const pingRes = await window.bridge.proxyPingActive(socksPort);
      if (pingRes && pingRes.success && pingRes.latencyMs != null) {
        const ms = Math.round(pingRes.latencyMs);
        window.state.updateStats({ pingMs: ms });
        const srv = window.state.getSelectedServer();
        if (srv) {
          srv.pingMs = ms;
        }
        if (userInitiated) {
          window.toasts.info(`Задержка: ${ms} ms`);
        }
      }
    } catch (e) {
      console.warn('Latency probe error:', e);
    }
  }

  render(s) {
    const btnPower = document.getElementById('btn-power-connect');
    const radarWave = document.getElementById('radar-pulse-wave');
    const labelStatus = document.getElementById('power-status-label');
    const labelTimer = document.getElementById('power-timer-label');

    const srvFlag = document.getElementById('quick-server-flag');
    const srvName = document.getElementById('quick-server-name');
    const srvProto = document.getElementById('quick-server-proto');
    const srvPing = document.getElementById('quick-server-ping');

    // Selected Server Pill
    const selectedServer = s.getSelectedServer();
    if (selectedServer) {
      if (srvFlag) srvFlag.textContent = this.getCountryEmoji(selectedServer.countryCode);
      if (srvName) srvName.textContent = selectedServer.name;
      if (srvProto) {
        srvProto.textContent = selectedServer.protocol;
        srvProto.classList.remove('hidden');
      }
      if (srvPing) srvPing.textContent = selectedServer.pingMs ? `${selectedServer.pingMs} ms` : '—';
    } else {
      if (srvFlag) srvFlag.textContent = '🌐';
      if (srvName) srvName.textContent = 'Сервер не выбран';
      if (srvProto) srvProto.classList.add('hidden');
      if (srvPing) srvPing.textContent = '—';
    }

    // Power Button & Radar State
    if (btnPower && radarWave && labelStatus && labelTimer) {
      btnPower.className = `power-button power-${s.status}`;
      if (s.status === 'connected') {
        radarWave.className = 'radar-wave active';
        labelStatus.textContent = window.i18n.t('btn_disconnect');
        labelTimer.classList.remove('hidden');
        this.startTimer();
      } else if (s.status === 'connecting') {
        radarWave.className = 'radar-wave';
        labelStatus.textContent = window.i18n.t('status_connecting');
        labelTimer.classList.add('hidden');
        this.stopTimer();
      } else {
        radarWave.className = 'radar-wave';
        labelStatus.textContent = window.i18n.t('btn_connect');
        labelTimer.classList.add('hidden');
        this.stopTimer();
      }
    }

    // Update Mascot & Tactical Radar state
    const isConnected = s.status === 'connected';
    const isConnecting = s.status === 'connecting';
    if (this.mascot) {
      this.mascot.setRunningState(isConnected, isConnecting);
      this.mascot.setMetrics(20, 35, s.stats.downloadSpeed || 0, s.stats.uploadSpeed || 0);
    }
    if (this.radar) {
      this.radar.setRunningState(isConnected, isConnecting);
    }

    // Inbound Mode Chips State
    const btnModeTun = document.getElementById('btn-mode-tun');
    const btnModeSysProxy = document.getElementById('btn-mode-sysproxy');
    const dashCoreSelect = document.getElementById('dash-core-select');

    if (dashCoreSelect && dashCoreSelect.value !== s.settings.activeCore) {
      dashCoreSelect.value = s.settings.activeCore || 'singbox';
    }

    if (btnModeTun && btnModeSysProxy) {
      if (s.settings.tunMode) {
        btnModeTun.classList.add('active');
        btnModeSysProxy.classList.remove('active');
      } else {
        btnModeSysProxy.classList.add('active');
        btnModeTun.classList.remove('active');
      }
    }

    // Telemetry Bento
    const statDl = document.getElementById('stat-download-speed');
    const statUl = document.getElementById('stat-upload-speed');
    const statTotalDl = document.getElementById('stat-total-download');
    const statTotalUl = document.getElementById('stat-total-upload');
    const statPing = document.getElementById('stat-ping-ms');
    const statProto = document.getElementById('stat-active-protocol');
    const statIP = document.getElementById('stat-public-ip');
    const statGeo = document.getElementById('stat-public-geo');

    if (statDl) statDl.textContent = this.formatSpeed(s.stats.downloadSpeed);
    if (statUl) statUl.textContent = this.formatSpeed(s.stats.uploadSpeed);
    if (statTotalDl) statTotalDl.textContent = `Всего: ${this.formatBytes(s.stats.totalDownload)}`;
    if (statTotalUl) statTotalUl.textContent = `Всего: ${this.formatBytes(s.stats.totalUpload)}`;
    if (statPing) statPing.textContent = selectedServer?.pingMs ? `${selectedServer.pingMs} ms` : '—';
    if (statProto) statProto.textContent = selectedServer ? `ПРОТОКОЛ: ${selectedServer.protocol}` : '—';
    if (statIP) statIP.textContent = s.stats.publicIP;
    if (statGeo) statGeo.textContent = s.stats.publicGeo;
  }

  startTimer() {
    if (this.timerInterval) return;
    this.durationSeconds = 0;
    this.timerInterval = setInterval(() => {
      this.durationSeconds++;
      const el = document.getElementById('power-timer-label');
      if (el) {
        const hrs = Math.floor(this.durationSeconds / 3600);
        const mins = Math.floor((this.durationSeconds % 3600) / 60);
        const secs = this.durationSeconds % 60;
        el.textContent = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      if (this.durationSeconds % 5 === 0) {
        this.measureLatency();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
    if (bytesPerSec > 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  }

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  getCountryEmoji(code) {
    if (!code || code.length !== 2) return '🌐';
    return [...code.toUpperCase()]
      .map(c => String.fromCodePoint(0x1F1E0 - 65 + c.charCodeAt(0)))
      .join('');
  }
}

window.dashboardView = new DashboardView();
