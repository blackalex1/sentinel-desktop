#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

pub fn enable_system_proxy(http_port: u16, socks_port: u16) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let path = "Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
        
        let key = hkcu.open_subkey_with_flags(path, KEY_WRITE)
            .map_err(|e| format!("Failed to open registry key: {}", e))?;

        let proxy_server = format!("http=127.0.0.1:{};https=127.0.0.1:{};socks=127.0.0.1:{}", http_port, http_port, socks_port);
        
        key.set_value("ProxyEnable", &1u32)
            .map_err(|e| format!("Failed to enable ProxyEnable: {}", e))?;
        key.set_value("ProxyServer", &proxy_server)
            .map_err(|e| format!("Failed to set ProxyServer: {}", e))?;
        key.set_value("ProxyOverride", &"<local>")
            .map_err(|e| format!("Failed to set ProxyOverride: {}", e))?;

        println!("[Windows System Proxy] Enabled System Proxy -> {}", proxy_server);
    }
    Ok(())
}

pub fn disable_system_proxy() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let path = "Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
        
        if let Ok(key) = hkcu.open_subkey_with_flags(path, KEY_WRITE) {
            let _ = key.set_value("ProxyEnable", &0u32);
            println!("[Windows System Proxy] Disabled System Proxy");
        }
    }
    Ok(())
}
