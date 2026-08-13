// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod network;
mod process_manager;
mod utils;

use commands::connect::{connect_vpn, get_core_logs, clear_core_logs, check_is_admin, request_admin_elevation};
use commands::disconnect::disconnect_vpn;
use commands::downloader::{download_core_binary, check_installed_cores, fetch_github_releases_native, check_geo_databases, update_geo_databases};
use commands::ping::ping_server;
use commands::network_info::get_default_gateways;
use commands::pairing::request_phone_pairing;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};

#[tauri::command]
fn close_app_window(window: tauri::WebviewWindow) {
    println!("[Windows Titlebar] Hiding application window to system tray...");
    let _ = window.emit("window-visibility", false);
    let _ = window.hide();
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

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if url.starts_with("http://") || url.starts_with("https://") {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            std::process::Command::new("cmd")
                .args(["/c", "start", "", &url])
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
        }
        Ok(())
    } else {
        Err("Invalid URL scheme".to_string())
    }
}

fn main() {
    println!("[Sentinel Secure Connect] Initializing native modular core...");

    tauri::Builder::default()
        .setup(|app| {
            commands::downloader::cores::ensure_wintun_extracted();

            // Setup System Tray Icon & Context Menu
            if let Some(icon) = app.default_window_icon() {
                let show_i = MenuItem::with_id(app, "show", "Показать окно", true, None::<&str>)?;
                let quit_i = MenuItem::with_id(app, "quit", "Выход из Sentinel", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

                let _tray = TrayIconBuilder::new()
                    .icon(icon.clone())
                    .tooltip("Sentinel Secure Connect")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| {
                        match event.id.as_ref() {
                            "show" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.unminimize();
                                    let _ = window.set_focus();
                                    let _ = window.emit("window-visibility", true);
                                }
                            }
                            "quit" => {
                                crate::process_manager::runner::VpnProcessRunner::stop_core();
                                app.exit(0);
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.emit("window-visibility", false);
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.unminimize();
                                    let _ = window.set_focus();
                                    let _ = window.emit("window-visibility", true);
                                }
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.emit("window-visibility", false);
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            connect_vpn,
            get_core_logs,
            clear_core_logs,
            check_is_admin,
            request_admin_elevation,
            disconnect_vpn,
            ping_server,
            download_core_binary,
            check_installed_cores,
            fetch_github_releases_native,
            check_geo_databases,
            update_geo_databases,
            get_default_gateways,
            request_phone_pairing,
            close_app_window,
            minimize_app_window,
            start_drag_window,
            open_url,
            commands::store::save_store_data,
            commands::store::read_store_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

