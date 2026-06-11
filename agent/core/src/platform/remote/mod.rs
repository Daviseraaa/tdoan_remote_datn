//! Mở/đóng ứng dụng remote trên máy agent (RustDesk, …).

#[cfg(windows)]
mod rustdesk;

pub const DEFAULT_RUSTDESK_PATH: &str = r"C:\Program Files\RustDesk\rustdesk.exe";

pub fn start_remote(provider: &str, exe_path: &str) -> Result<String, String> {
    let p = provider.trim().to_lowercase();
    if p.is_empty() || p == "rustdesk" {
        #[cfg(windows)]
        {
            rustdesk::launch_application(exe_path)?;
            return Ok("Đã mở ứng dụng RustDesk trên máy agent".into());
        }
        #[cfg(not(windows))]
        {
            return Err("Remote RustDesk chỉ hỗ trợ Windows".into());
        }
    }
    Err(format!("Remote provider chưa hỗ trợ: {provider}"))
}

pub fn stop_remote(provider: &str) -> Result<String, String> {
    let p = provider.trim().to_lowercase();
    if p.is_empty() || p == "rustdesk" {
        #[cfg(windows)]
        {
            rustdesk::close_application()?;
            return Ok("Đã đóng ứng dụng RustDesk".into());
        }
        #[cfg(not(windows))]
        {
            return Err("Remote RustDesk chỉ hỗ trợ Windows".into());
        }
    }
    Err(format!("Remote provider chưa hỗ trợ: {provider}"))
}
