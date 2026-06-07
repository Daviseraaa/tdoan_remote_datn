use eframe::egui::{
    self, Color32, FontId, Frame, RichText, Stroke, ViewportBuilder, ViewportClass, ViewportId,
};
use std::time::{Duration, Instant};

use super::theme::{BORDER, DANGER, SUCCESS, SURFACE_2, TOAST_DURATION};

const TOAST_GAP: f32 = 6.0;
const TOAST_PAD_X: f32 = 24.0;
const TOAST_PAD_Y: f32 = 16.0;
const TOAST_MIN_W: f32 = 72.0;
const TOAST_MIN_H: f32 = 32.0;
const TOAST_MAX_W: f32 = 520.0;
const TOAST_FONT: f32 = 12.0;

pub struct Toast {
    pub message: String,
    pub ok: bool,
    pub until: Instant,
}

impl Toast {
    pub fn new(message: impl Into<String>, ok: bool) -> Self {
        Self {
            message: message.into(),
            ok,
            until: Instant::now() + TOAST_DURATION,
        }
    }

    pub fn expired(&self) -> bool {
        Instant::now() >= self.until
    }

    pub fn color(&self) -> Color32 {
        if self.ok { SUCCESS } else { DANGER }
    }
}

fn measure_content(ctx: &egui::Context, message: &str) -> egui::Vec2 {
    let font = FontId::proportional(TOAST_FONT);
    ctx.fonts(|fonts| {
        let no_wrap = fonts.layout_no_wrap(message.to_owned(), font.clone(), Color32::WHITE);
        let wrap_w = TOAST_MAX_W - TOAST_PAD_X;
        let galley = if no_wrap.size().x <= wrap_w {
            no_wrap
        } else {
            fonts.layout(
                message.to_owned(),
                font,
                Color32::WHITE,
                wrap_w,
            )
        };
        egui::vec2(
            (galley.size().x + TOAST_PAD_X).clamp(TOAST_MIN_W, TOAST_MAX_W),
            (galley.size().y + TOAST_PAD_Y).max(TOAST_MIN_H),
        )
    })
}

/// Toast trong cửa sổ native riêng — neo dưới cửa sổ chính, rộng theo nội dung.
pub fn show(ctx: &egui::Context, toast: &Toast, parent_outer: egui::Rect) {
    let size = measure_content(ctx, &toast.message);
    let x = parent_outer.min.x;
    let y = parent_outer.max.y + TOAST_GAP;

    let builder = ViewportBuilder::default()
        .with_decorations(false)
        .with_transparent(true)
        .with_always_on_top()
        .with_resizable(false)
        .with_active(false)
        .with_mouse_passthrough(true)
        .with_inner_size([size.x, size.y])
        .with_min_inner_size([size.x, size.y])
        .with_max_inner_size([size.x, size.y])
        .with_position([x, y]);

    let message = toast.message.clone();
    let color = toast.color();

    ctx.show_viewport_immediate(
        ViewportId::from_hash_of("datn_recorder_toast"),
        builder,
        |ctx, class| {
            if matches!(class, ViewportClass::Embedded) {
                draw_embedded(ctx, &message, color, parent_outer, size);
                return;
            }
            draw_frame(ctx, &message, color, size);
            ctx.request_repaint_after(Duration::from_millis(200));
        },
    );
}

fn draw_frame(ctx: &egui::Context, message: &str, color: Color32, size: egui::Vec2) {
    egui::CentralPanel::default()
        .frame(Frame::none())
        .show(ctx, |ui| {
            Frame::none()
                .fill(SURFACE_2)
                .stroke(Stroke::new(1.0, BORDER))
                .inner_margin(egui::vec2(12.0, 8.0))
                .rounding(8.0)
                .show(ui, |ui| {
                    ui.set_max_width(size.x - TOAST_PAD_X);
                    ui.label(RichText::new(message).size(TOAST_FONT).color(color));
                });
        });
}

fn draw_embedded(
    ctx: &egui::Context,
    message: &str,
    color: Color32,
    parent_outer: egui::Rect,
    size: egui::Vec2,
) {
    egui::Area::new(egui::Id::new("toast_embedded"))
        .order(egui::Order::Tooltip)
        .interactable(false)
        .fixed_pos(egui::pos2(parent_outer.min.x, parent_outer.max.y + TOAST_GAP))
        .show(ctx, |ui| {
            Frame::none()
                .fill(SURFACE_2)
                .stroke(Stroke::new(1.0, BORDER))
                .inner_margin(egui::vec2(12.0, 8.0))
                .rounding(8.0)
                .show(ui, |ui| {
                    ui.set_max_width(size.x - TOAST_PAD_X);
                    ui.label(RichText::new(message).size(TOAST_FONT).color(color));
                });
        });
}
