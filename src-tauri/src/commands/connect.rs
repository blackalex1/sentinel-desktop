use serde::{Deserialize, Serialize};
use crate::process_manager::runner::VpnProcessRunner;
use crate::network::system_proxy::enable_system_proxy;

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VpnServer {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub protocol: String,
    #[serde(default)]
    pub address: String,
    #[serde(default)]
    pub port: u16,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub uuid: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub security: Option<String>,
    #[serde(default)]
    pub sni: Option<String>,
    #[serde(default)]
    pub pbk: Option<String>,
    #[serde(default)]
    pub sid: Option<String>,
    #[serde(default)]
    pub fp: Option<String>,
    #[serde(default)]
    pub flow: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub active_core: String,
    #[serde(default)]
    pub tun_mode: bool,
    #[serde(default)]
    pub system_proxy: bool,
    #[serde(default)]
    pub socks_port: Option<u16>,
    #[serde(default)]
    pub http_port: Option<u16>,
}

pub fn is_running_as_admin() -> bool {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::Security::{GetTokenInformation, TOKEN_ELEVATION, TokenElevation, TOKEN_QUERY};
        use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
        use windows_sys::Win32::Foundation::HANDLE;

        unsafe {
            let mut token: HANDLE = std::ptr::null_mut();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) != 0 {
                let mut elevation: TOKEN_ELEVATION = std::mem::zeroed();
                let mut size = std::mem::size_of::<TOKEN_ELEVATION>() as u32;
                let res = GetTokenInformation(
                    token,
                    TokenElevation,
                    &mut elevation as *mut _ as *mut _,
                    size,
                    &mut size,
                );
                windows_sys::Win32::Foundation::CloseHandle(token);
                if res != 0 {
                    return elevation.TokenIsElevated != 0;
                }
            }
        }
        false
    }
    #[cfg(not(target_os = "windows"))]
    true
}

#[tauri::command]
pub fn check_is_admin() -> bool {
    is_running_as_admin()
}

#[cfg(target_os = "windows")]
extern "system" {
    fn ShellExecuteW(
        hwnd: usize,
        lpOperation: *const u16,
        lpFile: *const u16,
        lpParameters: *const u16,
        lpDirectory: *const u16,
        nShowCmd: i32,
    ) -> usize;
}

#[tauri::command]
pub fn request_admin_elevation() -> Result<bool, String> {
    if !is_running_as_admin() {
        println!("[Elevation] App is not elevated, triggering native ShellExecuteW UAC prompt...");
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::ffi::OsStrExt;
            if let Ok(exe_path) = std::env::current_exe() {
                let path_wide: Vec<u16> = exe_path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
                let verb_wide: Vec<u16> = std::ffi::OsStr::new("runas").encode_wide().chain(std::iter::once(0)).collect();

                unsafe {
                    ShellExecuteW(
                        0,
                        verb_wide.as_ptr(),
                        path_wide.as_ptr(),
                        std::ptr::null(),
                        std::ptr::null(),
                        1, // SW_SHOWNORMAL
                    );
                }
                // Stop VPN core before exiting to avoid orphaned processes
                crate::process_manager::runner::VpnProcessRunner::stop_core();
                std::process::exit(0);
            }
        }
    }
    Ok(true)
}

#[tauri::command]
pub fn connect_vpn(
    app: tauri::AppHandle,
    server: VpnServer,
    settings: AppSettings,
    config_json: Option<String>,
) -> Result<bool, String> {
    println!(
        "[Rust Command] connect_vpn called for server '{}' ({}:{}) via core '{}'",
        server.name, server.address, server.port, settings.active_core
    );

    // Auto-request admin elevation if TUN mode is enabled and process is not elevated
    if settings.tun_mode && !is_running_as_admin() {
        println!("[Rust connect_vpn] TUN mode requested without admin rights. Elevating via UAC...");
        let _ = request_admin_elevation();
        return Err("Запрос прав Администратора. Пожалуйста, подтвердите UAC запрос.".to_string());
    }

    let mut effective_settings = settings.clone();
    let mut target_core = settings.active_core.to_lowercase();

    // Auto-switch to sing-box for TUN mode because Sing-box natively binds wintun.dll adapter
    if settings.tun_mode && (target_core == "xray" || target_core == "auto" || target_core.is_empty()) {
        println!("[Rust connect_vpn] TUN mode requested. Switching active core to Sing-box for Wintun adapter creation.");
        target_core = "singbox".to_string();
        effective_settings.active_core = "singbox".to_string();
    }

    // Stop any existing core process to release ports before configuring
    VpnProcessRunner::stop_core();

    let preferred_socks = effective_settings.socks_port.unwrap_or(10808);
    let preferred_http = effective_settings.http_port.unwrap_or(10809);

    let socks_port = resolve_available_port(preferred_socks);
    let http_port = resolve_available_port(preferred_http);

    let raw_config_json = if target_core == "singbox" || target_core == "sing-box" {
        build_fallback_config(&server, &effective_settings, socks_port, http_port)
    } else if let Some(ref cfg) = config_json {
        if !cfg.trim().is_empty() {
            cfg.clone()
        } else {
            build_fallback_config(&server, &effective_settings, socks_port, http_port)
        }
    } else {
        build_fallback_config(&server, &effective_settings, socks_port, http_port)
    };

    let final_config_json = inject_tun_if_needed(&raw_config_json, &effective_settings);

    // Check if binary exists — if not, return error so UI can trigger download via CoreManager
    let bin_path = crate::utils::paths::get_binary_path(&target_core);
    if !bin_path.exists() || std::fs::metadata(&bin_path).map(|m| m.len()).unwrap_or(0) < 100_000 {
        let err = format!("[ERROR] Ядро '{}' не установлено. Пожалуйста, скачайте его через Менеджер Ядер.", target_core);
        println!("{}", err);
        return Err(err);
    }

    // Ensure wintun.dll is present
    if effective_settings.tun_mode {
        crate::commands::downloader::cores::ensure_wintun_extracted();
    }

    // Start binary core process with live stdout/stderr event streaming to AppHandle
    VpnProcessRunner::start_core(&app, &target_core, &final_config_json)?;

    // Enable Windows System Proxy if requested
    if effective_settings.system_proxy {
        let _ = enable_system_proxy(http_port, socks_port);
    }

    Ok(true)
}

#[tauri::command]
pub fn get_core_logs() -> Vec<String> {
    VpnProcessRunner::get_logs()
}

#[tauri::command]
pub fn clear_core_logs() {
    VpnProcessRunner::clear_logs();
}

fn build_fallback_config(
    server: &VpnServer,
    settings: &AppSettings,
    socks_port: u16,
    http_port: u16,
) -> String {
    let proto = server.protocol.to_lowercase();
    let core = settings.active_core.to_lowercase();

    if core == "singbox" || core == "sing-box" {
        let outbound = build_singbox_outbound(server, &proto);
        let config = serde_json::json!({
            "log": { "level": "info" },
            "dns": {
                "servers": [
                    { "type": "udp", "tag": "google-dns", "server": "8.8.8.8" },
                    { "type": "local", "tag": "local-dns" }
                ],
                "final": "google-dns",
                "strategy": "ipv4_only"
            },
            "inbounds": [
                { "type": "socks", "tag": "socks-in", "listen": "127.0.0.1", "listen_port": socks_port },
                { "type": "http", "tag": "http-in", "listen": "127.0.0.1", "listen_port": http_port }
            ],
            "outbounds": [
                outbound,
                { "type": "direct", "tag": "direct" }
            ],
            "route": {
                "default_domain_resolver": "google-dns",
                "auto_detect_interface": true
            }
        });
        return serde_json::to_string_pretty(&config).unwrap_or_default();
    }

    // Default Xray config format
    let outbound = build_xray_outbound(server, &proto);
    let config = serde_json::json!({
        "log": { "access": "", "error": "", "loglevel": "info" },
        "inbounds": [
            { "tag": "socks-in", "port": socks_port, "listen": "127.0.0.1", "protocol": "socks" },
            { "tag": "http-in", "port": http_port, "listen": "127.0.0.1", "protocol": "http" }
        ],
        "outbounds": [
            outbound,
            { "protocol": "freedom", "tag": "direct" }
        ]
    });
    serde_json::to_string_pretty(&config).unwrap_or_default()
}

fn build_singbox_outbound(server: &VpnServer, proto: &str) -> serde_json::Value {
    match proto {
        "socks5" | "socks" => {
            let mut obj = serde_json::json!({
                "type": "socks",
                "tag": "proxy",
                "server": server.address,
                "server_port": server.port
            });
            if let Some(u) = server.username.as_deref().filter(|s| !s.trim().is_empty()) {
                obj["username"] = serde_json::Value::String(u.to_string());
            }
            if let Some(p) = server.password.as_deref().filter(|s| !s.trim().is_empty()) {
                obj["password"] = serde_json::Value::String(p.to_string());
            }
            obj
        }
        "http" => {
            let mut obj = serde_json::json!({
                "type": "http",
                "tag": "proxy",
                "server": server.address,
                "server_port": server.port
            });
            if let Some(u) = server.username.as_deref().filter(|s| !s.trim().is_empty()) {
                obj["username"] = serde_json::Value::String(u.to_string());
            }
            if let Some(p) = server.password.as_deref().filter(|s| !s.trim().is_empty()) {
                obj["password"] = serde_json::Value::String(p.to_string());
            }
            obj
        }
        "shadowsocks" => {
            let method = server.security.as_deref().unwrap_or("aes-256-gcm");
            serde_json::json!({
                "type": "shadowsocks",
                "tag": "proxy",
                "server": server.address,
                "server_port": server.port,
                "method": method,
                "password": server.password.as_deref().unwrap_or("")
            })
        }
        "trojan" => {
            serde_json::json!({
                "type": "trojan",
                "tag": "proxy",
                "server": server.address,
                "server_port": server.port,
                "password": server.password.as_deref().unwrap_or(""),
                "tls": {
                    "enabled": true,
                    "server_name": server.sni.as_deref().unwrap_or(&server.address)
                }
            })
        }
        "hysteria2" | "hy2" => {
            serde_json::json!({
                "type": "hysteria2",
                "tag": "proxy",
                "server": server.address,
                "server_port": server.port,
                "password": server.password.as_deref().unwrap_or(""),
                "tls": {
                    "enabled": true,
                    "server_name": server.sni.as_deref().unwrap_or(&server.address)
                }
            })
        }
        _ => {
            // vless / vmess
            let is_reality = server.security.as_deref() == Some("reality") || server.pbk.is_some();
            let is_tls = is_reality || server.security.as_deref() == Some("tls") || server.sni.is_some();

            let mut obj = serde_json::json!({
                "type": "vless",
                "tag": "proxy",
                "server": server.address,
                "server_port": server.port,
                "uuid": server.uuid.as_deref().unwrap_or("")
            });

            // Flow
            let flow = server.flow.clone().unwrap_or_else(|| {
                if is_reality { "xtls-rprx-vision".to_string() } else { String::new() }
            });
            if !flow.is_empty() {
                obj["flow"] = serde_json::Value::String(flow);
            }

            // TLS
            if is_tls {
                let sni = server.sni.as_deref().unwrap_or(&server.address);
                let fp = server.fp.as_deref().unwrap_or("chrome");
                let mut tls = serde_json::json!({
                    "enabled": true,
                    "insecure": true,
                    "server_name": sni,
                    "utls": { "enabled": true, "fingerprint": fp }
                });
                if is_reality {
                    tls["reality"] = serde_json::json!({
                        "enabled": true,
                        "public_key": server.pbk.as_deref().unwrap_or(""),
                        "short_id": server.sid.as_deref().unwrap_or("")
                    });
                }
                obj["tls"] = tls;
            }
            obj
        }
    }
}

fn build_xray_outbound(server: &VpnServer, proto: &str) -> serde_json::Value {
    let proto_tag = if proto == "socks5" { "socks" } else { proto };
    let settings = match proto {
        "socks" | "socks5" => {
            let users: Vec<serde_json::Value> = match (&server.uuid, &server.password) {
                (Some(u), Some(p)) if !u.is_empty() => vec![serde_json::json!({ "user": u, "pass": p })],
                _ => vec![],
            };
            serde_json::json!({
                "servers": [{ "address": server.address, "port": server.port, "users": users }]
            })
        }
        "http" => {
            let users: Vec<serde_json::Value> = match (&server.username, &server.password) {
                (Some(u), Some(p)) if !u.is_empty() => vec![serde_json::json!({ "user": u, "pass": p })],
                _ => vec![],
            };
            serde_json::json!({
                "servers": [{ "address": server.address, "port": server.port, "users": users }]
            })
        }
        _ => {
            serde_json::json!({
                "vnext": [{
                    "address": server.address,
                    "port": server.port,
                    "users": [{ "id": server.uuid.as_deref().unwrap_or("") }]
                }]
            })
        }
    };
    serde_json::json!({
        "tag": "proxy",
        "protocol": proto_tag,
        "settings": settings
    })
}

fn inject_tun_if_needed(config_str: &str, settings: &AppSettings) -> String {
    if !settings.tun_mode {
        return config_str.to_string();
    }

    let core = settings.active_core.to_lowercase();

    if core == "singbox" || core == "sing-box" {
        if let Ok(mut val) = serde_json::from_str::<serde_json::Value>(config_str) {
            if let Some(obj) = val.as_object_mut() {
                let mut has_tun = false;

                if let Some(inbounds) = obj.get("inbounds").and_then(|i| i.as_array()) {
                    for inb in inbounds {
                        if let Some(t) = inb.get("type").and_then(|s| s.as_str()) {
                            if t == "tun" {
                                has_tun = true;
                                break;
                            }
                        }
                    }
                }

                if !has_tun {
                    let tun_inbound = serde_json::json!({
                        "type": "tun",
                        "tag": "tun-in",
                        "interface_name": "Sentinel Secure Connect",
                        "address": ["172.19.0.1/30"],
                        "auto_route": true,
                        "strict_route": true,
                        "stack": "gvisor"
                    });

                    if let Some(inbounds) = obj.get_mut("inbounds").and_then(|i| i.as_array_mut()) {
                        inbounds.push(tun_inbound);
                    } else {
                        obj.insert("inbounds".to_string(), serde_json::json!([tun_inbound]));
                    }

                    let sniff_rule = serde_json::json!({ "action": "sniff" });
                    let dns_rule = serde_json::json!({ "ip_cidr": ["172.19.0.2/32"], "action": "hijack-dns" });
                    let route_rule = serde_json::json!({
                        "inbound": ["tun-in", "socks-in", "http-in"],
                        "outbound": "proxy"
                    });

                    if let Some(route) = obj.get_mut("route").and_then(|r| r.as_object_mut()) {
                        route.insert("default_domain_resolver".to_string(), serde_json::json!("google-dns"));
                        route.insert("auto_detect_interface".to_string(), serde_json::Value::Bool(true));
                        if let Some(rules) = route.get_mut("rules").and_then(|r| r.as_array_mut()) {
                            rules.insert(0, sniff_rule);
                            rules.insert(1, dns_rule);
                            rules.insert(2, route_rule);
                        } else {
                            route.insert("rules".to_string(), serde_json::json!([sniff_rule, dns_rule, route_rule]));
                        }
                    } else {
                        obj.insert("route".to_string(), serde_json::json!({
                            "default_domain_resolver": "google-dns",
                            "rules": [sniff_rule, dns_rule, route_rule],
                            "auto_detect_interface": true
                        }));
                    }

                    if let Ok(updated) = serde_json::to_string_pretty(&val) {
                        println!("[TUN Mode] Successfully injected Sing-box Wintun GVisor TUN inbound into core configuration!");
                        return updated;
                    }
                }
            }
        }
    } else if core == "xray" {
        if let Ok(mut val) = serde_json::from_str::<serde_json::Value>(config_str) {
            if let Some(obj) = val.as_object_mut() {
                let mut has_tun = false;

                if let Some(inbounds) = obj.get("inbounds").and_then(|i| i.as_array()) {
                    for inb in inbounds {
                        if let Some(tag) = inb.get("tag").and_then(|s| s.as_str()) {
                            if tag == "tun-in" {
                                has_tun = true;
                                break;
                            }
                        }
                    }
                }

                if !has_tun {
                    let dokodemo_inbound = serde_json::json!({
                        "tag": "tun-in",
                        "port": 0,
                        "listen": "127.0.0.1",
                        "protocol": "dokodemo-door",
                        "settings": {
                            "network": "tcp,udp",
                            "followRedirect": true
                        }
                    });

                    if let Some(inbounds) = obj.get_mut("inbounds").and_then(|i| i.as_array_mut()) {
                        inbounds.push(dokodemo_inbound);
                    } else {
                        obj.insert("inbounds".to_string(), serde_json::json!([dokodemo_inbound]));
                    }

                    if let Ok(updated) = serde_json::to_string_pretty(&val) {
                        println!("[TUN Mode] Successfully injected Xray dokodemo-door inbound into core configuration!");
                        return updated;
                    }
                }
            }
        }
    }

    config_str.to_string()
}

fn is_port_available(port: u16) -> bool {
    std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
}

fn resolve_available_port(preferred: u16) -> u16 {
    if is_port_available(preferred) {
        return preferred;
    }
    for p in (preferred + 1)..=(preferred + 100) {
        if is_port_available(p) {
            println!("[Port Resolver] Preferred port {} is busy, auto-allocated available port {}", preferred, p);
            return p;
        }
    }
    preferred
}
