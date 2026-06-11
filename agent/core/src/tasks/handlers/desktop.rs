use async_trait::async_trait;
use serde_json::Value;

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
    }
    let cmd = t.command.trim();
    if cmd.starts_with('[') || cmd.starts_with('{') {
        if let Ok(v) = serde_json::from_str::<Value>(cmd) {
            return Some(v);
        }
    }
    None
}

#[async_trait]
impl TaskHandler for Handler {
    fn task_type(&self) -> &'static str {
        "DESKTOP_AUTOMATION"
    }

    async fn run(&self, ctx: &TaskContext<'_>, task: &TaskExecute) -> TaskOutcome {
        if !ctx.config.desktop_automation_enabled {
            return (
                false,
                -1,
                Some(
                    "DESKTOP_AUTOMATION bị tắt. Đặt DESKTOP_AUTOMATION_ENABLED=true."
                        .into(),
                ),
                None,
            );
        }

        if !ctx.platform.desktop().is_available() {
            return (
                false,
                -1,
                Some("DESKTOP_AUTOMATION chỉ trên Windows".into()),
                None,
            );
        }

        let raw = match extract_steps_value(task) {
            Some(v) => v,
            None => {
                return (
                    false,
                    -1,
                    Some("Không đọc được steps".into()),
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
                    return (
                        false,
                        -1,
                        Some("steps phải là mảng".into()),
                        None,
                    );
                }
            }
        } else {
            return (
                false,
                -1,
                Some("steps không hợp lệ".into()),
                None,
            );
        };

        if steps_arr.is_empty() {
            return (false, -1, Some("steps rỗng".into()), None);
        }
        if steps_arr.len() > ctx.config.desktop_automation_max_steps {
            return (
                false,
                -1,
                Some(format!(
                    "Quá nhiều bước ({} > {})",
                    steps_arr.len(),
                    ctx.config.desktop_automation_max_steps
                )),
                None,
            );
        }

        for s in &steps_arr {
            let o = match s.as_object() {
                Some(o) => o,
                None => {
                    return (
                        false,
                        -1,
                        Some("step không phải object".into()),
                        None,
                    );
                }
            };
            let action = o.get("action").and_then(|a| a.as_str()).unwrap_or("");
            if action == "delay" {
                let ms = o.get("ms").and_then(|m| m.as_u64()).unwrap_or(0);
                if ms > ctx.config.desktop_automation_max_delay_ms {
                    return (
                        false,
                        -1,
                        Some(format!(
                            "delay.ms vượt {}",
                            ctx.config.desktop_automation_max_delay_ms
                        )),
                        None,
                    );
                }
            }
            if action == "typeText" {
                let text = o.get("text").and_then(|x| x.as_str()).unwrap_or("");
                if text.len() > ctx.config.desktop_automation_max_type_chars {
                    return (
                        false,
                        -1,
                        Some("typeText quá dài".into()),
                        None,
                    );
                }
            }
        }

        if ctx.is_cancelled() {
            return (
                false,
                -1,
                Some("Task cancelled".into()),
                Some(serde_json::json!({ "cancelled": true })),
            );
        }

        match ctx
            .platform
            .desktop()
            .run_steps(Value::Array(steps_arr), ctx.cancel.clone())
            .await
        {
            Ok(out) => {
                if ctx.is_cancelled() {
                    (
                        false,
                        -1,
                        Some("Task cancelled".into()),
                        Some(serde_json::json!({ "cancelled": true })),
                    )
                } else {
                    (true, 0, None, Some(out))
                }
            }
            Err(e) => {
                if ctx.is_cancelled() || e == "Task cancelled" {
                    (
                        false,
                        -1,
                        Some("Task cancelled".into()),
                        Some(serde_json::json!({ "cancelled": true })),
                    )
                } else {
                    (false, -1, Some(e), None)
                }
            }
        }
    }
}
