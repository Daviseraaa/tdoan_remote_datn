//! Khớp `desktop/src/shared/build-config.ts` — sửa tay cả hai file khi đổi giá trị.

pub const SERVER_WS_URL: &str = "wss://api.stationhub.io.vn";
pub const AGENT_VERSION: &str = "1.0.0";
pub const PUBLIC_IP_LOOKUP_URL: &str = "https://api.ipify.org";
pub const LOG_LEVEL: &str = "info";

/// Ghi đè biến môi trường bằng giá trị cố định lúc build.
pub fn pin_build_env() {
    std::env::set_var("SERVER_WS_URL", SERVER_WS_URL);
    std::env::set_var("AGENT_VERSION", AGENT_VERSION);
    std::env::set_var("PUBLIC_IP_LOOKUP_URL", PUBLIC_IP_LOOKUP_URL);
    std::env::set_var("LOG_LEVEL", LOG_LEVEL);
}
