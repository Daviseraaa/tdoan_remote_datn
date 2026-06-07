use eframe::egui::{self, Align, Context, Layout, Ui, Vec2};
use std::sync::Arc;

use crate::record_engine::RecordEngine;

use super::app::{BusyMode, RecorderApp};
use super::theme::{RECORD_RED, TOOLBAR_H, TOOLBAR_W};
use super::widgets::{self, drag_handle, list_icon, record_icon, settings_icon, stop_icon};

pub fn draw(app: &mut RecorderApp, ui: &mut Ui, ctx: &Context, eng: &Arc<RecordEngine>) {
    ui.allocate_ui_with_layout(
        Vec2::new(TOOLBAR_W, TOOLBAR_H),
        Layout::top_down(Align::Center),
        |ui| {
            ui.set_width(TOOLBAR_W);

            drag_handle(ui, ctx);
            ui.add_space(6.0);

            let recording = eng.is_recording() || matches!(app.busy, BusyMode::Recording);
            let idle = !app.is_busy();

            let record_tooltip = if recording {
                format!("Đang ghi — {} bước", eng.step_count())
            } else {
                "Bắt đầu ghi".to_string()
            };
            if widgets::tool_button(
                ui,
                record_icon(recording),
                idle,
                recording,
                Some(RECORD_RED),
                &record_tooltip,
            )
            .clicked()
            {
                app.start_recording();
            }

            ui.add_space(6.0);

            if matches!(app.busy, BusyMode::Replaying) {
                ui.add(egui::Spinner::new().size(28.0));
            } else if widgets::tool_button(
                ui,
                stop_icon(),
                recording,
                false,
                None,
                "Dừng và lưu (F12)",
            )
            .clicked()
            {
                app.stop_recording(eng);
            }

            ui.add_space(6.0);

            if widgets::tool_button(
                ui,
                list_icon(app.list_open),
                true,
                app.list_open,
                None,
                "Danh sách bản ghi",
            )
            .clicked()
            {
                app.toggle_list(ctx);
            }

            ui.add_space(6.0);

            if widgets::tool_button(
                ui,
                settings_icon(app.settings_open),
                true,
                app.settings_open,
                None,
                "Cài đặt",
            )
            .clicked()
            {
                app.toggle_settings(ctx);
            }
        },
    );
}
