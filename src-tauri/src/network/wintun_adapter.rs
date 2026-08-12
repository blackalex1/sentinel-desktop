use std::path::Path;

#[allow(dead_code)]
pub fn is_wintun_available() -> bool {
    let mut exe_dir = std::env::current_exe().unwrap_or_default();
    exe_dir.pop();
    
    let wintun_dll = exe_dir.join("wintun.dll");
    let system_wintun = Path::new("C:\\Windows\\System32\\wintun.dll");

    wintun_dll.exists() || system_wintun.exists()
}
