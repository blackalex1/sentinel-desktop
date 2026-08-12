use serde::{Deserialize, Serialize};
use crate::process_manager::runner::VpnProcessRunner;
use crate::network::system_proxy::enable_system_proxy;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VpnServer {
    pub id: String,
    pub name: String,
    pub protocol: String,
    pub address: String,
    pub port: u16,
    pub uuid: Option<String>,
    pub password: Option<String>,
    pub path: Option<String>,
    pub security: Option<String>,
    pub sni: Option<String>,
    pub pbk: Option<String>,
    pub sid: Option<String>,
    pub fp: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub active_core: String,
    pub tun_mode: bool,
    pub system_proxy: bool,
    pub socks_port: Option<u16>,
    pub http_port: Option<u16>,
}

#[tauri::command]
pub fn connect_vpn(app: tauri::AppHandle, server: VpnServer, settings: AppSettings) -> Result<bool, String> {
    println!(
        "[Rust Command] connect_vpn called for server '{}' ({}:{}) via core '{}'",
        server.name, server.address, server.port, settings.active_core
    );

    let socks_port = settings.socks_port.unwrap_or(10808);
    let http_port = settings.http_port.unwrap_or(10809);

    // Build minimal fallback JSON configuration for binary runner
    let config_json = format!(
        r#"{{
  "log": {{ "loglevel": "warning" }},
  "inbounds": [
    {{ "tag": "socks-in", "port": {}, "listen": "127.0.0.1", "protocol": "socks" }},
    {{ "tag": "http-in", "port": {}, "listen": "127.0.0.1", "protocol": "http" }}
  ],
  "outbounds": [
    {{
      "tag": "proxy",
      "protocol": "{}",
      "settings": {{
        "vnext": [
          {{
            "address": "{}",
            "port": {},
            "users": [{{ "id": "{}" }}]
          }}
        ]
      }}
    }}
  ]
}}"#,
        socks_port,
        http_port,
        server.protocol.to_lowercase(),
        server.address,
        server.port,
        server.uuid.as_deref().unwrap_or("")
    );

    // Start binary core process with live stdout/stderr event streaming to AppHandle
    VpnProcessRunner::start_core(&app, &settings.active_core, &config_json)?;

    // Enable Windows System Proxy if requested
    if settings.system_proxy {
        let _ = enable_system_proxy(http_port, socks_port);
    }

    Ok(true)
}
