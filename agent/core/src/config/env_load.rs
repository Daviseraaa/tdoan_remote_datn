//! Nạp file cấu hình trước khi đọc `std::env` (ưu tiên ProgramData trên Windows).

use super::dev_defaults;
use std::env;
use std::path::{Path, PathBuf};

fn program_data_config() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let pd = env::var("ProgramData").ok()?;
        let p = Path::new(&pd).join("StationHub").join("agent.env");
        return Some(p);
    }
    #[cfg(not(windows))]
    {
        let _ = ();
        None
    }
}

fn dev_env_candidates() -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Ok(cwd) = env::current_dir() {
        out.push(cwd.join(".env"));
        out.push(cwd.join("agent").join(".env"));
    }
    if let Ok(exe) = env::current_exe() {
        if let Some(dir) = exe.parent() {
            out.push(dir.join(".env"));
            if let Some(parent) = dir.parent() {
                out.push(parent.join(".env"));
                if parent.file_name().is_some_and(|n| n == "bin") {
                    if let Some(agent_root) = parent.parent() {
                        out.push(agent_root.join(".env"));
                    }
                }
            }
        }
    }
    out
}

/// Đọc một key từ file config đang dùng (fallback nếu dotenv không set biến).
pub fn read_key_from_active_config(key: &str) -> Option<String> {
    let path = default_config_path();
    if path.exists() {
        read_key_from_file(&path, key)
    } else {
        None
    }
}

/// Gọi một lần lúc khởi động process (trước `AgentConfig::load`).
pub fn load_env_files() {
    let loaded = if let Ok(path) = env::var("STATIONHUB_AGENT_CONFIG") {
        let p = Path::new(&path);
        if p.exists() {
            dotenvy::from_filename_override(&path).ok();
            Some(p.to_path_buf())
        } else {
            None
        }
    } else if let Some(p) = program_data_config() {
        if p.exists() {
            dotenvy::from_path_override(&p).ok();
            Some(p)
        } else {
            None
        }
    } else {
        dev_env_candidates()
            .into_iter()
            .find(|p| p.exists())
            .map(|p| {
                dotenvy::from_path_override(&p).ok();
                p
            })
    };

    if let Some(p) = loaded {
        pin_critical_keys_from_file(&p);
    }

    // Tab Nâng cao: cố định lúc build — ghi đè mọi giá trị trong agent.env.
    dev_defaults::pin_build_env();
}

/// Ghi đè trực tiếp các key quan trọng từ file (tránh dotenv/env cũ che mất).
fn pin_critical_keys_from_file(path: &Path) {
    const KEYS: &[&str] = &[
        "CHROME_EXTENSION_ENABLED",
        "DESKTOP_AUTOMATION_ENABLED",
        "RUSTDESK_EXE_PATH",
        "RUSTDESK_ID",
        "RUSTDESK_PASSWORD",
    ];
    for key in KEYS {
        if let Some(v) = read_key_from_file(path, key) {
            env::set_var(key, v);
        }
    }
}

fn unescape_env_value(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut chars = raw.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            if let Some(&next) = chars.peek() {
                chars.next();
                match next {
                    '\\' => out.push('\\'),
                    '"' => out.push('"'),
                    'n' => out.push('\n'),
                    'r' => out.push('\r'),
                    't' => out.push('\t'),
                    other => out.push(other),
                }
                continue;
            }
        }
        out.push(c);
    }
    out
}

fn collapse_backslashes(segment: &str) -> String {
    let mut out = String::with_capacity(segment.len());
    let mut chars = segment.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            out.push('\\');
            while chars.peek() == Some(&'\\') {
                chars.next();
            }
        } else {
            out.push(c);
        }
    }
    out
}

fn normalize_windows_path(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let bytes = trimmed.as_bytes();
    if trimmed.len() >= 2 && bytes[1] == b':' {
        let rest = collapse_backslashes(&trimmed[2..].replace('/', "\\"));
        return format!("{}:{rest}", &trimmed[..1]);
    }
    collapse_backslashes(&trimmed.replace('/', "\\"))
}

fn is_path_env_key(key: &str) -> bool {
    key.ends_with("_PATH")
        || key.ends_with("_DIR")
        || key.contains("PROFILE")
        || key == "CLOAK_RUNNER_SCRIPT"
}

fn normalize_env_value(key: &str, value: String) -> String {
    if is_path_env_key(key) {
        normalize_windows_path(&value)
    } else {
        value
    }
}

fn read_key_from_file(path: &Path, key: &str) -> Option<String> {
    let content = std::fs::read_to_string(path).ok()?;
    for line in content.lines() {
        let t = line.trim();
        if t.is_empty() || t.starts_with('#') {
            continue;
        }
        let Some((k, v)) = t.split_once('=') else {
            continue;
        };
        if k.trim() != key {
            continue;
        }
        let mut val = v.trim().to_string();
        if (val.starts_with('"') && val.ends_with('"'))
            || (val.starts_with('\'') && val.ends_with('\''))
        {
            val = unescape_env_value(&val[1..val.len() - 1]);
        }
        return Some(normalize_env_value(key, val));
    }
    None
}

/// Đường dẫn config mặc định (để log / tool).
pub fn default_config_path() -> PathBuf {
    if let Ok(path) = env::var("STATIONHUB_AGENT_CONFIG") {
        return PathBuf::from(path);
    }
    if let Some(p) = program_data_config() {
        return p;
    }
    dev_env_candidates()
        .into_iter()
        .find(|p| p.exists())
        .unwrap_or_else(|| program_data_config().unwrap_or_else(|| PathBuf::from(".env")))
}
