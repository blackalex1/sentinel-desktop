use std::collections::VecDeque;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Emitter;
use crate::utils::paths::get_binary_path;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

static ACTIVE_CHILD_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
static LOG_BUFFER: Mutex<VecDeque<String>> = Mutex::new(VecDeque::new());
static CHILD_PID: Mutex<Option<u32>> = Mutex::new(None);

pub struct VpnProcessRunner;

impl VpnProcessRunner {
    pub fn append_log(line: String) {
        if line.trim().is_empty() {
            return;
        }
        if let Ok(mut buffer) = LOG_BUFFER.lock() {
            if buffer.len() >= 1000 {
                buffer.pop_front(); // O(1) instead of O(n) remove(0)
            }
            buffer.push_back(line);
        }
    }

    pub fn get_logs() -> Vec<String> {
        if let Ok(buffer) = LOG_BUFFER.lock() {
            buffer.iter().cloned().collect()
        } else {
            Vec::new()
        }
    }

    pub fn clear_logs() {
        if let Ok(mut buffer) = LOG_BUFFER.lock() {
            buffer.clear();
        }
    }

    pub fn start_core(app: &tauri::AppHandle, core_type: &str, config_json: &str) -> Result<bool, String> {
        // Kill any existing active core process
        Self::stop_core();
        Self::clear_logs();

        let binary_path = get_binary_path(core_type);

        println!(
            "[VpnProcessRunner] Spawning core '{}' from binary: {:?} with in-memory stdin config",
            core_type, binary_path
        );

        let msg1 = format!("[SYSTEM] Запуск бинарного процесса ядра '{}'...", core_type);
        let msg2 = "[SYSTEM] Конфигурация: Защищенный in-memory поток (stdin)".to_string();
        let msg3 = format!("[SYSTEM] Исполняемый файл: {}", binary_path.display());

        Self::append_log(msg1.clone());
        Self::append_log(msg2.clone());
        Self::append_log(msg3.clone());

        let _ = app.emit("core-log", &msg1);
        let _ = app.emit("core-log", &msg2);
        let _ = app.emit("core-log", &msg3);

        if !binary_path.exists() {
            let msg = format!("[ERROR] Исполняемый файл '{}' не найден по пути {}.", core_type, binary_path.display());
            println!("{}", msg);
            Self::append_log(msg.clone());
            let _ = app.emit("core-log", msg.clone());
            return Err(msg);
        }

        let binaries_dir = crate::utils::paths::get_app_dir().join("binaries");
        let mut cmd = Command::new(&binary_path);
        cmd.current_dir(&binaries_dir);
        cmd.env("xray.location.asset", &binaries_dir);
        cmd.env("XRAY_LOCATION_ASSET", &binaries_dir);

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        
        match core_type {
            "xray" => {
                cmd.arg("run").arg("-c").arg("stdin:");
            }
            "singbox" | "sing-box" => {
                cmd.arg("run").arg("-c").arg("stdin");
            }
            "hysteria" | "hysteria2" | "hy2" => {
                cmd.arg("client").arg("-c").arg("stdin");
            }
            _ => {
                cmd.arg("run").arg("-c").arg("stdin");
            }
        }

        cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());

        match cmd.spawn() {
            Ok(mut child) => {
                let pid = child.id();

                // Store PID for targeted cleanup
                if let Ok(mut pid_guard) = CHILD_PID.lock() {
                    *pid_guard = Some(pid);
                }

                if let Some(mut stdin) = child.stdin.take() {
                    use std::io::Write;
                    let _ = stdin.write_all(config_json.as_bytes());
                }

                println!("[VpnProcessRunner] Successfully spawned core process (PID: {})", pid);
                let start_msg = format!("[SYSTEM] Ядро '{}' успешно запущено (PID: {})", core_type, pid);
                Self::append_log(start_msg.clone());
                let _ = app.emit("core-log", &start_msg);

                let stdout = child.stdout.take();
                let stderr = child.stderr.take();

                // Real-time stdout reader thread
                if let Some(stdout_stream) = stdout {
                    let app_handle = app.clone();
                    std::thread::spawn(move || {
                        use tauri::Manager;
                        let reader = BufReader::new(stdout_stream);
                        for line in reader.lines().flatten() {
                            if !line.trim().is_empty() {
                                Self::append_log(line.clone());
                                if let Some(window) = app_handle.get_webview_window("main") {
                                    if window.is_visible().unwrap_or(false) {
                                        let _ = app_handle.emit("core-log", line);
                                    }
                                }
                            }
                        }
                    });
                }

                // Real-time stderr reader thread
                if let Some(stderr_stream) = stderr {
                    let app_handle = app.clone();
                    std::thread::spawn(move || {
                        use tauri::Manager;
                        let reader = BufReader::new(stderr_stream);
                        for line in reader.lines().flatten() {
                            if !line.trim().is_empty() {
                                Self::append_log(line.clone());
                                if let Some(window) = app_handle.get_webview_window("main") {
                                    if window.is_visible().unwrap_or(false) {
                                        let _ = app_handle.emit("core-log", line);
                                    }
                                }
                            }
                        }
                    });
                }

                if let Ok(mut guard) = ACTIVE_CHILD_PROCESS.lock() {
                    *guard = Some(child);
                }
                Ok(true)
            }
            Err(e) => {
                let err_msg = format!("[ERROR] Не удалось запустить бинарный файл {}: {}", binary_path.display(), e);
                let _ = app.emit("core-log", err_msg.clone());
                Err(err_msg)
            }
        }
    }

    pub fn stop_core() {
        // Retrieve our tracked PID before releasing the lock
        let our_pid = if let Ok(mut pid_guard) = CHILD_PID.lock() {
            pid_guard.take()
        } else {
            None
        };

        if let Ok(mut guard) = ACTIVE_CHILD_PROCESS.lock() {
            if let Some(mut child) = guard.take() {
                println!("[VpnProcessRunner] Terminating active core process (PID: {})...", child.id());
                let _ = child.kill();
                let _ = child.wait();
            }
        }

        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            use std::os::windows::process::CommandExt;

            // Kill only our specific PID — avoids killing unrelated sing-box/xray instances
            if let Some(pid) = our_pid {
                let _ = Command::new("taskkill")
                    .creation_flags(0x08000000)
                    .args(["/F", "/PID", &pid.to_string(), "/T"])
                    .status();
            } else {
                // Fallback: kill by image name only if PID was not tracked
                let _ = Command::new("taskkill").creation_flags(0x08000000).args(["/F", "/IM", "sing-box.exe", "/T"]).status();
                let _ = Command::new("taskkill").creation_flags(0x08000000).args(["/F", "/IM", "xray.exe", "/T"]).status();
                let _ = Command::new("taskkill").creation_flags(0x08000000).args(["/F", "/IM", "hysteria.exe", "/T"]).status();
            }
        }
    }
}
