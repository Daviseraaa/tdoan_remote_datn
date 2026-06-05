//! CLI: desktop-replay — chạy lại bản ghi desktop từ file JSON (Windows).

use serde_json::Value;
use std::fs;
use std::path::PathBuf;

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

#[cfg(windows)]
pub async fn run_desktop_replay(path: PathBuf) -> Result<(), String> {
    datn_windows_uia::enable_per_monitor_v2();

    let text = fs::read_to_string(&path).map_err(|e| format!("Đọc file: {}", e))?;
    let steps = extract_steps_from_file(&text)?;
    if steps.is_empty() {
        return Err("steps rỗng".into());
    }

    let result = crate::platform::windows::desktop::run_steps_json(Some(serde_json::json!({
        "steps": steps
    })))
    .await?;

    println!("{}", serde_json::to_string_pretty(&result).unwrap_or_default());
    Ok(())
}

#[cfg(not(windows))]
pub async fn run_desktop_replay(_path: PathBuf) -> Result<(), String> {
    Err("desktop-replay chỉ hỗ trợ Windows".into())
}
