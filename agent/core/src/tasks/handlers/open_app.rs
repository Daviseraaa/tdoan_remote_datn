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

#[async_trait]
impl TaskHandler for Handler {
    fn task_type(&self) -> &'static str {
        "OPEN_APP"
    }

    async fn run(&self, ctx: &TaskContext<'_>, task: &TaskExecute) -> TaskOutcome {
        let target = extract_open_target(task);
        if target.is_empty() {
            return (
                false,
                -1,
                Some("Cần đường dẫn app hoặc tên để tìm".into()),
                None,
            );
        }
        match ctx.platform.open_app().resolve_and_launch(&target).await {
            Ok(s) => (
                true,
                0,
                None,
                Some(json!({
                    "method": s.method,
                    "launched": s.launched,
                    "windowDetected": cfg!(windows),
                    "pid": s.pid,
                    "processName": s.process_name,
                })),
            ),
            Err(e) => (false, -1, Some(e), None),
        }
    }
}
