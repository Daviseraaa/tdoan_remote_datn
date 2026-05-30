//! Font có glyph tiếng Việt — default egui chỉ Latin cơ bản nên hiện ô vuông.

use eframe::egui::{Context, FontData, FontDefinitions, FontFamily};

const FONT_ID: &str = "datn_ui";

#[cfg(windows)]
const CANDIDATES: &[&str] = &[
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\tahoma.ttf",
];

#[cfg(not(windows))]
const CANDIDATES: &[&str] = &[];

fn load_system_font_bytes() -> Option<Vec<u8>> {
    for path in CANDIDATES {
        if let Ok(data) = std::fs::read(path) {
            if !data.is_empty() {
                return Some(data);
            }
        }
    }
    None
}

pub fn setup_ui_fonts(ctx: &Context) {
    let Some(bytes) = load_system_font_bytes() else {
        return;
    };

    let mut fonts = FontDefinitions::default();
    fonts
        .font_data
        .insert(FONT_ID.to_owned(), FontData::from_owned(bytes));

    if let Some(list) = fonts.families.get_mut(&FontFamily::Proportional) {
        list.insert(0, FONT_ID.to_owned());
    }
    if let Some(list) = fonts.families.get_mut(&FontFamily::Monospace) {
        list.insert(0, FONT_ID.to_owned());
    }

    ctx.set_fonts(fonts);
}
