use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;
use uuid::Uuid;

use serde_json::json;

pub struct SavedRecording {
    pub id: String,
    pub path: String,
    pub name: String,
}

#[derive(Clone)]
pub struct RecordingMeta {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub step_count: usize,
    pub modified_label: String,
}

pub fn recordings_dir() -> PathBuf {
    let pd = std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".into());
    PathBuf::from(pd).join("DATN").join("desktop-recordings")
}

pub fn save_recording(
    name: &str,
    steps: &[Value],
    capture_uia: bool,
) -> Result<SavedRecording, Box<dyn std::error::Error>> {
    let dir = recordings_dir();
    fs::create_dir_all(&dir)?;

    let id = Uuid::new_v4().to_string();
    let display_name = if name.trim().is_empty() {
        format!("recording-{}", &id[..8])
    } else {
        name.trim().to_string()
    };

    let doc = json!({
        "id": id,
        "name": display_name,
        "version": 1,
        "coordSpace": "physical",
        "captureUia": capture_uia,
        "steps": steps,
        "createdAt": chrono::Utc::now().to_rfc3339(),
    });

    let path = dir.join(format!("{}.json", doc["id"].as_str().unwrap()));
    fs::write(&path, serde_json::to_string_pretty(&doc)?)?;

    Ok(SavedRecording {
        id: doc["id"].as_str().unwrap().to_string(),
        path: path.display().to_string(),
        name: display_name,
    })
}

fn format_modified(t: SystemTime) -> String {
    use chrono::{DateTime, Utc};
    let dt: DateTime<Utc> = t.into();
    dt.format("%Y-%m-%d %H:%M").to_string()
}

pub fn list_recordings() -> Result<Vec<RecordingMeta>, String> {
    let dir = recordings_dir();
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut items: Vec<(SystemTime, RecordingMeta)> = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| format!("read_dir: {}", e))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if p.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let modified = entry
            .metadata()
            .and_then(|m| m.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH);

        let text = fs::read_to_string(&p).map_err(|e| e.to_string())?;
        let doc: Value = serde_json::from_str(&text).map_err(|_| "invalid json".to_string())?;

        let id = doc.get("id").and_then(|x| x.as_str()).unwrap_or_default().to_string();
        if id.is_empty() {
            continue;
        }

        let name = doc
            .get("name")
            .and_then(|x| x.as_str())
            .unwrap_or("recording")
            .to_string();

        let step_count = doc
            .get("steps")
            .and_then(|s| s.as_array())
            .map(|a| a.len())
            .unwrap_or(0);

        items.push((
            modified,
            RecordingMeta {
                id,
                name,
                path: p,
                step_count,
                modified_label: format_modified(modified),
            },
        ));
    }

    items.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(items.into_iter().map(|(_, m)| m).collect())
}

pub fn delete_recording(id: &str) -> Result<(), String> {
    let dir = recordings_dir();
    let path = dir.join(format!("{id}.json"));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn open_recordings_folder() {
    let dir = recordings_dir();
    let _ = fs::create_dir_all(&dir);
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("explorer")
            .arg(dir.as_os_str())
            .spawn();
    }
}
