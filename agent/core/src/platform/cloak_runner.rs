//! Gọi `datn-cloak-runner` (CloakBrowser / Playwright stealth) qua file JSON.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, Instant};

use serde::Deserialize;
use serde_json::{json, Value};
use tokio::fs;
use tokio::process::Command;
use tokio::time::sleep;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloakOpenResponse {
    pub ok: bool,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub runner_pid: Option<u32>,
    #[serde(default)]
    pub chrome_profile: Option<String>,
    #[serde(default)]
    pub chrome_user_data_dir: Option<String>,
}

pub struct ChromeProfileOptions {
    pub use_chrome_profile: bool,
    pub chrome_profile: Option<String>,
    pub chrome_user_data_dir: Option<String>,
    pub chrome_executable_path: Option<String>,
}

pub struct CloakOpenSuccess {
    pub url: String,
    pub title: Option<String>,
    pub method: String,
    pub runner_pid: Option<u32>,
    pub chrome_profile: Option<String>,
    pub chrome_user_data_dir: Option<String>,
}

fn resolve_agent_root() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("DATN_AGENT_ROOT") {
        let p = p.trim();
        if !p.is_empty() {
            let pb = PathBuf::from(p);
            if pb.is_dir() {
                return Some(pb);
            }
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            if parent.file_name().is_some_and(|n| n == "bin") {
                return parent.parent().map(|p| p.to_path_buf());
            }
            if parent.file_name().is_some_and(|n| n == "core") {
                if let Some(resources) = parent.parent() {
                    return resources.parent().map(|p| p.to_path_buf());
                }
            }
        }
    }
    None
}

pub fn resolve_cloak_runner_dir() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("CLOAK_RUNNER_DIR") {
        let p = p.trim();
        if !p.is_empty() {
            let dir = PathBuf::from(p);
            if runner_exe_in_dir(&dir).is_some() {
                return Some(dir);
            }
        }
    }
    if let Ok(p) = std::env::var("CLOAK_RUNNER_EXE") {
        let p = p.trim();
        if !p.is_empty() {
            let pb = PathBuf::from(p);
            if pb.is_file() {
                return pb.parent().map(|x| x.to_path_buf());
            }
            if runner_exe_in_dir(&pb).is_some() {
                return Some(pb);
            }
        }
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(parent.join("cloak"));
            candidates.push(parent.join("..").join("cloak"));
            candidates.push(parent.join("..").join("resources").join("cloak"));
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("bin").join("cloak"));
    }
    candidates.push(PathBuf::from("bin").join("cloak"));
    candidates.push(PathBuf::from("agent").join("bin").join("cloak"));
    if let Some(root) = resolve_agent_root() {
        candidates.push(root.join("bin").join("cloak"));
    }

    for dir in candidates {
        if runner_exe_in_dir(&dir).is_some() {
            return Some(dir);
        }
    }
    None
}

fn runner_exe_in_dir(dir: &Path) -> Option<PathBuf> {
    let name = if cfg!(windows) {
        "datn-cloak-runner.exe"
    } else {
        "datn-cloak-runner"
    };
    let p = dir.join(name);
    if p.is_file() {
        return Some(p);
    }
    None
}

pub fn resolve_cloak_runner_script() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("CLOAK_RUNNER_SCRIPT") {
        let p = p.trim();
        if !p.is_empty() {
            let pb = PathBuf::from(p);
            if pb.is_file() {
                return Some(pb);
            }
        }
    }
    let mut candidates = vec![
        PathBuf::from("cloak-runner").join("main.py"),
        PathBuf::from("agent").join("cloak-runner").join("main.py"),
    ];
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("cloak-runner").join("main.py"));
    }
    if let Some(root) = resolve_agent_root() {
        candidates.push(root.join("cloak-runner").join("main.py"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            if let Some(agent_root) = parent.parent() {
                candidates.push(agent_root.join("cloak-runner").join("main.py"));
            }
        }
    }
    for p in candidates {
        if p.is_file() {
            return Some(p);
        }
    }
    None
}

pub fn cloak_runner_available() -> bool {
    resolve_cloak_runner_dir().is_some() || resolve_cloak_runner_script().is_some()
}

async fn write_temp_json(prefix: &str, value: &Value) -> Result<PathBuf, String> {
    let dir = std::env::temp_dir().join("datn-agent");
    fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("temp dir: {e}"))?;
    let name = format!(
        "{}-{}-{}.json",
        prefix,
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    );
    let path = dir.join(name);
    if value.is_object() && !value.as_object().unwrap().is_empty() {
        let body = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
        fs::write(&path, body)
            .await
            .map_err(|e| format!("ghi {path:?}: {e}"))?;
    }
    Ok(path)
}

async fn try_read_response(path: &Path) -> Option<CloakOpenResponse> {
    let raw = fs::read_to_string(path).await.ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let v: Value = serde_json::from_str(trimmed).ok()?;
    if v.get("ok").is_none() {
        return None;
    }
    serde_json::from_str(trimmed).ok()
}

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(windows)]
fn windows_detached_creation_flags() -> u32 {
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
    const DETACHED_PROCESS: u32 = 0x0000_0008;
    const CREATE_BREAKAWAY_FROM_JOB: u32 = 0x0100_0000;
    CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS | CREATE_BREAKAWAY_FROM_JOB | CREATE_NO_WINDOW
}

#[cfg(windows)]
fn windows_hidden_creation_flags() -> u32 {
    CREATE_NO_WINDOW
}

/// Trên Windows dùng `pythonw` để không bật cửa sổ console khi spawn runner.
fn resolve_cloak_python() -> String {
    if let Ok(py) = std::env::var("CLOAK_RUNNER_PYTHON") {
        let py = py.trim().to_string();
        if !py.is_empty() {
            return py;
        }
    }
    #[cfg(windows)]
    {
        return "pythonw".to_string();
    }
    #[cfg(not(windows))]
    {
        "python".to_string()
    }
}

/// Spawn runner detached — không giữ `Child` (tránh kill cả Chromium khi task xong).
fn spawn_runner_detached(program: &str, args: &[String]) -> Result<(), String> {
    let mut cmd = std::process::Command::new(program);
    cmd.args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(windows_detached_creation_flags());
    }
    cmd.spawn()
        .map_err(|e| format!("spawn detached {program}: {e}"))?;
    Ok(())
}

async fn poll_runner_response(
    res_path: &Path,
    wait_ms: u64,
    mut child: Option<&mut tokio::process::Child>,
) -> Result<CloakOpenResponse, String> {
    let deadline = Instant::now() + Duration::from_millis(wait_ms.max(10_000));

    loop {
        if let Some(parsed) = try_read_response(res_path).await {
            if parsed.ok || parsed.error.is_some() {
                if !parsed.ok {
                    if let Some(c) = child.as_mut() {
                        let _ = c.kill().await;
                    }
                }
                return Ok(parsed);
            }
        }

        if Instant::now() >= deadline {
            if let Some(c) = child.as_mut() {
                let _ = c.kill().await;
            }
            return Err("Cloak runner timeout (chờ response)".into());
        }

        if let Some(c) = child.as_mut() {
            if let Ok(Some(status)) = c.try_wait() {
                if let Some(parsed) = try_read_response(res_path).await {
                    return Ok(parsed);
                }
                return Err(format!(
                    "Cloak runner thoát {:?} trước khi có response hợp lệ",
                    status.code()
                ));
            }
        }

        sleep(Duration::from_millis(250)).await;
    }
}

/// Spawn runner; poll response file. `keep_open` → spawn detached, không giữ handle.
async fn run_runner(
    program: &str,
    args: &[String],
    res_path: &Path,
    wait_ms: u64,
    keep_open: bool,
) -> Result<CloakOpenResponse, String> {
    if keep_open {
        spawn_runner_detached(program, args)?;
        let parsed = poll_runner_response(res_path, wait_ms, None).await?;
        if parsed.ok {
            log::info!(
                "Cloak runner pid={:?} detached — browser giữ mở sau task",
                parsed.runner_pid
            );
        }
        return Ok(parsed);
    }

    let mut cmd = Command::new(program);
    cmd.args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    {
        cmd.creation_flags(windows_hidden_creation_flags());
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("spawn {program}: {e}"))?;

    poll_runner_response(res_path, wait_ms, Some(&mut child)).await
}

pub async fn open_url(
    url: &str,
    headless: bool,
    humanize: bool,
    user_data_dir: Option<String>,
    keep_open: bool,
    timeout_ms: u64,
    chrome: ChromeProfileOptions,
) -> Result<CloakOpenSuccess, String> {
    let req = json!({
        "action": "open_url",
        "url": url,
        "headless": headless,
        "humanize": humanize,
        "userDataDir": user_data_dir,
        "keepOpen": keep_open,
        "timeoutMs": timeout_ms,
        "useChromeProfile": chrome.use_chrome_profile,
        "chromeProfile": chrome.chrome_profile,
        "chromeUserDataDir": chrome.chrome_user_data_dir,
        "chromeExecutablePath": chrome.chrome_executable_path,
    });

    let req_path = write_temp_json("cloak-req", &req).await?;
    let res_path = write_temp_json("cloak-res", &json!({ "pending": true })).await?;

    let args = vec![
        "--request-file".into(),
        req_path.display().to_string(),
        "--response-file".into(),
        res_path.display().to_string(),
    ];

    let wait_ms = timeout_ms.saturating_add(60_000);

    // Ưu tiên CLOAK_RUNNER_SCRIPT (dev / main.py mới) trước exe PyInstaller trong bin/cloak.
    let parsed = if let Some(script) = resolve_cloak_runner_script() {
        let py = resolve_cloak_python();
        let mut py_args = vec![script.to_string_lossy().into_owned()];
        py_args.extend(args);
        log::info!("Cloak runner: python script {:?}", script);
        run_runner(&py, &py_args, &res_path, wait_ms, keep_open).await?
    } else if let Some(dir) = resolve_cloak_runner_dir() {
        let exe = runner_exe_in_dir(&dir).ok_or("Thiếu datn-cloak-runner.exe")?;
        log::info!("Cloak runner: exe {:?}", exe);
        run_runner(
            exe.to_str().ok_or("exe path")?,
            &args,
            &res_path,
            wait_ms,
            keep_open,
        )
        .await?
    } else {
        let _ = fs::remove_file(&req_path).await;
        return Err(
            "Không tìm thấy datn-cloak-runner. Chạy npm run build:cloak-runner.".into(),
        );
    };

    if !parsed.ok {
        let _ = fs::remove_file(&req_path).await;
        let _ = fs::remove_file(&res_path).await;
        return Err(parsed
            .error
            .unwrap_or_else(|| "Cloak runner failed".into()));
    }

    let success = CloakOpenSuccess {
        url: parsed.url.unwrap_or_else(|| url.to_string()),
        title: parsed.title,
        method: parsed
            .method
            .unwrap_or_else(|| "cloakbrowser".to_string()),
        runner_pid: parsed.runner_pid,
        chrome_profile: parsed.chrome_profile,
        chrome_user_data_dir: parsed.chrome_user_data_dir,
    };

    let _ = fs::remove_file(&req_path).await;
    let _ = fs::remove_file(&res_path).await;

    Ok(success)
}
