//! Đưa cửa sổ host lên foreground trước khi click/type trên desktop.

use serde_json::Value;
use windows::Win32::Foundation::HWND;
use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
use windows::Win32::UI::Accessibility::IUIAutomationElement;
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowThreadProcessId, IsIconic, SetForegroundWindow, ShowWindow,
    SW_RESTORE,
};

use crate::find::resolve_host_window;

const FOCUS_SETTLE_MS: u64 = 80;

/// Focus cửa sổ app liên quan tới bước (từ `uia.ancestors` / `automationId`).
pub fn focus_host_for_step(step: &Value) -> bool {
    let Some(uia) = step.get("uia") else {
        return false;
    };
    focus_host_for_uia(uia)
}

pub fn focus_host_for_uia(uia: &Value) -> bool {
    let Some(win) = resolve_host_window(uia) else {
        return false;
    };
    focus_window_element(&win)
}

pub fn focus_settle_ms() -> u64 {
    FOCUS_SETTLE_MS
}

fn focus_window_element(win: &IUIAutomationElement) -> bool {
    let mut ok = false;
    unsafe {
        if win.SetFocus().is_ok() {
            ok = true;
        }
    }
    if let Some(hwnd) = hwnd_from_element(win) {
        if set_foreground_hwnd(hwnd) {
            ok = true;
        }
    }
    ok
}

fn hwnd_from_element(el: &IUIAutomationElement) -> Option<HWND> {
    unsafe { el.CurrentNativeWindowHandle().ok() }
}

fn set_foreground_hwnd(hwnd: HWND) -> bool {
    if hwnd.0.is_null() {
        return false;
    }
    unsafe {
        if IsIconic(hwnd).as_bool() {
            let _ = ShowWindow(hwnd, SW_RESTORE);
        }

        let fg = GetForegroundWindow();
        let mut fg_pid = Default::default();
        let mut target_pid = Default::default();
        let fg_thread = GetWindowThreadProcessId(fg, Some(&mut fg_pid));
        let target_thread = GetWindowThreadProcessId(hwnd, Some(&mut target_pid));
        let cur_thread = GetCurrentThreadId();

        if target_thread != 0 && target_thread != fg_thread {
            let _ = AttachThreadInput(cur_thread, target_thread, true);
            if fg_thread != 0 {
                let _ = AttachThreadInput(fg_thread, target_thread, true);
            }
            let _ = SetForegroundWindow(hwnd);
            if fg_thread != 0 {
                let _ = AttachThreadInput(fg_thread, target_thread, false);
            }
            let _ = AttachThreadInput(cur_thread, target_thread, false);
        } else {
            let _ = SetForegroundWindow(hwnd);
        }

        SetForegroundWindow(hwnd).as_bool()
    }
}
