/**
 * Sentinel Secure Desktop - Localization (RU / EN)
 */

const translations = {
  ru: {
    nav_dashboard: "Дашборд",
    nav_servers: "Серверы",
    nav_routing: "Маршрутизация",
    nav_cores: "Менеджер ядер",
    nav_diagnostics: "Безопасность",
    nav_logs: "Логи ядра",
    nav_hotspot: "Sentinel Hotspot",
    nav_settings: "Настройки",

    status_disconnected: "ОТКЛЮЧЕНО",
    status_connecting: "ПОДКЛЮЧЕНИЕ...",
    status_connected: "ЗАЩИЩЕНО",
    status_disconnecting: "ОТКЛЮЧЕНИЕ...",
    status_error: "ОШИБКА",

    btn_connect: "ПОДКЛЮЧИТЬ",
    btn_disconnect: "ОТКЛЮЧИТЬ",
    select_server: "ВЫБЕРИТЕ СЕРВЕР",

    dash_download: "СКАЧИВАНИЕ",
    dash_upload: "ОТДАЧА",
    dash_ping: "ЗАДЕРЖКА",

    servers_title: "Управление серверами",
    servers_desc: "Узлы подключения, подписки и профили",
    ping_all: "Пинг всех",
    import_sub: "Импорт",
    add_server: "Добавить",
    search_servers: "Поиск по имени, адресу, протоколу...",

    routing_title: "Умная маршрутизация",
    routing_desc: "Атомарные пресеты Sentinel-Core и пользовательские правила",

    cores_title: "Менеджер ядер и баз",
    cores_desc: "Автономное обновление DLL и исполняемых файлов без пересборки",

    diag_title: "Диагностика и безопасность",
    diag_desc: "Проверка утечек DNS/IP, тестирование прокси и генерация ключей",

    logs_title: "Логи ядра в реальном времени",
    logs_desc: "Потоковый вывод консоли Sing-box, Xray и Hysteria",

    hotspot_title: "Sentinel Hotspot",
    hotspot_desc: "Автосопряжение с мобильной точкой доступа Sentinel Phone и раздача VPN",

    settings_title: "Параметры приложения",
    settings_desc: "Настройки системы, сети, портов и языка",
  },
  en: {
    nav_dashboard: "Dashboard",
    nav_servers: "Servers",
    nav_routing: "Routing",
    nav_cores: "Core Manager",
    nav_diagnostics: "Security",
    nav_logs: "Core Logs",
    nav_hotspot: "LAN Hotspot",
    nav_settings: "Settings",

    status_disconnected: "DISCONNECTED",
    status_connecting: "CONNECTING...",
    status_connected: "PROTECTED",
    status_disconnecting: "DISCONNECTING...",
    status_error: "ERROR",

    btn_connect: "CONNECT",
    btn_disconnect: "DISCONNECT",
    select_server: "SELECT SERVER",

    dash_download: "DOWNLOAD",
    dash_upload: "UPLOAD",
    dash_ping: "LATENCY",

    servers_title: "Server Management",
    servers_desc: "Connection nodes, subscriptions, and profiles",
    ping_all: "Ping All",
    import_sub: "Import",
    add_server: "Add Server",
    search_servers: "Search by name, address, protocol...",

    routing_title: "Smart Routing",
    routing_desc: "Atomic Sentinel-Core presets and custom rules",

    cores_title: "Core & DB Manager",
    cores_desc: "Dynamic DLL & core binary updates without rebuilding executable",

    diag_title: "Diagnostics & Security",
    diag_desc: "DNS/IP leak test, proxy latency probe, and key generation",

    logs_title: "Real-time Core Logs",
    logs_desc: "Live streaming console output from Sing-box, Xray, and Hysteria",

    hotspot_title: "LAN Sharing & Hotspot",
    hotspot_desc: "Share VPN connection with other local devices (Smart TVs, consoles, phones)",

    settings_title: "Application Settings",
    settings_desc: "System, network, port, and language preferences",
  }
};

class I18nManager {
  constructor() {
    this.currentLang = localStorage.getItem('xpc_language') || 'ru';
  }

  getLang() {
    return this.currentLang;
  }

  setLang(lang) {
    if (translations[lang]) {
      this.currentLang = lang;
      localStorage.setItem('xpc_language', lang);
      this.applyTranslations();
    }
  }

  t(key) {
    const dict = translations[this.currentLang] || translations.ru;
    return dict[key] || key;
  }

  applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.setAttribute('placeholder', this.t(key));
    });
  }
}

window.i18n = new I18nManager();
