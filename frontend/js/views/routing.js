/**
 * Sentinel Secure Desktop - Routing View (Ultra-Modern Panel Integration)
 */

class RoutingView {
  constructor() {
    this.presets = [];
  }

  async init() {
    const btnSaveQuickRules = document.getElementById('btn-save-quick-rules');
    const btnAddRule = document.getElementById('btn-add-custom-rule');
    const btnExportPreset = document.getElementById('btn-export-routing-preset');
    const btnImportPreset = document.getElementById('btn-import-routing-preset');
    const btnToggleQuick = document.getElementById('btn-toggle-quick-rules');

    if (btnSaveQuickRules) {
      btnSaveQuickRules.addEventListener('click', () => this.handleSaveQuickRules());
    }

    if (btnAddRule) {
      btnAddRule.addEventListener('click', () => this.openRuleModal(null));
    }

    if (btnExportPreset) {
      btnExportPreset.addEventListener('click', () => this.handleExportPreset());
    }

    if (btnImportPreset) {
      btnImportPreset.addEventListener('click', () => this.handleImportPreset());
    }

    if (btnToggleQuick) {
      btnToggleQuick.addEventListener('click', () => this.toggleQuickRules());
    }

    const navPills = document.querySelectorAll('.routing-nav-pills .nav-pill-btn');
    navPills.forEach(btn => {
      btn.addEventListener('click', () => {
        navPills.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-tab');
        this.switchSubTab(target);
      });
    });

    // Load atomic presets from sentinel-core.dll
    await this.loadPresets();

    // Subscribe to state changes
    window.state.subscribe((s, ev) => {
      if (ev === 'routing' || ev === 'quick_rules' || ev === 'state') {
        this.render();
      }
    });

    this.render();
  }

  switchSubTab(tab) {
    const quickCard = document.getElementById('quick-security-rules-card');
    const tableCard = document.getElementById('routing-rules-table-card');

    if (tab === 'rules') {
      if (quickCard) quickCard.style.display = 'none';
      if (tableCard) tableCard.style.display = 'block';
    } else if (tab === 'presets') {
      if (quickCard) quickCard.style.display = 'block';
      if (tableCard) tableCard.style.display = 'none';
    } else {
      // 'all'
      if (quickCard) quickCard.style.display = 'block';
      if (tableCard) tableCard.style.display = 'block';
    }
  }

  toggleQuickRules() {
    const body = document.getElementById('quick-rules-collapsible-body');
    const btn = document.getElementById('btn-toggle-quick-rules');
    if (!body || !btn) return;

    const isCollapsed = body.classList.toggle('collapsed');
    const icon = btn.querySelector('.toggle-icon');
    const text = btn.querySelector('.toggle-text');

    if (isCollapsed) {
      if (icon) icon.textContent = '▼';
      if (text) text.textContent = 'Развернуть';
    } else {
      if (icon) icon.textContent = '▲';
      if (text) text.textContent = 'Свернуть';
    }
  }

  async loadPresets() {
    try {
      const res = await window.bridge.fetchRoutingPresets();
      if (res) {
        let parsed = [];
        if (typeof res === 'string') {
          try { parsed = JSON.parse(res); } catch {}
        } else if (Array.isArray(res)) {
          parsed = res;
        }
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.presets = parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load routing presets from sentinel-core:', e);
    }
  }

  render() {
    this.renderQuickRules();
    this.renderRoutingRules();
  }

  renderQuickRules() {
    const container = document.getElementById('quick-security-rules-grid');
    if (!container) return;

    const quickPresets = this.presets.filter(p => p.type === 'quick_rule' || p.type !== 'template');
    if (!quickPresets || quickPresets.length === 0) {
      container.innerHTML = `<div class="text-xs text-muted" style="grid-column: 1/-1; padding: 10px;">Загрузка правил ядра...</div>`;
      return;
    }

    const quickRulesState = window.state.quickRules || {};
    const servers = window.state.servers || [];

    const badgePresetsCount = document.getElementById('badge-presets-count');
    const summaryBadge = document.getElementById('quick-rules-active-summary');
    let activeCount = 0;
    quickPresets.forEach(p => {
      const ruleState = quickRulesState[p.id] || {};
      const isChecked = ruleState.enabled !== undefined ? ruleState.enabled : (p.defaultTarget === 'block' || p.id === 'ru' || p.id === 'ads');
      if (isChecked) activeCount++;
    });

    if (badgePresetsCount) {
      badgePresetsCount.textContent = `${activeCount}/${quickPresets.length}`;
    }
    if (summaryBadge) {
      summaryBadge.textContent = `${activeCount} из ${quickPresets.length} активны`;
    }

    container.innerHTML = '';

    quickPresets.forEach(p => {
      const presetId = p.id;
      const ruleState = quickRulesState[presetId] || {};
      const isChecked = ruleState.enabled !== undefined ? ruleState.enabled : (p.defaultTarget === 'block' || presetId === 'ru' || presetId === 'ads');
      const selectedOutbound = (ruleState.outbound || (p.defaultTarget === 'block' ? 'BLOCKED' : (p.defaultTarget || 'DIRECT'))).toUpperCase();

      const card = document.createElement('div');
      card.className = 'quick-rule-card';
      card.id = `quick-rule-card-${presetId}`;

      // Build outbound options
      let optionsHtml = `
        <option value="BLOCKED" ${selectedOutbound === 'BLOCKED' ? 'selected' : ''}>BLOCKED (Блок)</option>
        <option value="DIRECT" ${selectedOutbound === 'DIRECT' ? 'selected' : ''}>DIRECT (Прямо)</option>
        <option value="PROXY" ${selectedOutbound === 'PROXY' ? 'selected' : ''}>PROXY (VPN)</option>
      `;

      servers.forEach(srv => {
        const srvVal = `SRV_${srv.id}`;
        const isSel = selectedOutbound === srvVal ? 'selected' : '';
        optionsHtml += `<option value="${srvVal}" ${isSel}>${srv.name} (${srv.protocol})</option>`;
      });

      card.innerHTML = `
        <div class="quick-rule-header">
          <div class="quick-rule-info">
            <span class="quick-rule-name">${p.name}</span>
            <span class="quick-rule-desc">${p.description || ''}</span>
          </div>
          <label class="switch-toggle" style="margin-left: 8px;">
            <input type="checkbox" id="quick-toggle-${presetId}" ${isChecked ? 'checked' : ''} data-preset-id="${presetId}">
            <span class="switch-slider"></span>
          </label>
        </div>
        <div class="quick-rule-footer">
          <label for="quick-outbound-${presetId}">Выходной маршрут:</label>
          <select class="quick-outbound-select" id="quick-outbound-${presetId}">
            ${optionsHtml}
          </select>
        </div>
      `;

      // Click card header to toggle switch
      const infoEl = card.querySelector('.quick-rule-info');
      if (infoEl) {
        infoEl.addEventListener('click', () => {
          const toggle = card.querySelector(`#quick-toggle-${presetId}`);
          if (toggle) {
            toggle.checked = !toggle.checked;
          }
        });
      }

      container.appendChild(card);
    });
  }

  handleSaveQuickRules() {
    const quickPresets = this.presets.filter(p => p.type === 'quick_rule' || p.type !== 'template');
    const newQuickRules = {};

    quickPresets.forEach(p => {
      const toggle = document.getElementById(`quick-toggle-${p.id}`);
      const select = document.getElementById(`quick-outbound-${p.id}`);
      if (toggle && select) {
        newQuickRules[p.id] = {
          enabled: toggle.checked,
          outbound: select.value,
        };
      }
    });

    // Also sync bypassRu setting with ru preset
    if (newQuickRules['ru']) {
      window.state.updateSettings({ bypassRu: newQuickRules['ru'].enabled });
    }

    window.state.saveQuickRules(newQuickRules);
    window.toasts.success('Быстрые правила безопасности сохранены');
  }

  async renderRoutingRules() {
    const tbody = document.getElementById('routing-rules-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    let rules = window.state.routingRules;
    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      rules = await window.bridge.getDefaultRoutingRules();
      if (Array.isArray(rules) && rules.length > 0) {
        window.state.routingRules = rules;
        window.state.saveRoutingRules(rules);
      } else {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">Нет правил маршрутизации. Нажмите "Добавить правило" выше.</td></tr>`;
        return;
      }
    }

    const badgeRulesCount = document.getElementById('badge-rules-count');
    if (badgeRulesCount) {
      badgeRulesCount.textContent = (rules || []).length;
    }

    rules.forEach((rule, idx) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-rule-id', rule.id);

      // Conditions Chips HTML
      const conditions = [];
      if (rule.inbounds && (Array.isArray(rule.inbounds) ? rule.inbounds.length > 0 : rule.inbounds)) {
        const val = Array.isArray(rule.inbounds) ? rule.inbounds.join(', ') : rule.inbounds;
        conditions.push(`<span class="condition-chip chip-inbound">Inbounds: ${val}</span>`);
      }
      if (rule.protocols && (Array.isArray(rule.protocols) ? rule.protocols.length > 0 : rule.protocols)) {
        const val = Array.isArray(rule.protocols) ? rule.protocols.join(', ') : rule.protocols;
        conditions.push(`<span class="condition-chip chip-proto">Proto: ${val}</span>`);
      }
      if (rule.domains && (Array.isArray(rule.domains) ? rule.domains.length > 0 : rule.domains)) {
        const count = Array.isArray(rule.domains) ? rule.domains.length : rule.domains.split('\n').filter(Boolean).length;
        conditions.push(`<span class="condition-chip chip-domain">Domains: ${count} шт.</span>`);
      }
      if (rule.ips && (Array.isArray(rule.ips) ? rule.ips.length > 0 : rule.ips)) {
        const val = Array.isArray(rule.ips) ? rule.ips.join(', ') : rule.ips;
        conditions.push(`<span class="condition-chip chip-ip">IPs: ${val}</span>`);
      }

      const conditionsHtml = conditions.length > 0 ? conditions.join(' ') : `<span style="color: var(--text-muted); font-size: 11px;">Any (Всегда)</span>`;

      // Destination Badge Class
      let badgeClass = 'tag-badge';
      const destUpper = String(rule.outbound_tag || rule.action || 'DIRECT').toUpperCase();
      if (destUpper === 'DIRECT') {
        badgeClass += ' tag-badge-direct';
      } else if (destUpper === 'BLOCKED' || destUpper === 'BLOCK') {
        badgeClass += ' tag-badge-blocked';
      } else if (destUpper === 'WARP') {
        badgeClass += ' tag-badge-warp';
      } else {
        badgeClass += ' tag-badge-proxy';
      }

      const isFirst = idx === 0;
      const isLast = idx === rules.length - 1;

      tr.innerHTML = `
        <td style="text-align: center;"><i class="drag-handle">⠿</i></td>
        <td style="text-align: center; font-family: var(--font-mono); font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
        <td style="font-weight: 600; color: var(--text-primary);">${rule.remark || rule.name || 'Правило #' + (idx + 1)}</td>
        <td>${conditionsHtml}</td>
        <td><span class="${badgeClass}">${destUpper}</span></td>
        <td style="text-align: center;">
          <label class="switch-toggle">
            <input type="checkbox" ${rule.enable === 1 || rule.enabled !== false ? 'checked' : ''} class="rule-enable-toggle">
            <span class="switch-slider"></span>
          </label>
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px; align-items: center;">
            <button class="table-action-btn move-up-btn" ${isFirst ? 'disabled' : ''} title="Вверх">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg>
            </button>
            <button class="table-action-btn move-down-btn" ${isLast ? 'disabled' : ''} title="Вниз">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <button class="table-action-btn edit-rule-btn" title="Редактировать">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="table-action-btn delete-btn delete-rule-btn" title="Удалить">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      `;

      // Drag & drop support
      tr.setAttribute('draggable', 'true');

      tr.addEventListener('dragstart', (e) => {
        if (e.target.closest('button, input, select, label')) {
          e.preventDefault();
          return;
        }
        this.draggedRuleId = rule.id;
        tr.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(rule.id));
      });

      tr.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = tr.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          tr.classList.add('drag-over-top');
          tr.classList.remove('drag-over-bottom');
        } else {
          tr.classList.add('drag-over-bottom');
          tr.classList.remove('drag-over-top');
        }
      });

      tr.addEventListener('dragleave', () => {
        tr.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      tr.addEventListener('drop', (e) => {
        e.preventDefault();
        tr.classList.remove('drag-over-top', 'drag-over-bottom');
        const fromId = this.draggedRuleId;
        const targetId = rule.id;
        if (fromId === targetId || fromId == null) return;

        const rules = [...window.state.routingRules];
        const fromIndex = rules.findIndex(r => r.id === fromId);
        let toIndex = rules.findIndex(r => r.id === targetId);
        if (fromIndex === -1 || toIndex === -1) return;

        const rect = tr.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertAfter = e.clientY >= midY;

        const [movedItem] = rules.splice(fromIndex, 1);
        toIndex = rules.findIndex(r => r.id === targetId);
        if (insertAfter) {
          rules.splice(toIndex + 1, 0, movedItem);
        } else {
          rules.splice(toIndex, 0, movedItem);
        }

        window.state.saveRoutingRules(rules);
        window.toasts.info('Приоритет правил обновлен');
        this.renderRoutingRules();
      });

      tr.addEventListener('dragend', () => {
        tr.classList.remove('dragging');
        document.querySelectorAll('#routing-rules-tbody tr').forEach(r => {
          r.classList.remove('drag-over-top', 'drag-over-bottom');
        });
      });

      // Event listeners
      tr.querySelector('.rule-enable-toggle').addEventListener('change', (e) => {
        this.toggleRule(rule.id, e.target.checked);
      });

      const upBtn = tr.querySelector('.move-up-btn');
      if (upBtn) {
        upBtn.addEventListener('click', () => this.moveRule(rule.id, 'up'));
      }

      const downBtn = tr.querySelector('.move-down-btn');
      if (downBtn) {
        downBtn.addEventListener('click', () => this.moveRule(rule.id, 'down'));
      }

      const editBtn = tr.querySelector('.edit-rule-btn');
      if (editBtn) {
        editBtn.addEventListener('click', () => this.openRuleModal(rule.id));
      }

      const delBtn = tr.querySelector('.delete-rule-btn');
      if (delBtn) {
        delBtn.addEventListener('click', () => this.deleteRule(rule.id));
      }

      tbody.appendChild(tr);
    });
  }

  moveRule(ruleId, direction) {
    const rules = [...window.state.routingRules];
    const idx = rules.findIndex(r => r.id === ruleId);
    if (idx === -1) return;

    if (direction === 'up' && idx > 0) {
      const temp = rules[idx];
      rules[idx] = rules[idx - 1];
      rules[idx - 1] = temp;
    } else if (direction === 'down' && idx < rules.length - 1) {
      const temp = rules[idx];
      rules[idx] = rules[idx + 1];
      rules[idx + 1] = temp;
    }

    window.state.saveRoutingRules(rules);
    window.toasts.info('Приоритет правил обновлен');
  }

  toggleRule(ruleId, isEnabled) {
    const rules = window.state.routingRules.map(r => {
      if (r.id === ruleId) {
        return { ...r, enable: isEnabled ? 1 : 0 };
      }
      return r;
    });
    window.state.saveRoutingRules(rules);
    window.toasts.info(`Правило ${isEnabled ? 'включено' : 'отключено'}`);
  }

  async deleteRule(ruleId) {
    const rule = window.state.routingRules.find(r => r.id === ruleId);
    if (!rule) return;

    const confirmed = await window.modalsView.showConfirm({
      title: 'Удаление правила',
      message: `Вы уверены, что хотите удалить правило "${rule.remark || rule.name || 'Правило'}"?`,
      okText: 'Удалить',
      cancelText: 'Отмена',
      danger: true,
    });

    if (confirmed) {
      const rules = window.state.routingRules.filter(r => r.id !== ruleId);
      window.state.saveRoutingRules(rules);
      window.toasts.info('Правило удалено');
    }
  }

  openRuleModal(ruleId = null) {
    window.modalsView.openRoutingRuleModal(ruleId);
  }

  handleExportPreset() {
    const data = {
      version: '2.0',
      type: 'sentinel_routing_preset',
      timestamp: new Date().toISOString(),
      quickRules: window.state.quickRules,
      routingRules: window.state.routingRules,
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel-routing-preset-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.toasts.success('Пресет правил успешно экспортирован');
  }

  handleImportPreset() {
    window.modalsView.openPresetImportModal();
  }
}

window.routingView = new RoutingView();

