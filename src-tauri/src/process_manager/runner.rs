use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Emitter;
use crate::utils::paths::{get_binary_path, get_temp_config_path};

static ACTIVE_CHILD_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

pub struct VpnProcessRunner;

impl VpnProcessRunner {
    pub fn start_core(app: &tauri::AppHandle, core_type: &str, config_json: &str) -> Result<bool, String> {
        // Kill any existing active core process
        Self::stop_core();

        // Write temp config JSON file
        let config_path = get_temp_config_path(core_type);
        if let Err(e) = std::fs::write(&config_path, config_json) {
            return Err(format!("Failed to write config file: {}", e));
        }

        let binary_path = get_binary_path(core_type);

        println!(
            "[VpnProcessRunner] Spawning core '{}' from binary: {:?} with config: {:?}",
            core_type, binary_path, config_path
        );

        let _ = app.emit("core-log", format!("[SYSTEM] Запуск бинарного процесса ядра '{}'...", core_type));

        if !binary_path.exists() {
            let msg = format!("[SYSTEM] Исполняемый файл {:?} пока не найден на диске. Готов к автозагрузке.", binary_path);
            println!("{}", msg);
            let _ = app.emit("core-log", msg);
            return Ok(true);
        }

        let mut cmd = Command::new(&binary_path);
        
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
                let _ = app.emit("core-log", format!("[SYSTEM] Ядро '{}' успешно запущено (PID: {})", core_type, pid));

                let stdout = child.stdout.take();
                let stderr = child.stderr.take();

                // Real-time stdout reader thread
                if let Some(stdout_stream) = stdout {
                    let app_handle = app.clone();
                    std::thread::spawn(move || {
                        let reader = BufReader::new(stdout_stream);
                        for line in reader.lines().flatten() {
                            let _ = app_handle.emit("core-log", line);
                        }
                    });
                }

                // Real-time stderr reader thread
                if let Some(stderr_stream) = stderr {
                    let app_handle = app.clone();
                    std::thread::spawn(move || {
                        let reader = BufReader::new(stderr_stream);
                        for line in reader.lines().flatten() {
                            let _ = app_handle.emit("core-log", line);
                        }
                    });
                }

                if let Ok(mut guard) = ACTIVE_CHILD_PROCESS.lock() {
                    *guard = Some(child);
                }
                Ok(true)
            }
            Err(e) => {
                let err_msg = format!("[ERROR] Не удалось запустить бинарный файл {:?}: {}", binary_path, e);
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
