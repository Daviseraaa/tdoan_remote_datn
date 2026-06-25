//! Windows UI Automation + tọa độ physical (DPI) cho desktop recorder.

#![cfg(windows)]

mod capture;
mod com;
mod dpi;
mod find;
mod focus;
mod highlight;
mod invoke;
mod screen;
mod timed;
mod util;

pub use capture::{capture_element_at_point, capture_highlight_target_at_point};
pub use timed::{
    active_uia_thread_count, capture_element_at_point_timed,
    capture_highlight_target_at_point_timed, UIA_CAPTURE_TIMEOUT_MS,
};
pub use dpi::enable_per_monitor_v2;
pub use find::find_target_element;
pub use focus::{focus_host_for_step, focus_settle_ms};
pub use highlight::{highlight_at_point, highlight_clear, highlight_worker_start, highlight_worker_stop};
pub use invoke::{resolve_click_point_for_step, try_invoke_click};
pub use screen::{bounds_center, physical_cursor_point, resolve_click_point, set_physical_cursor};
