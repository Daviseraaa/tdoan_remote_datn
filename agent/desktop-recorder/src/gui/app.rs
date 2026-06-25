use eframe::egui::{self, Vec2, ViewportCommand};
use std::path::PathBuf;
use std::sync::{mpsc, Arc};
use std::time::{Duration, Instant};

use crate::record_engine::{engine, RecordEngine};
use crate::replay::run_replay;
use crate::store::{list_recordings, RecordingMeta};

use super::theme::{
    LIST_PANEL_W, SCREEN_EDGE_MARGIN, SETTINGS_PANEL_W, SIDE_GAP, TOOLTIP_GUTTER, TOOLBAR_H,
    TOOLBAR_W,
};
use super::toast::Toast;

#[derive(Default, PartialEq, Eq)]
pub enum BusyMode {
    #[default]
    None,
    Recording,
    Replaying,
}

pub struct RecorderApp {
    pub recordings: Vec<RecordingMeta>,
    pub new_name: String,
    pub capture_uia: bool,
    pub show_highlight: bool,
    pub list_open: bool,
    pub settings_open: bool,
    pub last_refresh: Instant,
    pub busy: BusyMode,
    pub replay_rx: Option<mpsc::Receiver<(bool, String)>>,
    pub toast: Option<Toast>,
    last_viewport_size: Vec2,
    positioned: bool,
}

impl RecorderApp {
    pub fn new() -> Self {
        Self {
            recordings: list_recordings().unwrap_or_default(),
            new_name: String::new(),
            capture_uia: true,
            show_highlight: true,
            list_open: false,
            settings_open: false,
            last_refresh: Instant::now(),
            busy: BusyMode::None,
            replay_rx: None,
            toast: None,
            last_viewport_size: Vec2::new(TOOLBAR_W + TOOLTIP_GUTTER, TOOLBAR_H),
            positioned: false,
        }
    }

    fn place_left_center(&mut self, ctx: &egui::Context) {
        if self.positioned {
            return;
        }
        let cmd = ctx.input(|i| {
            let monitor_size = i.viewport().monitor_size?;
            let size = i
                .viewport()
                .outer_rect
                .or(i.viewport().inner_rect)
                .map(|r| r.size())
                .unwrap_or_else(|| Vec2::new(TOOLBAR_W + TOOLTIP_GUTTER, TOOLBAR_H));
            if monitor_size.x <= 1.0 || monitor_size.y <= 1.0 {
                return None;
            }
            Some(ViewportCommand::OuterPosition(egui::pos2(
                SCREEN_EDGE_MARGIN,
                (monitor_size.y - size.y) / 2.0,
            )))
        });
        if let Some(cmd) = cmd {
            ctx.send_viewport_cmd(cmd);
            self.positioned = true;
        }
    }

    pub fn refresh_list(&mut self) {
        self.recordings = list_recordings().unwrap_or_default();
    }

    pub fn show_toast(&mut self, msg: impl Into<String>, ok: bool) {
        self.toast = Some(Toast::new(msg, ok));
    }

    pub fn poll_toast(&mut self) {
        if self.toast.as_ref().is_some_and(|t| t.expired()) {
            self.toast = None;
        }
    }

    pub fn is_busy(&self) -> bool {
        self.busy != BusyMode::None
    }

    pub fn side_panel_open(&self) -> bool {
        self.list_open || self.settings_open
    }

    fn side_panel_width(&self) -> f32 {
        if self.list_open {
            LIST_PANEL_W
        } else if self.settings_open {
            SETTINGS_PANEL_W
        } else {
            0.0
        }
    }

    fn sync_exclude_rect(&self, ctx: &egui::Context, eng: &RecordEngine) {
        let rect = ctx.input(|i| {
            let outer = i.viewport().outer_rect?;
            let scale = i.viewport().native_pixels_per_point.unwrap_or(1.0);
            Some((
                (outer.min.x * scale).round() as i32,
                (outer.min.y * scale).round() as i32,
                (outer.max.x * scale).round() as i32,
                (outer.max.y * scale).round() as i32,
            ))
        });
        eng.set_exclude_rect_phys(rect);
    }

    pub fn sync_viewport_size(&mut self, ctx: &egui::Context) {
        let side_w = self.side_panel_width();
        let w = if side_w > 0.0 {
            TOOLBAR_W + side_w + SIDE_GAP
        } else {
            TOOLBAR_W + TOOLTIP_GUTTER
        };
        // Chiều cao cửa sổ luôn bằng toolbar (tab mở rộng ngang, không kéo dài dọc).
        let h = TOOLBAR_H;
        let size = Vec2::new(w, h);
        if (size - self.last_viewport_size).length_sq() > 0.25 {
            ctx.send_viewport_cmd(ViewportCommand::InnerSize(size));
            ctx.send_viewport_cmd(ViewportCommand::MinInnerSize(size));
            self.last_viewport_size = size;
        }
    }

    pub fn start_recording(&mut self) {
        match engine().start(self.new_name.clone(), self.capture_uia, self.show_highlight) {
            Ok(()) => {
                self.busy = BusyMode::Recording;
                self.show_toast("Đang ghi — F12 hoặc nút Stop để dừng.", true);
            }
            Err(e) => self.show_toast(format!("Không bắt đầu được: {e}"), false),
        }
    }

    pub fn finish_recording(&mut self, saved: Result<crate::store::SavedRecording, String>) {
        self.busy = BusyMode::None;
        match saved {
            Ok(saved) => {
                self.refresh_list();
                let steps = self
                    .recordings
                    .iter()
                    .find(|r| r.id == saved.id)
                    .map(|r| r.step_count)
                    .unwrap_or(0);
                self.show_toast(format!("Đã lưu «{}» — {steps} bước", saved.name), true);
            }
            Err(e) => {
                let msg = if e.contains("Không có bước nào") {
                    "Đã dừng ghi — không có bước nào để lưu.".into()
                } else {
                    format!("Lỗi lưu: {e}")
                };
                self.show_toast(msg, false);
            }
        }
    }

    pub fn cancel_recording(&mut self) {
        engine().cancel();
        self.busy = BusyMode::None;
        self.show_toast("Đã hủy phiên ghi.", true);
    }

    pub fn stop_recording(&mut self, eng: &Arc<RecordEngine>) {
        if matches!(self.busy, BusyMode::Recording) {
            let result = eng.stop_and_save().map_err(|e| e.to_string());
            self.finish_recording(result);
            return;
        }
        if eng.is_recording() {
            let result = eng.stop_and_save().map_err(|e| e.to_string());
            self.finish_recording(result);
        }
    }

    pub fn poll_stop_hotkey(&mut self, ctx: &egui::Context, eng: &Arc<RecordEngine>) {
        let f12_pressed = ctx.input(|i| i.key_pressed(egui::Key::F12));
        if (eng.take_hotkey_stop() || f12_pressed)
            && (eng.is_recording() || matches!(self.busy, BusyMode::Recording))
        {
            self.stop_recording(eng);
        }
    }

    pub fn start_replay(&mut self, path: PathBuf, name: String) {
        let (tx, rx) = mpsc::channel();
        self.replay_rx = Some(rx);
        self.busy = BusyMode::Replaying;
        self.show_toast(format!("Chạy lại «{name}» — chuyển sang cửa sổ đích trong 2 giây"), true);

        std::thread::spawn(move || {
            let outcome = run_replay(&path);
            let _ = tx.send((outcome.ok, outcome.message));
        });
    }

    pub fn poll_replay(&mut self) {
        let Some(rx) = &self.replay_rx else {
            return;
        };
        if let Ok((ok, msg)) = rx.try_recv() {
            self.replay_rx = None;
            self.busy = BusyMode::None;
            let display = if msg.is_empty() {
                if ok {
                    "Chạy lại hoàn tất.".into()
                } else {
                    "Chạy lại thất bại.".into()
                }
            } else {
                msg
            };
            self.show_toast(display, ok);
        }
    }

    pub fn toggle_list(&mut self, ctx: &egui::Context) {
        self.list_open = !self.list_open;
        if self.list_open {
            self.settings_open = false;
            self.refresh_list();
        }
        self.sync_viewport_size(ctx);
    }

    pub fn toggle_settings(&mut self, ctx: &egui::Context) {
        self.settings_open = !self.settings_open;
        if self.settings_open {
            self.list_open = false;
        }
        self.sync_viewport_size(ctx);
    }
}

impl eframe::App for RecorderApp {
    fn clear_color(&self, _visuals: &egui::Visuals) -> [f32; 4] {
        [0.0, 0.0, 0.0, 0.0]
    }

    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let eng = engine();
        self.sync_exclude_rect(ctx, &eng);
        self.poll_stop_hotkey(ctx, &eng);
        if eng.take_listener_failed() {
            self.show_toast(
                "Hook chuột/phím bị lỗi — khởi động lại app hoặc chạy với quyền admin.",
                false,
            );
            if matches!(self.busy, BusyMode::Recording) {
                engine().cancel();
                self.busy = BusyMode::None;
            }
        }
        self.poll_replay();
        self.poll_toast();

        self.place_left_center(ctx);

        if self.list_open && self.last_refresh.elapsed().as_secs() >= 5 && !self.is_busy() {
            self.refresh_list();
            self.last_refresh = Instant::now();
        }

        if self.is_busy() {
            ctx.request_repaint_after(Duration::from_millis(250));
        }
        if self.toast.is_some() {
            ctx.request_repaint_after(Duration::from_millis(200));
        }

        self.sync_viewport_size(ctx);

        egui::CentralPanel::default()
            .frame(egui::Frame::none())
            .show(ctx, |ui| {
                ui.spacing_mut().item_spacing = egui::vec2(0.0, 0.0);
                ui.set_min_height(TOOLBAR_H);
                ui.set_max_height(TOOLBAR_H);
                ui.horizontal_top(|ui| {
                    egui::Frame::none()
                        .fill(super::theme::SURFACE)
                        .inner_margin(0.0)
                        .stroke(egui::Stroke::new(1.0, super::theme::BORDER))
                        .show(ui, |ui| {
                            super::toolbar::draw(self, ui, ctx, &eng);
                        });
                    if self.list_open {
                        ui.add_space(SIDE_GAP);
                        super::list_panel::draw(self, ui);
                    } else if self.settings_open {
                        ui.add_space(SIDE_GAP);
                        super::settings::draw(self, ui);
                    }
                });
            });

        if let Some(toast) = &self.toast {
            if let Some(parent_outer) = ctx.input(|i| i.viewport().outer_rect) {
                super::toast::show(ctx, toast, parent_outer);
            }
        }
    }
}
