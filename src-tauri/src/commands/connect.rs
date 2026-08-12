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
}

#[derive(Debug, Serialize, Deserialize, Default)]
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
        use std::process::Command;
        let output = Command::new("net").arg("session").output();
        output.map(|o| o.status.success()).unwrap_or(false)
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

    let socks_port = settings.socks_port.unwrap_or(10808);
    let http_port = settings.http_port.unwrap_or(10809);

    let final_config_json = if let Some(ref cfg) = config_json {
        if !cfg.trim().is_empty() {
            cfg.clone()
        } else {
            build_fallback_config(&server, &settings, socks_port, http_port)
        }
    } else {
        build_fallback_config(&server, &settings, socks_port, http_port)
    };

    // Check if binary exists or is placeholder, auto-download if needed
    let bin_path = crate::utils::paths::get_binary_path(&settings.active_core);
    if !bin_path.exists() || std::fs::metadata(&bin_path).map(|m| m.len()).unwrap_or(0) < 100_000 {
        println!("[Rust connect_vpn] Core binary missing or placeholder, triggering auto-download...");
        let _ = tauri::async_runtime::block_on(crate::commands::downloader::download_core_binary(
            settings.active_core.clone(),
            "".to_string(),
        ));
    }

    // Start binary core process with live stdout/stderr event streaming to AppHandle
    VpnProcessRunner::start_core(&app, &settings.active_core, &final_config_json)?;

    // Enable Windows System Proxy if requested
    if settings.system_proxy {
        let _ = enable_system_proxy(http_port, socks_port);
    }

    Ok(true)
}

#[tauri::command]
pub fn get_core_logs() -> Vec<String> {
    VpnProcessRunner::get_logs()
}

fn build_fallback_config(
    server: &VpnServer,
    settings: &AppSettings,
    socks_port: u16,
    http_port: u16,
) -> String {
    let proto = server.protocol.to_lowercase();
    let core = settings.active_core.to_lowercase();

    if core == "singbox" {
        let outbound_json = match proto.as_str() {
            "socks5" | "socks" => {
                let user_field = server.uuid.as_deref().map(|u| format!(r#","username":"{}""#, u)).unwrap_or_default();
                let pass_field = server.password.as_deref().map(|p| format!(r#","password":"{}""#, p)).unwrap_or_default();
                format!(
                    r#"{{"type":"socks","tag":"proxy","server":"{}","server_port":{}{}{}}}"#,
                    server.address, server.port, user_field, pass_field
                )
            }
            "http" => {
                let user_field = server.uuid.as_deref().map(|u| format!(r#","username":"{}""#, u)).unwrap_or_default();
                let pass_field = server.password.as_deref().map(|p| format!(r#","password":"{}""#, p)).unwrap_or_default();
                format!(
                    r#"{{"type":"http","tag":"proxy","server":"{}","server_port":{}{}{}}}"#,
                    server.address, server.port, user_field, pass_field
                )
            }
            "shadowsocks" => {
                format!(
                    r#"{{"type":"shadowsocks","tag":"proxy","server":"{}","server_port":{},"method":"aes-256-gcm","password":"{}"}}"#,
                    server.address, server.port, server.password.as_deref().unwrap_or("")
                )
            }
            "trojan" => {
                format!(
                    r#"{{"type":"trojan","tag":"proxy","server":"{}","server_port":{},"password":"{}","tls":{{"enabled":true,"server_name":"{}"}}}}"#,
                    server.address, server.port, server.password.as_deref().unwrap_or(""), server.sni.as_deref().unwrap_or(&server.address)
                )
            }
            "hysteria2" | "hy2" => {
                format!(
                    r#"{{"type":"hysteria2","tag":"proxy","server":"{}","server_port":{},"password":"{}","tls":{{"enabled":true,"server_name":"{}"}}}}"#,
                    server.address, server.port, server.password.as_deref().unwrap_or(""), server.sni.as_deref().unwrap_or(&server.address)
                )
            }
            _ => { // vless / vmess
                format!(
                    r#"{{"type":"vless","tag":"proxy","server":"{}","server_port":{},"uuid":"{}","flow":"xtls-rprx-vision","tls":{{"enabled":true,"server_name":"{}"}}}}"#,
                    server.address, server.port, server.uuid.as_deref().unwrap_or(""), server.sni.as_deref().unwrap_or(&server.address)
                )
            }
        };

        return format!(
            r#"{{
  "log": {{ "level": "info" }},
  "inbounds": [
    {{ "type": "socks", "tag": "socks-in", "listen": "127.0.0.1", "listen_port": {} }},
    {{ "type": "http", "tag": "http-in", "listen": "127.0.0.1", "listen_port": {} }}
  ],
  "outbounds": [
    {},
    {{ "type": "direct", "tag": "direct" }}
  ]
}}"#,
            socks_port, http_port, outbound_json
        );
    }

    // Default Xray config format
    let outbound_settings = match proto.as_str() {
        "socks" | "socks5" => {
            let users_json = match (&server.uuid, &server.password) {
                (Some(u), Some(p)) if !u.is_empty() => format!(r#"[{{ "user": "{}", "pass": "{}" }}]"#, u, p),
                _ => "[]".to_string(),
            };
            format!(
                r#"{{
        "servers": [
          {{
            "address": "{}",
            "port": {},
            "users": {}
          }}
        ]
      }}"#,
                server.address, server.port, users_json
            )
        }
        "http" => {
            let users_json = match (&server.uuid, &server.password) {
                (Some(u), Some(p)) if !u.is_empty() => format!(r#"[{{ "user": "{}", "pass": "{}" }}]"#, u, p),
                _ => "[]".to_string(),
            };
            format!(
                r#"{{
        "servers": [
          {{
            "address": "{}",
            "port": {},
            "users": {}
          }}
        ]
      }}"#,
                server.address, server.port, users_json
            )
        }
        _ => {
            format!(
                r#"{{
        "vnext": [
          {{
            "address": "{}",
            "port": {},
            "users": [{{ "id": "{}" }}]
          }}
        ]
      }}"#,
                server.address, server.port, server.uuid.as_deref().unwrap_or("")
            )
        }
    };

    let proto_tag = match proto.as_str() {
        "socks5" => "socks",
        _ => &proto,
    };

    format!(
        r#"{{
  "log": {{ "access": "", "error": "", "loglevel": "info" }},
  "inbounds": [
    {{ "tag": "socks-in", "port": {}, "listen": "127.0.0.1", "protocol": "socks" }},
    {{ "tag": "http-in", "port": {}, "listen": "127.0.0.1", "protocol": "http" }}
  ],
  "outbounds": [
    {{
      "tag": "proxy",
      "protocol": "{}",
      "settings": {}
    }},
    {{ "protocol": "freedom", "tag": "direct" }}
  ]
}}"#,
        socks_port, http_port, proto_tag, outbound_settings
    )
}

