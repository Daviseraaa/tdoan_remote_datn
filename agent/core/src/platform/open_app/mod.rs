//! Mở ứng dụng theo đường dẫn hoặc tên (port từ agent TypeScript cũ).
//! Windows: Start-Process (PowerShell ẩn), Get-StartApps + shortcut Start Menu.
//! macOS: `open`. Linux: `xdg-open` cho file tồn tại.

#[cfg(any(target_os = "macos", all(unix, not(target_os = "macos"))))]
use std::path::Path;
#[cfg(any(target_os = "macos", all(unix, not(target_os = "macos"))))]
use std::process::Stdio;
#[cfg(any(target_os = "macos", all(unix, not(target_os = "macos"))))]
use tokio::process::Command;

pub struct OpenAppSuccess {
    pub method: &'static str,
    pub launched: String,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
}

#[cfg(windows)]
mod win {
    use super::OpenAppSuccess;
    use serde_json::Value;
    use std::path::{Path, PathBuf};
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

    /// Tránh progress CLIXML trên stderr (gây hiểu nhầm là lỗi task).
    fn wrap_ps_script(script: &str) -> String {
        format!(
            "$ProgressPreference = 'SilentlyContinue'\n\
             $WarningPreference = 'SilentlyContinue'\n\
             $InformationPreference = 'SilentlyContinue'\n\
             {}",
            script.trim_start()
        )
    }

    fn sanitize_ps_stderr(raw: &str) -> String {
        let mut s = raw.to_string();
        while let Some(start) = s.find("#< CLIXML") {
            let rest = &s[start..];
            if let Some(rel) = rest.find("</Objs>") {
                let end = start + rel + "</Objs>".len();
                s.replace_range(start..end, "");
            } else {
                s.replace_range(start..start + "#< CLIXML".len(), "");
            }
        }
        s.lines()
            .map(str::trim)
            .filter(|line| {
                !line.is_empty()
                    && !line.starts_with("<Objs ")
                    && !line.starts_with("</Objs>")
                    && !line.contains("xmlns=\"http://schemas.microsoft.com/powershell")
            })
            .collect::<Vec<_>>()
            .join("\n")
            .trim()
            .to_string()
    }

    fn ps_failure_message(stdout: &str, stderr: &str, code: Option<i32>) -> String {
        if let Ok(v) = serde_json::from_str::<Value>(stdout.trim()) {
            if let Some(msg) = v.get("message").and_then(|m| m.as_str()) {
                if !msg.is_empty() {
                    return msg.to_string();
                }
            }
        }
        let clean = sanitize_ps_stderr(stderr);
        if !clean.is_empty() {
            return clean;
        }
        format!("PowerShell exit {:?}", code)
    }

    async fn run_ps_encoded(script: &str) -> Result<String, String> {
        let encoded = utf16le_base64(&wrap_ps_script(script));
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
        let stderr = String::from_utf8_lossy(&out.stderr);
        if !out.status.success() {
            return Err(ps_failure_message(
                &stdout,
                &stderr,
                out.status.code(),
            ));
        }
        Ok(stdout)
    }

    fn parse_ps_json_rows(stdout: &str) -> Vec<Value> {
        let t = stdout.trim();
        if t.is_empty() {
            return Vec::new();
        }
        match serde_json::from_str::<Value>(t) {
            Ok(Value::Array(a)) => a,
            Ok(one) => vec![one],
            Err(_) => Vec::new(),
        }
    }

    fn score_name(query: &str, name: &str) -> i64 {
        let q = query.to_lowercase();
        let n = name.to_lowercase();
        let q = q.trim();
        let n = n.trim();
        if q.is_empty() || n.is_empty() {
            return 0;
        }
        if n == q {
            return 10_000;
        }
        if n.starts_with(q) {
            return 5_000 + (200_i64 - n.len() as i64).max(0);
        }
        if let Some(idx) = n.find(q) {
            return 2_000 + (100_i64 - idx as i64).max(0);
        }
        let mut t = 0_i64;
        for tok in q.split_whitespace() {
            if !tok.is_empty() && n.contains(tok) {
                t += 150;
            }
        }
        t
    }

    struct StartAppRow {
        name: String,
        app_id: String,
    }

    fn normalize_start_app_row(row: &serde_json::Map<String, Value>) -> Option<StartAppRow> {
        let name = row
            .get("Name")
            .or_else(|| row.get("name"))
            .and_then(|v| v.as_str())?;
        let app_id = row
            .get("AppID")
            .or_else(|| row.get("AppId"))
            .or_else(|| row.get("appid"))
            .and_then(|v| v.as_str())?;
        Some(StartAppRow {
            name: name.to_string(),
            app_id: app_id.to_string(),
        })
    }

    struct LnkRow {
        name: String,
        target_path: String,
    }

    async fn list_start_apps_win() -> Vec<StartAppRow> {
        let script = r#"
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new()
Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress -Depth 4
"#
        .trim();
        let Ok(out) = run_ps_encoded(script).await else {
            return Vec::new();
        };
        parse_ps_json_rows(&out)
            .into_iter()
            .filter_map(|v| v.as_object().and_then(|o| normalize_start_app_row(o)))
            .collect()
    }

    async fn list_start_menu_lnks_win() -> Vec<LnkRow> {
        let script = r#"
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new()
$roots = @(
  [Environment]::GetFolderPath('Programs'),
  [Environment]::GetFolderPath('CommonPrograms')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$sh = New-Object -ComObject WScript.Shell
$rows = @(
  foreach ($root in $roots) {
    Get-ChildItem -LiteralPath $root -Filter *.lnk -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 600 |
      ForEach-Object {
        try {
          $sc = $sh.CreateShortcut($_.FullName)
          $t = $sc.TargetPath
          if ($t -and (Test-Path -LiteralPath $t)) {
            [PSCustomObject]@{ Name = $_.BaseName; TargetPath = $t }
          }
        } catch {}
      }
  }
)
@($rows) | ConvertTo-Json -Compress -Depth 3
"#
        .trim();
        let Ok(out) = run_ps_encoded(script).await else {
            return Vec::new();
        };
        parse_ps_json_rows(&out)
            .into_iter()
            .filter_map(|v| {
                let o = v.as_object()?;
                let name = o
                    .get("Name")
                    .or_else(|| o.get("name"))
                    .and_then(|x| x.as_str())?;
                let target_path = o
                    .get("TargetPath")
                    .or_else(|| o.get("targetPath"))
                    .and_then(|x| x.as_str())?;
                Some(LnkRow {
                    name: name.to_string(),
                    target_path: target_path.to_string(),
                })
            })
            .collect()
    }

    fn open_app_window_wait_ms() -> u64 {
        std::env::var("OPEN_APP_WINDOW_WAIT_MS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(15_000)
            .clamp(1_000, 60_000)
    }

    struct LaunchMeta {
        pid: Option<u32>,
        process_name: Option<String>,
    }

    fn parse_launch_ps(stdout: &str) -> Result<LaunchMeta, String> {
        let v: Value = serde_json::from_str(stdout.trim())
            .map_err(|e| format!("parse launch result: {}", e))?;
        let window = v.get("window").and_then(|x| x.as_bool()).unwrap_or(false);
        let ok = v.get("ok").and_then(|x| x.as_bool()).unwrap_or(false);
        let message = v
            .get("message")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string());
        if ok && window {
            let pid = v
                .get("pid")
                .and_then(|x| x.as_u64())
                .and_then(|n| u32::try_from(n).ok());
            let process_name = v
                .get("processName")
                .or_else(|| v.get("process_name"))
                .and_then(|x| x.as_str())
                .map(|s| s.to_string());
            Ok(LaunchMeta { pid, process_name })
        } else {
            Err(message.unwrap_or_else(|| {
                "Đã chạy lệnh mở nhưng không thấy cửa sổ (timeout).".into()
            }))
        }
    }

    async fn launch_exe_and_wait_win(exe_path: &str) -> Result<LaunchMeta, String> {
        let q = escape_ps_single(exe_path);
        let timeout = open_app_window_wait_ms();
        let script = format!(
            r#"
$ErrorActionPreference = 'Stop'
$path = {q}
$timeoutMs = {timeout}
$before = @([int64[]](Get-Process | Where-Object {{ $_.MainWindowHandle -ne 0 }} | ForEach-Object {{ $_.MainWindowHandle }}))
$p = Start-Process -FilePath $path -PassThru
$name = [System.IO.Path]::GetFileNameWithoutExtension($path)
$deadline = [DateTime]::UtcNow.AddMilliseconds($timeoutMs)
while ([DateTime]::UtcNow -lt $deadline) {{
  foreach ($proc in @(Get-Process -Name $name -ErrorAction SilentlyContinue)) {{
    $proc.Refresh()
    if ([int]$proc.MainWindowHandle -ne 0) {{
      @{{ ok = $true; window = $true; pid = [int]$proc.Id; processName = $proc.ProcessName }} | ConvertTo-Json -Compress
      exit 0
    }}
  }}
  if ($p -and -not $p.HasExited) {{
    $p.Refresh()
    if ([int]$p.MainWindowHandle -ne 0) {{
      @{{ ok = $true; window = $true; pid = [int]$p.Id; processName = $p.ProcessName }} | ConvertTo-Json -Compress
      exit 0
    }}
  }}
  $now = @([int64[]](Get-Process | Where-Object {{ $_.MainWindowHandle -ne 0 }} | ForEach-Object {{ $_.MainWindowHandle }}))
  $newHandles = @($now | Where-Object {{ $_ -notin $before }})
  if ($newHandles.Count -gt 0) {{
    $found = $null
  foreach ($proc in @(Get-Process | Where-Object {{ $_.MainWindowHandle -ne 0 }})) {{
      if ($newHandles -contains [int64]$proc.MainWindowHandle) {{ $found = $proc; break }}
    }}
    if ($found) {{
      @{{ ok = $true; window = $true; pid = [int]$found.Id; processName = $found.ProcessName }} | ConvertTo-Json -Compress
    }} else {{
      @{{ ok = $true; window = $true }} | ConvertTo-Json -Compress
    }}
    exit 0
  }}
  Start-Sleep -Milliseconds 250
}}
@{{ ok = $false; window = $false; message = 'Đã chạy lệnh mở nhưng không thấy cửa sổ (timeout).' }} | ConvertTo-Json -Compress
exit 1
"#,
        );
        let out = run_ps_encoded(script.trim()).await?;
        parse_launch_ps(&out)
    }

    async fn launch_explorer_and_wait_win(argument_list_ps: &str) -> Result<LaunchMeta, String> {
        let timeout = open_app_window_wait_ms();
        let script = format!(
            r#"
$ErrorActionPreference = 'Stop'
$timeoutMs = {timeout}
$before = @([int64[]](Get-Process | Where-Object {{ $_.MainWindowHandle -ne 0 }} | ForEach-Object {{ $_.MainWindowHandle }}))
Start-Process -FilePath explorer.exe -ArgumentList {args}
$deadline = [DateTime]::UtcNow.AddMilliseconds($timeoutMs)
while ([DateTime]::UtcNow -lt $deadline) {{
  $now = @([int64[]](Get-Process | Where-Object {{ $_.MainWindowHandle -ne 0 }} | ForEach-Object {{ $_.MainWindowHandle }}))
  $newHandles = @($now | Where-Object {{ $_ -notin $before }})
  if ($newHandles.Count -gt 0) {{
    $found = $null
    foreach ($proc in @(Get-Process | Where-Object {{ $_.MainWindowHandle -ne 0 }})) {{
      if ($newHandles -contains [int64]$proc.MainWindowHandle) {{ $found = $proc; break }}
    }}
    if ($found) {{
      @{{ ok = $true; window = $true; pid = [int]$found.Id; processName = $found.ProcessName }} | ConvertTo-Json -Compress
    }} else {{
      @{{ ok = $true; window = $true }} | ConvertTo-Json -Compress
    }}
    exit 0
  }}
  Start-Sleep -Milliseconds 250
}}
@{{ ok = $false; window = $false; message = 'Đã chạy Explorer nhưng không thấy cửa sổ mới (timeout).' }} | ConvertTo-Json -Compress
exit 1
"#,
            args = argument_list_ps,
        );
        let out = run_ps_encoded(script.trim()).await?;
        parse_launch_ps(&out)
    }

    async fn launch_exe_win(exe_path: &str) -> Result<LaunchMeta, String> {
        launch_exe_and_wait_win(exe_path).await
    }

    async fn launch_explorer_shell_apps(app_id: &str) -> Result<LaunchMeta, String> {
        let uri = format!("shell:AppsFolder\\{}", app_id);
        let q = escape_ps_single(&uri);
        launch_explorer_and_wait_win(&q).await
    }

    async fn launch_explorer_dir(path: &str) -> Result<LaunchMeta, String> {
        let q = escape_ps_single(path);
        launch_explorer_and_wait_win(&q).await
    }

    async fn try_launch_existing_path_win(target: &str) -> Option<Result<OpenAppSuccess, String>> {
        let path_buf = if Path::new(target).is_absolute() {
            PathBuf::from(target)
        } else {
            let cwd = std::env::current_dir().ok()?;
            cwd.join(target)
        };
        let abs = match path_buf.canonicalize() {
            Ok(p) => p,
            Err(_) => return None,
        };
        let meta = match std::fs::metadata(&abs) {
            Ok(m) => m,
            Err(_) => return None,
        };
        if meta.is_file() {
            let ext = abs
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if ext == "lnk" {
                return Some(Err(
                    "Dùng đường dẫn tới .exe hoặc tên app; .lnk chưa hỗ trợ trực tiếp.".into(),
                ));
            }
            let s = abs.to_string_lossy().to_string();
            let meta = match launch_exe_win(&s).await {
                Ok(m) => m,
                Err(e) => return Some(Err(e)),
            };
            return Some(Ok(OpenAppSuccess {
                method: "path",
                launched: s,
                pid: meta.pid,
                process_name: meta.process_name,
            }));
        }
        if meta.is_dir() {
            let s = abs.to_string_lossy().to_string();
            let meta = match launch_explorer_dir(&s).await {
                Ok(m) => m,
                Err(e) => return Some(Err(e)),
            };
            return Some(Ok(OpenAppSuccess {
                method: "path",
                launched: s,
                pid: meta.pid,
                process_name: meta.process_name,
            }));
        }
        None
    }

    pub async fn resolve_and_launch_win(query: &str) -> Result<OpenAppSuccess, String> {
        if let Some(r) = try_launch_existing_path_win(query).await {
            return r;
        }

        let (apps, lnks) = tokio::join!(list_start_apps_win(), list_start_menu_lnks_win());

        let mut best_app: Option<(StartAppRow, i64)> = None;
        for row in apps {
            let s = score_name(query, &row.name);
            if s > 0 {
                match &best_app {
                    None => best_app = Some((row, s)),
                    Some((_, sc)) if s > *sc => best_app = Some((row, s)),
                    _ => {}
                }
            }
        }

        let mut best_lnk: Option<(LnkRow, i64)> = None;
        for row in lnks {
            let s_name = score_name(query, &row.name);
            let base = Path::new(&row.target_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("");
            let s_base = score_name(query, base);
            let s = s_name.max(s_base);
            if s > 0 {
                match &best_lnk {
                    None => best_lnk = Some((row, s)),
                    Some((_, sc)) if s > *sc => best_lnk = Some((row, s)),
                    _ => {}
                }
            }
        }

        let pick_app = match (&best_app, &best_lnk) {
            (Some((_, sa)), Some((_, sl))) => sa >= sl,
            (Some(_), None) => true,
            _ => false,
        };

        if pick_app {
            if let Some((row, sc)) = best_app {
                if sc >= 100 {
                    let meta = launch_explorer_shell_apps(&row.app_id).await?;
                    return Ok(OpenAppSuccess {
                        method: "shell_apps",
                        launched: format!("{} ({})", row.name, row.app_id),
                        pid: meta.pid,
                        process_name: meta.process_name,
                    });
                }
            }
        }

        if let Some((row, sc)) = best_lnk {
            if sc >= 100 {
                let meta = launch_exe_win(&row.target_path).await?;
                return Ok(OpenAppSuccess {
                    method: "shortcut",
                    launched: format!("{} → {}", row.name, row.target_path),
                    pid: meta.pid,
                    process_name: meta.process_name,
                });
            }
        }

        Err("Không tìm thấy app khớp (Start / shortcut). Thử đường dẫn đầy đủ tới file .exe.".into())
    }
}

#[cfg(target_os = "macos")]
async fn resolve_macos(query: &str) -> Result<OpenAppSuccess, String> {
    let exists = Path::new(query).exists();
    let mut c = Command::new("open");
    if exists {
        c.arg(query);
    } else {
        c.args(["-a", query]);
    }
    c.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    c.spawn().map_err(|e| e.to_string())?;
    Ok(OpenAppSuccess {
        method: "path",
        launched: query.to_string(),
        pid: None,
        process_name: None,
    })
}

#[cfg(all(unix, not(target_os = "macos")))]
async fn resolve_linux(query: &str) -> Result<OpenAppSuccess, String> {
    let p = Path::new(query);
    if p.exists() && p.is_file() {
        Command::new("xdg-open")
            .arg(query)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(OpenAppSuccess {
            method: "path",
            launched: query.to_string(),
            pid: None,
            process_name: None,
        });
    }
    Err("Linux: chỉ hỗ trợ đường dẫn file có thật + xdg-open.".into())
}

/// Entry chính: đường dẫn / tên app (Windows: resolve Start + shortcut).
pub async fn open_app_resolve(query: &str) -> Result<OpenAppSuccess, String> {
    let q = query.trim();
    if q.is_empty() {
        return Err("Thiếu đường dẫn hoặc tên app.".into());
    }
    #[cfg(windows)]
    {
        return win::resolve_and_launch_win(q).await;
    }
    #[cfg(target_os = "macos")]
    {
        return resolve_macos(q).await;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        return resolve_linux(q).await;
    }
    #[cfg(not(any(windows, unix)))]
    {
        let _ = q;
        Err("OPEN_APP: nền tảng chưa hỗ trợ.".into())
    }
}
