// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod network;
mod process_manager;
mod utils;

use commands::connect::{connect_vpn, get_core_logs, check_is_admin, request_admin_elevation};
use commands::disconnect::disconnect_vpn;
use commands::downloader::{download_core_binary, check_installed_cores, fetch_github_releases_native};
use commands::ping::ping_server;
use commands::network_info::get_default_gateways;
use commands::pairing::request_phone_pairing;

#[tauri::command]
fn close_app_window() {
    println!("[Windows Titlebar] Terminating application via window close button...");
    std::process::exit(0);
}

#[tauri::command]
fn minimize_app_window(window: tauri::WebviewWindow) {
    println!("[Windows Titlebar] Minimizing application window...");
    let _ = window.minimize();
}

#[tauri::command]
fn start_drag_window(window: tauri::WebviewWindow) {
    let _ = window.start_dragging();
}

fn main() {
    println!("[Sentinel Secure Connect] Initializing native modular core...");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            connect_vpn,
            get_core_logs,
            check_is_admin,
            request_admin_elevation,
            disconnect_vpn,
            ping_server,
            download_core_binary,
            check_installed_cores,
            fetch_github_releases_native,
            get_default_gateways,
            request_phone_pairing,
            close_app_window,
            minimize_app_window,
            start_drag_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

