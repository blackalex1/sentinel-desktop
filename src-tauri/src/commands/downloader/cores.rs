use std::fs;
use serde::Serialize;
use crate::utils::paths::{get_app_dir, get_binary_path};
use super::utils::{build_client, download_file_streaming, extract_file_from_zip};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Serialize)]
pub struct InstalledCoresInfo {
    pub singbox: bool,
    pub xray: bool,
    pub hysteria: bool,
    pub wintun: bool,
}

const EMBEDDED_WINTUN: &[u8] = include_bytes!("../../../assets/wintun.dll");

pub fn ensure_wintun_extracted() -> bool {
    let target_bin_path = get_binary_path("wintun");
    let root_wintun = get_app_dir().join("wintun.dll");
    let binaries_dir = get_app_dir().join("binaries");

    if let Some(parent) = target_bin_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if !target_bin_path.exists() || fs::metadata(&target_bin_path).map(|m| m.len()).unwrap_or(0) < 50_000 {
        // 1. Check if user dropped a local wintun zip file into binaries folder
        if let Ok(entries) = fs::read_dir(&binaries_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_lowercase();
                if name.contains("wintun") && name.ends_with(".zip") {
                    let zip_path = entry.path();
                    if extract_file_from_zip(&zip_path, "wintun.dll", &target_bin_path).is_ok() {
                        let _ = fs::copy(&target_bin_path, &root_wintun);
                        println!("[Local Zip Extractor] Extracted wintun.dll from local zip {:?}!", zip_path);
                        return true;
                    }
                }
            }
        }

        // 2. Embedded fallback
        if fs::write(&target_bin_path, EMBEDDED_WINTUN).is_ok() {
            let _ = fs::write(&root_wintun, EMBEDDED_WINTUN);
            println!("[Embedded Wintun] Unpacked embedded 64-bit wintun.dll to binaries/wintun.dll!");
            return true;
        }
    } else if !root_wintun.exists() {
        let _ = fs::copy(&target_bin_path, &root_wintun);
    }
    target_bin_path.exists()
}

#[tauri::command]
pub async fn download_core_binary(app: tauri::AppHandle, core_type: String, download_url: String) -> Result<bool, String> {
    let core = core_type.to_lowercase();
    let binaries_dir = get_app_dir().join("binaries");
    fs::create_dir_all(&binaries_dir).map_err(|e| format!("Failed creating binaries dir: {}", e))?;

    if core == "wintun" {
        ensure_wintun_extracted();
        let wt_path = get_binary_path("wintun");
        let success = wt_path.exists() && fs::metadata(&wt_path).map(|m| m.len()).unwrap_or(0) > 50_000;
        return Ok(success);
    }

    // Stop active core process to release file lock on binary
    crate::process_manager::runner::VpnProcessRunner::stop_core();
    #[cfg(target_os = "windows")]
    {
        let mut kill_cmd = std::process::Command::new("taskkill");
        kill_cmd.args(&["/F", "/IM", "sing-box.exe", "/IM", "xray.exe", "/IM", "hysteria.exe"]);
        kill_cmd.creation_flags(0x08000000);
        let _ = kill_cmd.output();
    }

    let mut target_url = download_url.trim().to_string();

    if target_url.is_empty() {
        target_url = match core.as_str() {
            "singbox" | "sing-box" => "https://github.com/SagerNet/sing-box/releases/download/v1.13.18/sing-box-1.13.18-windows-amd64.zip".to_string(),
            "xray" => "https://github.com/XTLS/Xray-core/releases/download/v26.3.27/Xray-windows-64.zip".to_string(),
            "hysteria" | "hysteria2" | "hy2" => "https://github.com/apernet/hysteria/releases/download/app%2Fv2.12.1/hysteria-windows-amd64.exe".to_string(),
            _ => "https://github.com/XTLS/Xray-core/releases/download/v26.3.27/Xray-windows-64.zip".to_string(),
        };
    }

    let client = build_client();
    println!("[Pure-Rust Downloader] Downloading requested core '{}' from URL: '{}'", core, target_url);

    let temp_download_path = binaries_dir.join(format!("{}_temp.download", core));
    
    // Download target URL requested by user from frontend
    download_file_streaming(&app, &core, &client, &target_url, &temp_download_path).await?;

    // Extract if zip, or rename if raw executable/dll
    let target_bin_path = get_binary_path(&core);
    let is_zip = target_url.ends_with(".zip") || core == "singbox" || core == "sing-box" || core == "xray";

    if is_zip {
        let target_name = match core.as_str() {
            "singbox" | "sing-box" => "sing-box.exe",
            "xray" => "xray.exe",
            _ => "sing-box.exe",
        };

        extract_file_from_zip(&temp_download_path, target_name, &target_bin_path)?;
        let _ = fs::remove_file(&temp_download_path);
    } else {
        let _ = fs::remove_file(&target_bin_path);
        fs::rename(&temp_download_path, &target_bin_path)
            .or_else(|_| fs::copy(&temp_download_path, &target_bin_path).map(|_| ()))
            .map_err(|e| format!("Failed installing binary: {}", e))?;
        let _ = fs::remove_file(&temp_download_path);
    }

    // Download GEOIP & GEOSITE DAT Files directly if missing
    let geoip_path = binaries_dir.join("geoip.dat");
    let geosite_path = binaries_dir.join("geosite.dat");

    if !geoip_path.exists() || fs::metadata(&geoip_path).map(|m| m.len()).unwrap_or(0) < 1000 {
        let _ = download_file_streaming(&app, "geoip", &client, "https://fastly.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geoip.dat", &geoip_path).await;
    }
    if !geosite_path.exists() || fs::metadata(&geosite_path).map(|m| m.len()).unwrap_or(0) < 1000 {
        let _ = download_file_streaming(&app, "geosite", &client, "https://fastly.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geosite.dat", &geosite_path).await;
    }

    // Verify installed file
    let success = target_bin_path.exists() && fs::metadata(&target_bin_path).map(|m| m.len()).unwrap_or(0) > 500_000;

    println!("[Pure-Rust Downloader] Verification for {:?}: success = {}", target_bin_path, success);
    Ok(success)
}

#[tauri::command]
pub fn check_installed_cores() -> InstalledCoresInfo {
    ensure_wintun_extracted();

    let sb_path = get_binary_path("singbox");
    let xr_path = get_binary_path("xray");
    let hy_path = get_binary_path("hysteria");
    let wt_path = get_app_dir().join("binaries").join("wintun.dll");

    let sb_exists = sb_path.exists() && fs::metadata(&sb_path).map(|m| m.len()).unwrap_or(0) > 500_000;
    let xr_exists = xr_path.exists() && fs::metadata(&xr_path).map(|m| m.len()).unwrap_or(0) > 500_000;
    let hy_exists = hy_path.exists() && fs::metadata(&hy_path).map(|m| m.len()).unwrap_or(0) > 500_000;
    let wt_exists = wt_path.exists() && fs::metadata(&wt_path).map(|m| m.len()).unwrap_or(0) > 50_000;

    InstalledCoresInfo {
        singbox: sb_exists,
        xray: xr_exists,
        hysteria: hy_exists,
        wintun: wt_exists,
    }
}
