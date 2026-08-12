use std::path::PathBuf;

/// Return the primary AppData directory for configs and temp files
pub fn get_app_dir() -> PathBuf {
    let mut dir = if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        PathBuf::from(local_appdata)
    } else {
        std::env::temp_dir()
    };
    dir.push("SentinelSecureConnect");
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    dir
}

/// Return path for temp configuration JSON files
pub fn get_temp_config_path(core_type: &str) -> PathBuf {
    let mut dir = get_app_dir();
    dir.push(format!("config_{}.json", core_type));
    dir
}

/// Smart resolution for core binaries path:
/// 1. Portable mode: <x-pc.exe directory>/binaries/<binary_name> (if writable)
/// 2. Installed mode / fallback: %LOCALAPPDATA%/SentinelSecureConnect/binaries/<binary_name>
pub fn get_binary_path(core_type: &str) -> PathBuf {
    let name = match core_type {
        "xray" => "xray.exe",
        "singbox" => "sing-box.exe",
        "hysteria" => "hysteria.exe",
        _ => "xray.exe",
    };

    // Try portable path next to x-pc.exe executable
    if let Ok(mut exe_dir) = std::env::current_exe() {
        exe_dir.pop();
        let portable_bin_dir = exe_dir.join("binaries");

        // Test if directory is writable or can be created
        if std::fs::create_dir_all(&portable_bin_dir).is_ok() {
            let portable_path = portable_bin_dir.join(name);
            return portable_path;
        }
    }

    // Fallback to AppData local binaries folder
    let mut app_bin_dir = get_app_dir();
    app_bin_dir.push("binaries");
    let _ = std::fs::create_dir_all(&app_bin_dir);
    app_bin_dir.join(name)
}
