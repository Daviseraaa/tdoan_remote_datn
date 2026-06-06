use crate::convert::{is_stop_key, RecorderState};
use crate::store::{save_recording, SavedRecording};
use rdev::{listen, Event};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;

pub struct RecordEngine {
    active: Mutex<Option<ActiveRecorder>>,
    stop_requested: AtomicBool,
    hotkey_stop: AtomicBool,
}

struct ActiveRecorder {
    state: RecorderState,
    draft_name: String,
    capture_uia: bool,
    show_highlight: bool,
}

static ENGINE: OnceLock<Arc<RecordEngine>> = OnceLock::new();
static LISTENER_STARTED: OnceLock<()> = OnceLock::new();

pub fn engine() -> Arc<RecordEngine> {
    ENGINE
        .get_or_init(|| {
            let eng = Arc::new(RecordEngine {
                active: Mutex::new(None),
                stop_requested: AtomicBool::new(false),
                hotkey_stop: AtomicBool::new(false),
            });
            eng.clone().ensure_listener();
            eng
        })
        .clone()
}

impl RecordEngine {
    fn ensure_listener(self: Arc<Self>) {
        LISTENER_STARTED.get_or_init(|| {
            let eng = self.clone();
            thread::spawn(move || {
                let _ = listen(move |event| {
                    eng.on_event(event);
                });
            });
        });
    }

    fn on_event(&self, event: Event) {
        if is_stop_key(&event) {
            if self.is_recording() {
                self.hotkey_stop.store(true, Ordering::SeqCst);
            }
            return;
        }
        if self.stop_requested.load(Ordering::SeqCst) {
            return;
        }
        let Ok(mut guard) = self.active.lock() else {
            return;
        };
        if let Some(rec) = guard.as_mut() {
            rec.state.on_event(event);
        }
    }

    pub fn is_recording(&self) -> bool {
        let Ok(guard) = self.active.lock() else {
            return false;
        };
        guard.is_some() && !self.stop_requested.load(Ordering::SeqCst)
    }

    pub fn step_count(&self) -> usize {
        let Ok(guard) = self.active.lock() else {
            return 0;
        };
        guard
            .as_ref()
            .map(|r| r.state.step_count())
            .unwrap_or(0)
    }

    pub fn start(
        &self,
        name: String,
        capture_uia: bool,
        show_highlight: bool,
    ) -> Result<(), String> {
        #[cfg(windows)]
        datn_windows_uia::enable_per_monitor_v2();

        let mut guard = self.active.lock().map_err(|_| "lock poisoned")?;
        if guard.is_some() {
            return Err("Đang ghi một bản ghi khác.".into());
        }
        self.stop_requested.store(false, Ordering::SeqCst);
        self.hotkey_stop.store(false, Ordering::SeqCst);
        #[cfg(windows)]
        if show_highlight {
            datn_windows_uia::highlight_worker_start();
        }
        *guard = Some(ActiveRecorder {
            state: RecorderState::new(capture_uia),
            draft_name: name,
            capture_uia,
            show_highlight,
        });
        Ok(())
    }

    fn stop_highlight(rec: &ActiveRecorder) {
        #[cfg(windows)]
        if rec.show_highlight {
            datn_windows_uia::highlight_worker_stop();
        }
    }

    pub fn stop_and_save(&self) -> Result<SavedRecording, String> {
        self.stop_requested.store(true, Ordering::SeqCst);
        let mut guard = self.active.lock().map_err(|_| "lock poisoned")?;
        let Some(mut rec) = guard.take() else {
            return Err("Không có phiên ghi đang chạy.".into());
        };
        Self::stop_highlight(&rec);
        let steps = rec.state.flush_and_take_steps();
        if steps.is_empty() {
            return Err("Không có bước nào được ghi.".into());
        }
        save_recording(&rec.draft_name, &steps, rec.capture_uia).map_err(|e| e.to_string())
    }

    pub fn cancel(&self) {
        self.stop_requested.store(true, Ordering::SeqCst);
        if let Ok(mut guard) = self.active.lock() {
            if let Some(rec) = guard.take() {
                Self::stop_highlight(&rec);
            }
        }
    }

    pub fn take_hotkey_stop(&self) -> bool {
        self.hotkey_stop.swap(false, Ordering::SeqCst)
    }
}
