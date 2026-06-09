use serde_json::Value;
use windows::Win32::Foundation::POINT;

use crate::com::automation;
use crate::find::{invoke_element, live_click_point, try_invoke_by_find, find_target_element};
use crate::screen::bounds_center;
use crate::util::{element_snapshot, elements_match};

fn try_invoke_at(target: &Value, x: i32, y: i32) -> bool {
    let automation = match automation() {
        Ok(a) => a,
        Err(_) => return false,
    };

    unsafe {
        let point = POINT { x, y: y };
        let element = match automation.ElementFromPoint(point) {
            Ok(e) => e,
            Err(_) => return false,
        };

        let at_point = match element_snapshot(&element) {
            Some(s) => s,
            None => return false,
        };

        if !elements_match(target, &at_point) {
            return false;
        }

        invoke_element(&element)
    }
}

/// Thử click qua UIA. Trả về `"find"` | `"point"` | None.
pub fn try_invoke_click(uia: &Value, fallback_x: i32, fallback_y: i32) -> Option<&'static str> {
    let target = uia.get("target")?;

    let supports = target
        .get("supportsInvoke")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !supports {
        return None;
    }

    if try_invoke_by_find(uia) {
        return Some("find");
    }

    let px = uia
        .get("point")
        .and_then(|p| p.get("x"))
        .and_then(|v| v.as_i64())
        .map(|n| n as i32)
        .unwrap_or(fallback_x);
    let py = uia
        .get("point")
        .and_then(|p| p.get("y"))
        .and_then(|v| v.as_i64())
        .map(|n| n as i32)
        .unwrap_or(fallback_y);

    if try_invoke_at(target, px, py) {
        return Some("point");
    }

    if let Some(bounds) = target.get("bounds") {
        if let Some((cx, cy)) = bounds_center(bounds) {
            if (cx, cy) != (px, py) && try_invoke_at(target, cx, cy) {
                return Some("point");
            }
        }
    }

    None
}

/// Tọa độ physical để click: live UIA → ghi lại → x/y bước.
pub fn resolve_click_point_for_step(step: &Value) -> Option<(i32, i32)> {
    if let Some(uia) = step.get("uia") {
        if let Some(el) = find_target_element(uia) {
            if let Some(pt) = live_click_point(&el) {
                return Some(pt);
            }
        }
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
