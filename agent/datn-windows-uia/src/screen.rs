use windows::Win32::Foundation::POINT;
use windows::Win32::UI::WindowsAndMessaging::{GetPhysicalCursorPos, SetPhysicalCursorPos};

/// Vị trí con trỏ theo pixel vật lý (màn hình) — dùng cho ghi/chạy lại trên Windows DPI.
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

/// Tọa độ physical để replay click: ưu tiên tâm `uia.target.bounds`, rồi `uia.point`, rồi x/y bước.
pub fn resolve_click_point(step: &serde_json::Value) -> Option<(i32, i32)> {
    if let Some(uia) = step.get("uia") {
        if let Some(bounds) = uia.get("target").and_then(|t| t.get("bounds")) {
            if let Some(c) = bounds_center(bounds) {
                return Some(c);
            }
        }
        if let (Some(x), Some(y)) = (
            uia.get("point").and_then(|p| p.get("x")).and_then(|v| v.as_i64()),
            uia.get("point").and_then(|p| p.get("y")).and_then(|v| v.as_i64()),
        ) {
            return Some((x as i32, y as i32));
        }
    }
    let x = step.get("x").and_then(|v| v.as_i64()).map(|n| n as i32)?;
    let y = step.get("y").and_then(|v| v.as_i64()).map(|n| n as i32)?;
    Some((x, y))
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
