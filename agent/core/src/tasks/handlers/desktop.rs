use async_trait::async_trait;
use serde_json::Value;

use crate::tasks::registry::{TaskContext, TaskExecute, TaskHandler};
use crate::tasks::types::TaskOutcome;

pub struct Handler;

const MSG_DESKTOP_DISABLED: &str = "Tự động hóa desktop chưa bật trên máy agent. \
Mở StationHub Agent → Cài đặt → tab Desktop → bật «Bật điều khiển desktop» → Lưu & áp dụng, rồi thử lại.";

const MSG_DESKTOP_WINDOWS: &str = "Task desktop chỉ chạy trên máy agent Windows. \
Đăng nhập Windows, mở StationHub Agent (icon khay hệ thống) rồi thử lại.";

fn user_desktop_error(raw: &str) -> String {
    let lower = raw.to_lowercase();
    if lower.contains("desktop_automation") && lower.contains("tắt") {
        return MSG_DESKTOP_DISABLED.into();
    }
    if lower.contains("task cancelled") {
        return "Task đã bị hủy.".into();
    }
    if lower.contains("steps rỗng") || lower.contains("steps rong") {
        return "Workflow không có bước desktop nào.".into();
    }
    if lower.contains("quá nhiều bước") {
        return "Quá nhiều bước desktop — rút gọn workflow hoặc nhờ admin tăng giới hạn.".into();
    }
    if lower.contains("thiếu tọa độ") || lower.contains("click:") {
        return "Không click được — mở đúng cửa sổ/ứng dụng như lúc ghi bản.".into();
    }
    if lower.contains("sendinput") {
        return "Không gửi được thao tác chuột/phím — thử lại khi cửa sổ đích đang mở và không bị che.".into();
    }
    if !raw.is_empty() && raw.len() <= 200 && !raw.contains("DESKTOP_AUTOMATION_ENABLED") {
        return raw.to_string();
    }
    "Thực thi desktop thất bại. Mở đúng cửa sổ/ứng dụng như khi ghi bản và thử lại.".into()
}

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
                Some(MSG_DESKTOP_DISABLED.into()),
                None,
            );
        }

        if !ctx.platform.desktop().is_available() {
            return (
                false,
                -1,
                Some(MSG_DESKTOP_WINDOWS.into()),
                None,
            );
        }

        let raw = match extract_steps_value(task) {
            Some(v) => v,
            None => {
                return (
                    false,
                    -1,
                    Some("Không đọc được các bước desktop trong task.".into()),
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
            return (false, -1, Some("Workflow không có bước desktop nào.".into()), None);
        }
        if steps_arr.len() > ctx.config.desktop_automation_max_steps {
            return (
                false,
                -1,
                Some(format!(
                    "Quá nhiều bước desktop ({} — tối đa {}).",
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
                Some("Task đã bị hủy.".into()),
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
                        Some("Task đã bị hủy.".into()),
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
                        Some("Task đã bị hủy.".into()),
                        Some(serde_json::json!({ "cancelled": true })),
                    )
                } else {
                    (false, -1, Some(user_desktop_error(&e)), None)
                }
            }
        }
    }
}
