use std::process::Command;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[tauri::command]
pub fn get_default_gateways() -> Vec<String> {
    let mut gateways: Vec<String> = Vec::new();

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty NextHop -Unique",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        if let Ok(out) = output {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                for line in text.lines() {
                    let ip = line.trim();
                    if !ip.is_empty() && ip != "0.0.0.0" && !gateways.contains(&ip.to_string()) {
                        gateways.push(ip.to_string());
                    }
                }
            }
        }

        // Fallback: parse ipconfig
        if gateways.is_empty() {
            let ipconfig_out = Command::new("cmd")
                .args(["/c", "ipconfig"])
                .creation_flags(CREATE_NO_WINDOW)
                .output();

            if let Ok(out) = ipconfig_out {
                let text = String::from_utf8_lossy(&out.stdout);
                for line in text.lines() {
                    if line.contains("Default Gateway") || line.contains("Основной шлюз") || line.contains("Шлюз по умолчанию") {
                        if let Some(pos) = line.find(':') {
                            let candidate = line[pos + 1..].trim();
                            if !candidate.is_empty() && candidate.chars().any(|c| c.is_ascii_digit()) && !gateways.contains(&candidate.to_string()) {
                                gateways.push(candidate.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort gateways so hotspot-like subnets (10.x.x.x, 172.20.x.x, 192.168.43.x) come first
    gateways.sort_by(|a, b| {
        let is_hotspot_a = a.starts_with("10.") || a.starts_with("172.20.") || a.starts_with("192.168.43.");
        let is_hotspot_b = b.starts_with("10.") || b.starts_with("172.20.") || b.starts_with("192.168.43.");
        match (is_hotspot_a, is_hotspot_b) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => std::cmp::Ordering::Equal,
        }
    });

    println!("[Network Info] Discovered gateways on Windows: {:?}", gateways);
    gateways
}
