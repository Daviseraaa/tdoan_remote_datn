//! Focus app / cửa sổ theo PID, tên process hoặc tiêu đề cửa sổ.

use serde_json::Value;

pub struct FocusAppResult {
    pub focused: Vec<u32>,
    pub failed: Vec<u32>,
}

fn parse_u32(v: &Value) -> Option<u32> {
    match v {
        Value::Number(n) => n.as_u64().and_then(|x| u32::try_from(x).ok()),
        Value::String(s) => s.trim().parse().ok(),
        _ => None,
    }
}

#[cfg(windows)]
mod win {
    use super::{parse_u32, FocusAppResult};
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

    fn push_unique_ci(hints: &mut Vec<String>, value: &str) {
        let v = value.trim();
        if v.is_empty() {
            return;
        }
        if !hints.iter().any(|h| h.eq_ignore_ascii_case(v)) {
            hints.push(v.to_string());
        }
    }

    fn expand_process_hints(name: &str) -> Vec<String> {
        let mut hints = vec![name.trim().to_string()];
        let lower = name.trim().to_lowercase();
        if lower.contains("edge") {
            push_unique_ci(&mut hints, "msedge");
        }
        if lower.contains("chrome") {
            push_unique_ci(&mut hints, "chrome");
        }
        if lower.contains("firefox") {
            push_unique_ci(&mut hints, "firefox");
        }
        hints
    }

    const PS_ENSURE_FOCUS_WIN32: &str = r#"
if (-not ('StationHub.FocusWin32' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace StationHub {
  public struct RECT { public int Left, Top, Right, Bottom; }
  public static class FocusWin32 {
    [DllImport("user32.dll", SetLastError=true)]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll", SetLastError=true)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  }
}
'@
}
"#;

    const PS_WINDOW_MATCH_UTILS: &str = r#"
function Test-ShWindowMatch {
  param($Proc, [string[]]$ProcessNames, [string[]]$TitleHints, [switch]$TitleRequired)
  if (-not $Proc -or [int]$Proc.MainWindowHandle -eq 0) { return $false }
  $procOk = ($ProcessNames.Count -eq 0) -or ($Proc.ProcessName -in $ProcessNames)
  if ($ProcessNames.Count -gt 0 -and $procOk -and -not $TitleRequired) { return $true }
  $titleOk = ($TitleHints.Count -eq 0)
  if (-not $titleOk -and $Proc.MainWindowTitle) {
    foreach ($hint in $TitleHints) {
      if ($hint -and ($Proc.MainWindowTitle -like ('*' + $hint + '*'))) { $titleOk = $true; break }
    }
  }
  if ($ProcessNames.Count -eq 0) { return $titleOk }
  return ($procOk -and $titleOk)
}
function Get-ShBestMatchingProcess {
  param(
    [string[]]$ProcessNames,
    [string[]]$TitleHints = @(),
    [switch]$TitleRequired,
    [int64[]]$ExcludeHandles = @(),
    [switch]$OnlyNew,
    [int]$SpawnPid = 0
  )
  $fg = [StationHub.FocusWin32]::GetForegroundWindow()
  $best = $null
  $bestScore = -1
  foreach ($p in @(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 })) {
    $p.Refresh()
    $hwnd = [int64]$p.MainWindowHandle
    if ($OnlyNew -and $ExcludeHandles -and ($hwnd -in $ExcludeHandles)) { continue }
    if (-not (Test-ShWindowMatch $p $ProcessNames $TitleHints $TitleRequired)) { continue }
    $score = 0
    if ($SpawnPid -gt 0 -and [int]$p.Id -eq $SpawnPid) { $score += 50000 }
    if ($ProcessNames.Count -gt 0 -and ($p.ProcessName -in $ProcessNames)) { $score += 3000 }
    if ($TitleHints.Count -gt 0 -and $p.MainWindowTitle) {
      foreach ($hint in $TitleHints) {
        if (-not $hint) { continue }
        if ($p.MainWindowTitle -like ('*' + $hint + '*')) { $score += 2000 }
        if ($p.MainWindowTitle -eq $hint) { $score += 1000 }
      }
    }
    if ($fg -ne [IntPtr]::Zero -and [int64]$fg -eq $hwnd) { $score += 800 }
    $rc = New-Object StationHub.FocusWin32+RECT
    if ([StationHub.FocusWin32]::GetWindowRect($p.MainWindowHandle, [ref]$rc)) {
      $area = ($rc.Right - $rc.Left) * ($rc.Bottom - $rc.Top)
      if ($area -gt 0) { $score += [Math]::Min(1500, [int]($area / 8000)) }
    }
    if ($score -gt $bestScore) { $best = $p; $bestScore = $score }
  }
  return $best
}
function Invoke-ShFocusProcess {
  param($Proc)
  if (-not $Proc -or [int]$Proc.MainWindowHandle -eq 0) { return $false }
  $ws = New-Object -ComObject WScript.Shell
  try {
    [StationHub.FocusWin32]::ShowWindowAsync($Proc.MainWindowHandle, 9) | Out-Null
    Start-Sleep -Milliseconds 80
    [StationHub.FocusWin32]::SetForegroundWindow($Proc.MainWindowHandle) | Out-Null
    return [bool]$ws.AppActivate([int]$Proc.Id)
  } catch {
    return $false
  }
}
"#;

    pub async fn focus_execute(payload: &Value) -> Result<FocusAppResult, String> {
        let mode = payload
            .get("mode")
            .and_then(|x| x.as_str())
            .unwrap_or("windowTitle")
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
                    .ok_or("FOCUS_APP: thiếu processName")?;
                let proc_list = expand_process_hints(name)
                    .iter()
                    .map(|n| escape_ps_single(n))
                    .collect::<Vec<_>>()
                    .join(", ");
                format!(
                    r#"
$ErrorActionPreference = 'SilentlyContinue'
{ps_ensure}
{ps_utils}
$processNames = @({proc_list})
$p = Get-ShBestMatchingProcess -ProcessNames $processNames -TitleHints @() -TitleRequired:$false
if (-not $p) {{
  @{{ focused = @(); failed = @() }} | ConvertTo-Json -Compress
  exit 0
}}
$ok = Invoke-ShFocusProcess $p
if ($ok) {{ @{{ focused = @([int]$p.Id); failed = @() }} | ConvertTo-Json -Compress }}
else {{ @{{ focused = @(); failed = @([int]$p.Id) }} | ConvertTo-Json -Compress }}
"#,
                    ps_ensure = PS_ENSURE_FOCUS_WIN32,
                    ps_utils = PS_WINDOW_MATCH_UTILS,
                    proc_list = proc_list,
                )
            }
            "windowtitle" | "window_title" => {
                let title = payload
                    .get("windowTitle")
                    .or_else(|| payload.get("window_title"))
                    .and_then(|x| x.as_str())
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
                    .ok_or("FOCUS_APP: thiếu windowTitle")?;
                let q = escape_ps_single(title);
                format!(
                    r#"
$ErrorActionPreference = 'SilentlyContinue'
{ps_ensure}
{ps_utils}
$windowTitle = {q}
$p = Get-ShBestMatchingProcess -ProcessNames @() -TitleHints @($windowTitle) -TitleRequired:$true
if (-not $p) {{
  @{{ focused = @(); failed = @() }} | ConvertTo-Json -Compress
  exit 0
}}
$ok = Invoke-ShFocusProcess $p
if ($ok) {{ @{{ focused = @([int]$p.Id); failed = @() }} | ConvertTo-Json -Compress }}
else {{ @{{ focused = @(); failed = @([int]$p.Id) }} | ConvertTo-Json -Compress }}
"#,
                    ps_ensure = PS_ENSURE_FOCUS_WIN32,
                    ps_utils = PS_WINDOW_MATCH_UTILS,
                )
            }
            "pid" => {
                let pid = payload
                    .get("pid")
                    .and_then(parse_u32)
                    .ok_or("FOCUS_APP: thiếu pid")?;
                format!(
                    r#"
$ErrorActionPreference = 'SilentlyContinue'
{ps_ensure}
{ps_utils}
$id = {pid}
$p = Get-Process -Id $id -ErrorAction SilentlyContinue
if (-not $p) {{
  @{{ focused = @(); failed = @() }} | ConvertTo-Json -Compress
  exit 0
}}
$ok = Invoke-ShFocusProcess $p
if ($ok) {{ @{{ focused = @($id); failed = @() }} | ConvertTo-Json -Compress }}
else {{ @{{ focused = @(); failed = @($id) }} | ConvertTo-Json -Compress }}
"#,
                    ps_ensure = PS_ENSURE_FOCUS_WIN32,
                    ps_utils = PS_WINDOW_MATCH_UTILS,
                )
            }
            other => return Err(format!("FOCUS_APP: mode không hỗ trợ: {}", other)),
        };

        let stdout = run_ps(script.trim()).await?;
        let v: Value = serde_json::from_str(stdout.trim())
            .map_err(|e| format!("parse focus result: {}", e))?;
        let focused = v
            .get("focused")
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
        Ok(FocusAppResult { focused, failed })
    }
}

pub async fn focus_execute(payload: &Value) -> Result<FocusAppResult, String> {
    #[cfg(windows)]
    {
        return win::focus_execute(payload).await;
    }
    #[cfg(not(windows))]
    {
        let _ = payload;
        Err("FOCUS_APP: chỉ hỗ trợ Windows.".into())
    }
}
