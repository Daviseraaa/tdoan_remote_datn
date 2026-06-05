use serde_json::Value;
use windows::Win32::Foundation::POINT;
use windows::Win32::UI::Accessibility::{IUIAutomationInvokePattern, UIA_InvokePatternId};

use crate::com::automation;
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

        let pattern: IUIAutomationInvokePattern = match element
            .GetCurrentPatternAs(UIA_InvokePatternId)
        {
            Ok(p) => p,
            Err(_) => return false,
        };

        pattern.Invoke().is_ok()
    }
}

/// Thử click qua UIA InvokePattern. Trả về `true` nếu đã invoke thành công.
pub fn try_invoke_click(uia: &Value, fallback_x: i32, fallback_y: i32) -> bool {
    let target = match uia.get("target") {
        Some(t) => t,
        None => return false,
    };

    let supports = target
        .get("supportsInvoke")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !supports {
        return false;
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
        return true;
    }

    if let Some(bounds) = target.get("bounds") {
        if let Some((cx, cy)) = bounds_center(bounds) {
            if (cx, cy) != (px, py) && try_invoke_at(target, cx, cy) {
                return true;
            }
        }
    }

    false
}
