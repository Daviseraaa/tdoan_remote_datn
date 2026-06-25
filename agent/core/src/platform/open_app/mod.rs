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
    pub reused_existing: bool,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
    pub maximized: bool,
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

    fn parse_focus_ps(stdout: &str) -> Result<Option<LaunchMeta>, String> {
        let v: Value = serde_json::from_str(stdout.trim())
            .map_err(|e| format!("parse focus result: {}", e))?;
        let found = v.get("found").and_then(|x| x.as_bool()).unwrap_or(false);
        if !found {
            return Ok(None);
        }
        let focused = v.get("focused").and_then(|x| x.as_bool()).unwrap_or(false);
        if !focused {
            return Err(
                v.get("message")
                    .and_then(|x| x.as_str())
                    .unwrap_or("Tìm thấy app đang mở nhưng không focus được.")
                    .to_string(),
            );
        }
        let pid = v
            .get("pid")
            .and_then(|x| x.as_u64())
            .and_then(|n| u32::try_from(n).ok());
        let process_name = v
            .get("processName")
            .or_else(|| v.get("process_name"))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string());
        Ok(Some(LaunchMeta { pid, process_name }))
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

    /// Tiêu chí khớp cửa sổ — ưu tiên AppID (UWP/Start), rồi process; title chỉ khi không có cả hai.
    struct WindowMatchSpec {
        app_id: Option<String>,
        process_names: Vec<String>,
        title_substrings: Vec<String>,
        title_required: bool,
    }

    impl WindowMatchSpec {
        fn from_parts(process: Option<&str>, title: Option<&str>) -> Self {
            let process_names = process
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(expand_process_hints_from_query)
                .unwrap_or_default();
            let title_substrings = title
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|s| vec![s.to_string()])
                .unwrap_or_default();
            let title_required =
                process_names.is_empty() && !title_substrings.is_empty();
            Self {
                app_id: None,
                process_names,
                title_substrings,
                title_required,
            }
        }

        fn from_start_app(app_id: &str, display_name: &str) -> Self {
            Self {
                app_id: Some(app_id.trim().to_string()),
                process_names: process_hints_from_start_app(app_id, display_name),
                title_substrings: Vec::new(),
                title_required: false,
            }
        }

        fn from_exe_stem(exe_path: &str) -> Self {
            let stem = Path::new(exe_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("");
            Self::from_parts(Some(stem), None)
        }

        fn is_empty(&self) -> bool {
            self.app_id.as_deref().unwrap_or("").is_empty()
                && self.process_names.is_empty()
                && self.title_substrings.is_empty()
        }
    }

    fn process_hints_from_app_id(app_id: &str) -> Vec<String> {
        let mut hints = Vec::new();
        let pkg = app_id.split('!').next().unwrap_or(app_id).trim();
        if pkg.is_empty() {
            return hints;
        }
        let family = pkg.split('_').next().unwrap_or(pkg);
        for part in family.split('.') {
            let p = part.trim();
            if p.len() >= 3 {
                push_unique_ci(&mut hints, p);
            }
        }
        for part in pkg.split(|c| c == '.' || c == '_' || c == '-') {
            let p = part.trim();
            if p.len() < 3 {
                continue;
            }
            if p.chars().all(|c| c.is_ascii_digit() || c == 'x') {
                continue;
            }
            if p.eq_ignore_ascii_case("app") || p.eq_ignore_ascii_case("exe") {
                continue;
            }
            push_unique_ci(&mut hints, p);
        }
        hints
    }

    fn process_hints_from_start_app(app_id: &str, display_name: &str) -> Vec<String> {
        let mut hints = process_hints_from_app_id(app_id);
        for h in expand_process_hints_from_query(display_name) {
            push_unique_ci(&mut hints, &h);
        }
        hints
    }

    fn process_hints_from_exe_path(exe_path: &str) -> Vec<String> {
        let stem = Path::new(exe_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        expand_process_hints_from_query(stem)
    }

    fn expand_process_hints_from_query(query: &str) -> Vec<String> {
        let mut hints = process_hints_from_display_name(query);
        let stem = query.trim();
        if !stem.is_empty() {
            push_unique_ci(&mut hints, stem);
        }
        let lower = stem.to_lowercase();
        if lower.contains("edge") {
            push_unique_ci(&mut hints, "msedge");
        }
        hints
    }

    fn process_hints_from_display_name(name: &str) -> Vec<String> {
        let mut hints = Vec::new();
        let lower = name.to_lowercase();

        if lower.contains("edge") {
            push_unique_ci(&mut hints, "msedge");
        }

        let compact: String = name.chars().filter(|c| c.is_alphanumeric()).collect();
        if compact.len() >= 3 {
            push_unique_ci(&mut hints, &compact);
        }

        for word in name.split_whitespace() {
            let w = word.trim();
            let wl = w.to_lowercase();
            if w.len() >= 3 && wl != "microsoft" && wl != "the" && wl != "app" {
                push_unique_ci(&mut hints, w);
            }
        }

        hints
    }

    fn render_process_names_ps(names: &[String]) -> String {
        if names.is_empty() {
            "$processNames = @()".to_string()
        } else {
            let joined = names
                .iter()
                .map(|n| escape_ps_single(n))
                .collect::<Vec<_>>()
                .join(", ");
            format!("$processNames = @({joined})")
        }
    }

    fn render_titles_ps(titles: &[String]) -> String {
        if titles.is_empty() {
            "$titleHints = @()".to_string()
        } else {
            let joined = titles
                .iter()
                .map(|t| escape_ps_single(t))
                .collect::<Vec<_>>()
                .join(", ");
            format!("$titleHints = @({joined})")
        }
    }

    fn render_title_required_ps(required: bool) -> String {
        if required {
            "$titleRequired = $true".to_string()
        } else {
            "$titleRequired = $false".to_string()
        }
    }

    fn render_app_id_ps(app_id: Option<&str>) -> String {
        app_id
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(escape_ps_single)
            .map(|s| format!("$targetAppId = {s}"))
            .unwrap_or_else(|| "$targetAppId = $null".to_string())
    }

    const PS_ENSURE_WINDOW_APP_ID: &str = r#"
if (-not ('StationHub.WindowAppId' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace StationHub {
  [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPropertyStore {
    [PreserveSig] int GetCount(out uint cProps);
    [PreserveSig] int GetAt(uint iProp, out PropertyKey pkey);
    [PreserveSig] int GetValue(ref PropertyKey key, out PropVariant pv);
    [PreserveSig] int SetValue(ref PropertyKey key, ref PropVariant pv);
    [PreserveSig] int Commit();
  }
  [StructLayout(LayoutKind.Sequential, Pack = 4)]
  struct PropertyKey { public Guid fmtid; public uint pid; }
  [StructLayout(LayoutKind.Explicit, Pack = 8, Size = 16)]
  struct PropVariant {
    [FieldOffset(0)] public ushort vt;
    [FieldOffset(8)] public IntPtr ptr;
  }
  public static class WindowAppId {
    static PropertyKey PKEY_AppUserModel_ID = new PropertyKey {
      fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid = 5 };
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    static extern int SHGetPropertyStoreForWindow(IntPtr hwnd, ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out IPropertyStore ps);
    public static string FromHwnd(IntPtr hwnd) {
      if (hwnd == IntPtr.Zero) return null;
      Guid iid = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
      IPropertyStore store;
      if (SHGetPropertyStoreForWindow(hwnd, ref iid, out store) != 0) return null;
      PropVariant pv;
      var k = PKEY_AppUserModel_ID;
      if (store.GetValue(ref k, out pv) != 0 || pv.vt != 31) return null;
      return Marshal.PtrToStringUni(pv.ptr);
    }
  }
}
'@
}
"#;

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

    /// Khớp cửa sổ: AppID (UWP) > process > title (fallback cuối).
    const PS_WINDOW_MATCH_UTILS: &str = r#"
function Test-ShAppIdMatch {
  param([string]$Aumid, [string]$Target)
  if (-not $Aumid -or -not $Target) { return $false }
  if ($Aumid -eq $Target) { return $true }
  $pkgT = ($Target -split '!', 2)[0]
  $pkgA = ($Aumid -split '!', 2)[0]
  return ($pkgT -and $pkgA -and ($pkgT -eq $pkgA))
}
function Test-ShWindowMatch {
  param($Proc, [string]$TargetAppId, [string[]]$ProcessNames, [string[]]$TitleHints, [switch]$TitleRequired)
  if (-not $Proc -or [int]$Proc.MainWindowHandle -eq 0) { return $false }
  if ($TargetAppId) {
    $aumid = [StationHub.WindowAppId]::FromHwnd($Proc.MainWindowHandle)
    if (Test-ShAppIdMatch $aumid $TargetAppId) { return $true }
    if ($ProcessNames.Count -gt 0 -and ($Proc.ProcessName -in $ProcessNames)) { return $true }
    return $false
  }
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
    [string]$TargetAppId = $null,
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
  $procList = @(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 })
  if ($ProcessNames.Count -gt 0) {
    $seen = @($procList | ForEach-Object { [int]$_.Id })
    foreach ($n in $ProcessNames) {
      foreach ($extra in @(Get-Process -Name $n -ErrorAction SilentlyContinue)) {
        if ($seen -contains [int]$extra.Id) { continue }
        $extra.Refresh()
        if ([int]$extra.MainWindowHandle -ne 0) {
          $procList += $extra
          $seen += [int]$extra.Id
        }
      }
    }
  }
  foreach ($p in $procList) {
    $p.Refresh()
    $hwnd = [int64]$p.MainWindowHandle
    if ($OnlyNew -and $ExcludeHandles -and ($hwnd -in $ExcludeHandles)) { continue }
    if (-not (Test-ShWindowMatch $p $TargetAppId $ProcessNames $TitleHints $TitleRequired)) { continue }
    $score = 0
    if ($SpawnPid -gt 0 -and [int]$p.Id -eq $SpawnPid) { $score += 50000 }
    if ($TargetAppId) { $score += 4000 }
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

    fn render_match_spec_ps(spec: &WindowMatchSpec) -> (String, String, String, String, String) {
        (
            render_app_id_ps(spec.app_id.as_deref()),
            render_process_names_ps(&spec.process_names),
            render_titles_ps(&spec.title_substrings),
            render_title_required_ps(spec.title_required),
            format!(
                "{}\n{}",
                PS_ENSURE_FOCUS_WIN32, PS_ENSURE_WINDOW_APP_ID
            ),
        )
    }

    async fn try_focus_existing_by_app_id(
        app_id: &str,
        display_name: &str,
    ) -> Result<Option<LaunchMeta>, String> {
        let spec = WindowMatchSpec::from_start_app(app_id, display_name);
        let (app_id_ps, process_names_ps, titles_ps, title_required_ps, ps_ensure) =
            render_match_spec_ps(&spec);
        let script = format!(
            r#"
$ErrorActionPreference = 'SilentlyContinue'
{app_id_ps}
{process_names_ps}
{titles_ps}
{title_required_ps}
{ps_ensure}
{ps_utils}
$p = Get-ShBestMatchingProcess -TargetAppId $targetAppId -ProcessNames $processNames -TitleHints $titleHints -TitleRequired:$titleRequired
if (-not $p) {{
  @{{ found = $false; focused = $false }} | ConvertTo-Json -Compress
  exit 0
}}
$ok = Invoke-ShFocusProcess $p
@{{ found = $true; focused = [bool]$ok; pid = [int]$p.Id; processName = $p.ProcessName; message = if ($ok) {{ '' }} else {{ 'Tìm thấy app đang mở nhưng không focus được.' }} }} | ConvertTo-Json -Compress
"#,
            ps_utils = PS_WINDOW_MATCH_UTILS,
        );
        let out = run_ps_encoded(script.trim()).await?;
        parse_focus_ps(&out)
    }

    async fn try_focus_existing_win(
        process_name: Option<&str>,
        window_title: Option<&str>,
    ) -> Result<Option<LaunchMeta>, String> {
        let spec = WindowMatchSpec::from_parts(process_name, window_title);
        if spec.is_empty() {
            return Ok(None);
        }
        let (app_id_ps, process_names_ps, titles_ps, title_required_ps, ps_ensure) =
            render_match_spec_ps(&spec);
        let script = format!(
            r#"
$ErrorActionPreference = 'SilentlyContinue'
{app_id_ps}
{process_names_ps}
{titles_ps}
{title_required_ps}
{ps_ensure}
{ps_utils}
$p = Get-ShBestMatchingProcess -TargetAppId $targetAppId -ProcessNames $processNames -TitleHints $titleHints -TitleRequired:$titleRequired
if (-not $p) {{
  @{{ found = $false; focused = $false }} | ConvertTo-Json -Compress
  exit 0
}}
$ok = Invoke-ShFocusProcess $p
@{{ found = $true; focused = [bool]$ok; pid = [int]$p.Id; processName = $p.ProcessName; message = if ($ok) {{ '' }} else {{ 'Tìm thấy app đang mở nhưng không focus được.' }} }} | ConvertTo-Json -Compress
"#,
            ps_utils = PS_WINDOW_MATCH_UTILS,
        );
        let out = run_ps_encoded(script.trim()).await?;
        parse_focus_ps(&out)
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
        let spec = WindowMatchSpec::from_exe_stem(exe_path);
        let (app_id_ps, process_names_ps, titles_ps, title_required_ps, ps_ensure) =
            render_match_spec_ps(&spec);
        let script = format!(
            r#"
$ErrorActionPreference = 'SilentlyContinue'
$path = {q}
$timeoutMs = {timeout}
$before = @([int64[]](Get-Process | Where-Object {{ $_.MainWindowHandle -ne 0 }} | ForEach-Object {{ $_.MainWindowHandle }}))
$p = Start-Process -FilePath $path -PassThru
$spawnPid = if ($p) {{ [int]$p.Id }} else {{ 0 }}
{app_id_ps}
{process_names_ps}
{titles_ps}
{title_required_ps}
{ps_ensure}
{ps_utils}
$deadline = [DateTime]::UtcNow.AddMilliseconds($timeoutMs)
while ([DateTime]::UtcNow -lt $deadline) {{
  $match = Get-ShBestMatchingProcess -TargetAppId $targetAppId -ProcessNames $processNames -TitleHints $titleHints -TitleRequired:$titleRequired -ExcludeHandles $before -OnlyNew -SpawnPid $spawnPid
  if ($match) {{
    @{{ ok = $true; window = $true; pid = [int]$match.Id; processName = $match.ProcessName }} | ConvertTo-Json -Compress
    exit 0
  }}
  Start-Sleep -Milliseconds 250
}}
@{{ ok = $false; window = $false; message = 'Đã chạy lệnh mở nhưng không thấy cửa sổ mới (timeout).' }} | ConvertTo-Json -Compress
exit 1
"#,
            ps_utils = PS_WINDOW_MATCH_UTILS,
        );
        let out = run_ps_encoded(script.trim()).await?;
        parse_launch_ps(&out)
    }

    struct LaunchWaitHints {
        app_id: Option<String>,
        process_names: Vec<String>,
    }

    impl LaunchWaitHints {
        fn from_start_app(app_id: &str, display_name: &str) -> Self {
            let spec = WindowMatchSpec::from_start_app(app_id, display_name);
            Self {
                app_id: spec.app_id,
                process_names: spec.process_names,
            }
        }

        fn from_exe_path(exe_path: &str) -> Self {
            Self {
                app_id: None,
                process_names: process_hints_from_exe_path(exe_path),
            }
        }

        fn to_match_spec(&self) -> WindowMatchSpec {
            WindowMatchSpec {
                app_id: self.app_id.clone(),
                process_names: self.process_names.clone(),
                title_substrings: Vec::new(),
                title_required: false,
            }
        }
    }

    async fn launch_explorer_and_wait_win(
        argument_list_ps: &str,
        hints: Option<&LaunchWaitHints>,
    ) -> Result<LaunchMeta, String> {
        let timeout = open_app_window_wait_ms();
        let spec = hints.map(|h| h.to_match_spec()).unwrap_or(WindowMatchSpec {
            app_id: None,
            process_names: Vec::new(),
            title_substrings: Vec::new(),
            title_required: false,
        });
        let (app_id_ps, process_names_ps, titles_ps, title_required_ps, ps_ensure) =
            render_match_spec_ps(&spec);
        let script = format!(
            r#"
$ErrorActionPreference = 'SilentlyContinue'
$timeoutMs = {timeout}
$before = @([int64[]](Get-Process | Where-Object {{ $_.MainWindowHandle -ne 0 }} | ForEach-Object {{ $_.MainWindowHandle }}))
Start-Process -FilePath explorer.exe -ArgumentList {args}
{app_id_ps}
{process_names_ps}
{titles_ps}
{title_required_ps}
{ps_ensure}
{ps_utils}
$deadline = [DateTime]::UtcNow.AddMilliseconds($timeoutMs)
$launchAt = [DateTime]::UtcNow
while ([DateTime]::UtcNow -lt $deadline) {{
  $p = Get-ShBestMatchingProcess -TargetAppId $targetAppId -ProcessNames $processNames -TitleHints $titleHints -TitleRequired:$titleRequired -ExcludeHandles $before -OnlyNew
  if (-not $p -and ([DateTime]::UtcNow - $launchAt).TotalMilliseconds -ge 750) {{
    $p = Get-ShBestMatchingProcess -TargetAppId $targetAppId -ProcessNames $processNames -TitleHints $titleHints -TitleRequired:$titleRequired
  }}
  if ($p) {{
    @{{ ok = $true; window = $true; pid = [int]$p.Id; processName = $p.ProcessName }} | ConvertTo-Json -Compress
    exit 0
  }}
  if (-not $targetAppId -and $processNames.Count -eq 0 -and $titleHints.Count -eq 0) {{
    $now = @([int64[]](Get-Process | Where-Object {{ $_.MainWindowHandle -ne 0 }} | ForEach-Object {{ $_.MainWindowHandle }}))
    $newHandles = @($now | Where-Object {{ $_ -notin $before }})
    if ($newHandles.Count -gt 0) {{
      $any = Get-ShBestMatchingProcess -ProcessNames @() -TitleHints @() -ExcludeHandles $before -OnlyNew
      if ($any) {{
        @{{ ok = $true; window = $true; pid = [int]$any.Id; processName = $any.ProcessName }} | ConvertTo-Json -Compress
        exit 0
      }}
    }}
  }}
  Start-Sleep -Milliseconds 250
}}
@{{ ok = $false; window = $false; message = 'Đã chạy Explorer nhưng không thấy cửa sổ mới (timeout).' }} | ConvertTo-Json -Compress
exit 1
"#,
            args = argument_list_ps,
            ps_utils = PS_WINDOW_MATCH_UTILS,
        );
        let out = run_ps_encoded(script.trim()).await?;
        parse_launch_ps(&out)
    }

    async fn launch_exe_win(exe_path: &str) -> Result<LaunchMeta, String> {
        launch_exe_and_wait_win(exe_path).await
    }

    async fn launch_explorer_shell_apps(
        app_id: &str,
        app_display_name: &str,
    ) -> Result<LaunchMeta, String> {
        let uri = format!("shell:AppsFolder\\{}", app_id);
        let q = escape_ps_single(&uri);
        let hints = LaunchWaitHints::from_start_app(app_id, app_display_name);
        launch_explorer_and_wait_win(&q, Some(&hints)).await
    }

    async fn launch_explorer_dir(path: &str) -> Result<LaunchMeta, String> {
        let q = escape_ps_single(path);
        launch_explorer_and_wait_win(&q, None).await
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
                reused_existing: false,
                pid: meta.pid,
                process_name: meta.process_name,
                maximized: false,
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
                reused_existing: false,
                pid: meta.pid,
                process_name: meta.process_name,
                maximized: false,
            }));
        }
        None
    }

    async fn try_maximize_window_win(
        pid: Option<u32>,
        process_name: Option<&str>,
    ) -> Result<bool, String> {
        let pid_expr = pid
            .map(|n| format!("$targetPid = {n}"))
            .unwrap_or_else(|| "$targetPid = $null".to_string());
        let name_expr = process_name
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(escape_ps_single)
            .map(|s| format!("$processName = {}", s))
            .unwrap_or_else(|| "$processName = $null".to_string());
        if pid.is_none() && process_name.map(str::trim).filter(|s| !s.is_empty()).is_none() {
            return Ok(false);
        }
        let script = format!(
            r#"
$ErrorActionPreference = 'SilentlyContinue'
{pid_expr}
{name_expr}
try {{
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class ShWinMax {{
  [StructLayout(LayoutKind.Sequential)] public struct RECT {{ public int Left, Top, Right, Bottom; }}
  [StructLayout(LayoutKind.Sequential)] public struct POINT {{ public int X, Y; }}
  [StructLayout(LayoutKind.Sequential)] public struct WINDOWPLACEMENT {{
    public int length; public int flags; public int showCmd; public POINT ptMinPosition; public POINT ptMaxPosition; public RECT rcNormalPosition;
  }}
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rc);
  [DllImport("user32.dll")] public static extern bool GetWindowPlacement(IntPtr hWnd, ref WINDOWPLACEMENT lpwndpl);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int nIndex);
  public const byte VK_LWIN = 0x5B;
  public const byte VK_UP = 0x26;
  public const uint KEYEVENTF_KEYUP = 0x0002;
}}
'@ -ErrorAction SilentlyContinue | Out-Null
}} catch {{}}
function Test-Maximized([IntPtr]$h) {{
  if ([ShWinMax]::IsZoomed($h)) {{ return $true }}
  $wp = New-Object ShWinMax+WINDOWPLACEMENT
  $wp.length = [System.Runtime.InteropServices.Marshal]::SizeOf([type]([ShWinMax+WINDOWPLACEMENT]))
  if ([ShWinMax]::GetWindowPlacement($h, [ref]$wp) -and $wp.showCmd -eq 3) {{ return $true }}
  $rc = New-Object ShWinMax+RECT
  if ([ShWinMax]::GetWindowRect($h, [ref]$rc)) {{
    $w = $rc.Right - $rc.Left
    $hgt = $rc.Bottom - $rc.Top
    $sw = [ShWinMax]::GetSystemMetrics(0)
    $sh = [ShWinMax]::GetSystemMetrics(1)
    if ($sw -gt 0 -and $sh -gt 0 -and $w -ge [int]($sw * 0.82) -and $hgt -ge [int]($sh * 0.82)) {{ return $true }}
  }}
  return $false
}}
function Send-WinUp {{
  [ShWinMax]::keybd_event([ShWinMax]::VK_LWIN, 0, 0, [UIntPtr]::Zero)
  [ShWinMax]::keybd_event([ShWinMax]::VK_UP, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
  [ShWinMax]::keybd_event([ShWinMax]::VK_UP, 0, [ShWinMax]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)
  [ShWinMax]::keybd_event([ShWinMax]::VK_LWIN, 0, [ShWinMax]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)
}}
function Get-BestProcess {{
  $list = New-Object System.Collections.Generic.List[object]
  if ($targetPid) {{
    $p = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
    if ($p) {{ [void]$list.Add($p) }}
  }}
  if ($processName) {{
    foreach ($p in @(Get-Process -Name $processName -ErrorAction SilentlyContinue)) {{
      [void]$list.Add($p)
    }}
  }}
  $best = $null
  $bestArea = 0
  foreach ($p in $list) {{
    $p.Refresh()
    $h = $p.MainWindowHandle
    if ([int]$h -eq 0) {{ continue }}
    $rc = New-Object ShWinMax+RECT
    if (-not [ShWinMax]::GetWindowRect($h, [ref]$rc)) {{ continue }}
    $area = ($rc.Right - $rc.Left) * ($rc.Bottom - $rc.Top)
    if ($area -gt $bestArea) {{ $best = $p; $bestArea = $area }}
  }}
  return $best
}}
$deadline = [DateTime]::UtcNow.AddSeconds(6)
$maximized = $false
$triedWinUp = $false
while ([DateTime]::UtcNow -lt $deadline -and -not $maximized) {{
  $p = Get-BestProcess
  if (-not $p) {{
    Start-Sleep -Milliseconds 350
    continue
  }}
  $p.Refresh()
  $h = $p.MainWindowHandle
  if ([int]$h -eq 0) {{
    Start-Sleep -Milliseconds 350
    continue
  }}
  [void][ShWinMax]::SetForegroundWindow($h)
  Start-Sleep -Milliseconds 80
  [void][ShWinMax]::ShowWindowAsync($h, 9)
  Start-Sleep -Milliseconds 60
  [void][ShWinMax]::ShowWindowAsync($h, 3)
  Start-Sleep -Milliseconds 200
  $maximized = Test-Maximized $h
  if (-not $maximized -and -not $triedWinUp) {{
    [void][ShWinMax]::SetForegroundWindow($h)
    Send-WinUp
    Start-Sleep -Milliseconds 250
    $maximized = Test-Maximized $h
    $triedWinUp = $true
  }}
  if (-not $maximized) {{ Start-Sleep -Milliseconds 350 }}
}}
@{{ ok = $true; maximized = [bool]$maximized }} | ConvertTo-Json -Compress
"#
        );
        let out = run_ps_encoded(script.trim()).await?;
        let v: Value = serde_json::from_str(out.trim())
            .map_err(|e| format!("parse maximize result: {}", e))?;
        Ok(v.get("maximized").and_then(|x| x.as_bool()).unwrap_or(false))
    }

    async fn resolve_and_launch_win_inner(
        query: &str,
        reuse_existing: bool,
    ) -> Result<OpenAppSuccess, String> {
        let path_buf = if Path::new(query).is_absolute() {
            Some(PathBuf::from(query))
        } else {
            std::env::current_dir().ok().map(|cwd| cwd.join(query))
        };
        let canonical = path_buf.as_ref().and_then(|p| p.canonicalize().ok());

        if reuse_existing {
            if let Some(abs) = &canonical {
                if let Ok(meta) = std::fs::metadata(abs) {
                    if meta.is_file() {
                        let stem = abs.file_stem().and_then(|s| s.to_str()).unwrap_or("");
                        if let Some(found) = try_focus_existing_win(Some(stem), None).await? {
                            return Ok(OpenAppSuccess {
                                method: "existing_window",
                                launched: abs.to_string_lossy().to_string(),
                                reused_existing: true,
                                pid: found.pid,
                                process_name: found.process_name,
                                maximized: false,
                            });
                        }
                    }
                }
            }
            if let Some(found) = try_focus_existing_win(Some(query), None).await? {
                return Ok(OpenAppSuccess {
                    method: "existing_window",
                    launched: query.to_string(),
                    reused_existing: true,
                    pid: found.pid,
                    process_name: found.process_name,
                    maximized: false,
                });
            }
            if let Some(found) = try_focus_existing_win(None, Some(query)).await? {
                return Ok(OpenAppSuccess {
                    method: "existing_window",
                    launched: query.to_string(),
                    reused_existing: true,
                    pid: found.pid,
                    process_name: found.process_name,
                    maximized: false,
                });
            }
        }

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
                    if reuse_existing {
                        if let Some(found) =
                            try_focus_existing_by_app_id(&row.app_id, &row.name).await?
                        {
                            return Ok(OpenAppSuccess {
                                method: "existing_window",
                                launched: format!("{} ({})", row.name, row.app_id),
                                reused_existing: true,
                                pid: found.pid,
                                process_name: found.process_name,
                                maximized: false,
                            });
                        }
                    }
                    let meta = launch_explorer_shell_apps(&row.app_id, &row.name).await?;
                    return Ok(OpenAppSuccess {
                        method: "shell_apps",
                        launched: format!("{} ({})", row.name, row.app_id),
                        reused_existing: false,
                        pid: meta.pid,
                        process_name: meta.process_name,
                        maximized: false,
                    });
                }
            }
        }

        if let Some((row, sc)) = best_lnk {
            if sc >= 100 {
                if reuse_existing {
                    let base = Path::new(&row.target_path)
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("");
                    if let Some(found) =
                        try_focus_existing_win(Some(base), None).await?
                    {
                        return Ok(OpenAppSuccess {
                            method: "existing_window",
                            launched: format!("{} → {}", row.name, row.target_path),
                            reused_existing: true,
                            pid: found.pid,
                            process_name: found.process_name,
                            maximized: false,
                        });
                    }
                }
                let meta = launch_exe_win(&row.target_path).await?;
                return Ok(OpenAppSuccess {
                    method: "shortcut",
                    launched: format!("{} → {}", row.name, row.target_path),
                    reused_existing: false,
                    pid: meta.pid,
                    process_name: meta.process_name,
                    maximized: false,
                });
            }
        }

        Err("Không tìm thấy app khớp (Start / shortcut). Thử đường dẫn đầy đủ tới file .exe.".into())
    }

    pub async fn resolve_and_launch_win(
        query: &str,
        reuse_existing: bool,
        maximize_window: bool,
    ) -> Result<OpenAppSuccess, String> {
        let mut result = resolve_and_launch_win_inner(query, reuse_existing).await?;
        if maximize_window {
            result.maximized = try_maximize_window_win(result.pid, result.process_name.as_deref())
                .await
                .unwrap_or(false);
        }
        Ok(result)
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
        reused_existing: false,
        pid: None,
        process_name: None,
        maximized: false,
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
            reused_existing: false,
            pid: None,
            process_name: None,
            maximized: false,
        });
    }
    Err("Linux: chỉ hỗ trợ đường dẫn file có thật + xdg-open.".into())
}

/// Entry chính: đường dẫn / tên app (Windows: resolve Start + shortcut).
pub async fn open_app_resolve(
    query: &str,
    reuse_existing: bool,
    maximize_window: bool,
) -> Result<OpenAppSuccess, String> {
    let q = query.trim();
    if q.is_empty() {
        return Err("Thiếu đường dẫn hoặc tên app.".into());
    }
    #[cfg(windows)]
    {
        return win::resolve_and_launch_win(q, reuse_existing, maximize_window).await;
    }
    #[cfg(target_os = "macos")]
    {
        let _ = (reuse_existing, maximize_window);
        return resolve_macos(q).await;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let _ = (reuse_existing, maximize_window);
        return resolve_linux(q).await;
    }
    #[cfg(not(any(windows, unix)))]
    {
        let _ = (q, reuse_existing, maximize_window);
        Err("OPEN_APP: nền tảng chưa hỗ trợ.".into())
    }
}
