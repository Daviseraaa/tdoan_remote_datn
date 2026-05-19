//! Cấu hình từ biến môi trường — khớp schema desktop (`desktop/src/shared/env-schema.ts`).

use std::env;

use super::env_load;

fn env_str(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn env_u64(key: &str, default: u64) -> u64 {
    env::var(key)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(default)
}

fn env_usize(key: &str, default: usize) -> usize {
    env::var(key)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(default)
}

fn env_bool(key: &str, default: bool) -> bool {
    match env::var(key) {
        Ok(v) => {
            let v = v.to_lowercase();
            matches!(v.as_str(), "1" | "true" | "yes" | "on")
        }
        Err(_) => default,
    }
}

#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub server_ws_url: String,
    pub agent_key: String,
    pub heartbeat_interval_ms: u64,
    pub command_timeout_ms: u64,
    pub max_output_bytes: usize,
    pub default_shell: String,
    pub task_max_concurrency: usize,
    pub desktop_automation_enabled: bool,
    pub desktop_automation_max_steps: usize,
    pub desktop_automation_max_delay_ms: u64,
    pub desktop_automation_max_type_chars: usize,
    pub agent_version: String,
}

impl AgentConfig {
    pub fn load() -> Self {
        env_load::load_env_files();
        Self {
            server_ws_url: env_str("SERVER_WS_URL", "ws://localhost:3000"),
            agent_key: env::var("AGENT_KEY").expect("Missing AGENT_KEY"),
            heartbeat_interval_ms: env_u64("HEARTBEAT_INTERVAL_MS", 30_000),
            command_timeout_ms: env_u64("COMMAND_TIMEOUT_MS", 300_000),
            max_output_bytes: env_usize("MAX_OUTPUT_BYTES", 1_000_000),
            default_shell: env_str("DEFAULT_SHELL", "powershell"),
            task_max_concurrency: env_usize("TASK_MAX_CONCURRENCY", 1).clamp(1, 32),
            desktop_automation_enabled: env_bool("DESKTOP_AUTOMATION_ENABLED", false),
            desktop_automation_max_steps: env_usize("DESKTOP_AUTOMATION_MAX_STEPS", 200).clamp(1, 200),
            desktop_automation_max_delay_ms: env_u64("DESKTOP_AUTOMATION_MAX_DELAY_MS", 60_000).min(120_000),
            desktop_automation_max_type_chars: env_usize("DESKTOP_AUTOMATION_MAX_TYPE_CHARS", 8000).clamp(1, 32_000),
            agent_version: env_str("AGENT_VERSION", "1.1.0"),
        }
    }

    /// Base URL cho Engine.IO: `http(s)://host:port` (đổi ws→http).
    pub fn engine_io_base(&self) -> String {
        let u = self.server_ws_url.trim();
        if u.starts_with("ws://") {
            format!("http://{}", &u[5..])
        } else if u.starts_with("wss://") {
            format!("https://{}", &u[6..])
        } else {
            u.to_string()
        }
    }
}
