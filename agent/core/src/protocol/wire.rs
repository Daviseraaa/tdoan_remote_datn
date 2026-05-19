//! Chuỗi kết quả `task:result` — cùng contract với server (stdout/stderr, payload JSON).

use serde_json::Value;

#[derive(Debug, Clone)]
pub struct TaskWire {
    pub status: String,
    pub output: String,
    pub exit_code: i32,
}

pub fn tool_result_to_task_wire(
    ok: bool,
    exit_code: i32,
    message: Option<&str>,
    payload: Option<Value>,
) -> TaskWire {
    if let Some(Value::Object(m)) = &payload {
        if let Some(ec) = m.get("exitCode").and_then(|v| v.as_i64()) {
            let ec = ec as i32;
            let timed_out = m.get("timedOut").and_then(|v| v.as_bool()).unwrap_or(false);
            let success = ec == 0 && !timed_out;
            let status = if success {
                "COMPLETED"
            } else {
                "FAILED"
            }
            .to_string();
            let stdout = m.get("stdout").and_then(|v| v.as_str()).unwrap_or("");
            let stderr = m.get("stderr").and_then(|v| v.as_str()).unwrap_or("");
            let mut output = stdout.to_string();
            if !stderr.is_empty() {
                output.push_str("\n[STDERR]\n");
                output.push_str(stderr);
            }
            if timed_out {
                output.push_str("\n[TIMEOUT]");
            }
            return TaskWire {
                status,
                output,
                exit_code: ec,
            };
        }
    }

    let exit_code = exit_code;
    let status = if ok && exit_code == 0 {
        "COMPLETED"
    } else {
        "FAILED"
    }
    .to_string();

    let output = if !ok {
        let msg = message
            .filter(|s| !s.is_empty())
            .map(|s| format!("[ERROR] {}", s))
            .unwrap_or_else(|| "[ERROR]".into());
        let extra = payload
            .as_ref()
            .map(|p| {
                if let Value::String(s) = p {
                    format!("\n{}", s)
                } else {
                    format!("\n{}", serde_json::to_string_pretty(p).unwrap_or_default())
                }
            })
            .unwrap_or_default();
        format!("{}{}", msg, extra)
    } else if let Some(Value::String(s)) = &payload {
        s.clone()
    } else if let Some(p) = payload {
        serde_json::to_string_pretty(&p).unwrap_or_default()
    } else {
        String::new()
    };

    TaskWire {
        status,
        output,
        exit_code,
    }
}
