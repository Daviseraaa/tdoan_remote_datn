use windows::Win32::Foundation::POINT;
use windows::Win32::UI::WindowsAndMessaging::{GetPhysicalCursorPos, SetPhysicalCursorPos};

/// Vị trí con trỏ theo pixel vật lý (màn hình).
pub fn physical_cursor_point() -> Option<(i32, i32)> {
    unsafe {
        let mut pt = POINT::default();
        GetPhysicalCursorPos(&mut pt).ok()?;
        Some((pt.x, pt.y))
    }
}

pub fn set_physical_cursor(x: i32, y: i32) -> Result<(), String> {
    unsafe {
        SetPhysicalCursorPos(x, y)
            .map_err(|e| e.to_string())
            .map(|_| ())
    }
}

pub fn bounds_center(bounds: &serde_json::Value) -> Option<(i32, i32)> {
    let left = bounds.get("left")?.as_i64()? as i32;
    let top = bounds.get("top")?.as_i64()? as i32;
    let right = bounds.get("right")?.as_i64()? as i32;
    let bottom = bounds.get("bottom")?.as_i64()? as i32;
    if right <= left || bottom <= top {
        return None;
    }
    Some(((left + right) / 2, (top + bottom) / 2))
}

/// @deprecated dùng `resolve_click_point_for_step` (live UIA).
pub fn resolve_click_point(step: &serde_json::Value) -> Option<(i32, i32)> {
    crate::invoke::resolve_click_point_for_step(step)
}
