use serde_json::Value;

/// Kết quả thô từ handler trước khi chuyển sang `TaskWire`.
pub type TaskOutcome = (bool, i32, Option<String>, Option<Value>);
