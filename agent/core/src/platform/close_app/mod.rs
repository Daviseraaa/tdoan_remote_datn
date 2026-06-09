//! Đóng app / cửa sổ theo PID, tên process hoặc tiêu đề cửa sổ.

use serde_json::Value;

pub struct CloseAppResult {
    pub closed: Vec<u32>,
    pub failed: Vec<u32>,
}

fn parse_u32(v: &Value) -> Option<u32> {
    match v {
        Value::Number(n) => n.as_u64().and_then(|x| u32::try_from(x).ok()),
        Value::String(s) => s.trim().parse().ok(),
        _ => None,
    }
}

fn collect_pids(payload: &Value) -> Vec<u32> {
    let mut pids = Vec::new();
    if let Some(p) = payload.get("pid") {
        if let Some(id) = parse_u32(p) {
            pids.push(id);
        }
    }
    if let Some(arr) = payload.get("pids").and_then(|x| x.as_array()) {
        for item in arr {
            if let Some(id) = parse_u32(item) {
                pids.push(id);
            }
        }
    }
    pids.sort_unstable();
    pids.dedup();
    pids
}

#[cfg(windows)]
mod win {
    use super::{collect_pids, CloseAppResult};
    use serde_json::Value;
    use std::process::Stdio;
    use tokio::process::Command;

    fn escape_ps_single(s: &str) -> String {
        format!("'{}'", s.replace('\'', "''"))
    }

    fn utf16le_base64(script: &str) -> String {
        let mut bytes = Vec::with_capacity(script.len() * 2 + 4);
        for u in script.encode_utf16() {
            bytes.extend_from_slice(&u.to_le_bytes());
        }
        base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes)
    }

    async fn run_ps(script: &str) -> Result<String, String> {
        let encoded = utf16le_base64(script);
        let out = Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-EncodedCommand",
                &encoded,
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| e.to_string())?;
        let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            return Err(if stderr.trim().is_empty() {
                format!("PowerShell exit {:?}", out.status.code())
            } else {
                stderr.into_owned()
            });
        }
        Ok(stdout)
    }

    pub async fn close_execute(payload: &Value) -> Result<CloseAppResult, String> {
        let mode = payload
            .get("mode")
            .and_then(|x| x.as_str())
            .unwrap_or("pid")
            .trim()
            .to_lowercase();

        let script = match mode.as_str() {
            "processname" | "process_name" => {
                let name = payload
                    .get("processName")
                    .or_else(|| payload.get("process_name"))
                    .and_then(|x| x.as_str())
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .ok_or("CLOSE_APP: thiếu processName")?;
                let q = escape_ps_single(name);
                format!(
                    r#"
$ErrorActionPreference = 'SilentlyContinue'
$closed = @()
$failed = @()
foreach ($p in @(Get-Process -Name {q} -ErrorAction SilentlyContinue)) {{
  try {{
    $p.CloseMainWindow() | Out-Null
    Start-Sleep -Milliseconds 300
    if (-not $p.HasExited) {{ $p | Stop-Process -Force -ErrorAction Stop }}
    $closed += [int]$p.Id
  }} catch {{
    $failed += [int]$p.Id
  }}
}}
@{{ closed = @($closed); failed = @($failed) }} | ConvertTo-Json -Compress
"#
                )
            }
            "windowtitle" | "window_title" => {
                let title = payload
                    .get("windowTitle")
                    .or_else(|| payload.get("window_title"))
                    .and_then(|x| x.as_str())
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .ok_or("CLOSE_APP: thiếu windowTitle")?;
                let q = escape_ps_single(title);
                format!(
                    r#"
$ErrorActionPreference = 'SilentlyContinue'
$closed = @()
$failed = @()
$pattern = {q}
foreach ($p in @(Get-Process | Where-Object {{ $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like ('*' + $pattern + '*') }})) {{
  try {{
    $p.CloseMainWindow() | Out-Null
    Start-Sleep -Milliseconds 300
    if (-not $p.HasExited) {{ $p | Stop-Process -Force -ErrorAction Stop }}
    $closed += [int]$p.Id
  }} catch {{
    $failed += [int]$p.Id
  }}
}}
@{{ closed = @($closed); failed = @($failed) }} | ConvertTo-Json -Compress
"#
                )
            }
            "pids" | "openedinrun" | "opened_in_run" | "pid" => {
                let pids = collect_pids(payload);
                if pids.is_empty() {
                    return Err("CLOSE_APP: thiếu pid/pids".into());
                }
                let list = pids
                    .iter()
                    .map(|id| id.to_string())
                    .collect::<Vec<_>>()
                    .join(",");
                format!(
                    r#"
$ErrorActionPreference = 'SilentlyContinue'
$closed = @()
$failed = @()
foreach ($id in @({list})) {{
  $p = Get-Process -Id $id -ErrorAction SilentlyContinue
  if (-not $p) {{ continue }}
  try {{
    $p.CloseMainWindow() | Out-Null
    Start-Sleep -Milliseconds 300
    if (-not $p.HasExited) {{ $p | Stop-Process -Force -ErrorAction Stop }}
    $closed += [int]$id
  }} catch {{
    $failed += [int]$id
  }}
}}
@{{ closed = @($closed); failed = @($failed) }} | ConvertTo-Json -Compress
"#
                )
            }
            other => return Err(format!("CLOSE_APP: mode không hỗ trợ: {}", other)),
        };

        let stdout = run_ps(script.trim()).await?;
        let v: Value = serde_json::from_str(stdout.trim())
            .map_err(|e| format!("parse close result: {}", e))?;
        let closed = v
            .get("closed")
            .and_then(|x| x.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|x| x.as_u64().and_then(|n| u32::try_from(n).ok()))
                    .collect()
            })
            .unwrap_or_default();
        let failed = v
            .get("failed")
            .and_then(|x| x.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|x| x.as_u64().and_then(|n| u32::try_from(n).ok()))
                    .collect()
            })
            .unwrap_or_default();
        Ok(CloseAppResult { closed, failed })
    }
}

pub async fn close_execute(payload: &Value) -> Result<CloseAppResult, String> {
    #[cfg(windows)]
    {
        return win::close_execute(payload).await;
    }
    #[cfg(not(windows))]
    {
        let _ = payload;
        Err("CLOSE_APP: chỉ hỗ trợ Windows.".into())
    }
}
