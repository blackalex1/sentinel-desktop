use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;
use crate::commands::network_info::get_default_gateways;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PairingResult {
    pub success: bool,
    pub pin: Option<String>,
    pub proxy_type: Option<String>,
    pub ip: Option<String>,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct PhonePairResponse {
    success: bool,
    #[serde(rename = "proxyType")]
    proxy_type: Option<String>,
    port: Option<u16>,
    #[serde(rename = "socksPort")]
    socks_port: Option<u16>,
    #[serde(rename = "httpPort")]
    http_port: Option<u16>,
    username: Option<String>,
    password: Option<String>,
    error: Option<String>,
}

const CANDIDATE_PORTS: [u16; 5] = [18080, 18081, 18082, 19080, 19081];

#[tauri::command]
pub async fn request_phone_pairing(
    custom_gateway_ip: Option<String>,
    pin: String,
) -> Result<PairingResult, String> {
    println!("[Rust Pairing] Starting zero-touch pairing request with PIN: {}", pin);

    let mut target_ips: Vec<String> = Vec::new();
    if let Some(custom) = custom_gateway_ip {
        let trimmed = custom.trim().to_string();
        if !trimmed.is_empty() {
            target_ips.push(trimmed);
        }
    }

    let detected_gws = get_default_gateways();
    for gw in detected_gws {
        if !target_ips.contains(&gw) {
            target_ips.push(gw);
        }
    }

    println!("[Rust Pairing] Dynamically discovered gateway IPs to probe: {:?}", target_ips);

    for ip in &target_ips {
        for port in CANDIDATE_PORTS {
            let addr = format!("{}:{}", ip, port);
            println!("[Rust Pairing] Probing pairing endpoint at {}...", addr);

            // Fast 600ms TCP probe to check if server port is responsive
            let connect_future = TcpStream::connect(&addr);
            let stream_res = timeout(Duration::from_millis(600), connect_future).await;

            if let Ok(Ok(mut stream)) = stream_res {
                println!("[Rust Pairing] Endpoint {} is ACTIVE! Sending pairing POST request...", addr);

                let body = serde_json::json!({
                    "clientName": "Windows 11 PC",
                    "pinCode": pin,
                    "timestamp": std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis())
                        .unwrap_or(0)
                }).to_string();

                let http_request = format!(
                    "POST /pair/request HTTP/1.1\r\n\
                     Host: {}\r\n\
                     Content-Type: application/json\r\n\
                     Content-Length: {}\r\n\
                     Connection: close\r\n\r\n\
                     {}",
                    addr,
                    body.as_bytes().len(),
                    body
                );

                if stream.write_all(http_request.as_bytes()).await.is_err() {
                    continue;
                }

                // Wait up to 32 seconds for user to confirm dialog on phone screen
                let mut response_buf = Vec::new();
                let read_future = stream.read_to_end(&mut response_buf);
                let read_res = timeout(Duration::from_secs(32), read_future).await;

                if let Ok(Ok(_)) = read_res {
                    let response_text = String::from_utf8_lossy(&response_buf);
                    println!("[Rust Pairing] Received raw response from phone:\n{}", response_text);

                    // Extract body after \r\n\r\n
                    if let Some(body_start) = response_text.find("\r\n\r\n") {
                        let json_part = &response_text[body_start + 4..];
                        if let Ok(parsed) = serde_json::from_str::<PhonePairResponse>(json_part) {
                            if parsed.success {
                                let final_port = parsed.port.or(parsed.socks_port).unwrap_or(10808);
                                let proxy_type = parsed.proxy_type.unwrap_or_else(|| "SOCKS5".to_string());
                                return Ok(PairingResult {
                                    success: true,
                                    pin: Some(pin),
                                    proxy_type: Some(proxy_type),
                                    ip: Some(ip.clone()),
                                    port: Some(final_port),
                                    username: parsed.username,
                                    password: parsed.password,
                                    message: Some(format!("Сопряжение подтверждено на смартфоне ({}:{})!", ip, final_port)),
                                });
                            } else {
                                return Ok(PairingResult {
                                    success: false,
                                    pin: None,
                                    proxy_type: None,
                                    ip: Some(ip.clone()),
                                    port: None,
                                    username: None,
                                    password: None,
                                    message: Some(parsed.error.unwrap_or_else(|| "Запрос сопряжения отклонен на смартфоне".to_string())),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(PairingResult {
        success: false,
        pin: None,
        proxy_type: None,
        ip: None,
        port: None,
        username: None,
        password: None,
        message: Some(format!(
            "Не удалось связаться со смартфоном (проверены адреса: {}). Убедитесь, что VPN в x-prox активен.",
            target_ips.join(", ")
        )),
    })
}
