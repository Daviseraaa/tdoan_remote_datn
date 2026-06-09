use async_trait::async_trait;
use serde_json::{json, Value};

use crate::platform::close_app;
use crate::tasks::registry::{TaskContext, TaskExecute, TaskHandler};
use crate::tasks::types::TaskOutcome;

pub struct Handler;

fn payload_object(task: &TaskExecute) -> Option<&serde_json::Map<String, Value>> {
    task.payload.as_ref().and_then(|v| v.as_object())
}

#[async_trait]
impl TaskHandler for Handler {
    fn task_type(&self) -> &'static str {
        "CLOSE_APP"
    }

    async fn run(&self, _ctx: &TaskContext<'_>, task: &TaskExecute) -> TaskOutcome {
        let payload = match payload_object(task) {
            Some(p) => Value::Object(p.clone()),
            None => {
                return (
                    false,
                    -1,
                    Some("CLOSE_APP: thiếu payload (mode, pid/processName/windowTitle)".into()),
                    None,
                );
            }
        };

        match close_app::close_execute(&payload).await {
            Ok(r) => {
                let ok = !r.closed.is_empty() || r.failed.is_empty();
                (
                    ok,
                    if ok { 0 } else { -1 },
                    if ok {
                        None
                    } else {
                        Some("Không đóng được process nào".into())
                    },
                    Some(json!({
                        "closed": r.closed,
                        "failed": r.failed,
                    })),
                )
            }
            Err(e) => (false, -1, Some(e), None),
        }
    }
}
