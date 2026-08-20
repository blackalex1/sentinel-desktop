/**
 * Sentinel Secure Desktop - Cores View
 */

class CoresView {
  constructor() {
    this.coreConfigs = {
      dll: {
        id: 'dll',
        coreType: 'sentinel_core',
        repo: 'blackalex1/sentinel-core',
        selectId: 'select-version-dll',
        badgeId: 'badge-version-dll',
        toggleId: 'toggle-prerelease-dll',
        btnId: 'btn-install-dll',
        verId: 'core-ver-dll',
        statusId: 'core-status-dll',
      },
      singbox: {
        id: 'singbox',
        coreType: 'singbox',
        repo: 'SagerNet/sing-box',
        selectId: 'select-version-singbox',
        badgeId: 'badge-version-singbox',
        toggleId: 'toggle-prerelease-singbox',
        btnId: 'btn-install-singbox',
        verId: 'core-installed-singbox',
        statusId: 'core-status-singbox',
      },
      xray: {
        id: 'xray',
        coreType: 'xray',
        repo: 'XTLS/Xray-core',
        selectId: 'select-version-xray',
        badgeId: 'badge-version-xray',
        toggleId: 'toggle-prerelease-xray',
        btnId: 'btn-install-xray',
        verId: 'core-installed-xray',
        statusId: 'core-status-xray',
      },
      hysteria: {
        id: 'hysteria',
        coreType: 'hysteria',
        repo: 'apernet/hysteria',
        selectId: 'select-version-hysteria',
        badgeId: 'badge-version-hysteria',
        toggleId: 'toggle-prerelease-hysteria',
        btnId: 'btn-install-hysteria',
        verId: 'core-installed-hysteria',
        statusId: 'core-status-hysteria',
      },
    };
    this.installedInfo = {};
  }

  init() {
    const btnReloadDLL = document.getElementById('btn-reload-dll');
    const btnReloadDLLCard = document.getElementById('btn-reload-dll-card');
    const btnUpdateGeo = document.getElementById('btn-update-geo');

    if (btnReloadDLL) {
      btnReloadDLL.addEventListener('click', () => this.handleReloadDLL());
    }
    if (btnReloadDLLCard) {
      btnReloadDLLCard.addEventListener('click', () => this.handleReloadDLL());
    }
    if (btnUpdateGeo) {
      btnUpdateGeo.addEventListener('click', () => this.handleUpdateGeo());
    }

    // Progress event listener from Go backend
    window.bridge.onEvent('download-progress', (payload) => {
      this.handleDownloadProgress(payload);
    });

    // Wire up activate buttons
    ['singbox', 'xray', 'hysteria'].forEach((c) => {
      const btn = document.getElementById(`btn-activate-${c}`);
      if (btn) {
        btn.addEventListener('click', () => {
          window.state.updateSettings({ activeCore: c });
          window.toasts.success(`Основное ядро переключено на: ${c.toUpperCase()}`);
          this.updateActiveCoreButtons();
        });
      }
    });

    window.state.subscribe(() => {
      this.updateActiveCoreButtons();
    });

    // Initialize all core controllers
    this.checkStatus().then(() => {
      Object.values(this.coreConfigs).forEach((cfg) => {
        this.setupCoreController(cfg);
      });
      this.updateActiveCoreButtons();
    });
  }

  updateActiveCoreButtons() {
    const active = window.state.settings.activeCore || 'singbox';
    ['singbox', 'xray', 'hysteria'].forEach((c) => {
      const btn = document.getElementById(`btn-activate-${c}`);
      if (!btn) return;
      if (c === active) {
        btn.className = 'btn btn-sm btn-primary';
        btn.textContent = '● Активно';
        btn.disabled = true;
      } else {
        btn.className = 'btn btn-sm btn-secondary';
        btn.textContent = 'Сделать активным';
        btn.disabled = false;
      }
    });
  }

  async checkStatus() {
    try {
      const details = await window.bridge.getInstalledCoresDetails();
      if (details) {
        this.installedInfo = details;

        // DLL
        const dllInfo = details.sentinel_core;
        const verDll = document.getElementById('core-ver-dll');
        if (verDll) {
          verDll.textContent = dllInfo?.version || 'dev';
        }
        this.updateStatusBadge('core-status-dll', dllInfo?.installed);

        // Sing-box
        const sbInfo = details.singbox;
        const verSb = document.getElementById('core-installed-singbox');
        if (verSb) verSb.textContent = sbInfo?.version || (sbInfo?.installed ? 'Установлено' : 'Не найдено');
        this.updateStatusBadge('core-status-singbox', sbInfo?.installed);

        // Xray
        const xrayInfo = details.xray;
        const verXray = document.getElementById('core-installed-xray');
        if (verXray) verXray.textContent = xrayInfo?.version || (xrayInfo?.installed ? 'Установлено' : 'Не найдено');
        this.updateStatusBadge('core-status-xray', xrayInfo?.installed);

        // Hysteria
        const hyInfo = details.hysteria;
        const verHy = document.getElementById('core-installed-hysteria');
        if (verHy) verHy.textContent = hyInfo?.version || (hyInfo?.installed ? 'Установлено' : 'Не найдено');
        this.updateStatusBadge('core-status-hysteria', hyInfo?.installed);
      }
    } catch (e) {
      console.warn('Error checking installed cores status:', e);
    }
  }

  updateStatusBadge(elId, isInstalled) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (isInstalled) {
      el.className = 'badge-status badge-active';
      el.textContent = 'УСТАНОВЛЕНО';
    } else {
      el.className = 'badge-status';
      el.textContent = 'НЕ НАЙДЕНО';
      el.style.background = 'rgba(244, 63, 94, 0.15)';
      el.style.color = 'var(--accent-rose)';
    }
  }

  async setupCoreController(cfg) {
    const toggle = document.getElementById(cfg.toggleId);
    const select = document.getElementById(cfg.selectId);
    const badge = document.getElementById(cfg.badgeId);
    const btn = document.getElementById(cfg.btnId);

    if (!select || !btn) return;

    // Load saved pre-release toggle preference
    const savedPre = localStorage.getItem(`xpc_prerelease_${cfg.id}`);
    if (toggle && savedPre !== null) {
      toggle.checked = savedPre === 'true';
    }

    const loadReleases = async () => {
      const includePre = toggle ? toggle.checked : false;
      select.innerHTML = '<option value="">Поиск релизов на GitHub...</option>';
      select.disabled = true;
      btn.disabled = true;

      try {
        const releases = await window.bridge.fetchGitHubReleases(cfg.repo, includePre);
        select.innerHTML = '';
        select.disabled = false;

        if (!releases || releases.length === 0) {
          select.innerHTML = '<option value="">Релизы не найдены</option>';
          btn.disabled = true;
          return;
        }

        const currentInstalledVer = this.getCurrentCoreVersion(cfg.coreType);
        const norm = (v) => (v || '').toLowerCase().replace(/^v/, '').trim();

        releases.forEach((r, idx) => {
          const opt = document.createElement('option');
          opt.value = r.download_url || '';
          opt.setAttribute('data-version', r.version);
          opt.setAttribute('data-prerelease', r.is_prerelease ? 'true' : 'false');

          const tag = r.is_prerelease ? 'Pre-release' : 'Stable';
          const isCurr = norm(r.version) === norm(currentInstalledVer);
          opt.textContent = `${r.version} (${tag})${isCurr ? ' — [Текущая]' : ''}`;

          select.appendChild(opt);
        });

        this.updateSelectedState(cfg);
      } catch (e) {
        select.innerHTML = `<option value="">Ошибка: ${e}</option>`;
        btn.disabled = true;
      }
    };

    // Toggle change listener
    if (toggle) {
      toggle.addEventListener('change', () => {
        localStorage.setItem(`xpc_prerelease_${cfg.id}`, toggle.checked);
        loadReleases();
      });
    }

    // Select change listener
    select.addEventListener('change', () => {
      this.updateSelectedState(cfg);
    });

    // Install button listener
    btn.addEventListener('click', async () => {
      const selectedOpt = select.options[select.selectedIndex];
      if (!selectedOpt) return;
      const downloadURL = selectedOpt.value;
      const ver = selectedOpt.getAttribute('data-version');

      if (!downloadURL) {
        window.toasts.error(`Для версии ${ver} не найден Windows x64 бинарник в релизе`);
        return;
      }

      this.showProgress(`Скачивание ${cfg.coreType} (${ver})...`);
      try {
        const ok = await window.bridge.downloadCoreBinary(cfg.coreType, downloadURL);
        if (ok) {
          window.toasts.success(`Ядро ${cfg.coreType} успешно обновлено до ${ver}!`);
          await this.checkStatus();
          await loadReleases();
        } else {
          window.toasts.error(`Ошибка скачивания ${cfg.coreType}`);
        }
      } catch (e) {
        window.toasts.error('Ошибка: ' + e);
      } finally {
        this.hideProgress();
      }
    });

    // Initial load
    await loadReleases();
  }

  getCurrentCoreVersion(coreType) {
    const info = this.installedInfo[coreType];
    return info?.version || '';
  }

  updateSelectedState(cfg) {
    const select = document.getElementById(cfg.selectId);
    const badge = document.getElementById(cfg.badgeId);
    const btn = document.getElementById(cfg.btnId);

    if (!select || !btn) return;
    const selectedOpt = select.options[select.selectedIndex];
    if (!selectedOpt || !selectedOpt.value && !selectedOpt.getAttribute('data-version')) {
      btn.disabled = true;
      btn.textContent = 'Скачать / Обновить';
      return;
    }

    const isPre = selectedOpt.getAttribute('data-prerelease') === 'true';
    const ver = selectedOpt.getAttribute('data-version') || '';
    const downloadURL = selectedOpt.value;

    // Update Badge
    if (badge) {
      badge.textContent = isPre ? 'Pre-release' : 'Stable';
      badge.className = `version-tag-badge ${isPre ? 'version-tag-prerelease' : 'version-tag-stable'}`;
    }

    // Check if matching currently installed
    const currentInstalledVer = this.getCurrentCoreVersion(cfg.coreType);
    const norm = (v) => (v || '').toLowerCase().replace(/^v/, '').trim();
    const isCurrent = currentInstalledVer && norm(ver) === norm(currentInstalledVer);

    if (isCurrent) {
      btn.disabled = true;
      btn.textContent = '✓ Установлено';
    } else if (!downloadURL) {
      btn.disabled = true;
      btn.textContent = 'Нет Windows архива';
    } else {
      btn.disabled = false;
      btn.textContent = `Скачать ${ver}`;
    }
  }

  async handleReloadDLL() {
    window.toasts.info('Перезагрузка sentinel-core.dll...');
    try {
      const res = await window.bridge.reloadCoreDLL();
      if (res && res.success) {
        window.toasts.success(`DLL успешно перезагружена! Версия: ${res.version}`);
        await this.checkStatus();
        if (window.sidebarView) window.sidebarView.updateFooter();
      } else {
        window.toasts.error(`Ошибка перезагрузки DLL: ${res?.error}`);
      }
    } catch (e) {
      window.toasts.error('Ошибка: ' + e);
    }
  }

  async handleUpdateGeo() {
    window.toasts.info('Запуск обновления GeoIP и GeoSite баз...');
    this.showProgress('Обновление Geo баз...');
    try {
      const res = await window.bridge.updateGeoDatabases();
      if (res) {
        window.toasts.success('GeoIP и GeoSite базы успешно обновлены');
      } else {
        window.toasts.error('Ошибка обновления Geo баз');
      }
    } catch (e) {
      window.toasts.error('Ошибка: ' + e);
    } finally {
      this.hideProgress();
    }
  }

  showProgress(title) {
    const box = document.getElementById('download-progress-container');
    const titleEl = document.getElementById('download-progress-title');
    const percentEl = document.getElementById('download-progress-percent');
    const fillEl = document.getElementById('download-progress-fill');

    if (box) box.classList.remove('hidden');
    if (titleEl) titleEl.textContent = title;
    if (percentEl) percentEl.textContent = '0%';
    if (fillEl) fillEl.style.width = '0%';
  }

  hideProgress() {
    const box = document.getElementById('download-progress-container');
    if (box) {
      setTimeout(() => box.classList.add('hidden'), 1000);
    }
  }

  handleDownloadProgress(payload) {
    const percentEl = document.getElementById('download-progress-percent');
    const fillEl = document.getElementById('download-progress-fill');
    if (percentEl) percentEl.textContent = `${payload.percent}%`;
    if (fillEl) fillEl.style.width = `${payload.percent}%`;
  }
}

window.coresView = new CoresView();

