use eframe::egui;

/// Icon taskbar / Alt+Tab — embed từ assets/icon.ico (cùng file với winres + rcedit).
pub fn app_icon() -> egui::IconData {
    let bytes = include_bytes!("../../assets/icon.ico");
    let img = image::load_from_memory(bytes).expect("assets/icon.ico");
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
    egui::IconData {
        rgba: rgba.into_raw(),
        width,
        height,
    }
}
