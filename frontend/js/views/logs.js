/**
 * Sentinel Secure Desktop - Live Logs View
 */

class LogsView {
  constructor() {
    this.searchQuery = '';
    this.autoScroll = true;
    this.lines = [];
  }

  init() {
    const btnCopy = document.getElementById('btn-copy-logs');
    const btnClear = document.getElementById('btn-clear-logs');
    const searchInput = document.getElementById('logs-search-input');
    const autoScrollToggle = document.getElementById('logs-autoscroll-toggle');

    if (btnCopy) {
      btnCopy.addEventListener('click', () => this.copyLogs());
    }

    if (btnClear) {
      btnClear.addEventListener('click', () => this.clearLogs());
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    if (autoScrollToggle) {
      autoScrollToggle.addEventListener('change', (e) => {
        this.autoScroll = e.target.checked;
      });
    }

    // Subscribe to state logs
    window.state.subscribe((_, event) => {
      if (event === 'log') {
        this.render();
      }
    });

    // Listen for live Wails event
    window.bridge.onEvent('vpn-log', (logLine) => {
      window.state.addLog(logLine);
    });

    // Initial load
    this.loadInitialLogs();
  }

  async loadInitialLogs() {
    const initialLogs = await window.bridge.getLiveLogs();
    if (Array.isArray(initialLogs) && initialLogs.length > 0) {
      initialLogs.forEach(l => window.state.addLog(l));
      this.render();
    }
  }

  copyLogs() {
    const text = window.state.logs.join('\n');
    navigator.clipboard.writeText(text);
    window.toasts.success('Логи скопированы в буфер обмена');
  }

  async clearLogs() {
    window.state.clearLogs();
    await window.bridge.clearLiveLogs();
    window.toasts.info('Логи очищены');
  }

  stripAnsi(str) {
    if (!str) return '';
    return str
      .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\[\d+m/g, '')
      .replace(/\[\d+;\d+;\d+m/g, '')
      .replace(/\x1B\].*?\x07/g, '');
  }

  formatLogLine(rawLine) {
    const clean = this.stripAnsi(rawLine);
    if (!clean) return '';

    // HTML escape
    let html = clean
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 1. Timestamps [18:21:19] or +0300 2026-08-20 18:21:19
    html = html.replace(/^(\[\d{2}:\d{2}:\d{2}\])/, '<span class="log-token-ts">$1</span>');
    html = html.replace(/(\+\d{4}\s\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/, '<span class="log-token-ts">$1</span>');

    // 2. Core tag [singbox], [xray], [hysteria], [Sentinel]
    html = html.replace(/(\[(?:singbox|xray|hysteria|Sentinel)\])/gi, '<span class="log-token-core">$1</span>');

    // 3. Log levels
    html = html.replace(/\b(FATAL)\b/g, '<span class="log-token-fatal">$1</span>');
    html = html.replace(/\b(ERROR)\b/g, '<span class="log-token-error">$1</span>');
    html = html.replace(/\b(WARN|WARNING)\b/g, '<span class="log-token-warn">$1</span>');
    html = html.replace(/\b(INFO)\b/g, '<span class="log-token-info">$1</span>');
    html = html.replace(/\b(DEBUG|TRACE)\b/g, '<span class="log-token-debug">$1</span>');

    // 4. Inbound / Outbound tags
    html = html.replace(/(inbound\/[a-zA-Z0-9_\-]+\[[^\]]+\])/g, '<span class="log-token-inbound">$1</span>');
    html = html.replace(/(outbound\/[a-zA-Z0-9_\-]+\[[^\]]+\])/g, '<span class="log-token-outbound">$1</span>');

    // 5. Connection IDs and Latencies [3460855502 36ms]
    html = html.replace(/\[(\d{6,12})\s+(\d+ms)\]/g, '[<span class="log-token-conn">$1</span> <span class="log-token-latency">$2</span>]');
    html = html.replace(/\[(\d{6,12})\]/g, '[<span class="log-token-conn">$1</span>]');
    html = html.replace(/\b(\d+ms)\b/g, '<span class="log-token-latency">$1</span>');

    // 6. Action descriptions
    html = html.replace(/(inbound connection from|inbound connection to|outbound connection to|tcp server started at|http server started at|started \(\d+\.\d+s\))/gi, '<span class="log-token-action">$1</span>');

    // 7. Host / IP with Port
    html = html.replace(/((?:[0-9]{1,3}\.){3}[0-9]{1,3}):(\d{2,5})/g, '<span class="log-token-host">$1</span>:<span class="log-token-port">$2</span>');
    html = html.replace(/([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}):(\d{2,5})/g, '<span class="log-token-host">$1</span>:<span class="log-token-port">$2</span>');

    return html;
  }

  render() {
    const body = document.getElementById('terminal-body');
    if (!body) return;

    const filtered = window.state.logs.filter(line => {
      if (!this.searchQuery) return true;
      return line.toLowerCase().includes(this.searchQuery);
    });

    body.innerHTML = '';
    filtered.forEach(line => {
      const clean = this.stripAnsi(line);
      const div = document.createElement('div');
      div.className = `log-line ${this.getLogLevelClass(clean)}`;
      div.innerHTML = this.formatLogLine(line);
      body.appendChild(div);
    });

    if (this.autoScroll) {
      body.scrollTop = body.scrollHeight;
    }
  }

  getLogLevelClass(line) {
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('fatal') || lower.includes('failed')) return 'log-error';
    if (lower.includes('warn')) return 'log-warn';
    if (lower.includes('debug') || lower.includes('trace')) return 'log-debug';
    return 'log-info';
  }
}

window.logsView = new LogsView();
