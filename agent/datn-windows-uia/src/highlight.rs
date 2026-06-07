//! Viền overlay (topmost, click-through) quanh phần tử UIA có thể bấm.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use windows::core::PCWSTR;
use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::Graphics::Gdi::CreateSolidBrush;
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, RegisterClassW, SetLayeredWindowAttributes,
    SetWindowPos, ShowWindow, CS_HREDRAW, CS_VREDRAW, HWND_TOPMOST, LWA_ALPHA, SW_HIDE,
    SW_SHOWNOACTIVATE, WINDOW_EX_STYLE, WINDOW_STYLE, WM_DESTROY, WNDCLASSW, WS_EX_LAYERED,
    WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
};

use crate::capture::capture_element_at_point;
use crate::screen::physical_cursor_point;
use crate::util::is_interactive_control;

const BAR_PX: i32 = 3;
const CLASS_NAME: &str = "DATN_UiaHighlightBar\0";
const ACCENT_BGR: u32 = 0x00_F8_BD_38; // #38bdf8

static REGISTERED: AtomicBool = AtomicBool::new(false);
static OVERLAY: Mutex<Option<BorderOverlay>> = Mutex::new(None);
static WORKER_STARTED: AtomicBool = AtomicBool::new(false);
static HIGHLIGHT_ACTIVE: AtomicBool = AtomicBool::new(false);

struct BorderOverlay {
    bars: [isize; 4],
}

unsafe impl Send for BorderOverlay {}
unsafe impl Sync for BorderOverlay {}

fn hwnd_from_raw(raw: isize) -> HWND {
    HWND(raw as *mut core::ffi::c_void)
}

fn hwnd_to_raw(hwnd: HWND) -> isize {
    hwnd.0 as isize
}

/// Bật thread cập nhật viền theo con trỏ (~15 fps). Thread sống lâu — bật/tắt bằng `HIGHLIGHT_ACTIVE`.
pub fn highlight_worker_start() {
    HIGHLIGHT_ACTIVE.store(true, Ordering::SeqCst);
    if WORKER_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }
    thread::spawn(|| {
        loop {
            if HIGHLIGHT_ACTIVE.load(Ordering::SeqCst) {
                if let Some((x, y)) = physical_cursor_point() {
                    let _ = highlight_at_point(x, y, true);
                }
            } else {
                highlight_clear();
            }
            thread::sleep(Duration::from_millis(66));
        }
    });
}

pub fn highlight_worker_stop() {
    HIGHLIGHT_ACTIVE.store(false, Ordering::SeqCst);
    highlight_clear();
}

/// Vẽ viền tại (x,y). `prefer_physical_cursor` giống capture.
pub fn highlight_at_point(x: i32, y: i32, prefer_physical_cursor: bool) -> bool {
    let Some(uia) = capture_element_at_point(x, y, prefer_physical_cursor) else {
        highlight_clear();
        return false;
    };
    let target = match uia.get("target") {
        Some(t) => t,
        None => {
            highlight_clear();
            return false;
        }
    };
    if !is_interactive_control(target) {
        highlight_clear();
        return false;
    }
    let bounds = match target.get("bounds") {
        Some(b) => b,
        None => {
            highlight_clear();
            return false;
        }
    };
    let left = bounds.get("left").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    let top = bounds.get("top").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    let right = bounds.get("right").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    let bottom = bounds.get("bottom").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    if right <= left || bottom <= top {
        highlight_clear();
        return false;
    }
    highlight_rect(left, top, right, bottom);
    true
}

pub fn highlight_clear() {
    if let Ok(guard) = OVERLAY.lock() {
        if let Some(ref o) = *guard {
            unsafe {
                for raw in o.bars {
                    if raw != 0 {
                        let _ = ShowWindow(hwnd_from_raw(raw), SW_HIDE);
                    }
                }
            }
        }
    }
}

fn highlight_rect(left: i32, top: i32, right: i32, bottom: i32) {
    let w = right - left;
    let h = bottom - top;
    if w < 2 || h < 2 {
        highlight_clear();
        return;
    }
    let Ok(mut guard) = OVERLAY.lock() else {
        return;
    };
    if guard.is_none() {
        *guard = Some(create_overlay().unwrap_or_else(|_| BorderOverlay { bars: [0; 4] }));
    }
    let Some(ref o) = *guard else {
        return;
    };
    if o.bars[0] == 0 {
        return;
    }
    unsafe {
        place_bar(hwnd_from_raw(o.bars[0]), left, top, w, BAR_PX);
        place_bar(hwnd_from_raw(o.bars[1]), left, bottom - BAR_PX, w, BAR_PX);
        place_bar(hwnd_from_raw(o.bars[2]), left, top, BAR_PX, h);
        place_bar(hwnd_from_raw(o.bars[3]), right - BAR_PX, top, BAR_PX, h);
        for raw in o.bars {
            if raw != 0 {
                let _ = ShowWindow(hwnd_from_raw(raw), SW_SHOWNOACTIVATE);
            }
        }
    }
}

unsafe fn place_bar(hwnd: HWND, x: i32, y: i32, w: i32, h: i32) {
    let _ = SetWindowPos(
        hwnd,
        HWND_TOPMOST,
        x,
        y,
        w.max(1),
        h.max(1),
        windows::Win32::UI::WindowsAndMessaging::SWP_NOACTIVATE,
    );
}

fn create_overlay() -> windows::core::Result<BorderOverlay> {
    ensure_class()?;
    let mut bars = [0isize; 4];
    for b in &mut bars {
        *b = hwnd_to_raw(create_bar()?);
    }
    Ok(BorderOverlay { bars })
}

fn create_bar() -> windows::core::Result<HWND> {
    unsafe {
        let hwnd = CreateWindowExW(
            WINDOW_EX_STYLE(
                WS_EX_LAYERED.0
                    | WS_EX_TOPMOST.0
                    | WS_EX_TRANSPARENT.0
                    | WS_EX_TOOLWINDOW.0
                    | WS_EX_NOACTIVATE.0,
            ),
            PCWSTR(class_name_wide().as_ptr()),
            PCWSTR::null(),
            WINDOW_STYLE(WS_POPUP.0),
            0,
            0,
            1,
            1,
            None,
            None,
            GetModuleHandleW(None)?,
            None,
        )?;
        let _ = SetLayeredWindowAttributes(hwnd, COLORREF(0), 220, LWA_ALPHA);
        let _ = ShowWindow(hwnd, SW_HIDE);
        Ok(hwnd)
    }
}

fn ensure_class() -> windows::core::Result<()> {
    if REGISTERED.load(Ordering::SeqCst) {
        return Ok(());
    }
    unsafe {
        let brush = CreateSolidBrush(COLORREF(ACCENT_BGR));
        let name = class_name_wide();
        let wc = WNDCLASSW {
            style: CS_HREDRAW | CS_VREDRAW,
            lpfnWndProc: Some(wnd_proc),
            hInstance: GetModuleHandleW(None)?.into(),
            hCursor: Default::default(),
            hbrBackground: brush,
            lpszClassName: PCWSTR(name.as_ptr()),
            ..Default::default()
        };
        RegisterClassW(&wc);
    }
    REGISTERED.store(true, Ordering::SeqCst);
    Ok(())
}

unsafe extern "system" fn wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if msg == WM_DESTROY {
        return LRESULT(0);
    }
    DefWindowProcW(hwnd, msg, wparam, lparam)
}

fn class_name_wide() -> Vec<u16> {
    CLASS_NAME.encode_utf16().collect()
}

/// Viền nháy một lần trước click (replay).
pub fn flash_bounds(left: i32, top: i32, right: i32, bottom: i32, hold_ms: u64) {
    highlight_rect(left, top, right, bottom);
    thread::sleep(Duration::from_millis(hold_ms));
    highlight_clear();
}
