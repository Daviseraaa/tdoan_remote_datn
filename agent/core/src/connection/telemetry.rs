//! CPU / RAM / IP sampling — dùng chung một `sysinfo::System`, refresh tối thiểu.

use std::net::UdpSocket;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use sysinfo::{CpuRefreshKind, System};

#[derive(Debug, Clone)]
pub struct TelemetrySnapshot {
    pub ip: String,
    pub cpu_percent: f32,
    pub ram_used: u64,
    pub ram_total: u64,
    pub ram_label: String,
    pub timestamp: u64,
}

pub struct TelemetrySampler {
    sys: System,
    cached_ip: String,
    ip_refresh_at: Instant,
}

impl TelemetrySampler {
    pub fn new() -> Self {
        let mut sys = System::new();
        sys.refresh_cpu_usage();

        Self {
            sys,
            cached_ip: String::new(),
            ip_refresh_at: Instant::now() - Duration::from_secs(3600),
        }
    }

    /// Gọi trước `sample()` (async context). Ưu tiên public IP qua HTTP, fallback LAN.
    pub async fn refresh_ip_if_needed(&mut self) {
        const REFRESH_EVERY: Duration = Duration::from_secs(300);
        if self.ip_refresh_at.elapsed() < REFRESH_EVERY && !self.cached_ip.is_empty() {
            return;
        }
        self.ip_refresh_at = Instant::now();

        if let Some(ip) = fetch_public_ip().await {
            if !ip.is_empty() {
                self.cached_ip = ip;
                return;
            }
        }
        if let Some(ip) = resolve_local_outbound_ip() {
            self.cached_ip = ip;
        }
    }

    /// Số CPU logic — dùng cho metadata connect (không tạo `System` mới không refresh).
    pub fn logical_cpu_count(&mut self) -> u32 {
        self.sys.refresh_cpu_list(CpuRefreshKind::everything());
        let n = self.sys.cpus().len();
        if n > 0 {
            return n as u32;
        }
        std::thread::available_parallelism()
            .map(|p| p.get() as u32)
            .unwrap_or(1)
            .max(1)
    }

    pub fn sample(&mut self) -> TelemetrySnapshot {
        self.sys.refresh_cpu_usage();
        self.sys.refresh_memory();

        let cpu_percent = self.sys.global_cpu_usage();
        let ram_used = self.sys.used_memory();
        let ram_total = self.sys.total_memory().max(1);
        let ram_label = format_ram_label(ram_used, ram_total);

        TelemetrySnapshot {
            ip: self.cached_ip.clone(),
            cpu_percent,
            ram_used,
            ram_total,
            ram_label,
            timestamp: now_ms(),
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn format_ram_label(used: u64, total: u64) -> String {
    const GB: f64 = 1024.0 * 1024.0 * 1024.0;
    let fmt_gb = |bytes: u64| format!("{:.1}", bytes as f64 / GB);
    format!("{}/{} GB", fmt_gb(used), fmt_gb(total))
}

/// Public IP (egress) — `PUBLIC_IP_LOOKUP_URL` hoặc https://api.ipify.org
async fn fetch_public_ip() -> Option<String> {
    let url = std::env::var("PUBLIC_IP_LOOKUP_URL")
        .unwrap_or_else(|_| "https://api.ipify.org".to_string());
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .ok()?;
    let body = client.get(&url).send().await.ok()?.text().await.ok()?;
    let ip = body.trim();
    if looks_like_ip(ip) && !is_private_or_loopback(ip) {
        Some(ip.to_string())
    } else {
        None
    }
}

fn looks_like_ip(s: &str) -> bool {
    if s.contains(':') {
        return s.parse::<std::net::IpAddr>().is_ok();
    }
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    parts.iter().all(|p| p.parse::<u8>().is_ok())
}

fn is_private_or_loopback(ip: &str) -> bool {
    let Ok(addr) = ip.parse::<std::net::IpAddr>() else {
        return true;
    };
    match addr {
        std::net::IpAddr::V4(v4) => {
            v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.octets()[0] == 169 && v4.octets()[1] == 254
        }
        std::net::IpAddr::V6(v6) => v6.is_loopback() || v6.is_unique_local(),
    }
}

/// IP interface outbound (LAN) — fallback khi không gọi được dịch vụ public IP.
fn resolve_local_outbound_ip() -> Option<String> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    match socket.local_addr().ok()?.ip() {
        std::net::IpAddr::V4(v4) => Some(v4.to_string()),
        std::net::IpAddr::V6(v6) => Some(v6.to_string()),
    }
}
