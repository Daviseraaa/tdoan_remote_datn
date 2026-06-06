//! Tìm phần tử UIA theo automationId / cửa sổ host — không phụ thuộc tọa độ lúc ghi.

use serde_json::Value;
use windows::core::VARIANT;
use windows::Win32::UI::Accessibility::{
    IUIAutomation, IUIAutomationElement, TreeScope_Children, TreeScope_Descendants,
    UIA_AutomationIdPropertyId,
};

use crate::com::automation;

pub const WINDOW_CONTROL_TYPE: i32 = 50032;

/// Cửa sổ top-level host cho bước UIA (Notepad, Terminal, …).
pub fn resolve_host_window(uia: &Value) -> Option<IUIAutomationElement> {
    let automation = automation().ok()?;

    if let Some(win) = find_host_window(&automation, uia) {
        return Some(win);
    }

    if let Some(class) = host_window_class(uia) {
        let name_hint = host_window_name_hint(uia);
        let wins = list_windows_by_class(&automation, Some(class));
        if wins.len() == 1 {
            return wins.into_iter().next();
        }
        for win in wins {
            if window_name_matches(&win, name_hint.as_deref()) {
                return Some(win);
            }
        }
    }

    find_target_element(uia).and_then(|el| window_ancestor(&automation, &el))
}

fn host_window_name_hint(uia: &Value) -> Option<String> {
    uia.get("ancestors").and_then(|a| a.as_array()).and_then(|arr| {
        arr.iter().find_map(|anc| {
            if anc.get("controlTypeId")?.as_i64()? as i32 != WINDOW_CONTROL_TYPE {
                return None;
            }
            anc.get("name").and_then(|v| v.as_str()).map(String::from)
        })
    })
}

fn window_ancestor(
    automation: &IUIAutomation,
    el: &IUIAutomationElement,
) -> Option<IUIAutomationElement> {
    unsafe {
        if el.CurrentControlType().map(|t| t.0).unwrap_or(0) == WINDOW_CONTROL_TYPE {
            return Some(el.clone());
        }
        let walker = automation.ControlViewWalker().ok()?;
        let mut current = el.clone();
        for _ in 0..24 {
            let parent = walker.GetParentElement(&current).ok()?;
            if parent.CurrentControlType().map(|t| t.0).unwrap_or(0) == WINDOW_CONTROL_TYPE {
                return Some(parent);
            }
            current = parent;
        }
    }
    None
}

pub fn find_target_element(uia: &Value) -> Option<IUIAutomationElement> {
    let target = uia.get("target")?;
    let auto_id = target.get("automationId").and_then(|v| v.as_str()).filter(|s| !s.is_empty())?;
    let automation = automation().ok()?;

    if let Some(win) = find_host_window(&automation, uia) {
        if let Some(el) = find_by_automation_id(&automation, &win, auto_id) {
            return Some(el);
        }
    }

    for win in list_windows_by_class(&automation, host_window_class(uia)) {
        if let Some(el) = find_by_automation_id(&automation, &win, auto_id) {
            return Some(el);
        }
    }

    let root = unsafe { automation.GetRootElement().ok()? };
    find_by_automation_id(&automation, &root, auto_id)
}

fn host_window_class(uia: &Value) -> Option<String> {
    uia.get("ancestors")
        .and_then(|a| a.as_array())
        .and_then(|arr| {
            arr.iter().find_map(|anc| {
                let ct = anc.get("controlTypeId")?.as_i64()? as i32;
                if ct != WINDOW_CONTROL_TYPE {
                    return None;
                }
                anc.get("className")
                    .and_then(|v| v.as_str())
                    .map(String::from)
            })
        })
}

fn find_host_window(automation: &IUIAutomation, uia: &Value) -> Option<IUIAutomationElement> {
    let class = host_window_class(uia)?;
    let name_hint = host_window_name_hint(uia);

    for win in list_windows_by_class(automation, Some(class)) {
        if window_name_matches(&win, name_hint.as_deref()) {
            return Some(win);
        }
    }
    None
}

fn window_name_matches(el: &IUIAutomationElement, hint: Option<&str>) -> bool {
    let Some(hint) = hint.filter(|s| !s.is_empty()) else {
        return true;
    };
    unsafe {
        let Ok(title) = el.CurrentName() else {
            return false;
        };
        let title = title.to_string();
        if title == hint {
            return true;
        }
        let core = hint.trim_end_matches('*').trim();
        if !core.is_empty() && (title.contains(core) || hint.contains(&title)) {
            return true;
        }
        title.contains("Notepad") && hint.contains("Notepad")
    }
}

fn list_windows_by_class(
    automation: &IUIAutomation,
    class_name: Option<String>,
) -> Vec<IUIAutomationElement> {
    unsafe {
        let Ok(root) = automation.GetRootElement() else {
            return vec![];
        };
        let Ok(true_cond) = automation.CreateTrueCondition() else {
            return vec![];
        };
        let Ok(arr) = root.FindAll(TreeScope_Children, &true_cond) else {
            return vec![];
        };
        let Ok(len) = arr.Length() else {
            return vec![];
        };
        let mut out = Vec::new();
        for i in 0..len {
            let Ok(el) = arr.GetElement(i) else {
                continue;
            };
            if el.CurrentControlType().map(|t| t.0).unwrap_or(0) != WINDOW_CONTROL_TYPE {
                continue;
            }
            if let Some(ref want) = class_name {
                let Ok(cls) = el.CurrentClassName() else {
                    continue;
                };
                if cls.to_string() != *want {
                    continue;
                }
            }
            out.push(el);
        }
        out
    }
}

fn find_by_automation_id(
    automation: &IUIAutomation,
    scope: &IUIAutomationElement,
    automation_id: &str,
) -> Option<IUIAutomationElement> {
    unsafe {
        let value = VARIANT::from(automation_id);
        let cond = automation
            .CreatePropertyCondition(UIA_AutomationIdPropertyId, &value)
            .ok()?;
        scope.FindFirst(TreeScope_Descendants, &cond).ok()
    }
}

/// Tâm bounds **hiện tại** của phần tử (sau khi cửa sổ đã di chuyển).
pub fn live_click_point(element: &IUIAutomationElement) -> Option<(i32, i32)> {
    unsafe {
        let rect = element.CurrentBoundingRectangle().ok()?;
        let w = rect.right - rect.left;
        let h = rect.bottom - rect.top;
        if w <= 0 || h <= 0 {
            return None;
        }
        Some((rect.left + w / 2, rect.top + h / 2))
    }
}

pub fn invoke_element(element: &IUIAutomationElement) -> bool {
    use windows::Win32::UI::Accessibility::{IUIAutomationInvokePattern, UIA_InvokePatternId};
    unsafe {
        if let Ok(pattern) = element.GetCurrentPatternAs::<IUIAutomationInvokePattern>(UIA_InvokePatternId) {
            if pattern.Invoke().is_ok() {
                return true;
            }
        }
        false
    }
}

/// Invoke theo cây UIA (automationId). Trả về `Some("find")` nếu thành công.
pub fn try_invoke_by_find(uia: &Value) -> bool {
    let Some(el) = find_target_element(uia) else {
        return false;
    };
    invoke_element(&el)
}

/// Tọa độ click từ phần tử live (ưu tiên hơn bounds đã ghi).
pub fn live_resolve_click_point(uia: &Value) -> Option<(i32, i32)> {
    find_target_element(uia).and_then(|el| live_click_point(&el))
}
