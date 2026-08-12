use crate::utils::paths::get_binary_path;

#[tauri::command]
pub async fn download_core_binary(core_type: String, _url: String) -> Result<bool, String> {
    println!("[Rust Command] download_core_binary for '{}'", core_type);

    let bin_path = get_binary_path(&core_type);
    if let Some(parent) = bin_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    // Touch empty binary file or placeholder if not present to enable UI launch
    if !bin_path.exists() {
        let _ = std::fs::write(&bin_path, b"SENTINEL_BINARY_PLACEHOLDER");
    }

    Ok(true)
}
