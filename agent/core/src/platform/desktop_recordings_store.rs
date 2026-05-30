//! Đọc desktop recording ghi local từ recorder (%ProgramData%\DATN\desktop-recordings).

use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

fn recordings_dir() -> PathBuf {
    let pd = std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".into());
    PathBuf::from(pd).join("DATN").join("desktop-recordings")
}

/// Liệt kê toàn bộ recording local (tối đa `max_count` bản ghi, mới nhất trước).
#[cfg(windows)]
pub fn list_local_desktop_recordings(max_count: usize) -> Result<Vec<Value>, String> {
    let dir = recordings_dir();
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut items: Vec<(std::time::SystemTime, Value)> = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| format!("read_dir: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if p.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let modified = entry
            .metadata()
            .and_then(|m| m.modified())
            .unwrap_or(std::time::UNIX_EPOCH);

        let text = fs::read_to_string(&p).map_err(|e| e.to_string())?;
        let doc: Value = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let id = doc
            .get("id")
            .and_then(|x| x.as_str())
            .unwrap_or_default()
            .to_string();
        if id.is_empty() {
            continue;
        }

        let name = doc
            .get("name")
            .and_then(|x| x.as_str())
            .unwrap_or("recording")
            .to_string();

        let steps = doc.get("steps").cloned().unwrap_or_else(|| json!([]));
        if !steps.is_array() || steps.as_array().map(|a| a.is_empty()).unwrap_or(true) {
            continue;
        }

        let saved_path = p.display().to_string();

        items.push((
            modified,
            json!({
                "id": id,
                "name": name,
                "steps": steps,
                "savedPath": saved_path,
            }),
        ));
    }

    items.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(items
        .into_iter()
        .take(max_count)
        .map(|(_, v)| v)
        .collect())
}

#[cfg(not(windows))]
pub fn list_local_desktop_recordings(_max_count: usize) -> Result<Vec<Value>, String> {
    Ok(vec![])
}
