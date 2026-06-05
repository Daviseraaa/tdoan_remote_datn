//! Windows UI Automation + tọa độ physical (DPI) cho desktop recorder.

#![cfg(windows)]

mod capture;
mod com;
mod dpi;
mod invoke;
mod screen;
mod util;

pub use capture::capture_element_at_point;
pub use dpi::enable_per_monitor_v2;
pub use invoke::try_invoke_click;
pub use screen::{bounds_center, physical_cursor_point, resolve_click_point, set_physical_cursor};
