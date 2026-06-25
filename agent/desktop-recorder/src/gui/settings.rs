use eframe::egui::{RichText, Ui};

use crate::store::open_recordings_folder;

use super::app::{BusyMode, RecorderApp};
use super::side_panel;
use super::theme::{DANGER, SETTINGS_PANEL_W, TEXT_DIM, TOOLBAR_H};

pub fn draw(app: &mut RecorderApp, ui: &mut Ui) {
    let mut request_close = false;
    let mut on_close = || request_close = true;

    side_panel::draw(
        ui,
        SETTINGS_PANEL_W,
        TOOLBAR_H,
        "Cài đặt",
        None,
        "settings_scroll",
        &mut on_close,
        |ui| {
            ui.label(RichText::new("Tên bản ghi (tùy chọn)").small().color(TEXT_DIM));
            ui.add_space(4.0);
            ui.text_edit_singleline(&mut app.new_name);

            ui.add_space(12.0);
            ui.checkbox(
                &mut app.capture_uia,
                RichText::new("Bắt UIA khi click (Button, TextBox…)").size(13.0),
            );
            ui.label(
                RichText::new("Một số app (Zalo PC…) có thể chặn UIA — tắt nếu ghi bị treo.")
                    .small()
                    .color(TEXT_DIM),
            );
            ui.checkbox(
                &mut app.show_highlight,
                RichText::new("Hiện viền phần tử khi ghi").size(13.0),
            );

            ui.add_space(12.0);
            if ui.button("Mở thư mục").clicked() {
                open_recordings_folder();
            }

            if matches!(app.busy, BusyMode::Recording) {
                ui.add_space(12.0);
                ui.separator();
                if ui
                    .button(RichText::new("Hủy phiên ghi").color(DANGER))
                    .clicked()
                {
                    app.cancel_recording();
                }
            }
        },
    );

    if request_close {
        app.settings_open = false;
    }
}
