use async_trait::async_trait;
use serde_json::{json, Value};

#[cfg(windows)]
use crate::platform::windows::chrome_bridge;
use crate::tasks::registry::{TaskContext, TaskExecute, TaskHandler};
use crate::tasks::types::TaskOutcome;

pub struct Handler;

fn extract_steps_value(t: &TaskExecute) -> Option<Value> {
    if let Some(Value::Object(p)) = &t.payload {
        if let Some(s) = p.get("steps") {
            return Some(s.clone());
        }
        if let Some(Value::String(script)) = p.get("script") {
            if let Ok(v) = serde_json::from_str::<Value>(script) {
                return Some(v);
            }
        }
        if let Some(action) = p.get("action").and_then(|x| x.as_str()) {
            let mut step = serde_json::Map::new();
            step.insert("action".into(), json!(action));
            if let Some(sel) = p.get("selector") {
                step.insert("selector".into(), sel.clone());
            }
            if let Some(text) = p.get("text") {
                step.insert("text".into(), text.clone());
            }
            if let Some(tab_id) = p.get("tabId") {
                step.insert("tabId".into(), tab_id.clone());
            }
            if let Some(url) = p.get("urlPattern") {
                step.insert("urlPattern".into(), url.clone());
            }
            if let Some(max) = p.get("maxNodes") {
                step.insert("maxNodes".into(), max.clone());
            }
            if let Some(ms) = p.get("timeoutMs") {
                step.insert("timeoutMs".into(), ms.clone());
            }
            return Some(Value::Array(vec![Value::Object(step)]));
        }
    }
    let cmd = t.command.trim();
    if cmd.starts_with('[') || cmd.starts_with('{') {
        if let Ok(v) = serde_json::from_str::<Value>(cmd) {
            return Some(v);
        }
    }
    None
}

fn step_payload(step: &serde_json::Map<String, Value>, task: &TaskExecute) -> Value {
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
        if let Some(v) = step.get(key) {
            p.insert(key.to_string(), v.clone());
        }
    }
    if !p.contains_key("tabId") {
        if let Some(Value::Object(tp)) = &task.payload {
            if let Some(v) = tp.get("tabId") {
                p.insert("tabId".into(), v.clone());
            }
            if let Some(v) = tp.get("urlPattern") {
                p.insert("urlPattern".into(), v.clone());
            }
        }
    }
    Value::Object(p)
}

fn url_allowed(cfg: &crate::config::AgentConfig, url: &str) -> bool {
    if cfg.chrome_extension_allowed_urls.is_empty() {
        return true;
    }
    cfg.chrome_extension_allowed_urls
        .iter()
        .any(|pat| url.starts_with(pat) || url.contains(pat))
}

#[async_trait]
impl TaskHandler for Handler {
    fn task_type(&self) -> &'static str {
        "CHROME_EXTENSION"
    }

    async fn run(&self, ctx: &TaskContext<'_>, task: &TaskExecute) -> TaskOutcome {
        if !crate::config::settings::chrome_extension_enabled_now() {
            let path = crate::config::env_load::default_config_path();
            return (
                false,
                -1,
                Some(format!(
                    "CHROME_EXTENSION bị tắt. Đặt CHROME_EXTENSION_ENABLED=true trong {} rồi Lưu cài đặt (hoặc restart agent).",
                    path.display()
                )),
                None,
            );
        }

        let raw = match extract_steps_value(task) {
            Some(v) => v,
            None => {
                return (
                    false,
                    -1,
                    Some("Payload cần action hoặc steps[]".into()),
                    None,
                );
            }
        };

        let steps_arr = if let Some(a) = raw.as_array() {
            a.clone()
        } else if let Some(obj) = raw.as_object() {
            match obj.get("steps").and_then(|s| s.as_array()) {
                Some(a) => a.clone(),
                None => {
                    return (false, -1, Some("steps phải là mảng".into()), None);
                }
            }
        } else {
            return (false, -1, Some("steps không hợp lệ".into()), None);
        };

        if steps_arr.is_empty() {
            return (false, -1, Some("steps rỗng".into()), None);
        }
        if steps_arr.len() > ctx.config.chrome_extension_max_steps {
            return (
                false,
                -1,
                Some(format!(
                    "Quá nhiều bước ({} > {})",
                    steps_arr.len(),
                    ctx.config.chrome_extension_max_steps
                )),
                None,
            );
        }

        #[cfg(not(windows))]
        {
            return (
                false,
                -1,
                Some("CHROME_EXTENSION chỉ hỗ trợ Windows".into()),
                None,
            );
        }

        let wait_ms = task.timeout.min(300_000).max(1000);
        let bridge_wait_ms = task.timeout.min(30_000).max(5_000);

        #[cfg(windows)]
        if let Err(e) = chrome_bridge::wait_for_bridge_connected(bridge_wait_ms).await {
            return (false, -1, Some(e), None);
        }

        #[cfg(windows)]
        match chrome_bridge::replay_steps(
            &steps_arr,
            |o| step_payload(o, task),
            wait_ms,
            ctx.config.chrome_extension_max_steps,
            |url| url_allowed(ctx.config, url),
        )
        .await
        {
            Ok(v) => return (true, 0, None, Some(v)),
            Err(e) => return (false, -1, Some(e), None),
        }
    }
}
