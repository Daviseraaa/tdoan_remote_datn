use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

pub struct SavedScript {
    pub id: String,
    pub path: String,
    pub name: String,
}

fn scripts_dir() -> PathBuf {
    let pd = std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".into());
    PathBuf::from(pd).join("DATN").join("chrome-scripts")
}

pub fn save_recording_script(script: &Value) -> Result<SavedScript, Box<dyn std::error::Error + Send + Sync>> {
    let dir = scripts_dir();
    fs::create_dir_all(&dir)?;

    let id = script
        .get("id")
        .and_then(|x| x.as_str())
        .filter(|s| !s.is_empty())
        .map(String::from)
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let name = script
        .get("name")
        .and_then(|x| x.as_str())
        .unwrap_or("recording")
        .to_string();

    let mut doc = if script.is_object() {
        script.clone()
    } else {
        json!({ "steps": script })
    };
    if let Some(obj) = doc.as_object_mut() {
        obj.insert("id".into(), json!(id));
        obj.insert("version".into(), json!(obj.get("version").and_then(|v| v.as_i64()).unwrap_or(1)));
        if !obj.contains_key("name") {
            obj.insert("name".into(), json!(name));
        }
    }

    let path = dir.join(format!("{}.json", id));
    let pretty = serde_json::to_string_pretty(&doc)?;
    fs::write(&path, pretty)?;

    Ok(SavedScript {
        id,
        path: path.display().to_string(),
        name,
    })
}

pub fn list_recording_scripts(
    limit: usize,
) -> Result<Vec<Value>, Box<dyn std::error::Error + Send + Sync>> {
    let dir = scripts_dir();
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut items: Vec<(std::time::SystemTime, Value)> = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let p = entry.path();
        if p.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let modified = entry
            .metadata()
            .and_then(|m| m.modified())
            .unwrap_or(std::time::UNIX_EPOCH);

        let text = fs::read_to_string(&p)?;
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

        let start_url = doc
            .get("startUrl")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string());

        let steps = doc.get("steps").cloned().unwrap_or_else(|| json!([]));
        let steps_count = steps.as_array().map(|a| a.len()).unwrap_or(0);

        let saved_path = p.display().to_string();

        items.push((
            modified,
            json!({
                "id": id,
                "name": name,
                "startUrl": start_url,
                "steps": steps,
                "stepsCount": steps_count,
                "savedPath": saved_path,
            }),
        ));
    }

    items.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(items
        .into_iter()
        .take(limit)
        .map(|(_, v)| v)
        .collect())
}

fn resolve_script_path_for_delete(
    id: Option<&str>,
    script_path: Option<&str>,
) -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
    let dir = scripts_dir();
    fs::create_dir_all(&dir)?;

    let path = if let Some(p) = script_path {
        if p.trim().is_empty() {
            return Err("scriptPath empty".into());
        }
        PathBuf::from(p)
    } else if let Some(id) = id {
        let id = id.trim();
        if id.is_empty() || id.contains("..") || id.contains('/') || id.contains('\\') {
            return Err("invalid id".into());
        }
        dir.join(format!("{}.json", id))
    } else {
        return Err("id or scriptPath required".into());
    };

    let dir_canon = dir.canonicalize().unwrap_or(dir.clone());
    let path_canon = path.canonicalize().unwrap_or(path.clone());
    if !path_canon.starts_with(&dir_canon) {
        return Err("path outside chrome-scripts directory".into());
    }
    Ok(path_canon)
}

pub fn delete_recording_script(
    id: Option<&str>,
    script_path: Option<&str>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let path = resolve_script_path_for_delete(id, script_path)?;
    if !path.is_file() {
        return Err(format!("file not found: {}", path.display()).into());
    }
    fs::remove_file(path)?;
    Ok(())
}
