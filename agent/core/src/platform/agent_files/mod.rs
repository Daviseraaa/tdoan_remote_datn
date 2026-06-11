//! Duyệt file trên máy agent — từ ổ đĩa gốc (C:\, D:\, …) và shortcut StationHub.

use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

const MAX_LIST_ENTRIES: usize = 500;
const MAX_READ_BYTES: usize = 10 * 1024 * 1024;
const MAX_WRITE_BYTES: usize = 10 * 1024 * 1024;
const MAX_CHUNK_BYTES: usize = 1024 * 1024;
const STATIONHUB_ALIAS: &str = "stationhub";

static UPLOAD_BUFFERS: Mutex<Option<HashMap<String, Vec<u8>>>> = Mutex::new(None);

fn upload_buffers() -> std::sync::MutexGuard<'static, Option<HashMap<String, Vec<u8>>>> {
    let mut guard = UPLOAD_BUFFERS.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        *guard = Some(HashMap::new());
    }
    guard
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentFileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentFileReadResult {
    pub path: String,
    pub size: u64,
    pub mime_type: String,
    pub encoding: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentFileWriteResult {
    pub path: String,
    pub size: u64,
    pub written: bool,
}

enum ResolvedTarget {
    /// Danh sách ổ đĩa / root hệ thống.
    VirtualRoot,
    Physical(PathBuf),
}

pub fn station_hub_root() -> PathBuf {
    #[cfg(windows)]
    {
        let pd = std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".into());
        return PathBuf::from(pd).join("StationHub");
    }
    #[cfg(not(windows))]
    {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home).join(".stationhub");
        }
        PathBuf::from("/var/lib/stationhub")
    }
}

pub fn filesystem_root_label() -> String {
    #[cfg(windows)]
    {
        "This PC".into()
    }
    #[cfg(not(windows))]
    {
        "/".into()
    }
}

fn ensure_station_hub_layout(root: &Path) {
    let _ = std::fs::create_dir_all(root);
    for sub in [
        "workspace",
        "captures",
        "chrome-scripts",
        "desktop-recordings",
    ] {
        let _ = std::fs::create_dir_all(root.join(sub));
    }
}

fn normalize_rel_path(raw: &str) -> String {
    raw.trim().replace('\\', "/")
}

fn push_segments(mut base: PathBuf, rel: &str) -> Result<PathBuf, String> {
    for part in rel.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            return Err("Đường dẫn không hợp lệ".into());
        }
        base.push(part);
    }
    Ok(base)
}

#[cfg(windows)]
fn parse_windows_drive_path(rel: &str) -> Option<PathBuf> {
    let rel = rel.trim();
    if rel.len() < 2 {
        return None;
    }
    let mut chars = rel.chars();
    let letter = chars.next()?;
    let colon = chars.next()?;
    if colon != ':' || !letter.is_ascii_alphabetic() {
        return None;
    }
    let drive = format!("{}:", letter.to_ascii_uppercase());
    let rest: String = chars.collect();
    let mut path = PathBuf::from(format!("{}\\", drive));
    let sub = rest.trim_start_matches('/');
    if !sub.is_empty() {
        path = push_segments(path, sub).ok()?;
    }
    Some(path)
}

#[cfg(not(windows))]
fn parse_unix_path(rel: &str) -> PathBuf {
    let rel = rel.trim();
    if rel.is_empty() || rel == "/" {
        return PathBuf::from("/");
    }
    if rel.starts_with('/') {
        PathBuf::from(rel)
    } else {
        push_segments(PathBuf::from("/"), rel).unwrap_or_else(|_| PathBuf::from("/"))
    }
}

fn resolve_stationhub_path(rel: &str) -> Result<PathBuf, String> {
    let root = station_hub_root();
    ensure_station_hub_layout(&root);
    let sub = rel
        .strip_prefix(STATIONHUB_ALIAS)
        .unwrap_or("")
        .trim_start_matches('/');
    let path = if sub.is_empty() {
        root.clone()
    } else {
        push_segments(root, sub)?
    };
    if !path.exists() {
        return Err(format!("Không tìm thấy: {}", rel));
    }
    Ok(path)
}

fn resolve_target(rel_path: &str) -> Result<ResolvedTarget, String> {
    let rel = normalize_rel_path(rel_path);
    if rel.is_empty() {
        return Ok(ResolvedTarget::VirtualRoot);
    }

    if rel == STATIONHUB_ALIAS || rel.starts_with(&format!("{}/", STATIONHUB_ALIAS)) {
        return Ok(ResolvedTarget::Physical(resolve_stationhub_path(&rel)?));
    }

    #[cfg(windows)]
    {
        if let Some(p) = parse_windows_drive_path(&rel) {
            if !p.exists() {
                return Err(format!("Không tìm thấy: {}", rel));
            }
            return Ok(ResolvedTarget::Physical(p));
        }
        return Err(format!("Đường dẫn không hợp lệ: {}", rel));
    }

    #[cfg(not(windows))]
    {
        let p = parse_unix_path(&rel);
        if !p.exists() {
            return Err(format!("Không tìm thấy: {}", rel));
        }
        Ok(ResolvedTarget::Physical(p))
    }
}

#[cfg(windows)]
fn list_virtual_root() -> Result<Vec<AgentFileEntry>, String> {
    let mut entries = Vec::new();

    let hub = station_hub_root();
    ensure_station_hub_layout(&hub);
    entries.push(AgentFileEntry {
        name: "StationHub".into(),
        path: STATIONHUB_ALIAS.into(),
        is_dir: true,
        size: 0,
        modified_at: modified_unix(&hub),
    });

    for letter in b'A'..=b'Z' {
        let drive = format!("{}:", letter as char);
        let path = PathBuf::from(format!("{}\\", drive));
        if path.exists() {
            entries.push(AgentFileEntry {
                name: format!("{} \\", letter as char),
                path: drive,
                is_dir: true,
                size: 0,
                modified_at: None,
            });
        }
    }

    if entries.len() <= 1 {
        return Err("Không liệt kê được ổ đĩa".into());
    }
    Ok(entries)
}

#[cfg(not(windows))]
fn list_virtual_root() -> Result<Vec<AgentFileEntry>, String> {
    let mut entries = vec![AgentFileEntry {
        name: "StationHub".into(),
        path: STATIONHUB_ALIAS.into(),
        is_dir: true,
        size: 0,
        modified_at: modified_unix(&station_hub_root()),
    }];
    let root = PathBuf::from("/");
    let read_dir = std::fs::read_dir(&root).map_err(|e| e.to_string())?;
    for item in read_dir {
        if entries.len() >= MAX_LIST_ENTRIES {
            break;
        }
        let item = item.map_err(|e| e.to_string())?;
        let name = item.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let path_abs = item.path();
        let ft = item.file_type().map_err(|e| e.to_string())?;
        entries.push(AgentFileEntry {
            name: name.clone(),
            path: format!("/{}", name),
            is_dir: ft.is_dir(),
            size: std::fs::metadata(&path_abs).map(|m| m.len()).unwrap_or(0),
            modified_at: modified_unix(&path_abs),
        });
    }
    Ok(entries)
}

fn logical_child_path(parent_rel: &str, name: &str) -> String {
    let parent = normalize_rel_path(parent_rel);
    if parent.is_empty() {
        return name.to_string();
    }
    if parent.ends_with('/') {
        format!("{}{}", parent, name)
    } else {
        format!("{}/{}", parent, name)
    }
}

fn modified_unix(path: &Path) -> Option<u64> {
    let meta = std::fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?;
    modified.duration_since(UNIX_EPOCH).ok().map(|d| d.as_secs())
}

fn guess_mime(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    if lower.ends_with(".png") {
        return "image/png";
    }
    if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        return "image/jpeg";
    }
    if lower.ends_with(".json") {
        return "application/json";
    }
    if lower.ends_with(".txt") || lower.ends_with(".log") {
        return "text/plain";
    }
    if lower.ends_with(".html") {
        return "text/html";
    }
    "application/octet-stream"
}

pub fn list_agent_files(rel_path: &str) -> Result<Vec<AgentFileEntry>, String> {
    let rel = normalize_rel_path(rel_path);

    let target = match resolve_target(rel_path)? {
        ResolvedTarget::VirtualRoot => return list_virtual_root(),
        ResolvedTarget::Physical(p) => p,
    };

    if !target.is_dir() {
        return Err("Đường dẫn không phải thư mục".into());
    }

    let mut entries: Vec<AgentFileEntry> = Vec::new();
    let read_dir = std::fs::read_dir(&target).map_err(|e| e.to_string())?;

    for item in read_dir {
        if entries.len() >= MAX_LIST_ENTRIES {
            break;
        }
        let item = item.map_err(|e| e.to_string())?;
        let ft = item.file_type().map_err(|e| e.to_string())?;
        let name = item.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let path_abs = item.path();
        let rel_entry = logical_child_path(&rel, &name);
        let meta = std::fs::metadata(&path_abs).ok();
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified_at = modified_unix(&path_abs);
        entries.push(AgentFileEntry {
            name,
            path: rel_entry.replace('\\', "/"),
            is_dir: ft.is_dir(),
            size,
            modified_at,
        });
    }

    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

pub fn guess_mime_from_name(name: &str) -> &'static str {
    guess_mime(name)
}

/// Đọc file nhị phân từ đường dẫn logic (C:/…, stationhub/…).
pub fn read_agent_file_bytes(
    rel_path: &str,
    max_bytes: Option<usize>,
) -> Result<(Vec<u8>, String, String), String> {
    let rel = normalize_rel_path(rel_path);
    if rel.is_empty() {
        return Err("Thiếu đường dẫn file".into());
    }

    let target = match resolve_target(rel_path)? {
        ResolvedTarget::VirtualRoot => {
            return Err("Không thể đọc thư mục gốc".into());
        }
        ResolvedTarget::Physical(p) => p,
    };

    if !target.is_file() {
        return Err("Không phải file".into());
    }
    let meta = std::fs::metadata(&target).map_err(|e| e.to_string())?;
    let cap = max_bytes.unwrap_or(MAX_READ_BYTES).min(MAX_READ_BYTES);
    if meta.len() as usize > cap {
        return Err(format!(
            "File quá lớn ({} bytes, tối đa {})",
            meta.len(),
            cap
        ));
    }
    let bytes = std::fs::read(&target).map_err(|e| e.to_string())?;
    let name = target
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("file")
        .to_string();
    let mime = guess_mime(&name).to_string();
    Ok((bytes, mime, name))
}

fn is_drive_only_path(rel: &str) -> bool {
    let rel = rel.trim();
    if rel.len() == 2 {
        let mut chars = rel.chars();
        let letter = chars.next().unwrap_or('\0');
        let colon = chars.next().unwrap_or('\0');
        return colon == ':' && letter.is_ascii_alphabetic();
    }
    false
}

fn resolve_write_target(rel_path: &str) -> Result<PathBuf, String> {
    let rel = normalize_rel_path(rel_path);
    if rel.is_empty() {
        return Err("Thiếu đường dẫn file".into());
    }
    if rel == STATIONHUB_ALIAS || is_drive_only_path(&rel) {
        return Err("Chỉ định đường dẫn file (có tên file), không phải thư mục gốc".into());
    }

    let path = if rel.starts_with(&format!("{}/", STATIONHUB_ALIAS)) {
        let root = station_hub_root();
        ensure_station_hub_layout(&root);
        let sub = rel
            .strip_prefix(STATIONHUB_ALIAS)
            .unwrap_or("")
            .trim_start_matches('/');
        if sub.is_empty() {
            return Err("Thiếu tên file trong stationhub/".into());
        }
        push_segments(root, sub)?
    } else {
        #[cfg(windows)]
        {
            parse_windows_drive_path(&rel)
                .ok_or_else(|| format!("Đường dẫn không hợp lệ: {rel}"))?
        }
        #[cfg(not(windows))]
        {
            if rel == "/" {
                return Err("Chỉ định đường dẫn file".into());
            }
            parse_unix_path(&rel)
        }
    };

    if path.file_name().is_none() {
        return Err("Thiếu tên file".into());
    }
    if path.exists() && path.is_dir() {
        return Err("Đường dẫn trỏ tới thư mục — cần tên file".into());
    }
    if let Some(parent) = path.parent() {
        if parent.as_os_str().is_empty() {
            return Err("Thư mục đích không hợp lệ".into());
        }
        if parent.exists() && !parent.is_dir() {
            return Err("Thư mục cha không hợp lệ".into());
        }
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    Ok(path)
}

fn decode_write_content(content: &str, encoding: &str) -> Result<Vec<u8>, String> {
    let enc = encoding.trim().to_lowercase();
    if enc == "utf-8" || enc == "utf8" || enc == "text" {
        return Ok(content.as_bytes().to_vec());
    }
    if enc == "base64" {
        return base64::Engine::decode(&base64::engine::general_purpose::STANDARD, content)
            .map_err(|e| format!("base64 không hợp lệ: {e}"));
    }
    Err(format!("encoding không hỗ trợ: {encoding}"))
}

/// Ghi file (một lần hoặc theo chunk) — cùng không gian đường dẫn với list/read.
pub fn write_agent_file(
    rel_path: &str,
    content: &str,
    encoding: &str,
    upload_id: Option<&str>,
    chunk_index: Option<u32>,
    total_chunks: Option<u32>,
) -> Result<AgentFileWriteResult, String> {
    let rel = normalize_rel_path(rel_path);
    let bytes = decode_write_content(content, encoding)?;

    if bytes.len() > MAX_CHUNK_BYTES {
        return Err(format!(
            "Chunk quá lớn ({} bytes, tối đa {})",
            bytes.len(),
            MAX_CHUNK_BYTES
        ));
    }

    let is_chunked = upload_id.map(|s| !s.trim().is_empty()).unwrap_or(false);
    let final_bytes = if is_chunked {
        let upload_id = upload_id.unwrap().trim();
        let chunk_index = chunk_index.ok_or("Thiếu chunkIndex")?;
        let total_chunks = total_chunks.ok_or("Thiếu totalChunks")?;
        if total_chunks == 0 {
            return Err("totalChunks phải > 0".into());
        }
        if chunk_index >= total_chunks {
            return Err("chunkIndex vượt totalChunks".into());
        }

        let mut guard = upload_buffers();
        let map = guard.as_mut().ok_or("upload buffer unavailable")?;
        let key = upload_id.to_string();
        let expected_len = map.get(&key).map(|v| v.len()).unwrap_or(0);
        if chunk_index as usize != expected_len {
            map.remove(&key);
            return Err(format!(
                "Chunk không liên tiếp (nhận {}, kỳ vọng {})",
                chunk_index,
                expected_len
            ));
        }
        let entry = map.entry(key.clone()).or_default();
        entry.extend_from_slice(&bytes);
        let assembled_len = entry.len();
        if assembled_len > MAX_WRITE_BYTES {
            map.remove(&key);
            return Err(format!(
                "File upload quá lớn ({} bytes, tối đa {})",
                assembled_len, MAX_WRITE_BYTES
            ));
        }

        if chunk_index + 1 < total_chunks {
            return Ok(AgentFileWriteResult {
                path: rel.clone(),
                size: assembled_len as u64,
                written: false,
            });
        }

        let assembled = map.remove(&key).unwrap_or_default();
        assembled
    } else {
        if bytes.len() > MAX_WRITE_BYTES {
            return Err(format!(
                "File quá lớn ({} bytes, tối đa {})",
                bytes.len(),
                MAX_WRITE_BYTES
            ));
        }
        bytes
    };

    let target = resolve_write_target(rel_path)?;
    std::fs::write(&target, &final_bytes).map_err(|e| e.to_string())?;

    Ok(AgentFileWriteResult {
        path: rel,
        size: final_bytes.len() as u64,
        written: true,
    })
}

pub fn read_agent_file(rel_path: &str, max_bytes: Option<usize>) -> Result<AgentFileReadResult, String> {
    let rel = normalize_rel_path(rel_path);
    let (bytes, mime, _name) = read_agent_file_bytes(rel_path, max_bytes)?;
    let mime = mime.as_str();
    let encoding = if mime.starts_with("text/") || mime == "application/json" {
        "utf-8"
    } else {
        "base64"
    };
    let content = if encoding == "base64" {
        base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes)
    } else {
        String::from_utf8_lossy(&bytes).into_owned()
    };

    Ok(AgentFileReadResult {
        path: rel,
        size: bytes.len() as u64,
        mime_type: mime.to_string(),
        encoding: encoding.to_string(),
        content,
    })
}
