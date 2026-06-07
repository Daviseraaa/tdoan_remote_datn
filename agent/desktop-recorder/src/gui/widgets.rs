use eframe::egui::{self, Button, Color32, Context, Response, RichText, Sense, Stroke, Ui, Vec2, ViewportCommand};
use egui_phosphor::{fill, regular};

use super::theme::{
    ACCENT, ACCENT_DIM, BORDER, DANGER, DANGER_DIM, DRAG_HANDLE_H, SURFACE_2,
    TEXT, TEXT_DIM, TOOL_BTN, TOOLBAR_W, TOOLTIP_OFFSET,
};

/// Tooltip nổi bên phải widget — không bị ép trong toolbar hẹp.
fn hover_tooltip_right(response: Response, text: &str) -> Response {
    if response.enabled() && response.hovered() {
        let rect = response.rect;
        egui::show_tooltip_at(
            &response.ctx,
            response.layer_id,
            response.id.with("toolbar_tip"),
            egui::pos2(rect.right() + TOOLTIP_OFFSET, rect.center().y),
            |ui| {
                ui.set_max_width(240.0);
                ui.label(text);
            },
        );
    }
    response
}

pub fn drag_handle(ui: &mut Ui, ctx: &Context) -> Response {
    let (rect, response) = ui.allocate_exact_size(
        Vec2::new(TOOLBAR_W, DRAG_HANDLE_H),
        Sense::drag(),
    );

    let painter = ui.painter();
    painter.rect_filled(rect, 0.0, SURFACE_2);
    painter.line_segment(
        [rect.left_top(), rect.right_top()],
        Stroke::new(1.0, BORDER),
    );

    let center = rect.center();
    let dot_color = if response.hovered() {
        TEXT
    } else {
        TEXT_DIM
    };
    for dx in [-8.0_f32, 0.0, 8.0] {
        painter.circle_filled(center + Vec2::new(dx, 0.0), 1.8, dot_color);
    }

    if response.drag_started() {
        ctx.send_viewport_cmd(ViewportCommand::StartDrag);
    }

    hover_tooltip_right(response, "Kéo để di chuyển")
}

pub fn tool_button(
    ui: &mut Ui,
    icon: &str,
    enabled: bool,
    active: bool,
    accent: Option<Color32>,
    tooltip: &str,
) -> Response {
    let (fill, stroke, fg) = if !enabled {
        (SURFACE_2, Stroke::new(1.0, BORDER), TEXT_DIM)
    } else if active {
        let accent = accent.unwrap_or(ACCENT_DIM);
        (accent, Stroke::new(1.5, ACCENT), Color32::WHITE)
    } else {
        (SURFACE_2, Stroke::new(1.0, BORDER), TEXT)
    };

    let button = Button::new(RichText::new(icon).size(20.0).color(fg))
        .min_size(Vec2::splat(TOOL_BTN))
        .fill(fill)
        .stroke(stroke)
        .rounding(6.0);

    let response = ui.scope(|ui| {
        ui.style_mut().spacing.button_padding = egui::vec2(2.0, 2.0);
        ui.add_enabled(enabled, button)
    }).inner;
    if enabled {
        hover_tooltip_right(response, tooltip)
    } else {
        response
    }
}

pub fn action_button(
    ui: &mut Ui,
    icon: &str,
    label: &str,
    enabled: bool,
    accent: Color32,
    tooltip: &str,
) -> Response {
    let (fill, stroke, fg) = if !enabled {
        (SURFACE_2, Stroke::new(1.0, BORDER), TEXT_DIM)
    } else {
        (SURFACE_2, Stroke::new(1.0, BORDER), accent)
    };

    let text = RichText::new(format!("{icon} {label}")).size(12.0).color(fg);
    let button = Button::new(text)
        .min_size(Vec2::new(72.0, 32.0))
        .fill(fill)
        .stroke(stroke)
        .rounding(6.0);

    let response = ui.add_enabled(enabled, button);
    if enabled {
        response.on_hover_text(tooltip)
    } else {
        response
    }
}

pub fn danger_action_button(ui: &mut Ui, icon: &str, label: &str, enabled: bool) -> Response {
    let (fill, stroke, fg) = if !enabled {
        (SURFACE_2, Stroke::new(1.0, BORDER), TEXT_DIM)
    } else {
        (DANGER_DIM, Stroke::new(1.0, DANGER), DANGER)
    };

    let text = RichText::new(format!("{icon} {label}")).size(12.0).color(fg);
    let button = Button::new(text)
        .min_size(Vec2::new(56.0, 32.0))
        .fill(fill)
        .stroke(stroke)
        .rounding(6.0);

    let response = ui.add_enabled(enabled, button);
    if enabled {
        response.on_hover_text("Xóa bản ghi")
    } else {
        response
    }
}

pub fn record_icon(active: bool) -> &'static str {
    if active {
        fill::RECORD
    } else {
        regular::RECORD
    }
}

pub fn stop_icon() -> &'static str {
    regular::STOP
}

pub fn list_icon(active: bool) -> &'static str {
    if active {
        fill::LIST_BULLETS
    } else {
        regular::LIST_BULLETS
    }
}

pub fn settings_icon(active: bool) -> &'static str {
    if active {
        fill::GEAR_SIX
    } else {
        regular::GEAR_SIX
    }
}

pub fn replay_icon() -> &'static str {
    regular::ARROWS_CLOCKWISE
}

pub fn delete_icon() -> &'static str {
    regular::TRASH
}

pub fn card_frame() -> egui::Frame {
    egui::Frame::none()
        .fill(SURFACE_2)
        .stroke(Stroke::new(1.0, BORDER))
        .inner_margin(10.0)
        .rounding(8.0)
}

pub fn panel_frame() -> egui::Frame {
    egui::Frame::none()
        .fill(SURFACE_2)
        .stroke(Stroke::new(1.0, BORDER))
        .inner_margin(12.0)
        .rounding(10.0)
}
