/**
 * Sentinel Secure Desktop - Servers View
 */

class ServersView {
  constructor() {
    this.searchQuery = '';
    this.activeFilter = 'all';
    this.isPingingAll = false;
  }

  init() {
    const searchInput = document.getElementById('servers-search-input');
    const filterChips = document.querySelectorAll('.filter-chip');
    const btnPingAll = document.getElementById('btn-ping-all');
    const btnImportSub = document.getElementById('btn-import-sub');
    const btnAddServer = document.getElementById('btn-add-server');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeFilter = chip.getAttribute('data-filter');
        this.render();
      });
    });

    const btnClipQuick = document.getElementById('btn-clipboard-quick-add');

    if (btnClipQuick) {
      btnClipQuick.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (!text || !text.trim()) {
            window.toasts.info('Буфер обмена пуст');
            return;
          }
          const parsed = await window.bridge.parseProxyURI(text.trim());
          if (parsed && (parsed.address || parsed.server)) {
            const server = window.modalsView.normalizeParsedNode(parsed);
            window.state.addServer(server);
            window.toasts.success(`Сервер "${server.name}" успешно добавлен!`);
          } else {
            window.modalsView.openServerEditor();
            const qInput = document.getElementById('edit-server-quick-link');
            if (qInput) qInput.value = text.trim();
            window.toasts.info('Вставьте ссылку на сервер или заполните вручную');
          }
        } catch (e) {
          window.modalsView.openServerEditor();
        }
      });
    }

    if (btnPingAll) {
      btnPingAll.addEventListener('click', () => this.handlePingAll());
    }

    if (btnImportSub) {
      btnImportSub.addEventListener('click', () => window.modalsView.openSubImport());
    }

    if (btnAddServer) {
      btnAddServer.addEventListener('click', () => window.modalsView.openServerEditor());
    }

    // Subscribe to state changes
    window.state.subscribe(() => this.render());
  }

  async handlePingAll() {
    if (this.isPingingAll || window.state.servers.length === 0) return;
    this.isPingingAll = true;
    window.toasts.info('Измерение задержки всех серверов...');

    const targets = window.state.servers.map(s => ({
      id: s.id,
      address: s.address,
      port: s.port || 443,
    }));

    try {
      const results = await window.bridge.batchPingNodes(targets, 2500);
      if (Array.isArray(results)) {
        results.forEach(res => {
          const latency = res.success ? Math.round(res.latencyMs) : null;
          window.state.updateServer(res.id, { pingMs: latency });
        });
        window.toasts.success('Задержка всех серверов обновлена');
      }
    } catch (e) {
      window.toasts.error('Ошибка пинга: ' + e);
    } finally {
      this.isPingingAll = false;
    }
  }

  render() {
    const container = document.getElementById('servers-list-container');
    if (!container) return;

    const filtered = window.state.servers.filter(server => {
      // 1. Text search filter
      if (this.searchQuery) {
        const matchesName = (server.name || '').toLowerCase().includes(this.searchQuery);
        const matchesAddr = (server.address || '').toLowerCase().includes(this.searchQuery);
        const matchesProto = (server.protocol || '').toLowerCase().includes(this.searchQuery);
        if (!matchesName && !matchesAddr && !matchesProto) return false;
      }

      // 2. Protocol filter chip
      if (this.activeFilter === 'fav') {
        return !!server.isFavorite;
      } else if (this.activeFilter !== 'all') {
        return (server.protocol || '').toLowerCase() === this.activeFilter;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-12 text-center text-muted">
          <div class="text-3xl mb-2">🔍</div>
          <div class="font-semibold text-sm">Серверы не найдены</div>
          <div class="text-xs text-dim mt-1">Попробуйте изменить поисковый запрос или фильтр</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    filtered.forEach(server => {
      const isSelected = server.id === window.state.selectedServerId;
      const isConnected = isSelected && window.state.status === 'connected';

      const card = document.createElement('div');
      card.className = `server-card ${isSelected ? 'active-node' : ''} ${isConnected ? 'node-connected' : ''}`;

      const pingClass = this.getPingColorClass(server.pingMs);
      const pingText = server.pingMs != null ? `${server.pingMs} ms` : '—';
      const protoNorm = (server.protocol || 'vless').toLowerCase().replace(/[^a-z0-9]/g, '');

      let selectBtnClass = 'btn-secondary';
      let selectBtnText = 'Выбрать';
      if (isConnected) {
        selectBtnClass = 'btn-connected';
        selectBtnText = '✓ Защищено';
      } else if (isSelected) {
        selectBtnClass = 'btn-primary';
        selectBtnText = '● Выбран';
      }

      card.innerHTML = `
        <div>
          <div class="server-card-header">
            <div class="server-card-info">
              <span class="server-card-flag">${this.getCountryEmoji(server.countryCode)}</span>
              <div class="min-w-0">
                <div class="server-card-title truncate" title="${server.name}">${server.name}</div>
                <div class="server-card-meta">
                  <span class="proto-tag proto-tag-${protoNorm}">${server.protocol || 'VLESS'}</span>
                  <span>${server.address}:${server.port}</span>
                </div>
              </div>
            </div>
            <button class="btn-star ${server.isFavorite ? 'is-fav' : ''}" title="Избранное">
              ${server.isFavorite ? '★' : '☆'}
            </button>
          </div>
        </div>

        <div class="server-card-footer">
          <div class="server-card-ping ${pingClass}">⚡ ${pingText}</div>
          <div class="server-card-btns">
            <button class="btn-select-connect ${selectBtnClass}">
              ${selectBtnText}
            </button>
            <button class="btn-icon-mini btn-ping-node" title="Измерить пинг этого сервера">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </button>
            <button class="btn-icon-mini btn-edit-node" title="Редактировать">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon-mini btn-copy-link" title="Копировать ссылку">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="btn-icon-mini btn-delete-node" title="Удалить">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;

      // Event bindings
      card.querySelector('.btn-star').addEventListener('click', (e) => {
        e.stopPropagation();
        window.state.toggleFavorite(server.id);
      });

      card.querySelector('.btn-select-connect').addEventListener('click', (e) => {
        e.stopPropagation();
        window.state.setSelectedServerId(server.id);
        if (window.state.status === 'disconnected') {
          window.dashboardView.handleToggleConnect();
        }
      });

      card.querySelector('.btn-ping-node').addEventListener('click', async (e) => {
        e.stopPropagation();
        const pingEl = card.querySelector('.server-card-ping');
        if (pingEl) pingEl.textContent = '⚡ ...';
        try {
          const targets = [{ id: server.id, address: server.address, port: server.port }];
          const results = await window.bridge.batchPingNodes(targets, 2500);
          if (results && results[server.id] !== undefined) {
            const ms = results[server.id];
            server.pingMs = ms >= 0 ? ms : null;
            window.state.saveServers(window.state.servers);
            this.renderServers();
          }
        } catch (err) {
          if (pingEl) pingEl.textContent = '⚡ —';
        }
      });

      card.querySelector('.btn-edit-node').addEventListener('click', (e) => {
        e.stopPropagation();
        window.modalsView.openServerEditor(server);
      });

      card.querySelector('.btn-copy-link').addEventListener('click', async (e) => {
        e.stopPropagation();
        const uri = await window.bridge.generateProxyURI(server);
        if (uri) {
          navigator.clipboard.writeText(uri);
          window.toasts.success('Ссылка на узел скопирована в буфер');
        }
      });

      card.querySelector('.btn-delete-node').addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await window.modalsView.showConfirm({
          title: 'Удаление сервера',
          message: `Вы действительно хотите удалить сервер "${server.name}"?`,
          okText: 'Удалить',
          cancelText: 'Отмена',
          danger: true,
        });
        if (confirmed) {
          window.state.deleteServer(server.id);
          window.toasts.info('Сервер удален');
        }
      });

      card.addEventListener('click', () => {
        window.state.setSelectedServerId(server.id);
        if (window.dashboardView?.checkCoreServerCompatibility) {
          window.dashboardView.checkCoreServerCompatibility();
        }
      });

      container.appendChild(card);
    });
  }

  getPingColorClass(ping) {
    if (ping == null) return 'ping-none';
    if (ping < 100) return 'ping-fast';
    if (ping < 250) return 'ping-medium';
    return 'ping-slow';
  }

  getCountryEmoji(code) {
    if (!code || code.length !== 2) return '🌐';
    return [...code.toUpperCase()]
      .map(c => String.fromCodePoint(0x1F1E0 - 65 + c.charCodeAt(0)))
      .join('');
  }
}

window.serversView = new ServersView();
