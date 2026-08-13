use crate::utils::paths::{get_app_dir, get_binary_path};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::time::Duration;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DynamicVersionItem {
    pub version: String,
    pub is_prerelease: bool,
    pub download_url: String,
}

#[derive(Serialize)]
pub struct InstalledCoresInfo {
    pub singbox: bool,
    pub xray: bool,
    pub hysteria: bool,
    pub wintun: bool,
}

fn build_client() -> Client {
    Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(Duration::from_secs(45))
        .connect_timeout(Duration::from_secs(10))
        .danger_accept_invalid_certs(false)
        .build()
        .unwrap_or_else(|_| Client::new())
}

async fn download_file_direct(client: &Client, url: &str, destination: &PathBuf) -> Result<bool, String> {
    println!("[Pure-Rust Downloader] Downloading requested URL: {}", url);
    
    let mut candidate_urls = Vec::new();
    if url.contains("github.com") {
        candidate_urls.push(format!("https://ghfast.top/{}", url));
        candidate_urls.push(format!("https://ghproxy.net/{}", url));
        candidate_urls.push(format!("https://gh-proxy.com/{}", url));
        candidate_urls.push(url.to_string());
    } else if url.contains("wintun") {
        candidate_urls.push("https://fastly.jsdelivr.net/gh/WireGuard/wintun@master/builds/wintun-0.14.1.zip".to_string());
        candidate_urls.push(url.to_string());
    } else {
        candidate_urls.push(url.to_string());
    }

    for cand_url in candidate_urls {
        // 1. Try reqwest with native TLS
        if let Ok(resp) = client.get(&cand_url).send().await {
            if resp.status().is_success() {
                if let Ok(bytes) = resp.bytes().await {
                    if bytes.len() > 1000 {
                        let _ = fs::remove_file(destination);
                        let mut file = File::create(destination).map_err(|e| format!("Failed creating target file {:?}: {}", destination, e))?;
                        file.write_all(&bytes).map_err(|e| format!("Failed writing file content {:?}: {}", destination, e))?;
                        println!("[Pure-Rust Downloader] Successfully downloaded {} bytes via reqwest from {}", bytes.len(), cand_url);
                        return Ok(true);
                    }
                }
            }
        }

        // 2. Try native curl.exe without popping console window (CREATE_NO_WINDOW)
        println!("[Pure-Rust Downloader] reqwest attempt missed, trying curl.exe for {}", cand_url);
        let mut cmd = std::process::Command::new("curl.exe");
        cmd.arg("-s")
           .arg("-L")
           .arg("-A")
           .arg("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
           .arg("--connect-timeout")
           .arg("5")
           .arg("--max-time")
           .arg("30")
           .arg("-o")
           .arg(destination)
           .arg(&cand_url);

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW (Prevents CMD flash)

        if let Ok(out) = cmd.output() {
            if out.status.success() && destination.exists() {
                let len = fs::metadata(destination).map(|m| m.len()).unwrap_or(0);
                if len > 1000 {
                    println!("[Pure-Rust Downloader] Successfully downloaded {} bytes via curl.exe from {}", len, cand_url);
                    return Ok(true);
                }
            }
        }
    }

    Err(format!("Failed to download file from {}", url))
}

fn extract_file_from_zip(zip_path: &PathBuf, target_filename: &str, dest_path: &PathBuf) -> Result<bool, String> {
    let file = File::open(zip_path).map_err(|e| format!("Failed to open zip file: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Invalid zip archive: {}", e))?;

    for i in 0..archive.len() {
        let mut zip_file = archive.by_index(i).map_err(|e| format!("Failed reading zip index {}: {}", i, e))?;
        let name = zip_file.name().to_lowercase();
        
        let is_match = if target_filename == "wintun.dll" {
            name.contains("wintun.dll") && (name.contains("amd64") || name.contains("x64"))
        } else {
            name.ends_with(target_filename)
        };

        if is_match {
            let _ = fs::remove_file(dest_path);
            let mut out_file = File::create(dest_path).map_err(|e| format!("Failed creating extracted file: {}", e))?;
            let mut buffer = Vec::new();
            zip_file.read_to_end(&mut buffer).map_err(|e| format!("Failed reading zip content: {}", e))?;
            out_file.write_all(&buffer).map_err(|e| format!("Failed writing extracted file: {}", e))?;
            println!("[Pure-Rust Extractor] Successfully extracted {} to {:?}", target_filename, dest_path);
            return Ok(true);
        }
    }

    Err(format!("File {} not found inside zip archive", target_filename))
}

#[tauri::command]
pub async fn download_core_binary(core_type: String, download_url: String) -> Result<bool, String> {
    let core = core_type.to_lowercase();
    let binaries_dir = get_app_dir().join("binaries");
    fs::create_dir_all(&binaries_dir).map_err(|e| format!("Failed creating binaries dir: {}", e))?;

    // Stop active core process to release file lock on binary
    crate::process_manager::runner::VpnProcessRunner::stop_core();
    #[cfg(target_os = "windows")]
    {
        let mut kill_cmd = std::process::Command::new("taskkill");
        kill_cmd.args(&["/F", "/IM", "sing-box.exe", "/IM", "xray.exe", "/IM", "hysteria.exe"]);
        kill_cmd.creation_flags(0x08000000);
        let _ = kill_cmd.output();
    }

    let client = build_client();
    let target_url = download_url.trim().to_string();

    if target_url.is_empty() {
        return Err("Download URL cannot be empty".to_string());
    }

    println!("[Pure-Rust Downloader] Downloading requested core '{}' from URL: '{}'", core, target_url);

    let temp_download_path = binaries_dir.join(format!("{}_temp.download", core));
    
    // Download target URL requested by user from frontend
    download_file_direct(&client, &target_url, &temp_download_path).await?;

    // Extract if zip, or rename if raw executable/dll
    let target_bin_path = get_binary_path(&core);
    let is_zip = target_url.ends_with(".zip") || core == "singbox" || core == "sing-box" || core == "xray" || core == "wintun";

    if is_zip {
        let target_name = match core.as_str() {
            "singbox" | "sing-box" => "sing-box.exe",
            "xray" => "xray.exe",
            "wintun" => "wintun.dll",
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
        let _ = download_file_direct(&client, "https://fastly.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geoip.dat", &geoip_path).await;
    }
    if !geosite_path.exists() || fs::metadata(&geosite_path).map(|m| m.len()).unwrap_or(0) < 1000 {
        let _ = download_file_direct(&client, "https://fastly.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geosite.dat", &geosite_path).await;
    }

    // Verify installed file
    let min_size = if core == "wintun" { 50_000 } else { 500_000 };
    let success = target_bin_path.exists() && fs::metadata(&target_bin_path).map(|m| m.len()).unwrap_or(0) > min_size;

    println!("[Pure-Rust Downloader] Verification for {:?}: success = {}", target_bin_path, success);
    Ok(success)
}

#[tauri::command]
pub fn check_installed_cores() -> InstalledCoresInfo {
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

#[tauri::command]
pub async fn fetch_github_releases_native(repo: String) -> Result<Vec<DynamicVersionItem>, String> {
    let client = build_client();
    let api_url = format!("https://api.github.com/repos/{}/releases?per_page=25", repo);
    
    let candidate_urls = vec![
        api_url.clone(),
        format!("https://ghfast.top/{}", api_url),
    ];

    for url in candidate_urls {
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                if let Ok(json_text) = resp.text().await {
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&json_text) {
                        if let Some(arr) = value.as_array() {
                            let mut list = Vec::new();
                            for item in arr {
                                let tag = item["tag_name"].as_str().or_else(|| item["name"].as_str()).unwrap_or("").to_string();
                                if tag.is_empty() { continue; }
                                let is_pre = item["prerelease"].as_bool().unwrap_or(false);

                                let mut win_url = String::new();
                                if let Some(assets) = item["assets"].as_array() {
                                    for a in assets {
                                        if let Some(name) = a["name"].as_str() {
                                            let n = name.to_lowercase();
                                            if n.contains("windows") && (n.contains("64") || n.contains("amd64")) && !n.contains("avx") && !n.contains("386") && !n.contains("arm") {
                                                if let Some(dl) = a["browser_download_url"].as_str() {
                                                    win_url = dl.to_string();
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                    if win_url.is_empty() && !assets.is_empty() {
                                        if let Some(dl) = assets[0]["browser_download_url"].as_str() {
                                            win_url = dl.to_string();
                                        }
                                    }
                                }

                                list.push(DynamicVersionItem {
                                    version: tag,
                                    is_prerelease: is_pre,
                                    download_url: win_url,
                                });
                            }
                            if !list.is_empty() {
                                println!("[Pure-Rust GitHub API] Successfully loaded {} releases for {}", list.len(), repo);
                                return Ok(list);
                            }
                        }
                    }
                }
            }
        }
    }

    Err(format!("Failed to fetch releases for {}", repo))
}
