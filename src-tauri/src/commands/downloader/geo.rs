use std::fs;
use serde::Serialize;
use crate::utils::paths::get_app_dir;
use super::utils::{build_client, download_file_streaming, get_file_mtime_secs};

#[derive(Serialize)]
pub struct GeoDatabasesInfo {
    pub geoip_dat_exists: bool,
    pub geoip_dat_size: u64,
    pub geoip_dat_mtime: u64,
    pub geosite_dat_exists: bool,
    pub geosite_dat_size: u64,
    pub geosite_dat_mtime: u64,
    pub geoip_db_exists: bool,
    pub geoip_db_size: u64,
    pub geoip_db_mtime: u64,
    pub geosite_db_exists: bool,
    pub geosite_db_size: u64,
    pub geosite_db_mtime: u64,
}

#[tauri::command]
pub fn check_geo_databases() -> GeoDatabasesInfo {
    let binaries_dir = get_app_dir().join("binaries");
    let geoip_dat = binaries_dir.join("geoip.dat");
    let geosite_dat = binaries_dir.join("geosite.dat");
    let geoip_db = binaries_dir.join("geoip.db");
    let geosite_db = binaries_dir.join("geosite.db");

    GeoDatabasesInfo {
        geoip_dat_exists: geoip_dat.exists(),
        geoip_dat_size: fs::metadata(&geoip_dat).map(|m| m.len()).unwrap_or(0),
        geoip_dat_mtime: get_file_mtime_secs(&geoip_dat),
        geosite_dat_exists: geosite_dat.exists(),
        geosite_dat_size: fs::metadata(&geosite_dat).map(|m| m.len()).unwrap_or(0),
        geosite_dat_mtime: get_file_mtime_secs(&geosite_dat),
        geoip_db_exists: geoip_db.exists(),
        geoip_db_size: fs::metadata(&geoip_db).map(|m| m.len()).unwrap_or(0),
        geoip_db_mtime: get_file_mtime_secs(&geoip_db),
        geosite_db_exists: geosite_db.exists(),
        geosite_db_size: fs::metadata(&geosite_db).map(|m| m.len()).unwrap_or(0),
        geosite_db_mtime: get_file_mtime_secs(&geosite_db),
    }
}

#[tauri::command]
pub async fn update_geo_databases(app: tauri::AppHandle) -> Result<bool, String> {
    let binaries_dir = get_app_dir().join("binaries");
    fs::create_dir_all(&binaries_dir).map_err(|e| format!("Failed creating binaries dir: {}", e))?;
    let client = build_client();

    let geoip_dat_path = binaries_dir.join("geoip.dat");
    let geosite_dat_path = binaries_dir.join("geosite.dat");
    let geoip_db_path = binaries_dir.join("geoip.db");
    let geosite_db_path = binaries_dir.join("geosite.db");

    println!("[Geo Updater] Updating geoip.dat...");
    let _ = download_file_streaming(
        &app,
        "geoip",
        &client,
        "https://fastly.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geoip.dat",
        &geoip_dat_path,
    ).await;

    println!("[Geo Updater] Updating geosite.dat...");
    let _ = download_file_streaming(
        &app,
        "geosite",
        &client,
        "https://fastly.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geosite.dat",
        &geosite_dat_path,
    ).await;

    println!("[Geo Updater] Updating geoip.db...");
    let _ = download_file_streaming(
        &app,
        "geoip_db",
        &client,
        "https://fastly.jsdelivr.net/gh/SagerNet/sing-geoip@release/geoip.db",
        &geoip_db_path,
    ).await;

    println!("[Geo Updater] Updating geosite.db...");
    let _ = download_file_streaming(
        &app,
        "geosite_db",
        &client,
        "https://fastly.jsdelivr.net/gh/SagerNet/sing-geosite@release/geosite.db",
        &geosite_db_path,
    ).await;

    Ok(true)
}
