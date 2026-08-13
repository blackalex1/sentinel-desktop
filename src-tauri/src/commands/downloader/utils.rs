use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::time::Duration;
use reqwest::Client;
use serde::Serialize;
use tauri::Emitter;
use futures_util::StreamExt;

#[derive(Serialize, Clone)]
pub struct DownloadProgressPayload {
    pub core_type: String,
    pub percent: u8,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
}

pub fn build_client() -> Client {
    Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(Duration::from_secs(120))
        .connect_timeout(Duration::from_secs(15))
        .danger_accept_invalid_certs(false)
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .unwrap_or_else(|_| Client::new())
}

pub async fn download_file_streaming(
    app: &tauri::AppHandle,
    core_type: &str,
    client: &Client,
    url: &str,
    destination: &PathBuf,
) -> Result<bool, String> {
    println!("[Pure-Rust Downloader] Downloading directly from URL: {}", url);

    let resp = client.get(url)
        .header("Accept", "application/octet-stream, */*")
        .send()
        .await
        .map_err(|e| format!("Failed connecting to host: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Server returned HTTP status {}", resp.status()));
    }

    let total_size = resp.content_length().unwrap_or(0);
    let _ = fs::remove_file(destination);

    let mut file = File::create(destination)
        .map_err(|e| format!("Failed creating file {:?}: {}", destination, e))?;

    let mut downloaded: u64 = 0;
    let mut stream = resp.bytes_stream();
    let mut last_percent: u8 = 0;

    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| format!("Error reading download stream: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("Error writing file: {}", e))?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let percent = ((downloaded as f64 / total_size as f64) * 100.0).min(99.0) as u8;
            if percent >= last_percent + 2 || percent == 99 {
                last_percent = percent;
                let _ = app.emit("download-progress", DownloadProgressPayload {
                    core_type: core_type.to_string(),
                    percent,
                    bytes_downloaded: downloaded,
                    total_bytes: total_size,
                });
            }
        }
    }

    if downloaded < 1000 {
        let _ = fs::remove_file(destination);
        return Err("Downloaded file is empty or corrupted".to_string());
    }

    let _ = app.emit("download-progress", DownloadProgressPayload {
        core_type: core_type.to_string(),
        percent: 100,
        bytes_downloaded: downloaded,
        total_bytes: if total_size > 0 { total_size } else { downloaded },
    });

    println!("[Pure-Rust Downloader] Successfully downloaded {} bytes from {}", downloaded, url);
    Ok(true)
}

pub fn extract_file_from_zip(zip_path: &PathBuf, target_filename: &str, dest_path: &PathBuf) -> Result<bool, String> {
    let file = File::open(zip_path).map_err(|e| format!("Failed to open zip file: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Invalid zip archive: {}", e))?;

    for i in 0..archive.len() {
        let mut zip_file = archive.by_index(i).map_err(|e| format!("Failed reading zip index {}: {}", i, e))?;
        let name = zip_file.name().to_lowercase();

        let is_match = if target_filename == "wintun.dll" {
            name.contains("wintun.dll") && (name.contains("amd64") || name.contains("x64") || name.ends_with("wintun.dll"))
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

pub fn get_file_mtime_secs(path: &PathBuf) -> u64 {
    if let Ok(metadata) = fs::metadata(path) {
        if let Ok(modified) = metadata.modified() {
            if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                return duration.as_secs();
            }
        }
    }
    0
}
