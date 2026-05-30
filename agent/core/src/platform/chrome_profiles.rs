//! Liệt kê profile Google Chrome hệ thống (User Data / Local State).

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChromeProfileEntry {
    pub directory: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

pub fn list_system_chrome_profiles() -> Result<Vec<ChromeProfileEntry>, String> {
    let udd = default_chrome_user_data_dir()?;
    if !udd.is_dir() {
        return Err(format!("Không thấy thư mục Chrome User Data: {}", udd.display()));
    }

    let mut from_state = parse_local_state_profiles(&udd)?;
    if !from_state.is_empty() {
        from_state.sort_by(|a, b| a.directory.cmp(&b.directory));
        return Ok(from_state);
    }

    let mut scanned = scan_profile_directories(&udd);
    scanned.sort_by(|a, b| a.directory.cmp(&b.directory));
    if scanned.is_empty() {
        return Err(format!(
            "Không tìm thấy profile trong {} (cài Chrome hoặc mở Chrome ít nhất một lần)",
            udd.display()
        ));
    }
    Ok(scanned)
}

fn default_chrome_user_data_dir() -> Result<PathBuf, String> {
    if let Ok(v) = std::env::var("CHROME_USER_DATA_DIR") {
        let t = v.trim();
        if !t.is_empty() {
            return Ok(PathBuf::from(t));
        }
    }

    #[cfg(windows)]
    {
        let local = std::env::var("LOCALAPPDATA")
            .map_err(|_| "LOCALAPPDATA không set".to_string())?;
        return Ok(PathBuf::from(local).join("Google").join("Chrome").join("User Data"));
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME không set".to_string())?;
        return Ok(PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("Google")
            .join("Chrome"));
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME không set".to_string())?;
        let home = PathBuf::from(home);
        for name in ["google-chrome", "chromium"] {
            let p = home.join(".config").join(name);
            if p.is_dir() {
                return Ok(p);
            }
        }
        return Ok(home.join(".config").join("google-chrome"));
    }

    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        Err("Hệ điều hành không hỗ trợ liệt kê Chrome profile".into())
    }
}

fn parse_local_state_profiles(udd: &Path) -> Result<Vec<ChromeProfileEntry>, String> {
    let path = udd.join("Local State");
    if !path.is_file() {
        return Ok(vec![]);
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("đọc Local State: {e}"))?;
    let v: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("parse Local State: {e}"))?;
    let cache = v
        .pointer("/profile/info_cache")
        .and_then(|c| c.as_object());
    let Some(cache) = cache else {
        return Ok(vec![]);
    };

    let mut out = Vec::new();
    for (dir, info) in cache {
        if dir.starts_with("System") {
            continue;
        }
        let name = info
            .get("name")
            .and_then(|n| n.as_str())
            .map(|s| s.to_string());
        let profile_path = udd.join(dir);
        if profile_path.join("Preferences").is_file() || dir == "Default" {
            out.push(ChromeProfileEntry {
                directory: dir.clone(),
                name,
            });
        }
    }
    Ok(out)
}

fn scan_profile_directories(udd: &Path) -> Vec<ChromeProfileEntry> {
    let mut out = Vec::new();
    let Ok(entries) = std::fs::read_dir(udd) else {
        return out;
    };
    for ent in entries.flatten() {
        let path = ent.path();
        if !path.is_dir() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if name.starts_with('.') || name == "GrShaderCache" || name == "ShaderCache" {
            continue;
        }
        if path.join("Preferences").is_file() {
            out.push(ChromeProfileEntry {
                directory: name.to_string(),
                name: None,
            });
        }
    }
    out
}
