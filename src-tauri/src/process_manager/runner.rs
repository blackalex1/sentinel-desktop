use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Emitter;
use crate::utils::paths::{get_binary_path, get_temp_config_path};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

static ACTIVE_CHILD_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
static LOG_BUFFER: Mutex<Vec<String>> = Mutex::new(Vec::new());

pub struct VpnProcessRunner;

impl VpnProcessRunner {
    pub fn append_log(line: String) {
        if line.trim().is_empty() {
            return;
        }
        if let Ok(mut buffer) = LOG_BUFFER.lock() {
            if buffer.len() > 1000 {
                buffer.remove(0);
            }
            buffer.push(line);
        }
    }

    pub fn get_logs() -> Vec<String> {
        if let Ok(buffer) = LOG_BUFFER.lock() {
            buffer.clone()
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

        // Write temp config JSON file
        let config_path = get_temp_config_path(core_type);
        if let Err(e) = std::fs::write(&config_path, config_json) {
            let err_msg = format!("[ERROR] Ошибка записи файла конфигурации {}: {}", config_path.display(), e);
            Self::append_log(err_msg.clone());
            let _ = app.emit("core-log", &err_msg);
            return Err(err_msg);
        }

        let binary_path = get_binary_path(core_type);

        println!(
            "[VpnProcessRunner] Spawning core '{}' from binary: {:?} with config: {:?}",
            core_type, binary_path, config_path
        );

        let msg1 = format!("[SYSTEM] Запуск бинарного процесса ядра '{}'...", core_type);
        let msg2 = format!("[SYSTEM] Файл конфигурации: {}", config_path.display());
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

        let mut cmd = Command::new(&binary_path);

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        
        match core_type {
            "xray" => {
                cmd.arg("run").arg("-c").arg(&config_path);
            }
            "singbox" => {
                cmd.arg("run").arg("-c").arg(&config_path);
            }
            "hysteria" => {
                cmd.arg("client").arg("-c").arg(&config_path);
            }
            _ => {
                cmd.arg("run").arg("-c").arg(&config_path);
            }
        }

        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        match cmd.spawn() {
            Ok(mut child) => {
                let pid = child.id();
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
                        let reader = BufReader::new(stdout_stream);
                        for line in reader.lines().flatten() {
                            if !line.trim().is_empty() {
                                Self::append_log(line.clone());
                                let _ = app_handle.emit("core-log", line);
                            }
                        }
                    });
                }

                // Real-time stderr reader thread
                if let Some(stderr_stream) = stderr {
                    let app_handle = app.clone();
                    std::thread::spawn(move || {
                        let reader = BufReader::new(stderr_stream);
                        for line in reader.lines().flatten() {
                            if !line.trim().is_empty() {
                                Self::append_log(line.clone());
                                let _ = app_handle.emit("core-log", line);
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
        if let Ok(mut guard) = ACTIVE_CHILD_PROCESS.lock() {
            if let Some(mut child) = guard.take() {
                println!("[VpnProcessRunner] Terminating active core process (PID: {})...", child.id());
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}
