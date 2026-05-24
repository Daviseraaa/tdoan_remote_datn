//! Chuẩn hoá URL cho task `OPEN_BROWSER` (mở browser qua cloak-runner).

fn http_url_has_host(lower: &str) -> bool {
    let rest = lower
        .strip_prefix("https://")
        .or_else(|| lower.strip_prefix("http://"))
        .unwrap_or(lower);
    let host = rest.split(['/', '?', '#']).next().unwrap_or("").trim();
    !host.is_empty()
        && (host.contains('.') || host == "localhost" || host.starts_with('['))
}

pub fn normalize_url_for_task(raw: &str) -> Result<String, String> {
    let s = raw.trim();
    if s.is_empty() {
        return Err("URL trống".into());
    }
    let lower = s.to_lowercase();
    if lower == "http://"
        || lower == "https://"
        || lower == "http:///"
        || lower == "https:///"
    {
        return Err("URL chưa đủ — nhập địa chỉ đầy đủ (vd. https://example.com)".into());
    }
    if lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("about:")
        || lower.starts_with("file://")
    {
        if !lower.starts_with("about:") && !http_url_has_host(&lower) {
            return Err("URL thiếu hostname (vd. https://example.com)".into());
        }
        return Ok(s.to_string());
    }
    if s.contains('.') && !s.contains(' ') {
        return Ok(format!("https://{}", s));
    }
    Err("URL không hợp lệ (cần http://, https://, about: hoặc file://)".into())
}
