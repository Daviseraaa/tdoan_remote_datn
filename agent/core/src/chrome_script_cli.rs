//! CLI: chrome-replay (Windows + CHROME_EXTENSION).

use std::fs;
use std::path::PathBuf;
use serde_json::{json, Value};

use crate::config::AgentConfig;

fn extract_steps_from_file(text: &str) -> Result<Vec<Value>, String> {
    let v: Value = serde_json::from_str(text).map_err(|e| e.to_string())?;
    if let Some(arr) = v.as_array() {
        return Ok(arr.clone());
    }
    if let Some(obj) = v.as_object() {
        if let Some(steps) = obj.get("steps").and_then(|s| s.as_array()) {
            return Ok(steps.clone());
        }
    }
    Err("File JSON cần mảng steps hoặc object có field steps".into())
}

fn step_payload_from_map(o: &serde_json::Map<String, Value>, extra: &Value) -> Value {
    let mut p = serde_json::Map::new();
    for key in [
        "selector",
        "selectorIndex",
        "text",
        "tabId",
        "urlPattern",
        "maxNodes",
        "interactiveOnly",
        "timeoutMs",
        "ms",
    ] {
        if let Some(v) = o.get(key) {
            p.insert(key.to_string(), v.clone());
        }
    }
    if let Some(obj) = extra.as_object() {
        if !p.contains_key("tabId") {
            if let Some(v) = obj.get("tabId") {
                p.insert("tabId".into(), v.clone());
            }
        }
        if !p.contains_key("urlPattern") {
            if let Some(v) = obj.get("urlPattern") {
                p.insert("urlPattern".into(), v.clone());
            }
        }
    }
    Value::Object(p)
}

#[cfg(windows)]
pub async fn run_chrome_replay(path: PathBuf) -> Result<(), String> {
    if !crate::config::settings::chrome_extension_enabled_now() {
        return Err("CHROME_EXTENSION_ENABLED phải là true trong agent.env".into());
    }

    let text = fs::read_to_string(&path).map_err(|e| format!("Đọc file: {}", e))?;
    let steps = extract_steps_from_file(&text)?;
    let cfg = AgentConfig::load();
    let extra = json!({
        "urlPattern": serde_json::from_str::<Value>(&text)
            .ok()
            .and_then(|v| v.get("startUrl").cloned())
            .and_then(|u| u.as_str().map(String::from))
            .map(|s| {
                if s.ends_with('/') {
                    format!("{}*", s)
                } else {
                    format!("{}*", s)
                }
            })
    });

    tokio::spawn(async {
        if let Err(e) =
            crate::platform::windows::chrome_bridge::run_chrome_bridge_pipe_forever().await
        {
            eprintln!("[chrome-replay] pipe: {}", e);
        }
    });

    crate::platform::windows::chrome_bridge::wait_for_bridge_connected(30_000).await?;

    let url_allowed = |url: &str| {
        if cfg.chrome_extension_allowed_urls.is_empty() {
            return true;
        }
        cfg.chrome_extension_allowed_urls
            .iter()
            .any(|pat| url.starts_with(pat) || url.contains(pat))
    };

    let wait_ms = 30_000u64;
    let result = crate::platform::windows::chrome_bridge::replay_steps(
        &steps,
        |o| step_payload_from_map(o, &extra),
        wait_ms,
        cfg.chrome_extension_max_steps,
        url_allowed,
    )
    .await?;

    println!("{}", serde_json::to_string_pretty(&result).unwrap_or_default());
    Ok(())
}

#[cfg(not(windows))]
pub async fn run_chrome_replay(_path: PathBuf) -> Result<(), String> {
    Err("chrome-replay chỉ hỗ trợ Windows".into())
}
