export type Language = 'ru' | 'en';

export interface TranslationDictionary {
  // Sidebar Navigation
  nav_dashboard: string;
  nav_connections: string;
  nav_routing: string;
  nav_cores: string;
  nav_logs: string;
  nav_hotspot: string;
  nav_settings: string;
  nav_vpn_status: string;
  nav_active_core: string;

  // Header & Status
  status_connected: string;
  status_disconnected: string;
  status_connecting: string;
  status_disconnecting: string;
  status_error: string;
  header_hotspot_btn: string;

  // Dashboard / Connection Ring
  dash_click_to_connect: string;
  dash_click_to_disconnect: string;
  dash_connecting: string;
  dash_disconnecting: string;
  dash_download: string;
  dash_upload: string;
  dash_total_down: string;
  dash_total_up: string;
  dash_ping: string;
  dash_ping_all: string;
  dash_servers_list: string;
  dash_search_servers: string;
  dash_no_servers: string;
  dash_add_server: string;
  dash_import_sub: string;
  dash_hotspot_link: string;

  // Server List
  server_search_ph: string;
  server_add_btn: string;
  server_tab_all: string;
  server_tab_favorites: string;
  server_not_found: string;
  server_empty_hint: string;

  // Routing Manager
  route_title: string;
  route_subtitle: string;
  route_add_rule: string;
  route_quick_presets: string;
  route_quick_hint: string;
  route_table_title: string;
  route_col_num: string;
  route_col_name: string;
  route_col_conditions: string;
  route_col_action: string;
  route_col_status: string;
  route_col_actions: string;
  route_no_rules: string;
  route_modal_add_title: string;
  route_modal_edit_title: string;
  route_modal_rule_name: string;
  route_modal_domains: string;
  route_modal_ips: string;
  route_modal_action: string;
  route_cancel: string;
  route_save: string;
  route_action_vpn: string;
  route_action_direct: string;
  route_action_blocked: string;

  // Core Manager
  cores_title: string;
  cores_subtitle: string;
  cores_refresh: string;
  cores_prereleases: string;
  cores_prereleases_desc: string;
  cores_active_badge: string;
  cores_available_badge: string;
  cores_installed_label: string;
  cores_not_installed: string;
  cores_download_btn: string;
  cores_downloading: string;
  cores_cache_label: string;
  cores_check_updates: string;
  cores_select_btn: string;
  cores_selected_btn: string;
  cores_available_github: string;
  cores_install_ver: string;
  cores_geo_title: string;
  cores_geo_badge: string;
  cores_geo_desc: string;
  cores_geo_update_btn: string;
  cores_geo_updating: string;
  cores_geo_updated_success: string;
  cores_geo_dat_status: string;
  cores_geo_db_status: string;

  // Logs View
  logs_title: string;
  logs_subtitle: string;
  logs_search_ph: string;
  logs_clear: string;
  logs_copy: string;
  logs_empty: string;
  logs_stream_pause: string;
  logs_stream_live: string;
  logs_all_cores: string;
  logs_all_levels: string;
  logs_core_label: string;
  logs_level_label: string;

  // Hotspot View
  hotspot_title: string;
  hotspot_subtitle: string;
  hotspot_step1_title: string;
  hotspot_step1_desc: string;
  hotspot_pin_code: string;
  hotspot_refresh_pin: string;
  hotspot_step2_title: string;
  hotspot_step2_desc: string;
  hotspot_paste_ph: string;
  hotspot_phone_ip: string;
  hotspot_request_btn: string;
  hotspot_paste_card_title: string;
  hotspot_paste_card_desc: string;
  hotspot_clipboard_content: string;
  hotspot_clipboard_empty_hint: string;
  hotspot_paste_btn: string;
  hotspot_status_clipboard_empty: string;
  hotspot_status_imported_success: string;
  hotspot_status_invalid_format: string;
  hotspot_status_clipboard_error: string;
  hotspot_status_enter_ip: string;
  hotspot_status_generating_pin: string;
  hotspot_status_pin_generated: string;
  hotspot_status_pairing_success: string;
  hotspot_status_pairing_error: string;

  // Cores Toasts & Labels
  cores_toast_github_updated_title: string;
  cores_toast_github_updated_desc: string;
  cores_toast_installed_title: string;
  cores_toast_installed_desc: string;
  cores_toast_download_error_title: string;
  cores_toast_download_error_desc: string;
  cores_toast_install_error: string;
  cores_tun_driver: string;

  // Presets
  preset_bittorrent_name: string;
  preset_bittorrent_desc: string;
  preset_ads_name: string;
  preset_ads_desc: string;
  preset_cn_name: string;
  preset_cn_desc: string;
  preset_ru_name: string;
  preset_ru_desc: string;
  preset_us_name: string;
  preset_us_desc: string;
  preset_ip_service_name: string;
  preset_ip_service_desc: string;

  // Settings View
  set_title: string;
  set_subtitle: string;
  set_language: string;
  set_language_desc: string;
  set_sys_proxy: string;
  set_sys_proxy_desc: string;
  set_tun_mode: string;
  set_tun_mode_desc: string;
  set_lan_sharing: string;
  set_lan_sharing_desc: string;
  set_auto_connect: string;
  set_auto_connect_desc: string;
  set_auto_start: string;
  set_auto_start_desc: string;
  set_dns_server: string;
  set_dns_server_desc: string;
  set_socks_port: string;
  set_http_port: string;
  set_theme: string;
  set_theme_cosmic: string;
  set_theme_oled: string;
  set_section_network: string;
  set_section_engine: string;
  set_default_core: string;
  set_default_core_desc: string;
  set_log_level: string;
  set_log_level_desc: string;

  // Modals & Toasts
  sub_modal_title: string;
  sub_modal_desc: string;
  sub_modal_textarea_ph: string;
  sub_modal_import_btn: string;
  toast_success: string;
  toast_error: string;
  toast_info: string;
}
