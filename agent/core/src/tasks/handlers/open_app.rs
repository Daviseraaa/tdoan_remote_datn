use async_trait::async_trait;
use serde_json::{json, Value};

use crate::tasks::registry::{TaskContext, TaskExecute, TaskHandler};
use crate::tasks::types::TaskOutcome;

pub struct Handler;

fn extract_open_target(t: &TaskExecute) -> String {
    if let Some(Value::Object(p)) = &t.payload {
        if let Some(s) = p.get("path").and_then(|x| x.as_str()) {
            if !s.trim().is_empty() {
                return s.trim().to_string();
            }
        }
        if let Some(s) = p.get("query").and_then(|x| x.as_str()) {
            if !s.trim().is_empty() {
                return s.trim().to_string();
            }
        }
        if let Some(s) = p.get("app").and_then(|x| x.as_str()) {
            if !s.trim().is_empty() {
                return s.trim().to_string();
            }
        }
    }
    t.command.trim().to_string()
}

fn extract_reuse_existing(t: &TaskExecute) -> bool {
    t.payload
        .as_ref()
        .and_then(|v| v.as_object())
        .and_then(|p| p.get("reuseExisting"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

fn extract_maximize_window(t: &TaskExecute) -> bool {
    t.payload
        .as_ref()
        .and_then(|v| v.as_object())
        .and_then(|p| p.get("maximizeWindow"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

#[async_trait]
impl TaskHandler for Handler {
    fn task_type(&self) -> &'static str {
        "OPEN_APP"
    }

    async fn run(&self, ctx: &TaskContext<'_>, task: &TaskExecute) -> TaskOutcome {
        let target = extract_open_target(task);
        let reuse_existing = extract_reuse_existing(task);
        let maximize_window = extract_maximize_window(task);
        if target.is_empty() {
            return (
                false,
                -1,
                Some("Cần đường dẫn app hoặc tên để tìm".into()),
                None,
            );
        }
        match ctx
            .platform
            .open_app()
            .resolve_and_launch(&target, reuse_existing, maximize_window)
            .await
        {
            Ok(s) => (
                true,
                0,
                None,
                Some(json!({
                    "method": s.method,
                    "launched": s.launched,
                    "reusedExisting": s.reused_existing,
                    "windowDetected": cfg!(windows),
                    "pid": s.pid,
                    "processName": s.process_name,
                    "maximized": s.maximized,
                    "maximizeRequested": maximize_window,
                })),
            ),
            Err(e) => (false, -1, Some(e), None),
        }
    }
}
