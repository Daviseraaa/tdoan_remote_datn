use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

pub struct ReplayOutcome {
    pub ok: bool,
    pub message: String,
}

fn station_hub_dir() -> PathBuf {
    let pd = std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".into());
    PathBuf::from(pd).join("StationHub")
}

fn program_data_bin() -> PathBuf {
    station_hub_dir().join("bin")
}

fn push_candidate(out: &mut Vec<PathBuf>, p: PathBuf) {
    if out.iter().any(|x| x == &p) {
        return;
    }
    out.push(p);
}

const MIN_CORE_BYTES: u64 = 2_000_000;

fn is_valid_core_exe(p: &Path) -> bool {
    fs::metadata(p)
        .map(|m| m.is_file() && m.len() >= MIN_CORE_BYTES)
        .unwrap_or(false)
}

fn read_pinned_core_path() -> Option<PathBuf> {
    let pointer = station_hub_dir().join("agent-core.path");
    let text = fs::read_to_string(&pointer).ok()?;
    let path = PathBuf::from(text.trim());
    if is_valid_core_exe(&path) {
        Some(path)
    } else {
        None
    }
}

fn collect_core_candidates() -> Vec<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Some(p) = read_pinned_core_path() {
        push_candidate(&mut candidates, p);
    }

    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        push_candidate(
            &mut candidates,
            PathBuf::from(local)
                .join("Programs")
                .join("StationHub Agent")
                .join("resources")
                .join("core")
                .join("stationhub-agent-native.exe"),
        );
    }

    push_candidate(
        &mut candidates,
        PathBuf::from(r"C:\Program Files\StationHub\bin\stationhub-agent-native.exe"),
    );

    if let Ok(root) = std::env::var("STATIONHUB_AGENT_ROOT") {
        push_candidate(
            &mut candidates,
            PathBuf::from(root)
                .join("bin")
                .join("stationhub-agent-native.exe"),
        );
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for p in [
                dir.join("..")
                    .join("resources")
                    .join("core")
                    .join("stationhub-agent-native.exe"),
                dir.join("stationhub-agent-native.exe"),
                dir.join("..").join("bin").join("stationhub-agent-native.exe"),
                dir.join("..")
                    .join("..")
                    .join("bin")
                    .join("stationhub-agent-native.exe"),
            ] {
                push_candidate(&mut candidates, p);
            }
        }
    }

    // Cuối cùng — bản copy từ Cai-dat.bat (recorder-only, có thể cũ hơn Agent)
    push_candidate(
        &mut candidates,
        program_data_bin().join("stationhub-agent-native.exe"),
    );

    candidates
}

/// Ưu tiên core đang dùng bởi StationHub Agent (cùng bản web task), rồi bản mới nhất tìm được.
pub fn resolve_core_exe() -> Option<PathBuf> {
    if let Some(pinned) = read_pinned_core_path() {
        return Some(pinned);
    }

    let mut best: Option<(PathBuf, std::time::SystemTime)> = None;
    for p in collect_core_candidates() {
        if !is_valid_core_exe(&p) {
            continue;
        }
        let Ok(mtime) = fs::metadata(&p).and_then(|m| m.modified()) else {
            continue;
        };
        if best.as_ref().map(|(_, t)| mtime > *t).unwrap_or(true) {
            best = Some((p, mtime));
        }
    }
    best.map(|(p, _)| p)
}

const MSG_MISSING_REPLAY: &str = "Không thể chạy lại — chưa cài đặt đầy đủ trên máy.\n\n\
Mở gói StationHub Desktop Recorder (file zip), chạy Cai-dat.bat, rồi mở lại Desktop Recorder.\n\
Nếu đã cài StationHub Agent: mở Agent (icon khay) rồi thử lại, hoặc chạy lại Cai-dat.bat.";

fn user_replay_error(raw: &str) -> String {
    let lower = raw.to_lowercase();
    if lower.contains("steps rỗng") || lower.contains("steps rong") {
        return "Bản ghi không có thao tác nào.".into();
    }
    if lower.contains("đọc file") || lower.contains("doc file") || lower.contains("no such file") {
        return "Không đọc được file bản ghi — có thể file đã bị xóa hoặc di chuyển.".into();
    }
    if lower.contains("json") {
        return "File bản ghi bị lỗi hoặc không đúng định dạng.".into();
    }
    if !raw.is_empty() && raw.len() <= 200 && !raw.contains("Usage:") && !raw.contains('\\') {
        return raw.to_string();
    }
    "Chạy lại thất bại. Hãy mở đúng cửa sổ/ứng dụng như lúc ghi và thử lại.".into()
}

#[cfg(windows)]
fn spawn_replay(core: &Path, recording_path: &Path) -> std::io::Result<std::process::Output> {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    Command::new(core)
        .arg("desktop-replay")
        .arg(recording_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .output()
}

#[cfg(not(windows))]
fn spawn_replay(core: &Path, recording_path: &Path) -> std::io::Result<std::process::Output> {
    Command::new(core)
        .arg("desktop-replay")
        .arg(recording_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
}

pub fn run_replay(recording_path: &Path) -> ReplayOutcome {
    let Some(core) = resolve_core_exe() else {
        return ReplayOutcome {
            ok: false,
            message: MSG_MISSING_REPLAY.into(),
        };
    };

    let output = spawn_replay(&core, recording_path);

    match output {
        Ok(out) => {
            if out.status.success() {
                ReplayOutcome {
                    ok: true,
                    message: "Chạy lại hoàn tất.".into(),
                }
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                let raw = [stderr, stdout]
                    .into_iter()
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<_>>()
                    .join("\n");
                ReplayOutcome {
                    ok: false,
                    message: user_replay_error(&raw),
                }
            }
        }
        Err(_) => ReplayOutcome {
            ok: false,
            message: MSG_MISSING_REPLAY.into(),
        },
    }
}
