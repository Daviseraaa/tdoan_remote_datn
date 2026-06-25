//! Chạy UIA trên thread riêng có timeout — tránh treo hook khi app đích (Zalo, Electron…) block `ElementFromPoint`.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use serde_json::Value;

use crate::capture::{capture_element_at_point, capture_highlight_target_at_point};

/// Thời gian chờ UIA tối đa — app Chromium (Zalo PC…) có thể treo vô hạn nếu không timeout.
pub const UIA_CAPTURE_TIMEOUT_MS: u64 = 250;

/// Sau vài lần treo, bỏ UIA cho phiên còn lại thay vì tạo thêm thread zombie.
const MAX_STUCK_UIA_THREADS: usize = 3;

static ACTIVE_UIA_THREADS: AtomicUsize = AtomicUsize::new(0);

enum CaptureKind {
    Full,
    Highlight,
}

fn run_timed(
    kind: CaptureKind,
    x: i32,
    y: i32,
    prefer_physical: bool,
    timeout_ms: u64,
) -> Option<Value> {
    if ACTIVE_UIA_THREADS.load(Ordering::Relaxed) >= MAX_STUCK_UIA_THREADS {
        return None;
    }

    let (reply_tx, reply_rx) = mpsc::channel();
    ACTIVE_UIA_THREADS.fetch_add(1, Ordering::Relaxed);
    thread::spawn(move || {
        let result = match kind {
            CaptureKind::Full => capture_element_at_point(x, y, prefer_physical),
            CaptureKind::Highlight => {
                capture_highlight_target_at_point(x, y, prefer_physical)
            }
        };
        let _ = reply_tx.send(result);
        ACTIVE_UIA_THREADS.fetch_sub(1, Ordering::Relaxed);
    });

    match reply_rx.recv_timeout(Duration::from_millis(timeout_ms)) {
        Ok(value) => value,
        Err(mpsc::RecvTimeoutError::Timeout) => None,
        Err(mpsc::RecvTimeoutError::Disconnected) => None,
    }
}

pub fn capture_element_at_point_timed(
    x: i32,
    y: i32,
    prefer_physical: bool,
) -> Option<Value> {
    run_timed(
        CaptureKind::Full,
        x,
        y,
        prefer_physical,
        UIA_CAPTURE_TIMEOUT_MS,
    )
}

pub fn capture_highlight_target_at_point_timed(
    x: i32,
    y: i32,
    prefer_physical: bool,
) -> Option<Value> {
    run_timed(
        CaptureKind::Highlight,
        x,
        y,
        prefer_physical,
        UIA_CAPTURE_TIMEOUT_MS,
    )
}

/// Số thread UIA đang chạy/treo — dùng để debug.
pub fn active_uia_thread_count() -> usize {
    ACTIVE_UIA_THREADS.load(Ordering::Relaxed)
}
