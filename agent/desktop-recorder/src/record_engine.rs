use crate::convert::{is_stop_key, RecorderState};
use crate::store::{save_recording, SavedRecording};
use rdev::{listen, Event, EventType};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

const STOP_STATE_LOCK_TIMEOUT: Duration = Duration::from_secs(3);

/// Hình chữ nhật pixel vật lý (left, top, right, bottom) — bỏ qua ghi input trong vùng app.
type ExcludePhys = (i32, i32, i32, i32);

pub struct RecordEngine {
    session: Mutex<Option<RecordingSession>>,
    stop_requested: AtomicBool,
    hotkey_stop: AtomicBool,
    recording: AtomicBool,
    step_count_cache: AtomicUsize,
    exclude_phys: Mutex<Option<ExcludePhys>>,
    listener_failed: AtomicBool,
}

struct RecordingSession {
    state: Arc<Mutex<RecorderState>>,
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
                session: Mutex::new(None),
                stop_requested: AtomicBool::new(false),
                hotkey_stop: AtomicBool::new(false),
                recording: AtomicBool::new(false),
                step_count_cache: AtomicUsize::new(0),
                exclude_phys: Mutex::new(None),
                listener_failed: AtomicBool::new(false),
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
            let eng_err = self.clone();
            thread::spawn(move || {
                if let Err(e) = listen(move |event| {
                    eng.on_event(event);
                }) {
                    eprintln!("[desktop-recorder] global hook failed: {e:?}");
                    eng_err.listener_failed.store(true, Ordering::SeqCst);
                }
            });
        });
    }

    /// Hook listener đã chết — GUI có thể hiện toast.
    pub fn take_listener_failed(&self) -> bool {
        self.listener_failed.swap(false, Ordering::SeqCst)
    }

    /// Cập nhật vùng cửa sổ app (pixel vật lý) — gọi mỗi frame từ GUI.
    pub fn set_exclude_rect_phys(&self, rect: Option<ExcludePhys>) {
        if let Ok(mut g) = self.exclude_phys.lock() {
            *g = rect;
        }
    }

    fn point_in_exclude_zone(&self, x: i32, y: i32) -> bool {
        let Ok(guard) = self.exclude_phys.lock() else {
            return false;
        };
        let Some((left, top, right, bottom)) = *guard else {
            return false;
        };
        x >= left && x <= right && y >= top && y <= bottom
    }

    fn cursor_in_exclude_zone(&self) -> bool {
        cursor_physical_point().is_some_and(|(x, y)| self.point_in_exclude_zone(x, y))
    }

    fn should_skip_user_input(&self, event: &Event) -> bool {
        match event.event_type {
            EventType::ButtonPress(_) => cursor_physical_point()
                .is_some_and(|(x, y)| self.point_in_exclude_zone(x, y)),
            EventType::Wheel { .. } => self.cursor_in_exclude_zone(),
            _ => false,
        }
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
        if self.should_skip_user_input(&event) {
            return;
        }

        // MouseMove flood hook — chỉ cần khi đang ghi, xử lý trong state.
        if matches!(event.event_type, EventType::MouseMove { .. }) {
            let state_arc = self.current_state_arc();
            let Some(state_arc) = state_arc else {
                return;
            };
            if let Ok(mut state) = state_arc.try_lock() {
                state.on_event(event);
            }
            return;
        }

        let state_arc = self.current_state_arc();
        let Some(state_arc) = state_arc else {
            return;
        };
        let step_count = {
            let Ok(mut state) = state_arc.try_lock() else {
                return;
            };
            state.on_event(event);
            state.step_count()
        };
        self.step_count_cache.store(step_count, Ordering::Relaxed);
    }

    fn current_state_arc(&self) -> Option<Arc<Mutex<RecorderState>>> {
        let guard = self.session.try_lock().ok()?;
        guard.as_ref().map(|s| s.state.clone())
    }

    pub fn is_recording(&self) -> bool {
        self.recording.load(Ordering::Relaxed) && !self.stop_requested.load(Ordering::SeqCst)
    }

    pub fn step_count(&self) -> usize {
        self.step_count_cache.load(Ordering::Relaxed)
    }

    pub fn start(
        &self,
        name: String,
        capture_uia: bool,
        show_highlight: bool,
    ) -> Result<(), String> {
        if self.listener_failed.load(Ordering::SeqCst) {
            return Err(
                "Hook chuột/phím không khả dụng — khởi động lại app hoặc chạy với quyền admin."
                    .into(),
            );
        }

        #[cfg(windows)]
        stationhub_windows_uia::enable_per_monitor_v2();

        let mut guard = self.session.lock().map_err(|_| "lock poisoned")?;
        if guard.is_some() {
            return Err("Đang ghi một bản ghi khác.".into());
        }
        self.stop_requested.store(false, Ordering::SeqCst);
        self.hotkey_stop.store(false, Ordering::SeqCst);
        self.step_count_cache.store(0, Ordering::Relaxed);
        #[cfg(windows)]
        if show_highlight {
            stationhub_windows_uia::highlight_worker_start();
        }
        *guard = Some(RecordingSession {
            state: Arc::new(Mutex::new(RecorderState::new(capture_uia))),
            draft_name: name,
            capture_uia,
            show_highlight,
        });
        self.recording.store(true, Ordering::SeqCst);
        Ok(())
    }

    fn stop_highlight(session: &RecordingSession) {
        #[cfg(windows)]
        if session.show_highlight {
            stationhub_windows_uia::highlight_worker_stop();
        }
    }

    pub fn stop_and_save(&self) -> Result<SavedRecording, String> {
        self.stop_requested.store(true, Ordering::SeqCst);
        self.recording.store(false, Ordering::SeqCst);
        let mut guard = self.session.lock().map_err(|_| "lock poisoned")?;
        let Some(session) = guard.take() else {
            return Err("Không có phiên ghi đang chạy.".into());
        };
        Self::stop_highlight(&session);
        self.step_count_cache.store(0, Ordering::Relaxed);
        let deadline = Instant::now() + STOP_STATE_LOCK_TIMEOUT;
        let mut state = loop {
            match session.state.try_lock() {
                Ok(guard) => break guard,
                Err(_) if Instant::now() < deadline => {
                    thread::sleep(Duration::from_millis(10));
                }
                Err(_) => {
                    return Err(
                        "Không dừng được phiên ghi — UIA có thể đang treo (vd. Zalo). \
                         Tắt «Bắt UIA» / «Hiện viền» rồi thử lại."
                            .into(),
                    );
                }
            }
        };
        let steps = state.flush_and_take_steps();
        if steps.is_empty() {
            return Err("Không có bước nào được ghi.".into());
        }
        save_recording(&session.draft_name, &steps, session.capture_uia).map_err(|e| e.to_string())
    }

    pub fn cancel(&self) {
        self.stop_requested.store(true, Ordering::SeqCst);
        self.recording.store(false, Ordering::SeqCst);
        self.step_count_cache.store(0, Ordering::Relaxed);
        if let Ok(mut guard) = self.session.lock() {
            if let Some(session) = guard.take() {
                Self::stop_highlight(&session);
            }
        }
    }

    pub fn take_hotkey_stop(&self) -> bool {
        self.hotkey_stop.swap(false, Ordering::SeqCst)
    }
}

fn cursor_physical_point() -> Option<(i32, i32)> {
    #[cfg(windows)]
    {
        stationhub_windows_uia::physical_cursor_point()
    }
    #[cfg(not(windows))]
    {
        None
    }
}
