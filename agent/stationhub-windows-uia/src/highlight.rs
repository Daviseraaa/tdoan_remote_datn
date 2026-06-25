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
    CreateWindowExW, DefWindowProcW, RegisterClassW, SetLayeredWindowAttributes, SetWindowPos,
    ShowWindow, CS_HREDRAW, CS_VREDRAW, HWND_TOPMOST, LWA_ALPHA, SW_HIDE, SW_SHOWNOACTIVATE,
    WINDOW_EX_STYLE, WINDOW_STYLE, WM_DESTROY, WNDCLASSW, WS_EX_LAYERED, WS_EX_NOACTIVATE,
    WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
};

use crate::timed::capture_highlight_target_at_point_timed;
use crate::screen::physical_cursor_point;

const BAR_PX: i32 = 3;
const CLASS_NAME: &str = "StationHub_UiaHighlightBar\0";
const ACCENT_BGR: u32 = 0x00_F8_BD_38; // #38bdf8
const WORKER_INTERVAL_MS: u64 = 100;
const CURSOR_MOVE_THRESHOLD_PX: i32 = 3;

static REGISTERED: AtomicBool = AtomicBool::new(false);
static OVERLAY: Mutex<Option<BorderOverlay>> = Mutex::new(None);
static WORKER_STARTED: AtomicBool = AtomicBool::new(false);
static HIGHLIGHT_ACTIVE: AtomicBool = AtomicBool::new(false);
static LAST_CURSOR: Mutex<Option<(i32, i32)>> = Mutex::new(None);
static LAST_BOUNDS: Mutex<Option<(i32, i32, i32, i32)>> = Mutex::new(None);

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

/// Bật thread cập nhật viền theo con trỏ (~10 fps). Thread sống lâu — bật/tắt bằng `HIGHLIGHT_ACTIVE`.
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
                if let Ok(mut last) = LAST_CURSOR.lock() {
                    *last = None;
                }
                if let Ok(mut bounds) = LAST_BOUNDS.lock() {
                    *bounds = None;
                }
            }
            thread::sleep(Duration::from_millis(WORKER_INTERVAL_MS));
        }
    });
}

pub fn highlight_worker_stop() {
    HIGHLIGHT_ACTIVE.store(false, Ordering::SeqCst);
    highlight_clear();
    if let Ok(mut last) = LAST_CURSOR.lock() {
        *last = None;
    }
    if let Ok(mut bounds) = LAST_BOUNDS.lock() {
        *bounds = None;
    }
}

/// Vẽ viền tại (x,y). `prefer_physical_cursor` giống capture.
pub fn highlight_at_point(x: i32, y: i32, prefer_physical_cursor: bool) -> bool {
    if cursor_unchanged(x, y) {
        return last_bounds_visible();
    }
    store_cursor(x, y);

    let Some(target) = capture_highlight_target_at_point_timed(x, y, prefer_physical_cursor) else {
        highlight_clear();
        store_bounds(None);
        return false;
    };
    let bounds = match target.get("bounds") {
        Some(b) => b,
        None => {
            highlight_clear();
            store_bounds(None);
            return false;
        }
    };
    let left = bounds.get("left").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    let top = bounds.get("top").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    let right = bounds.get("right").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    let bottom = bounds.get("bottom").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    if right <= left || bottom <= top {
        highlight_clear();
        store_bounds(None);
        return false;
    }
    store_bounds(Some((left, top, right, bottom)));
    highlight_rect(left, top, right, bottom);
    true
}

fn cursor_unchanged(x: i32, y: i32) -> bool {
    let Ok(guard) = LAST_CURSOR.lock() else {
        return false;
    };
    guard.is_some_and(|(lx, ly)| {
        (x - lx).abs() <= CURSOR_MOVE_THRESHOLD_PX && (y - ly).abs() <= CURSOR_MOVE_THRESHOLD_PX
    })
}

fn store_cursor(x: i32, y: i32) {
    if let Ok(mut guard) = LAST_CURSOR.lock() {
        *guard = Some((x, y));
    }
}

fn store_bounds(rect: Option<(i32, i32, i32, i32)>) {
    if let Ok(mut guard) = LAST_BOUNDS.lock() {
        *guard = rect;
    }
}

fn last_bounds_visible() -> bool {
    let Ok(guard) = LAST_BOUNDS.lock() else {
        return false;
    };
    guard.is_some()
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
