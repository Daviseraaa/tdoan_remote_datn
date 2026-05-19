//! Nạp file cấu hình trước khi đọc `std::env` (ưu tiên ProgramData trên Windows).

use std::env;
use std::path::{Path, PathBuf};

fn program_data_config() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let pd = env::var("ProgramData").ok()?;
        let p = Path::new(&pd).join("DATN").join("agent.env");
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

/// Gọi một lần lúc khởi động process (trước `AgentConfig::load`).
pub fn load_env_files() {
    if let Ok(path) = env::var("DATN_AGENT_CONFIG") {
        if Path::new(&path).exists() {
            let _ = dotenvy::from_filename(&path);
        }
        return;
    }

    if let Some(p) = program_data_config() {
        if p.exists() {
            let _ = dotenvy::from_path(&p);
            return;
        }
    }

    for p in dev_env_candidates() {
        if p.exists() {
            let _ = dotenvy::from_path(&p);
            return;
        }
    }
}

/// Đường dẫn config mặc định (để log / tool).
pub fn default_config_path() -> PathBuf {
    if let Ok(path) = env::var("DATN_AGENT_CONFIG") {
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
