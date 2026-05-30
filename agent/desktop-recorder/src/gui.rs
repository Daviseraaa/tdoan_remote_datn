use crate::fonts::setup_ui_fonts;
use crate::record_engine::engine;
use crate::replay::run_replay;
use crate::store::{delete_recording, list_recordings, open_recordings_folder, RecordingMeta};
use eframe::egui::{self, Color32, RichText, Stroke, ViewportCommand};
use std::path::PathBuf;
use std::sync::mpsc;

const ACCENT: Color32 = Color32::from_rgb(56, 189, 248);
const ACCENT_DIM: Color32 = Color32::from_rgb(14, 116, 144);
const SURFACE: Color32 = Color32::from_rgb(24, 24, 27);
const SURFACE_2: Color32 = Color32::from_rgb(39, 39, 42);
const BORDER: Color32 = Color32::from_rgb(63, 63, 70);
const TEXT_DIM: Color32 = Color32::from_rgb(161, 161, 170);
const DANGER: Color32 = Color32::from_rgb(248, 113, 113);
const SUCCESS: Color32 = Color32::from_rgb(74, 222, 128);

pub fn run() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([980.0, 620.0])
            .with_min_inner_size([760.0, 480.0]),
        ..Default::default()
    };
    eframe::run_native(
        "DATN Desktop Recorder",
        options,
        Box::new(|cc| {
            setup_ui_fonts(&cc.egui_ctx);
            setup_theme(&cc.egui_ctx);
            Ok(Box::new(RecorderApp::new()))
        }),
    )
}

fn setup_theme(ctx: &egui::Context) {
    let mut style = (*ctx.style()).clone();
    style.visuals.window_fill = SURFACE;
    style.visuals.panel_fill = SURFACE;
    style.visuals.extreme_bg_color = Color32::from_rgb(9, 9, 11);
    style.visuals.faint_bg_color = SURFACE_2;
    style.visuals.widgets.noninteractive.bg_fill = SURFACE_2;
    style.visuals.widgets.inactive.bg_fill = SURFACE_2;
    style.visuals.widgets.hovered.bg_fill = Color32::from_rgb(52, 52, 58);
    style.visuals.widgets.active.bg_fill = ACCENT_DIM;
    style.visuals.selection.bg_fill = ACCENT_DIM.gamma_multiply(0.35);
    style.visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0, TEXT_DIM);
    style.spacing.item_spacing = egui::vec2(10.0, 8.0);
    style.spacing.button_padding = egui::vec2(12.0, 8.0);
    ctx.set_style(style);
}

#[derive(Default, PartialEq, Eq)]
enum BusyMode {
    #[default]
    None,
    Recording,
    Replaying,
}

struct RecorderApp {
    recordings: Vec<RecordingMeta>,
    selected_id: Option<String>,
    new_name: String,
    filter: String,
    status: String,
    status_ok: bool,
    last_refresh: std::time::Instant,
    busy: BusyMode,
    replay_rx: Option<mpsc::Receiver<(bool, String)>>,
}

impl RecorderApp {
    fn new() -> Self {
        let recordings = list_recordings().unwrap_or_default();
        Self {
            selected_id: recordings.first().map(|r| r.id.clone()),
            recordings,
            new_name: String::new(),
            filter: String::new(),
            status: "Sẵn sàng.".into(),
            status_ok: true,
            last_refresh: std::time::Instant::now(),
            busy: BusyMode::None,
            replay_rx: None,
        }
    }

    fn refresh_list(&mut self) {
        self.recordings = list_recordings().unwrap_or_default();
        if let Some(id) = &self.selected_id {
            if !self.recordings.iter().any(|r| &r.id == id) {
                self.selected_id = self.recordings.first().map(|r| r.id.clone());
            }
        }
    }

    fn selected_meta(&self) -> Option<&RecordingMeta> {
        let id = self.selected_id.as_ref()?;
        self.recordings.iter().find(|r| &r.id == id)
    }

    fn filtered_recordings(&self) -> Vec<&RecordingMeta> {
        let q = self.filter.trim().to_lowercase();
        self.recordings
            .iter()
            .filter(|r| {
                q.is_empty()
                    || r.name.to_lowercase().contains(&q)
                    || r.id.to_lowercase().contains(&q)
            })
            .collect()
    }

    fn set_status(&mut self, msg: impl Into<String>, ok: bool) {
        self.status = msg.into();
        self.status_ok = ok;
    }

    fn minimize_window(&self, ctx: &egui::Context) {
        ctx.send_viewport_cmd(ViewportCommand::Minimized(true));
    }

    fn restore_window(&self, ctx: &egui::Context) {
        ctx.send_viewport_cmd(ViewportCommand::Minimized(false));
        ctx.send_viewport_cmd(ViewportCommand::Focus);
    }

    fn is_busy(&self) -> bool {
        self.busy != BusyMode::None
    }

    fn start_recording(&mut self, ctx: &egui::Context) {
        match engine().start(self.new_name.clone()) {
            Ok(()) => {
                self.busy = BusyMode::Recording;
                self.set_status("Đang ghi — nhấn F12 để dừng và lưu.", true);
                self.minimize_window(ctx);
            }
            Err(e) => self.set_status(format!("Không bắt đầu được: {e}"), false),
        }
    }

    fn finish_recording(&mut self, ctx: &egui::Context, saved: Result<crate::store::SavedRecording, String>) {
        self.busy = BusyMode::None;
        self.restore_window(ctx);
        match saved {
            Ok(saved) => {
                self.refresh_list();
                let steps = self
                    .recordings
                    .iter()
                    .find(|r| r.id == saved.id)
                    .map(|r| r.step_count)
                    .unwrap_or(0);
                self.set_status(format!("Đã lưu «{}» — {steps} bước", saved.name), true);
                self.selected_id = Some(saved.id);
            }
            Err(e) => self.set_status(format!("Lỗi lưu: {e}"), false),
        }
    }

    fn cancel_recording(&mut self, ctx: &egui::Context) {
        engine().cancel();
        self.busy = BusyMode::None;
        self.restore_window(ctx);
        self.set_status("Đã hủy phiên ghi.", true);
    }

    fn start_replay(&mut self, ctx: &egui::Context, path: PathBuf, name: String) {
        let (tx, rx) = mpsc::channel();
        self.replay_rx = Some(rx);
        self.busy = BusyMode::Replaying;
        self.set_status(format!("Đang chạy lại «{name}»…"), true);
        self.minimize_window(ctx);

        std::thread::spawn(move || {
            let outcome = run_replay(&path);
            let _ = tx.send((outcome.ok, outcome.message));
        });
    }

    fn poll_replay(&mut self, ctx: &egui::Context) {
        let Some(rx) = &self.replay_rx else {
            return;
        };
        if let Ok((ok, msg)) = rx.try_recv() {
            self.replay_rx = None;
            self.busy = BusyMode::None;
            self.restore_window(ctx);
            self.set_status(msg, ok);
        }
    }

    fn section_frame() -> egui::Frame {
        egui::Frame::none()
            .fill(SURFACE_2)
            .stroke(Stroke::new(1.0, BORDER))
            .inner_margin(16.0)
            .rounding(8.0)
    }

    fn primary_button(text: &str) -> egui::Button<'static> {
        egui::Button::new(RichText::new(text).strong().color(Color32::WHITE))
            .fill(ACCENT_DIM)
            .stroke(Stroke::new(1.0, ACCENT))
    }

    fn danger_button(text: &str) -> egui::Button<'static> {
        egui::Button::new(RichText::new(text).strong())
            .fill(Color32::from_rgb(69, 26, 26))
            .stroke(Stroke::new(1.0, DANGER))
    }
}

impl eframe::App for RecorderApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let eng = engine();

        if eng.take_hotkey_stop() {
            let result = eng.stop_and_save().map_err(|e| e.to_string());
            self.finish_recording(ctx, result);
        }

        self.poll_replay(ctx);

        if self.last_refresh.elapsed().as_secs() >= 2 && !self.is_busy() {
            self.refresh_list();
            self.last_refresh = std::time::Instant::now();
        }

        if self.is_busy() {
            ctx.request_repaint_after(std::time::Duration::from_millis(150));
        }

        egui::TopBottomPanel::top("header").show(ctx, |ui| {
            ui.add_space(4.0);
            ui.horizontal(|ui| {
                ui.label(RichText::new("DATN").strong().size(18.0).color(ACCENT));
                ui.label(RichText::new("Desktop Recorder").strong().size(18.0));
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui
                        .add_enabled(!self.is_busy(), egui::Button::new("Làm mới"))
                        .clicked()
                    {
                        self.refresh_list();
                    }
                    if ui.button("Mở thư mục").clicked() {
                        open_recordings_folder();
                    }
                });
            });
            ui.add_space(4.0);
        });

        egui::SidePanel::left("sidebar")
            .resizable(true)
            .default_width(300.0)
            .frame(egui::Frame::side_top_panel(&ctx.style()).inner_margin(12.0))
            .show(ctx, |ui| {
                ui.label(RichText::new("Bản ghi đã lưu").strong());
                ui.add_space(4.0);
                ui.text_edit_singleline(&mut self.filter);
                ui.label(
                    RichText::new(format!("{} bản ghi", self.recordings.len()))
                        .small()
                        .color(TEXT_DIM),
                );
                ui.separator();

                egui::ScrollArea::vertical().show(ui, |ui| {
                    let items: Vec<RecordingMeta> = self.filtered_recordings().into_iter().cloned().collect();
                    if items.is_empty() {
                        ui.label(RichText::new("Chưa có bản ghi.").color(TEXT_DIM));
                        return;
                    }
                    for rec in items {
                        let selected = self.selected_id.as_deref() == Some(rec.id.as_str());
                        let frame = if selected {
                            egui::Frame::none()
                                .fill(ACCENT_DIM.gamma_multiply(0.45))
                                .stroke(Stroke::new(1.0, ACCENT))
                                .inner_margin(10.0)
                                .rounding(6.0)
                        } else {
                            egui::Frame::none()
                                .fill(SURFACE)
                                .stroke(Stroke::new(1.0, BORDER))
                                .inner_margin(10.0)
                                .rounding(6.0)
                        };

                        frame.show(ui, |ui| {
                            ui.set_width(ui.available_width());
                            let response = ui.interact(
                                ui.max_rect(),
                                ui.id().with(rec.id.as_str()),
                                egui::Sense::click(),
                            );
                            ui.label(RichText::new(&rec.name).strong());
                            ui.label(
                                RichText::new(format!(
                                    "{} bước · {}",
                                    rec.step_count, rec.modified_label
                                ))
                                .small()
                                .color(TEXT_DIM),
                            );
                            if response.clicked() {
                                self.selected_id = Some(rec.id.clone());
                            }
                        });
                        ui.add_space(6.0);
                    }
                });
            });

        egui::CentralPanel::default()
            .frame(egui::Frame::central_panel(&ctx.style()).inner_margin(16.0))
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(
                            RichText::new("Ghi thao tác desktop")
                                .strong()
                                .size(20.0),
                        );
                        ui.label(
                            RichText::new(
                                "Chuột, phím và cuộn được ghi thành JSON tương thích DESKTOP_AUTOMATION.",
                            )
                            .color(TEXT_DIM),
                        );
                    });
                });
                ui.add_space(12.0);

                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.set_min_width(ui.available_width() * 0.52);
                        Self::section_frame().show(ui, |ui| {
                            ui.label(RichText::new("Bản ghi mới").strong());
                            ui.add_space(8.0);

                            if matches!(self.busy, BusyMode::Recording) {
                                ui.horizontal(|ui| {
                                    ui.label(RichText::new("●").color(DANGER).size(20.0));
                                    ui.label(
                                        RichText::new(format!(
                                            "Đang ghi — {} bước",
                                            eng.step_count()
                                        ))
                                        .strong()
                                        .color(DANGER),
                                    );
                                });
                                ui.add_space(8.0);
                                ui.label(
                                    RichText::new(
                                        "Cửa sổ đã thu nhỏ xuống taskbar. Thao tác trên desktop, sau đó nhấn F12 để dừng và lưu.",
                                    )
                                    .color(TEXT_DIM),
                                );
                                ui.add_space(12.0);
                                ui.horizontal(|ui| {
                                    if ui
                                        .add(Self::primary_button("Dừng & lưu"))
                                        .clicked()
                                    {
                                        let result =
                                            eng.stop_and_save().map_err(|e| e.to_string());
                                        self.finish_recording(ctx, result);
                                    }
                                    if ui.add(Self::danger_button("Hủy")).clicked() {
                                        self.cancel_recording(ctx);
                                    }
                                });
                            } else if matches!(self.busy, BusyMode::Replaying) {
                                ui.spinner();
                                ui.label(
                                    RichText::new("Đang chạy lại bản ghi…")
                                        .strong()
                                        .color(ACCENT),
                                );
                                ui.label(
                                    RichText::new("Cửa sổ đã thu nhỏ xuống taskbar.")
                                        .small()
                                        .color(TEXT_DIM),
                                );
                            } else {
                                ui.label("Tên (tùy chọn):");
                                ui.text_edit_singleline(&mut self.new_name);
                                ui.add_space(8.0);
                                if ui
                                    .add(Self::primary_button("▶  Bắt đầu ghi"))
                                    .clicked()
                                {
                                    self.start_recording(ctx);
                                }
                                ui.label(
                                    RichText::new("F12 = dừng và lưu · cửa sổ tự thu nhỏ khi ghi")
                                        .small()
                                        .color(TEXT_DIM),
                                );
                            }
                        });
                    });

                    ui.add_space(12.0);

                    ui.vertical(|ui| {
                        ui.set_min_width(ui.available_width());
                        Self::section_frame().show(ui, |ui| {
                            ui.label(RichText::new("Chi tiết & chạy lại").strong());
                            ui.add_space(8.0);

                            if let Some(meta) = self.selected_meta().cloned() {
                                ui.label(format!("Tên: {}", meta.name));
                                ui.label(format!("Số bước: {}", meta.step_count));
                                ui.label(
                                    RichText::new(format!("ID: {}", meta.id))
                                        .small()
                                        .color(TEXT_DIM),
                                );
                                ui.label(
                                    RichText::new(format!("Sửa: {}", meta.modified_label))
                                        .small()
                                        .color(TEXT_DIM),
                                );
                                ui.label(
                                    RichText::new(meta.path.display().to_string())
                                        .small()
                                        .color(TEXT_DIM),
                                );
                                ui.add_space(12.0);

                                ui.horizontal(|ui| {
                                    let can_replay = !self.is_busy() && meta.step_count > 0;
                                    if ui
                                        .add_enabled(
                                            can_replay,
                                            Self::primary_button("↻  Chạy lại"),
                                        )
                                        .clicked()
                                    {
                                        let path = meta.path.clone();
                                        let name = meta.name.clone();
                                        self.start_replay(ctx, path, name);
                                    }
                                    if ui
                                        .add_enabled(!self.is_busy(), Self::danger_button("Xóa"))
                                        .clicked()
                                    {
                                        if delete_recording(&meta.id).is_ok() {
                                            self.selected_id = None;
                                            self.refresh_list();
                                            self.set_status("Đã xóa bản ghi.", true);
                                        }
                                    }
                                });
                                ui.add_space(6.0);
                                ui.label(
                                    RichText::new(
                                        "Chạy lại cần datn-agent-native.exe (npm run build:core).",
                                    )
                                    .small()
                                    .color(TEXT_DIM),
                                );
                            } else {
                                ui.label(
                                    RichText::new("Chọn một bản ghi bên trái.")
                                        .color(TEXT_DIM),
                                );
                            }
                        });
                    });
                });
            });

        egui::TopBottomPanel::bottom("status").show(ctx, |ui| {
            ui.horizontal(|ui| {
                let color = if self.status_ok { SUCCESS } else { DANGER };
                ui.label(RichText::new("●").color(color));
                ui.label(RichText::new(&self.status).small());
            });
        });
    }
}
