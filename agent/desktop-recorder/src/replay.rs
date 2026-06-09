use std::path::{Path, PathBuf};
use std::process::Command;

pub struct ReplayOutcome {
    pub ok: bool,
    pub message: String,
}

pub fn resolve_core_exe() -> Option<PathBuf> {
    if let Ok(root) = std::env::var("STATIONHUB_AGENT_ROOT") {
        let p = PathBuf::from(root).join("bin").join("stationhub-agent-native.exe");
        if p.is_file() {
            return Some(p);
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for candidate in [
                dir.join("stationhub-agent-native.exe"),
                dir.join("..").join("bin").join("stationhub-agent-native.exe"),
                dir.join("..").join("..").join("bin").join("stationhub-agent-native.exe"),
            ] {
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }

    None
}

pub fn run_replay(recording_path: &Path) -> ReplayOutcome {
    let Some(core) = resolve_core_exe() else {
        return ReplayOutcome {
            ok: false,
            message: "Không tìm thấy stationhub-agent-native.exe.\n\
                      Chạy npm run build:core trong thư mục agent/ \
                      hoặc đặt STATIONHUB_AGENT_ROOT."
                .into(),
        };
    };

    let output = Command::new(&core)
        .arg("desktop-replay")
        .arg(recording_path)
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            if out.status.success() {
                let detail = if stdout.is_empty() {
                    "Hoàn tất.".into()
                } else if stdout.len() > 1200 {
                    format!("{}…", &stdout[..1200])
                } else {
                    stdout
                };
                ReplayOutcome {
                    ok: true,
                    message: detail,
                }
            } else {
                ReplayOutcome {
                    ok: false,
                    message: [stderr, stdout]
                        .into_iter()
                        .filter(|s| !s.is_empty())
                        .collect::<Vec<_>>()
                        .join("\n"),
                }
            }
        }
        Err(e) => ReplayOutcome {
            ok: false,
            message: format!("Không chạy được replay: {e}"),
        },
    }
}
