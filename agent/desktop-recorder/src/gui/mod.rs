use eframe::egui;

mod app;
mod icon;
mod list_panel;
mod settings;
mod side_panel;
mod theme;
mod toast;
mod toolbar;
mod widgets;

use app::RecorderApp;
use theme::{TOOLBAR_H, TOOLBAR_W, TOOLTIP_GUTTER};

pub fn run() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_icon(icon::app_icon())
            .with_inner_size([TOOLBAR_W + TOOLTIP_GUTTER, TOOLBAR_H])
            .with_min_inner_size([TOOLBAR_W + TOOLTIP_GUTTER, TOOLBAR_H])
            .with_decorations(false)
            .with_transparent(true)
            .with_always_on_top()
            .with_resizable(false),
        ..Default::default()
    };
    eframe::run_native(
        "StationHub Desktop Recorder",
        options,
        Box::new(|cc| {
            theme::setup(&cc.egui_ctx);
            Ok(Box::new(RecorderApp::new()))
        }),
    )
}
