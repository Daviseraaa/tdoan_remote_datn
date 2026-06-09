use windows::Win32::UI::HiDpi::{SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2};

/// Per-Monitor V2: `GetPhysicalCursorPos` / `SetPhysicalCursorPos` / UIA bounds cùng hệ tọa độ.
pub fn enable_per_monitor_v2() {
    unsafe {
        let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    }
}
