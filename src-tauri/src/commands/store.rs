use std::fs;
use crate::utils::paths::get_app_dir;

#[cfg(target_os = "windows")]
use windows_sys::Win32::Security::Cryptography::{CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB};
#[cfg(target_os = "windows")]
use std::ptr::null_mut;

fn get_store_file_path(key: &str) -> std::path::PathBuf {
    let binaries_dir = get_app_dir().join("binaries");
    let _ = fs::create_dir_all(&binaries_dir);
    binaries_dir.join(format!("{}.bin", key))
}

#[cfg(target_os = "windows")]
fn encrypt_data(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut in_blob = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut out_blob = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };

    unsafe {
        let res = CryptProtectData(
            &mut in_blob,
            null_mut(),
            null_mut(),
            null_mut(),
            null_mut(),
            0,
            &mut out_blob,
        );
        if res == 0 {
            return Err("DPAPI CryptProtectData failed".to_string());
        }
        let slice = std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize);
        let encrypted_vec = slice.to_vec();
        windows_sys::Win32::Foundation::LocalFree(out_blob.pbData as _);
        Ok(encrypted_vec)
    }
}

#[cfg(target_os = "windows")]
fn decrypt_data(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut in_blob = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut out_blob = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };

    unsafe {
        let res = CryptUnprotectData(
            &mut in_blob,
            null_mut(),
            null_mut(),
            null_mut(),
            null_mut(),
            0,
            &mut out_blob,
        );
        if res == 0 {
            return Err("DPAPI CryptUnprotectData failed".to_string());
        }
        let slice = std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize);
        let decrypted_vec = slice.to_vec();
        windows_sys::Win32::Foundation::LocalFree(out_blob.pbData as _);
        Ok(decrypted_vec)
    }
}

#[cfg(not(target_os = "windows"))]
fn encrypt_data(data: &[u8]) -> Result<Vec<u8>, String> {
    Ok(data.to_vec())
}

#[cfg(not(target_os = "windows"))]
fn decrypt_data(data: &[u8]) -> Result<Vec<u8>, String> {
    Ok(data.to_vec())
}

#[tauri::command]
pub fn save_store_data(key: String, data_json: String) -> Result<bool, String> {
    let file_path = get_store_file_path(&key);
    let bytes = data_json.as_bytes();

    let payload_to_save = match encrypt_data(bytes) {
        Ok(encrypted) => encrypted,
        Err(e) => {
            let err_msg = format!("[Portable Store] DPAPI encryption failed for '{}': {}. Refusing to store credentials in plaintext.", key, e);
            println!("{}", err_msg);
            return Err(err_msg);
        }
    };

    fs::write(&file_path, payload_to_save)
        .map_err(|e| format!("Failed to write encrypted store data to {:?}: {}", file_path, e))?;
    
    // Also clean up old unencrypted .json store file if it exists
    let old_json_path = get_app_dir().join("binaries").join(format!("{}.json", key));
    if old_json_path.exists() {
        let _ = fs::remove_file(old_json_path);
    }

    println!("[Portable Store] DPAPI-encrypted & saved '{}' into {:?}", key, file_path);
    Ok(true)
}

#[tauri::command]
pub fn read_store_data(key: String) -> Result<String, String> {
    let file_path = get_store_file_path(&key);
    let old_json_path = get_app_dir().join("binaries").join(format!("{}.json", key));

    if !file_path.exists() && old_json_path.exists() {
        if let Ok(raw) = fs::read_to_string(&old_json_path) {
            return Ok(raw);
        }
    }

    if !file_path.exists() {
        return Ok("".to_string());
    }

    let encrypted_bytes = match fs::read(&file_path) {
        Ok(b) => b,
        Err(e) => return Err(format!("Failed to read store file {:?}: {}", file_path, e)),
    };

    match decrypt_data(&encrypted_bytes) {
        Ok(decrypted_bytes) => {
            String::from_utf8(decrypted_bytes).map_err(|e| format!("UTF8 error decoding decrypted store: {}", e))
        }
        Err(_) => {
            // Fallback for unencrypted plain text store
            String::from_utf8(encrypted_bytes).map_err(|e| format!("UTF8 error decoding store: {}", e))
        }
    }
}
