use eframe::egui::{self, Color32, Context, FontData, FontDefinitions, FontFamily, Stroke, Vec2};
use std::time::Duration;

pub const DRAG_HANDLE_H: f32 = 20.0;
pub const TOOLBAR_PAD: f32 = 6.0;
pub const TOOL_BTN: f32 = 42.0;
/// Rộng toolbar = nút + padding hai bên (tránh clip viền nút).
pub const TOOLBAR_W: f32 = TOOL_BTN + TOOLBAR_PAD * 2.0;
pub const TOOLBAR_H: f32 = DRAG_HANDLE_H + 6.0 + TOOL_BTN * 4.0 + 6.0 * 3.0 + TOOLBAR_PAD;
pub const SIDE_GAP: f32 = 10.0;
/// Khoảng cách tooltip so với mép phải toolbar.
pub const TOOLTIP_OFFSET: f32 = 14.0;
/// Vùng trong suốt bên phải toolbar — chỗ tooltip nổi, không vẽ nền.
pub const TOOLTIP_GUTTER: f32 = 160.0;
/// Lề trái khi neo toolbar giữa chiều cao màn hình.
pub const SCREEN_EDGE_MARGIN: f32 = 12.0;
pub const LIST_PANEL_W: f32 = 300.0;
pub const SETTINGS_PANEL_W: f32 = 280.0;
pub const TOAST_DURATION: Duration = Duration::from_secs(3);

pub const ACCENT: Color32 = Color32::from_rgb(56, 189, 248);
pub const ACCENT_DIM: Color32 = Color32::from_rgb(14, 116, 144);
pub const SURFACE: Color32 = Color32::from_rgb(24, 24, 27);
pub const SURFACE_2: Color32 = Color32::from_rgb(39, 39, 42);
pub const SURFACE_3: Color32 = Color32::from_rgb(52, 52, 58);
pub const BORDER: Color32 = Color32::from_rgb(63, 63, 70);
pub const TEXT_DIM: Color32 = Color32::from_rgb(161, 161, 170);
pub const TEXT: Color32 = Color32::from_rgb(228, 228, 231);
pub const DANGER: Color32 = Color32::from_rgb(248, 113, 113);
pub const DANGER_DIM: Color32 = Color32::from_rgb(127, 29, 29);
pub const SUCCESS: Color32 = Color32::from_rgb(74, 222, 128);
pub const RECORD_RED: Color32 = Color32::from_rgb(239, 68, 68);

const FONT_ID: &str = "datn_ui";

#[cfg(windows)]
const FONT_CANDIDATES: &[&str] = &[
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\tahoma.ttf",
];

#[cfg(not(windows))]
const FONT_CANDIDATES: &[&str] = &[];

pub fn setup(ctx: &Context) {
    let mut fonts = FontDefinitions::default();
    load_ui_font(&mut fonts);
    egui_phosphor::add_to_fonts(&mut fonts, egui_phosphor::Variant::Regular);
    egui_phosphor::add_to_fonts(&mut fonts, egui_phosphor::Variant::Fill);
    ctx.set_fonts(fonts);
    setup_theme(ctx);
}

fn load_ui_font(fonts: &mut FontDefinitions) {
    let Some(bytes) = FONT_CANDIDATES
        .iter()
        .find_map(|path| std::fs::read(path).ok().filter(|d| !d.is_empty()))
    else {
        return;
    };

    fonts
        .font_data
        .insert(FONT_ID.to_owned(), FontData::from_owned(bytes));

    if let Some(list) = fonts.families.get_mut(&FontFamily::Proportional) {
        list.insert(0, FONT_ID.to_owned());
    }
    if let Some(list) = fonts.families.get_mut(&FontFamily::Monospace) {
        list.insert(0, FONT_ID.to_owned());
    }
}

fn setup_theme(ctx: &Context) {
    let mut style = (*ctx.style()).clone();
    style.visuals.window_fill = SURFACE;
    style.visuals.panel_fill = SURFACE;
    style.visuals.extreme_bg_color = Color32::from_rgb(9, 9, 11);
    style.visuals.faint_bg_color = SURFACE_2;
    style.visuals.widgets.noninteractive.bg_fill = SURFACE_2;
    style.visuals.widgets.inactive.bg_fill = SURFACE_2;
    style.visuals.widgets.hovered.bg_fill = SURFACE_3;
    style.visuals.widgets.active.bg_fill = ACCENT_DIM;
    style.visuals.selection.bg_fill = ACCENT_DIM.gamma_multiply(0.35);
    style.visuals.widgets.noninteractive.fg_stroke = Stroke::new(1.0, TEXT_DIM);
    style.visuals.widgets.inactive.fg_stroke = Stroke::new(1.0, TEXT);
    style.visuals.widgets.hovered.fg_stroke = Stroke::new(1.5, TEXT);
    style.visuals.widgets.active.fg_stroke = Stroke::new(1.5, Color32::WHITE);
    style.visuals.widgets.inactive.rounding = 8.0.into();
    style.visuals.widgets.active.rounding = 8.0.into();
    style.visuals.widgets.hovered.rounding = 8.0.into();
    style.spacing.item_spacing = egui::vec2(6.0, 6.0);
    style.spacing.button_padding = egui::vec2(4.0, 4.0);
    style.spacing.interact_size = Vec2::splat(TOOL_BTN);
    ctx.set_style(style);
}
