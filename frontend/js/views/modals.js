/**
 * Sentinel Secure Desktop - Modals View
 */

class ModalsView {
  constructor() {
    this.editingServerId = null;
    this.ruleModalCallback = null;
  }

  init() {
    const backdrop = document.getElementById('modal-backdrop');
    const closeBtns = document.querySelectorAll('[data-close-modal]');
    const btnSaveServer = document.getElementById('btn-save-server-modal');
    const btnSubmitImport = document.getElementById('btn-submit-import');
    const btnSaveRule = document.getElementById('btn-save-rule-modal');

    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => this.closeAll());
    });

    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.closeAll();
      });
    }

    if (btnSaveServer) {
      btnSaveServer.addEventListener('click', () => this.handleSaveServer());
    }

    if (btnSubmitImport) {
      btnSubmitImport.addEventListener('click', () => this.handleSubmitImport());
    }

    if (btnSaveRule) {
      btnSaveRule.addEventListener('click', () => this.handleSaveRule());
    }

    const btnSubmitPresetImport = document.getElementById('btn-submit-preset-import');
    if (btnSubmitPresetImport) {
      btnSubmitPresetImport.addEventListener('click', () => this.handleSubmitPresetImport());
    }

    const presetSourceSelect = document.getElementById('preset-import-source');
    if (presetSourceSelect) {
      presetSourceSelect.addEventListener('change', (e) => {
        const fileGroup = document.getElementById('preset-file-group');
        if (fileGroup) {
          fileGroup.style.display = e.target.value === 'custom' ? 'flex' : 'none';
        }
      });
    }

    // Toggle Reality fields based on security dropdown
    const secSelect = document.getElementById('edit-server-security');
    if (secSelect) {
      secSelect.addEventListener('change', (e) => {
        const realityRow = document.getElementById('row-reality-keys');
        if (realityRow) {
          if (e.target.value === 'reality') {
            realityRow.classList.remove('hidden');
          } else {
            realityRow.classList.add('hidden');
          }
        }
      });
    }

    // Quick link parsing in Server Editor Modal
    const quickLinkInput = document.getElementById('edit-server-quick-link');
    const btnPasteQuickLink = document.getElementById('btn-paste-quick-link');

    const handleQuickLink = async (text) => {
      if (!text || !text.trim()) return;
      try {
        const parsed = await window.bridge.parseProxyURI(text.trim());
        if (parsed && (parsed.address || parsed.server)) {
          this.populateFormFromParsed(parsed);
          window.toasts.success('Ссылка успешно распознана и вставлена в форму!');
        } else {
          window.toasts.error('Не удалось распознать ссылку на сервер');
        }
      } catch (err) {
        console.error('URI parse error:', err);
      }
    };

    if (quickLinkInput) {
      quickLinkInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val.includes('://')) {
          handleQuickLink(val);
        }
      });
      quickLinkInput.addEventListener('paste', (e) => {
        setTimeout(() => {
          const val = quickLinkInput.value.trim();
          if (val.includes('://')) {
            handleQuickLink(val);
          }
        }, 50);
      });
    }

    if (btnPasteQuickLink) {
      btnPasteQuickLink.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.trim()) {
            if (quickLinkInput) quickLinkInput.value = text.trim();
            await handleQuickLink(text.trim());
          } else {
            window.toasts.info('Буфер обмена пуст');
          }
        } catch (err) {
          window.toasts.error('Нет доступа к буферу обмена');
        }
      });
    }

    this.closeAll();
  }

  populateFormFromParsed(parsed) {
    if (!parsed) return;
    const inName = document.getElementById('edit-server-name');
    const inProto = document.getElementById('edit-server-protocol');
    const inAddr = document.getElementById('edit-server-address');
    const inPort = document.getElementById('edit-server-port');
    const inUUID = document.getElementById('edit-server-uuid');
    const inSec = document.getElementById('edit-server-security');
    const inSNI = document.getElementById('edit-server-sni');
    const inPBK = document.getElementById('edit-server-pbk');
    const inSID = document.getElementById('edit-server-sid');
    const inFP = document.getElementById('edit-server-fp');
    const inFlow = document.getElementById('edit-server-flow');
    const realityRow = document.getElementById('row-reality-keys');

    if (inName) inName.value = parsed.name || parsed.ps || `${parsed.protocol || 'NODE'} - ${parsed.address || parsed.server}`;
    if (inProto && parsed.protocol) inProto.value = parsed.protocol.toLowerCase();
    if (inAddr) inAddr.value = parsed.address || parsed.server || '';
    if (inPort) inPort.value = parsed.port || 443;
    if (inUUID) inUUID.value = parsed.uuid || parsed.id || parsed.password || '';
    
    const sec = (parsed.security || (parsed.tls ? 'tls' : 'none')).toLowerCase();
    if (inSec) inSec.value = sec;
    if (realityRow) {
      if (sec === 'reality') {
        realityRow.classList.remove('hidden');
      } else {
        realityRow.classList.add('hidden');
      }
    }

    if (inSNI) inSNI.value = parsed.sni || parsed.host || parsed.serverName || '';
    if (inPBK) inPBK.value = parsed.pbk || parsed.publicKey || '';
    if (inSID) inSID.value = parsed.sid || parsed.shortId || '';
    if (inFP && parsed.fp) inFP.value = parsed.fp.toLowerCase();
    if (inFlow) inFlow.value = parsed.flow || '';
  }

  // Confirmation Dialog Promise
  showConfirm({ title = 'Подтверждение', message = 'Вы уверены?', okText = 'Подтвердить', cancelText = 'Отмена', danger = true } = {}) {
    return new Promise((resolve) => {
      this.closeAll();
      const backdrop = document.getElementById('modal-backdrop');
      const modal = document.getElementById('modal-confirm');
      const titleEl = document.getElementById('modal-confirm-title');
      const msgEl = document.getElementById('modal-confirm-message');
      const okBtn = document.getElementById('modal-confirm-ok');
      const cancelBtn = document.getElementById('modal-confirm-cancel');

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      if (okBtn) {
        okBtn.textContent = okText;
        okBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
      }
      if (cancelBtn) cancelBtn.textContent = cancelText;

      const cleanup = () => {
        if (okBtn) okBtn.onclick = null;
        if (cancelBtn) cancelBtn.onclick = null;
        this.closeAll();
      };

      if (okBtn) {
        okBtn.onclick = (e) => {
          e.stopPropagation();
          cleanup();
          resolve(true);
        };
      }

      if (cancelBtn) {
        cancelBtn.onclick = (e) => {
          e.stopPropagation();
          cleanup();
          resolve(false);
        };
      }

      if (backdrop) backdrop.classList.remove('hidden');
      if (modal) modal.classList.remove('hidden');
    });
  }

  openServerEditor(server = null) {
    this.closeAll();
    const backdrop = document.getElementById('modal-backdrop');
    const modal = document.getElementById('modal-server-editor');
    const title = document.getElementById('modal-server-title');

    const inQuick = document.getElementById('edit-server-quick-link');
    const inName = document.getElementById('edit-server-name');
    const inProto = document.getElementById('edit-server-protocol');
    const inAddr = document.getElementById('edit-server-address');
    const inPort = document.getElementById('edit-server-port');
    const inUUID = document.getElementById('edit-server-uuid');
    const inSec = document.getElementById('edit-server-security');
    const inSNI = document.getElementById('edit-server-sni');
    const inPBK = document.getElementById('edit-server-pbk');
    const inSID = document.getElementById('edit-server-sid');
    const inFP = document.getElementById('edit-server-fp');
    const inFlow = document.getElementById('edit-server-flow');
    const realityRow = document.getElementById('row-reality-keys');

    if (inQuick) inQuick.value = '';

    if (server) {
      this.editingServerId = server.id;
      if (title) title.textContent = 'Редактирование сервера';
      if (inName) inName.value = server.name || '';
      if (inProto) inProto.value = (server.protocol || 'vless').toLowerCase();
      if (inAddr) inAddr.value = server.address || '';
      if (inPort) inPort.value = server.port || 443;
      if (inUUID) inUUID.value = server.uuid || server.password || '';
      if (inSec) inSec.value = server.security || 'reality';
      if (inSNI) inSNI.value = server.sni || '';
      if (inPBK) inPBK.value = server.pbk || '';
      if (inSID) inSID.value = server.sid || '';
      if (inFP) inFP.value = server.fp || 'chrome';
      if (inFlow) inFlow.value = server.flow || '';
    } else {
      this.editingServerId = null;
      if (title) title.textContent = 'Добавление сервера';
      if (inName) inName.value = 'Новый сервер';
      if (inProto) inProto.value = 'vless';
      if (inAddr) inAddr.value = '';
      if (inPort) inPort.value = 443;
      if (inUUID) inUUID.value = '';
      if (inSec) inSec.value = 'reality';
      if (inSNI) inSNI.value = '';
      if (inPBK) inPBK.value = '';
      if (inSID) inSID.value = '';
      if (inFP) inFP.value = 'chrome';
      if (inFlow) inFlow.value = 'xtls-rprx-vision';
    }

    if (realityRow) {
      const secVal = inSec ? inSec.value : 'reality';
      if (secVal === 'reality') {
        realityRow.classList.remove('hidden');
      } else {
        realityRow.classList.add('hidden');
      }
    }

    if (backdrop) backdrop.classList.remove('hidden');
    if (modal) modal.classList.remove('hidden');
  }

  openSubImport() {
    this.closeAll();
    const backdrop = document.getElementById('modal-backdrop');
    const modal = document.getElementById('modal-sub-import');
    const textarea = document.getElementById('import-sub-textarea');

    if (textarea) textarea.value = '';
    if (backdrop) backdrop.classList.remove('hidden');
    if (modal) modal.classList.remove('hidden');
  }

  openRoutingRuleModal(ruleId = null) {
    this.closeAll();
    const backdrop = document.getElementById('modal-backdrop');
    const modal = document.getElementById('modal-custom-rule');
    const titleEl = document.getElementById('modal-routing-rule-title');
    const inId = document.getElementById('rule-modal-id');
    const inRemark = document.getElementById('rule-modal-remark');
    const inOutbound = document.getElementById('rule-modal-outbound');
    const inProtocols = document.getElementById('rule-modal-protocols');
    const inInbounds = document.getElementById('rule-modal-inbounds');
    const inDomains = document.getElementById('rule-modal-domains');
    const inIPs = document.getElementById('rule-modal-ips');
    const inEnable = document.getElementById('rule-modal-enable');

    // Populate outbound options dynamically
    if (inOutbound) {
      let opts = `
        <option value="DIRECT">DIRECT (Прямо)</option>
        <option value="BLOCKED">BLOCKED (Блок)</option>
        <option value="PROXY">PROXY (VPN)</option>
      `;
      (window.state.servers || []).forEach(srv => {
        opts += `<option value="SRV_${srv.id}">${srv.name} (${srv.protocol})</option>`;
      });
      inOutbound.innerHTML = opts;
    }

    if (ruleId) {
      const rule = (window.state.routingRules || []).find(r => r.id === ruleId);
      if (rule) {
        if (titleEl) titleEl.textContent = 'Редактирование правила';
        if (inId) inId.value = String(rule.id);
        if (inRemark) inRemark.value = rule.remark || rule.name || '';
        if (inOutbound) inOutbound.value = (rule.outbound_tag || rule.action || 'DIRECT').toUpperCase();
        if (inProtocols) inProtocols.value = Array.isArray(rule.protocols) ? rule.protocols.join(', ') : (rule.protocols || '');
        if (inInbounds) inInbounds.value = Array.isArray(rule.inbounds) ? rule.inbounds.join(', ') : (rule.inbounds || '');
        if (inDomains) inDomains.value = Array.isArray(rule.domains) ? rule.domains.join('\n') : (rule.domains || '');
        if (inIPs) inIPs.value = Array.isArray(rule.ips) ? rule.ips.join('\n') : (rule.ips || '');
        if (inEnable) inEnable.checked = rule.enable === 1 || rule.enabled !== false;
      }
    } else {
      if (titleEl) titleEl.textContent = 'Новое правило маршрутизации';
      if (inId) inId.value = '';
      if (inRemark) inRemark.value = '';
      if (inOutbound) inOutbound.value = 'DIRECT';
      if (inProtocols) inProtocols.value = '';
      if (inInbounds) inInbounds.value = '';
      if (inDomains) inDomains.value = '';
      if (inIPs) inIPs.value = '';
      if (inEnable) inEnable.checked = true;
    }

    if (backdrop) backdrop.classList.remove('hidden');
    if (modal) modal.classList.remove('hidden');
  }

  handleSaveRule() {
    const idVal = document.getElementById('rule-modal-id')?.value;
    const remark = document.getElementById('rule-modal-remark')?.value.trim();
    const outbound = document.getElementById('rule-modal-outbound')?.value;
    const protocolsStr = document.getElementById('rule-modal-protocols')?.value.trim();
    const inboundsStr = document.getElementById('rule-modal-inbounds')?.value.trim();
    const domainsStr = document.getElementById('rule-modal-domains')?.value.trim();
    const ipsStr = document.getElementById('rule-modal-ips')?.value.trim();
    const isEnabled = document.getElementById('rule-modal-enable')?.checked;

    if (!remark) {
      window.toasts.error('Укажите название или описание правила!');
      return;
    }

    const protocols = protocolsStr ? protocolsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
    const inbounds = inboundsStr ? inboundsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
    const domains = domainsStr ? domainsStr.split(/[\n,]/).map(s => s.trim()).filter(Boolean) : [];
    const ips = ipsStr ? ipsStr.split(/[\n,]/).map(s => s.trim()).filter(Boolean) : [];

    const currentRules = [...(window.state.routingRules || [])];

    if (idVal) {
      const numId = isNaN(Number(idVal)) ? idVal : Number(idVal);
      const idx = currentRules.findIndex(r => r.id === numId || String(r.id) === String(idVal));
      if (idx !== -1) {
        currentRules[idx] = {
          ...currentRules[idx],
          remark,
          outbound_tag: outbound,
          protocols,
          inbounds,
          domains,
          ips,
          enable: isEnabled ? 1 : 0,
        };
        window.state.saveRoutingRules(currentRules);
        window.toasts.success('Правило обновлено');
      }
    } else {
      const newRule = {
        id: Date.now(),
        remark,
        outbound_tag: outbound,
        protocols,
        inbounds,
        domains,
        ips,
        enable: isEnabled ? 1 : 0,
      };
      currentRules.push(newRule);
      window.state.saveRoutingRules(currentRules);
      window.toasts.success('Правило добавлено');
    }

    this.closeAll();
  }

  openPresetImportModal() {
    this.closeAll();
    const backdrop = document.getElementById('modal-backdrop');
    const modal = document.getElementById('modal-preset-import');
    const textarea = document.getElementById('preset-import-json');
    const select = document.getElementById('preset-import-source');
    const fileGroup = document.getElementById('preset-file-group');

    if (textarea) textarea.value = '';
    if (select) select.value = 'custom';
    if (fileGroup) fileGroup.style.display = 'flex';

    if (backdrop) backdrop.classList.remove('hidden');
    if (modal) modal.classList.remove('hidden');
  }

  handleSubmitPresetImport() {
    const select = document.getElementById('preset-import-source');
    const source = select?.value || 'custom';

    if (source === 'custom') {
      const textarea = document.getElementById('preset-import-json');
      const text = textarea?.value.trim();
      if (!text) {
        window.toasts.error('Вставьте JSON пресета в поле');
        return;
      }
      try {
        const parsed = JSON.parse(text);
        if (parsed.routingRules && Array.isArray(parsed.routingRules)) {
          window.state.saveRoutingRules(parsed.routingRules);
        }
        if (parsed.quickRules && typeof parsed.quickRules === 'object') {
          window.state.saveQuickRules(parsed.quickRules);
        }
        window.toasts.success('Пользовательский пресет успешно применен');
        this.closeAll();
      } catch (err) {
        window.toasts.error('Ошибка в формате JSON: ' + err.message);
      }
    } else if (source === 'ru_bypass') {
      const ruRules = [
        { id: 1, remark: 'Локальная сеть (LAN)', ips: ['geoip:private'], outbound_tag: 'DIRECT', enable: 1 },
        { id: 2, remark: 'Сайты РФ (Bypass RU)', ips: ['geoip:ru'], domains: ['geosite:ru'], outbound_tag: 'DIRECT', enable: 1 },
        { id: 3, remark: 'Сервисы определения IP', domains: ['ipify.org', '2ip.ru', 'ifconfig.me'], outbound_tag: 'DIRECT', enable: 1 },
      ];
      const quick = { ...window.state.quickRules, ru: { enabled: true, outbound: 'DIRECT' } };
      window.state.saveRoutingRules(ruRules);
      window.state.saveQuickRules(quick);
      window.toasts.success('Пресет "Обход блокировок РФ" применен');
      this.closeAll();
    } else if (source === 'security_strict') {
      const secRules = [
        { id: 1, remark: 'Блокировка рекламы и трекеров', domains: ['geosite:category-ads-all'], outbound_tag: 'BLOCKED', enable: 1 },
        { id: 2, remark: 'Блокировка BitTorrent', protocols: ['bittorrent'], outbound_tag: 'BLOCKED', enable: 1 },
        { id: 3, remark: 'Блокировка QUIC (UDP 443)', protocols: ['quic'], outbound_tag: 'BLOCKED', enable: 1 },
      ];
      const quick = { ...window.state.quickRules, ads: { enabled: true, outbound: 'BLOCKED' }, bittorrent: { enabled: true, outbound: 'BLOCKED' }, quic: { enabled: true, outbound: 'BLOCKED' } };
      window.state.saveRoutingRules(secRules);
      window.state.saveQuickRules(quick);
      window.toasts.success('Пресет "Максимальная защита" применен');
      this.closeAll();
    } else if (source === 'china_direct') {
      const cnRules = [
        { id: 1, remark: 'Сайты и IP Китая', ips: ['geoip:cn'], domains: ['geosite:cn'], outbound_tag: 'DIRECT', enable: 1 },
      ];
      const quick = { ...window.state.quickRules, cn: { enabled: true, outbound: 'DIRECT' } };
      window.state.saveRoutingRules(cnRules);
      window.state.saveQuickRules(quick);
      window.toasts.success('Пресет "Прямой Китай" применен');
      this.closeAll();
    }
  }

  closeAll() {
    const backdrop = document.getElementById('modal-backdrop');
    const modals = document.querySelectorAll('.modal-box');

    if (backdrop) backdrop.classList.add('hidden');
    modals.forEach(m => m.classList.add('hidden'));
    this.editingServerId = null;
    this.ruleModalCallback = null;
  }

  handleSaveServer() {
    const name = document.getElementById('edit-server-name')?.value.trim();
    const protocol = document.getElementById('edit-server-protocol')?.value;
    const address = document.getElementById('edit-server-address')?.value.trim();
    const port = parseInt(document.getElementById('edit-server-port')?.value || '443', 10);
    const uuid = document.getElementById('edit-server-uuid')?.value.trim();
    const security = document.getElementById('edit-server-security')?.value;
    const sni = document.getElementById('edit-server-sni')?.value.trim();
    const pbk = document.getElementById('edit-server-pbk')?.value.trim();
    const sid = document.getElementById('edit-server-sid')?.value.trim();
    const fp = document.getElementById('edit-server-fp')?.value;
    const flow = document.getElementById('edit-server-flow')?.value;

    if (!name || !address) {
      window.toasts.error('Заполните название и адрес сервера!');
      return;
    }

    const payload = {
      name,
      protocol: protocol.toUpperCase(),
      address,
      port,
      uuid,
      security,
      sni,
      pbk,
      sid,
      fp,
      flow,
    };

    if (this.editingServerId) {
      window.state.updateServer(this.editingServerId, payload);
      window.toasts.success('Сервер обновлен');
    } else {
      window.state.addServer(payload);
      window.toasts.success('Сервер добавлен');
    }

    this.closeAll();
  }

  async handleSubmitImport() {
    const textarea = document.getElementById('import-sub-textarea');
    const text = textarea?.value.trim();

    if (!text) {
      window.toasts.error('Вставьте ссылки или подписку');
      return;
    }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let importedCount = 0;

    window.toasts.info(`Обработка ${lines.length} строк...`);

    for (const line of lines) {
      if (line.startsWith('http://') || line.startsWith('https://')) {
        // Fetch subscription
        try {
          const res = await fetch(line);
          const rawSub = await res.text();
          let decoded = rawSub;
          try {
            decoded = atob(rawSub.trim());
          } catch {}
          const subLines = decoded.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          for (const subLine of subLines) {
            const parsed = await window.bridge.parseProxyURI(subLine);
            if (parsed && (parsed.address || parsed.server)) {
              window.state.addServer(this.normalizeParsedNode(parsed));
              importedCount++;
            }
          }
        } catch (e) {
          window.toasts.error(`Ошибка загрузки подписки: ${e}`);
        }
      } else {
        const parsed = await window.bridge.parseProxyURI(line);
        if (parsed && (parsed.address || parsed.server)) {
          window.state.addServer(this.normalizeParsedNode(parsed));
          importedCount++;
        }
      }
    }

    if (importedCount > 0) {
      window.toasts.success(`Успешно импортировано узлов: ${importedCount}`);
      this.closeAll();
    } else {
      window.toasts.error('Не удалось распознать прокси-узлы');
    }
  }

  normalizeParsedNode(parsed) {
    return {
      name: parsed.name || parsed.ps || `${parsed.protocol || 'NODE'} - ${parsed.address || parsed.server}`,
      protocol: (parsed.protocol || 'VLESS').toUpperCase(),
      address: parsed.address || parsed.server,
      port: parsed.port || 443,
      uuid: parsed.uuid || parsed.id || parsed.password,
      password: parsed.password,
      security: parsed.security || (parsed.tls ? 'tls' : 'none'),
      sni: parsed.sni || parsed.host || parsed.serverName,
      pbk: parsed.pbk || parsed.publicKey,
      sid: parsed.sid || parsed.shortId,
      fp: parsed.fp || parsed.fingerprint || 'chrome',
      flow: parsed.flow || '',
      countryCode: '',
      isFavorite: false,
    };
  }
}

window.modalsView = new ModalsView();
