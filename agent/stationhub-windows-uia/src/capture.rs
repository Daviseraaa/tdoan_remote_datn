use serde_json::{json, Value};
use windows::Win32::Foundation::POINT;
use windows::Win32::UI::Accessibility::IUIAutomationElement;

use crate::com::automation;
use crate::screen::physical_cursor_point;
use crate::util::{element_snapshot, is_interactive_control};

const MAX_ANCESTORS: usize = 4;

/// Bắt phần tử UIA tại điểm chuột. Luôn ưu tiên `GetPhysicalCursorPos` khi `prefer_physical_cursor`.
pub fn capture_element_at_point(x: i32, y: i32, prefer_physical_cursor: bool) -> Option<Value> {
    let (px, py) = if prefer_physical_cursor {
        physical_cursor_point().unwrap_or((x, y))
    } else {
        (x, y)
    };

    let automation = automation().ok()?;
    unsafe {
        let point = POINT { x: px, y: py };
        let element = automation.ElementFromPoint(point).ok()?;
        build_capture(&automation, &element, px, py)
    }
}

unsafe fn build_capture(
    automation: &windows::Win32::UI::Accessibility::IUIAutomation,
    element: &IUIAutomationElement,
    x: i32,
    y: i32,
) -> Option<Value> {
    let target = element_snapshot(element)?;
    let mut ancestors: Vec<Value> = Vec::new();
    if let Ok(walker) = automation.ControlViewWalker() {
        let mut current = element.clone();
        for _ in 0..MAX_ANCESTORS {
            let parent = match walker.GetParentElement(&current) {
                Ok(p) => p,
                Err(_) => break,
            };
            if let Some(snap) = element_snapshot(&parent) {
                ancestors.push(snap);
            }
            current = parent;
        }
    }

    Some(json!({
        "version": 1,
        "point": { "x": x, "y": y },
        "target": target,
        "ancestors": ancestors,
    }))
}

/// Capture nhẹ cho highlight overlay — không walk ancestors.
pub fn capture_highlight_target_at_point(
    x: i32,
    y: i32,
    prefer_physical_cursor: bool,
) -> Option<Value> {
    let (px, py) = if prefer_physical_cursor {
        physical_cursor_point().unwrap_or((x, y))
    } else {
        (x, y)
    };

    let automation = automation().ok()?;
    unsafe {
        let point = POINT { x: px, y: py };
        let element = automation.ElementFromPoint(point).ok()?;
        let target = element_snapshot(&element)?;
        if !is_interactive_control(&target) {
            return None;
        }
        Some(target)
    }
}
