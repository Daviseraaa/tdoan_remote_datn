//! Mở/đóng giao diện RustDesk trên máy agent — không cài/dừng Windows service.

use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use super::DEFAULT_RUSTDESK_PATH;

const CMD_TIMEOUT: Duration = Duration::from_secs(30);

fn run_process_with_timeout(program: &str, args: &[&str]) -> Result<(), String> {
    let mut child = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn {program}: {e}"))?;

    let started = Instant::now();
    loop {
        match child.try_wait().map_err(|e| e.to_string())? {
            Some(status) => {
                if status.success() {
                    return Ok(());
                }
                let stderr = child
                    .stderr
                    .take()
                    .and_then(|mut s| {
                        let mut buf = String::new();
                        use std::io::Read;
                        s.read_to_string(&mut buf).ok()?;
                        Some(buf)
                    })
                    .unwrap_or_default();
                let code = status.code().unwrap_or(-1);
                return Err(format!(
                    "{program} exit {code}{}",
                    if stderr.is_empty() {
                        String::new()
                    } else {
                        format!(" — {stderr}")
                    }
                ));
            }
            None if started.elapsed() >= CMD_TIMEOUT => {
                let _ = child.kill();
                return Err(format!(
                    "{program} quá thời gian ({}s)",
                    CMD_TIMEOUT.as_secs()
                ));
            }
            None => std::thread::sleep(Duration::from_millis(200)),
        }
    }
}

/// Mở giao diện RustDesk trên máy agent (không chờ process thoát).
pub fn launch_application(exe_path: &str) -> Result<(), String> {
    let path = exe_path.trim();
    let path = if path.is_empty() {
        DEFAULT_RUSTDESK_PATH
    } else {
        path
    };

    if !Path::new(path).is_file() {
        return Err(format!("Không tìm thấy RustDesk: {path}"));
    }

    let escaped = path.replace('\'', "''");
    let ps = format!(
        "$ErrorActionPreference = 'SilentlyContinue'; \
         Start-Process -FilePath '{escaped}'; \
         exit 0"
    );

    run_process_with_timeout(
        "powershell.exe",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &ps,
        ],
    )
    .map_err(|e| format!("mở RustDesk: {e}"))
}

/// Đóng UI RustDesk (session user) — không dừng Windows service (session 0).
pub fn close_application() -> Result<(), String> {
    let ps = r#"
$ErrorActionPreference = 'SilentlyContinue'
$procs = Get-Process | Where-Object {
  $_.ProcessName -like 'rustdesk*' -and $_.SessionId -gt 0
}
if (-not $procs) { exit 0 }
$procs | Stop-Process -Force -ErrorAction SilentlyContinue
exit 0
"#;

    run_process_with_timeout(
        "powershell.exe",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            ps,
        ],
    )
    .map_err(|e| format!("đóng ứng dụng RustDesk: {e}"))
}
