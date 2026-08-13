use std::path::PathBuf;

/// Return the primary application directory right next to the executable (Portable Mode)
pub fn get_app_dir() -> PathBuf {
    if let Ok(mut exe_path) = std::env::current_exe() {
        exe_path.pop(); // Remove x-pc.exe filename to get the directory
        return exe_path;
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}



/// Resolution for core binaries path right next to x-pc.exe: <x-pc.exe directory>/binaries/<binary_name>
pub fn get_binary_path(core_type: &str) -> PathBuf {
    let normalized = core_type.to_lowercase();
    let name = match normalized.as_str() {
        "xray" => "xray.exe",
        "singbox" | "sing-box" => "sing-box.exe",
        "hysteria" | "hysteria2" | "hy2" => "hysteria.exe",
        "wintun" => "wintun.dll",
        _ => "sing-box.exe",
    };

    let app_dir = get_app_dir();
    let bin_dir = if app_dir.ends_with("binaries") {
        app_dir
    } else {
        app_dir.join("binaries")
    };

    if !bin_dir.exists() {
        let _ = std::fs::create_dir_all(&bin_dir);
    }
    
    bin_dir.join(name)
}
