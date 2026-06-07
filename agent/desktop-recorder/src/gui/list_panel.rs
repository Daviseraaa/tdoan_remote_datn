use eframe::egui::{RichText, Ui};

use crate::store::{delete_recording, RecordingMeta};

use super::app::RecorderApp;
use super::side_panel;
use super::theme::{ACCENT, LIST_PANEL_W, TEXT_DIM, TOOLBAR_H};
use super::widgets::{self, card_frame, delete_icon, replay_icon};

pub fn draw(app: &mut RecorderApp, ui: &mut Ui) {
    let count = app.recordings.len();
    let subtitle = format!("{count} mục");

    let mut request_close = false;
    let mut on_close = || request_close = true;

    side_panel::draw(
        ui,
        LIST_PANEL_W,
        TOOLBAR_H,
        "Bản ghi đã lưu",
        Some(&subtitle),
        "recordings_scroll",
        &mut on_close,
        |ui| {
            if app.recordings.is_empty() {
                ui.label(RichText::new("Chưa có bản ghi.").color(TEXT_DIM));
                return;
            }

            let recordings: Vec<RecordingMeta> = app.recordings.clone();
            for rec in recordings {
                draw_row(app, ui, &rec);
                ui.add_space(8.0);
            }
        },
    );

    if request_close {
        app.list_open = false;
    }
}

fn draw_row(app: &mut RecorderApp, ui: &mut Ui, rec: &RecordingMeta) {
    card_frame().show(ui, |ui| {
        ui.set_min_width(LIST_PANEL_W - 72.0);
        ui.vertical(|ui| {
            ui.label(RichText::new(&rec.name).strong().size(13.0));
            ui.label(
                RichText::new(format!(
                    "{} bước · {}",
                    rec.step_count, rec.modified_label
                ))
                .small()
                .color(TEXT_DIM),
            );
            ui.add_space(8.0);
            ui.horizontal(|ui| {
                let can_act = !app.is_busy();
                let can_replay = can_act && rec.step_count > 0;

                if widgets::action_button(
                    ui,
                    replay_icon(),
                    "Chạy lại",
                    can_replay,
                    ACCENT,
                    "Chạy lại bản ghi",
                )
                .clicked()
                {
                    let path = rec.path.clone();
                    let name = rec.name.clone();
                    app.start_replay(path, name);
                }

                if widgets::danger_action_button(ui, delete_icon(), "Xóa", can_act).clicked()
                    && delete_recording(&rec.id).is_ok()
                {
                    app.refresh_list();
                    app.show_toast("Đã xóa bản ghi.", true);
                }
            });
        });
    });
}
