use serde::{Deserialize, Serialize};
use super::utils::build_client;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DynamicVersionItem {
    pub version: String,
    pub is_prerelease: bool,
    pub download_url: String,
}

#[tauri::command]
pub async fn fetch_github_releases_native(repo: String) -> Result<Vec<DynamicVersionItem>, String> {
    let client = build_client();
    let api_url = format!("https://api.github.com/repos/{}/releases?per_page=25", repo);

    if let Ok(resp) = client.get(&api_url).send().await {
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

    Err(format!("Failed fetching GitHub releases for {}", repo))
}
