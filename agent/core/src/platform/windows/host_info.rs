//! MAC / RDP metadata cho remote access (WoL, RDP hint).

use serde_json::{json, Value};

#[derive(Debug, Clone)]
struct NicEntry {
    name: String,
    mac: String,
    kind: String,
    status: String,
}

fn normalize_mac(raw: &str) -> Option<String> {
    let hex: String = raw.chars().filter(|c| c.is_ascii_hexdigit()).collect();
    if hex.len() != 12 {
        return None;
    }
    let upper = hex.to_uppercase();
    Some(
        upper
            .as_bytes()
            .chunks(2)
            .map(|pair| std::str::from_utf8(pair).unwrap_or("00"))
            .collect::<Vec<_>>()
            .join(":"),
    )
}

fn classify_kind(name: &str, description: &str) -> &'static str {
    let n = format!("{} {}", name, description).to_lowercase();
    if n.contains("wi-fi") || n.contains("wifi") || n.contains("wireless") || n.contains("802.11") {
        "wifi"
    } else if n.contains("ethernet") || n.contains("realtek") || n.contains("gbe") || n.contains("2.5gbe")
    {
        "ethernet"
    } else if n.contains("bluetooth") {
        "bluetooth"
    } else {
        "other"
    }
}

fn is_wol_unfriendly(kind: &str) -> bool {
    matches!(kind, "bluetooth" | "other")
}

fn is_virtual_only(name: &str, description: &str) -> bool {
    let n = format!("{} {}", name, description).to_lowercase();
    [
        "virtual", "vmware", "hyper-v", "vethernet", "loopback", "wan miniport", "tap-",
        "wintun", "npcap", "pseudo", "kernel debug",
    ]
    .iter()
    .any(|k| n.contains(k))
}

fn parse_getmac_csv(stdout: &str) -> Vec<NicEntry> {
    let mut out = Vec::new();
    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split(',').map(|s| s.trim_matches('"').trim()).collect();
        if parts.is_empty() {
            continue;
        }

        // getmac /fo csv /nh      → MAC, Transport
        // getmac /fo csv /nh /v  → Connection, Adapter, MAC, Transport
        let (name, description, mac_raw) = if parts.len() >= 4 {
            (parts[0], parts[1], parts[2])
        } else if parts.len() >= 2 {
            let mac_candidate = parts[0];
            if normalize_mac(mac_candidate).is_some() {
                ("Network adapter", "", mac_candidate)
            } else {
                (parts[0], "", parts[1])
            }
        } else {
            continue;
        };

        if mac_raw.eq_ignore_ascii_case("N/A") {
            continue;
        }
        let Some(mac) = normalize_mac(mac_raw) else {
            continue;
        };
        if mac == "00:00:00:00:00:00" {
            continue;
        }

        let kind = classify_kind(name, description);
        out.push(NicEntry {
            name: if description.is_empty() {
                name.to_string()
            } else {
                format!("{name} ({description})")
            },
            mac,
            kind: kind.into(),
            status: "unknown".into(),
        });
    }
    out
}

fn pick_wol_mac(interfaces: &[NicEntry]) -> Option<String> {
    let usable: Vec<&NicEntry> = interfaces
        .iter()
        .filter(|n| !is_virtual_only(&n.name, ""))
        .filter(|n| !is_wol_unfriendly(&n.kind))
        .collect();

    let pick = |kind: &str| -> Option<String> {
        usable
            .iter()
            .find(|n| n.kind == kind && n.status.eq_ignore_ascii_case("up"))
            .or_else(|| usable.iter().find(|n| n.kind == kind))
            .map(|n| n.mac.clone())
    };

    pick("ethernet").or_else(|| pick("wifi")).or_else(|| {
        interfaces
            .iter()
            .filter(|n| !is_virtual_only(&n.name, ""))
            .filter(|n| n.kind != "bluetooth")
            .map(|n| n.mac.clone())
            .next()
    })
}

#[cfg(windows)]
fn list_network_interfaces_ps() -> Vec<NicEntry> {
    let script = r#"
$adapters = Get-NetAdapter -ErrorAction SilentlyContinue |
  Where-Object { $_.MacAddress -and $_.MacAddress -ne '00-00-00-00-00-00' } |
  Select-Object Name, MacAddress, InterfaceDescription, MediaType, Status
if (-not $adapters) { '[]' } else { $adapters | ConvertTo-Json -Compress }
"#;
    let output = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .output();
    let Ok(o) = output else {
        return Vec::new();
    };
    if !o.status.success() {
        return Vec::new();
    }
    let text = String::from_utf8_lossy(&o.stdout).trim().to_string();
    let Ok(v) = serde_json::from_str::<Value>(&text) else {
        return Vec::new();
    };
    let arr = match v {
        Value::Array(a) => a,
        Value::Object(_) => vec![v],
        _ => return Vec::new(),
    };

    let mut out = Vec::new();
    for item in arr {
        let Some(obj) = item.as_object() else {
            continue;
        };
        let name = obj
            .get("Name")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string();
        let desc = obj
            .get("InterfaceDescription")
            .and_then(|x| x.as_str())
            .unwrap_or("");
        let mac_raw = obj
            .get("MacAddress")
            .and_then(|x| x.as_str())
            .unwrap_or("");
        let status = obj
            .get("Status")
            .and_then(|x| x.as_str())
            .unwrap_or("Unknown")
            .to_string();
        let Some(mac) = normalize_mac(mac_raw) else {
            continue;
        };
        if is_virtual_only(&name, desc) {
            continue;
        }
        let kind = classify_kind(&name, desc);
        out.push(NicEntry {
            name: if desc.is_empty() {
                name
            } else {
                format!("{name} ({desc})")
            },
            mac,
            kind: kind.into(),
            status,
        });
    }
    out
}

#[cfg(windows)]
fn list_network_interfaces() -> Vec<NicEntry> {
    let mut interfaces = list_network_interfaces_ps();
    if interfaces.is_empty() {
        let output = std::process::Command::new("getmac")
            .args(["/fo", "csv", "/nh", "/v"])
            .output();
        if let Ok(o) = output {
            if o.status.success() {
                interfaces = parse_getmac_csv(&String::from_utf8_lossy(&o.stdout));
            }
        }
    }
    interfaces
}

#[cfg(windows)]
fn rdp_status() -> (bool, u16) {
    let script = r#"
$ts = Get-ItemProperty -Path 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name fDenyTSConnections -ErrorAction SilentlyContinue
$enabled = ($null -ne $ts -and $ts.fDenyTSConnections -eq 0)
$port = 3389
$winStations = Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -Name PortNumber -ErrorAction SilentlyContinue
if ($winStations -and $winStations.PortNumber) { $port = [int]$winStations.PortNumber }
@{ enabled = $enabled; port = $port } | ConvertTo-Json -Compress
"#;
    let output = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ])
        .output();
    let Ok(o) = output else {
        return (false, 3389);
    };
    if !o.status.success() {
        return (false, 3389);
    }
    let text = String::from_utf8_lossy(&o.stdout);
    let Ok(v) = serde_json::from_str::<Value>(text.trim()) else {
        return (false, 3389);
    };
    let enabled = v.get("enabled").and_then(|x| x.as_bool()).unwrap_or(false);
    let port = v
        .get("port")
        .and_then(|x| x.as_u64())
        .unwrap_or(3389)
        .min(65535) as u16;
    (enabled, port)
}

#[cfg(windows)]
fn detect_wol_broadcast(wol_mac: Option<&str>) -> Option<String> {
    let mac_arg = wol_mac.unwrap_or("").replace('\'', "''");
    let script = format!(
        r#"
$target = '{mac_arg}' -replace '[^0-9A-Fa-f]',''
$target = $target.ToUpper()
$best = $null
$configs = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
  Where-Object {{ $_.IPv4Address -and $_.NetAdapter -and $_.NetAdapter.Status -eq 'Up' }}
foreach ($c in $configs) {{
  $ip = $c.IPv4Address.IPAddress
  if (-not $ip -or $ip -like '127.*' -or $ip -like '169.254.*') {{ continue }}
  $prefix = [int]$c.IPv4Address.PrefixLength
  if ($prefix -le 0 -or $prefix -ge 32) {{ continue }}
  $macHex = ($c.NetAdapter.MacAddress -replace '[^0-9A-Fa-f]','').ToUpper()
  $matchMac = (-not $target) -or ($macHex -eq $target)
  $hasGw = [bool]$c.IPv4DefaultGateway
  if (-not $matchMac -and $target) {{ continue }}
  $ipBytes = [System.Net.IPAddress]::Parse($ip).GetAddressBytes()
  $mask = @()
  for ($i = 0; $i -lt 4; $i++) {{
    $bits = [Math]::Min(8, [Math]::Max(0, $prefix - ($i * 8)))
    if ($bits -le 0) {{ $mask += 0 }}
    elseif ($bits -ge 8) {{ $mask += 255 }}
    else {{ $mask += (256 - [Math]::Pow(2, 8 - $bits)) }}
  }}
  $bcast = @()
  for ($i = 0; $i -lt 4; $i++) {{ $bcast += ($ipBytes[$i] -bor (255 - $mask[i])) }}
  $row = [PSCustomObject]@{{
    broadcast = ($bcast -join '.')
    hasGateway = $hasGw
    matchMac = $matchMac
  }}
  if ($matchMac -and $hasGw) {{ $best = $row; break }}
  if ($matchMac -and -not $best) {{ $best = $row }}
  elseif ($hasGw -and -not $best) {{ $best = $row }}
  elseif (-not $best) {{ $best = $row }}
}}
if ($best) {{ $best.broadcast }} else {{ '' }}
"#,
        mac_arg = mac_arg
    );
    let output = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ])
        .output();
    let Ok(o) = output else {
        return None;
    };
    if !o.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&o.stdout).trim().to_string();
    if text.is_empty() || !text.contains('.') {
        return None;
    }
    Some(text)
}

/// Metadata remote access gửi lên server lúc connect.
#[cfg(windows)]
pub fn remote_access_metadata() -> Value {
    let interfaces = list_network_interfaces();
    let if_json: Vec<Value> = interfaces
        .iter()
        .map(|n| {
            json!({
                "name": n.name,
                "mac": n.mac,
                "kind": n.kind,
                "status": n.status,
            })
        })
        .collect();

    let wol_mac = pick_wol_mac(&interfaces);
    let wol_broadcast = detect_wol_broadcast(wol_mac.as_deref());
    let (rdp_enabled, rdp_port) = rdp_status();
    let rdp_host = hostname::get()
        .map(|h| h.to_string_lossy().into_owned())
        .unwrap_or_default();

    let mut obj = serde_json::Map::new();
    obj.insert("networkInterfaces".into(), Value::Array(if_json));
    if let Some(mac) = wol_mac {
        obj.insert("wolMacAddress".into(), json!(mac));
    }
    if let Some(bcast) = wol_broadcast {
        obj.insert("wolBroadcast".into(), json!(bcast));
    }
    obj.insert("rdpEnabled".into(), json!(rdp_enabled));
    obj.insert("rdpPort".into(), json!(rdp_port));
    obj.insert("rdpHost".into(), json!(rdp_host));
    obj.insert(
        "remoteAccessCollectedAt".into(),
        json!(chrono_like_ms()),
    );

    Value::Object(obj)
}

fn chrono_like_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(not(windows))]
pub fn remote_access_metadata() -> Value {
    json!({
        "networkInterfaces": [],
        "rdpEnabled": false,
        "rdpPort": 3389,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_getmac_verbose_csv() {
        let sample = r#""Ethernet","Realtek Controller","AA-BB-CC-DD-EE-FF","\Device\Tcpip_{...}""#;
        let nics = parse_getmac_csv(sample);
        assert_eq!(nics.len(), 1);
        assert_eq!(nics[0].mac, "AA:BB:CC:DD:EE:FF");
        assert_eq!(nics[0].kind, "ethernet");
    }

    #[test]
    fn parse_getmac_short_csv() {
        let sample = r#""11-22-33-44-55-66","\Device\Tcpip_{...}""#;
        let nics = parse_getmac_csv(sample);
        assert_eq!(nics.len(), 1);
        assert_eq!(nics[0].mac, "11:22:33:44:55:66");
    }
}
