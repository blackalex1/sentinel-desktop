use crate::process_manager::runner::VpnProcessRunner;
use crate::network::system_proxy::disable_system_proxy;

#[tauri::command]
pub fn disconnect_vpn() -> Result<bool, String> {
    println!("[Rust Command] disconnect_vpn called");

    // Terminate core binary child process
    VpnProcessRunner::stop_core();

    // Disable Windows System Proxy in Registry
    let _ = disable_system_proxy();

    Ok(true)
}
