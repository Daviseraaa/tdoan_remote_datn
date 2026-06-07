//! Tab mở rộng bên cạnh toolbar — layout thống nhất:
//! [Tên tab ··· nút đóng] → nội dung scroll (chiều cao = toolbar).

use eframe::egui::{self, Align, Layout, RichText, Ui, Vec2};
use egui_phosphor::regular;

use super::theme::TEXT_DIM;
use super::widgets::panel_frame;

pub fn draw(
    ui: &mut Ui,
    panel_w: f32,
    panel_h: f32,
    title: &str,
    subtitle: Option<&str>,
    scroll_id: &str,
    on_close: &mut impl FnMut(),
    content: impl FnOnce(&mut Ui),
) {
    ui.allocate_ui_with_layout(
        Vec2::new(panel_w, panel_h),
        Layout::top_down(Align::LEFT),
        |ui| {
            ui.set_width(panel_w);
            ui.set_height(panel_h);

            panel_frame().show(ui, |ui| {
                ui.set_width(panel_w - 24.0);
                ui.set_height(panel_h - 24.0);

                // Header: tên tab + nút đóng
                ui.horizontal(|ui| {
                    ui.label(RichText::new(title).strong().size(14.0));
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        let close = egui::Button::new(RichText::new(regular::X).size(16.0))
                            .min_size(Vec2::splat(28.0));
                        if ui.add(close).on_hover_ui_at_pointer(|ui| {
                            ui.label("Đóng tab");
                        }).clicked() {
                            on_close();
                        }
                    });
                });

                if let Some(sub) = subtitle {
                    ui.label(RichText::new(sub).small().color(TEXT_DIM));
                }

                ui.add_space(4.0);
                ui.separator();
                ui.add_space(4.0);

                // Nội dung — scroll khi dài hơn vùng còn lại
                let scroll_h = ui.available_height().max(40.0);
                egui::ScrollArea::vertical()
                    .id_salt(scroll_id)
                    .auto_shrink([false, false])
                    .max_height(scroll_h)
                    .show(ui, |ui| {
                        ui.set_width(panel_w - 48.0);
                        content(ui);
                    });
            });
        },
    );
}
