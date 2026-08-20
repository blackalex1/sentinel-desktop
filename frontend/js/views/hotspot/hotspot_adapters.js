/**
 * Sentinel Hotspot - Network Adapters & Gateway Detection
 */
class HotspotAdaptersModule {
  constructor(view) {
    this.view = view;
  }

  renderAdapters(adapters) {
    const select = document.getElementById('hotspot-adapter-select');
    const input = document.getElementById('hotspot-target-ip');
    if (!select) return;

    if (typeof adapters === 'string') {
      try { adapters = JSON.parse(adapters); } catch { adapters = []; }
    }

    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }

    if (Array.isArray(adapters) && adapters.length > 0) {
      let preferredGW = '';

      adapters.forEach((a, idx) => {
        const opt = document.createElement('option');
        opt.value = a.gateway;
        const icon = a.isWireless ? '📶' : '🌐';
        opt.textContent = `${icon} ${a.name} — Шлюз: ${a.gateway} (IP: ${a.ip})`;
        select.appendChild(opt);

        if (idx === 0 || (a.isWireless && !preferredGW)) {
          preferredGW = a.gateway;
        }
      });

      const customOpt = document.createElement('option');
      customOpt.value = '';
      customOpt.textContent = '✏️ Указать свой IP-адрес вручную...';
      select.appendChild(customOpt);

      if (preferredGW) {
        select.value = preferredGW;
        if (input) input.value = preferredGW;
      }
    } else {
      const currentVal = input?.value || '10.60.133.124';
      const opt1 = document.createElement('option');
      opt1.value = currentVal;
      opt1.textContent = `📶 Беспроводная сеть (Шлюз: ${currentVal})`;
      select.appendChild(opt1);

      const optCustom = document.createElement('option');
      optCustom.value = '';
      optCustom.textContent = '✏️ Указать свой IP-адрес вручную...';
      select.appendChild(optCustom);

      select.value = currentVal;
      if (input && !input.value) input.value = currentVal;
    }
  }

  async loadAdapters(showToast = false) {
    try {
      let adapters = await window.bridge.getNetworkAdapters();
      this.renderAdapters(adapters);
      if (showToast && window.toasts) {
        window.toasts.info('Список сетевых адаптеров обновлен');
      }
    } catch (e) {
      console.warn('[HotspotAdapters] Error loading adapters:', e);
      this.renderAdapters([]);
      if (showToast && window.toasts) {
        window.toasts.error(`Ошибка загрузки адаптеров: ${e.message || e}`);
      }
    }
  }
}

window.HotspotAdaptersModule = HotspotAdaptersModule;
