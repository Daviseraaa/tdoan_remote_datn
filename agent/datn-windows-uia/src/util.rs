use serde_json::{json, Value};
use windows::core::BSTR;
use windows::Win32::Foundation::RECT;
use windows::Win32::UI::Accessibility::{IUIAutomationElement, IUIAutomationInvokePattern, UIA_InvokePatternId};

pub fn control_type_label(id: i32) -> &'static str {
    match id {
        50000 => "Button",
        50001 => "Calendar",
        50002 => "CheckBox",
        50003 => "ComboBox",
        50004 => "Edit",
        50005 => "Hyperlink",
        50006 => "Image",
        50007 => "ListItem",
        50008 => "List",
        50009 => "Menu",
        50010 => "MenuBar",
        50011 => "MenuItem",
        50012 => "ProgressBar",
        50013 => "RadioButton",
        50014 => "ScrollBar",
        50015 => "Slider",
        50016 => "Spinner",
        50017 => "StatusBar",
        50018 => "Tab",
        50019 => "TabItem",
        50020 => "Text",
        50021 => "ToolBar",
        50022 => "ToolTip",
        50023 => "Tree",
        50024 => "TreeItem",
        50025 => "Custom",
        50026 => "Group",
        50027 => "Thumb",
        50028 => "DataGrid",
        50029 => "DataItem",
        50030 => "Document",
        50031 => "SplitButton",
        50032 => "Window",
        50033 => "Pane",
        50034 => "Header",
        50035 => "HeaderItem",
        50036 => "Table",
        50037 => "TitleBar",
        50038 => "Separator",
        _ => "Control",
    }
}

pub fn bstr_opt(b: &BSTR) -> Option<String> {
    let s = b.to_string();
    if s.trim().is_empty() {
        None
    } else {
        Some(s)
    }
}

pub fn rect_json(rect: &RECT) -> Value {
    json!({
        "left": rect.left,
        "top": rect.top,
        "right": rect.right,
        "bottom": rect.bottom,
    })
}

pub fn element_snapshot(el: &IUIAutomationElement) -> Option<Value> {
    unsafe {
        let control_type_id = el.CurrentControlType().map(|t| t.0).unwrap_or(0);

        let name = el.CurrentName().ok().and_then(|b| bstr_opt(&b));
        let automation_id = el
            .CurrentAutomationId()
            .ok()
            .and_then(|b| bstr_opt(&b));
        let class_name = el.CurrentClassName().ok().and_then(|b| bstr_opt(&b));
        let bounds = el.CurrentBoundingRectangle().ok().map(|r| rect_json(&r));

        let supports_invoke = el
            .GetCurrentPatternAs::<IUIAutomationInvokePattern>(UIA_InvokePatternId)
            .is_ok();

        Some(json!({
            "controlType": control_type_label(control_type_id),
            "controlTypeId": control_type_id,
            "name": name,
            "automationId": automation_id,
            "className": class_name,
            "bounds": bounds,
            "supportsInvoke": supports_invoke,
        }))
    }
}

pub fn elements_match(expected: &Value, actual: &Value) -> bool {
    let exp_auto = expected.get("automationId").and_then(|v| v.as_str()).unwrap_or("");
    let act_auto = actual.get("automationId").and_then(|v| v.as_str()).unwrap_or("");
    if !exp_auto.is_empty() && exp_auto == act_auto {
        return true;
    }

    let exp_ct = expected.get("controlTypeId").and_then(|v| v.as_i64());
    let act_ct = actual.get("controlTypeId").and_then(|v| v.as_i64());
    let exp_name = expected.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let act_name = actual.get("name").and_then(|v| v.as_str()).unwrap_or("");

    if exp_ct == act_ct && !exp_name.is_empty() && exp_name == act_name {
        return true;
    }

    false
}
