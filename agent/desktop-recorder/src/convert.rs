use rdev::{Button, Event, EventType, Key};
use serde_json::{json, Value};
use std::time::{Duration, Instant};

const MIN_DELAY_MS: u64 = 300;

pub struct RecorderState {
    steps: Vec<Value>,
    last_time: Instant,
    mouse_x: f64,
    mouse_y: f64,
    text_buf: String,
    modifiers: ModifierState,
}

#[derive(Default, Clone, Copy)]
struct ModifierState {
    ctrl: bool,
    alt: bool,
    shift: bool,
    meta: bool,
}

impl RecorderState {
    pub fn new() -> Self {
        Self {
            steps: Vec::new(),
            last_time: Instant::now(),
            mouse_x: 0.0,
            mouse_y: 0.0,
            text_buf: String::new(),
            modifiers: ModifierState::default(),
        }
    }

    pub fn flush_and_take_steps(&mut self) -> Vec<Value> {
        self.flush_text();
        std::mem::take(&mut self.steps)
    }

    pub fn step_count(&self) -> usize {
        let pending = usize::from(!self.text_buf.is_empty());
        self.steps.len() + pending
    }

    fn maybe_delay(&mut self) {
        let elapsed = self.last_time.elapsed();
        if elapsed >= Duration::from_millis(MIN_DELAY_MS) {
            let ms = elapsed.as_millis().min(u64::MAX as u128) as u64;
            self.steps.push(json!({ "action": "delay", "ms": ms }));
        }
        self.last_time = Instant::now();
    }

    fn push_step(&mut self, step: Value) {
        self.flush_text();
        self.maybe_delay();
        self.steps.push(step);
        self.last_time = Instant::now();
    }

    fn flush_text(&mut self) {
        if self.text_buf.is_empty() {
            return;
        }
        let text = std::mem::take(&mut self.text_buf);
        self.steps.push(json!({ "action": "typeText", "text": text }));
        self.last_time = Instant::now();
    }

    fn push_key_combo(&mut self, keys: Vec<String>) {
        if keys.is_empty() {
            return;
        }
        self.flush_text();
        self.maybe_delay();
        self.steps.push(json!({
            "action": "keyCombo",
            "keys": keys,
        }));
        self.last_time = Instant::now();
    }

    fn update_modifiers(&mut self, key: Key, pressed: bool) {
        match key {
            Key::ControlLeft | Key::ControlRight => self.modifiers.ctrl = pressed,
            Key::Alt | Key::AltGr => self.modifiers.alt = pressed,
            Key::ShiftLeft | Key::ShiftRight => self.modifiers.shift = pressed,
            Key::MetaLeft | Key::MetaRight => self.modifiers.meta = pressed,
            _ => {}
        }
    }

    fn is_modifier(key: Key) -> bool {
        matches!(
            key,
            Key::ControlLeft
                | Key::ControlRight
                | Key::Alt
                | Key::AltGr
                | Key::ShiftLeft
                | Key::ShiftRight
                | Key::MetaLeft
                | Key::MetaRight
        )
    }

    /// Phím không gõ được qua typeText — ghi thành keyCombo.
    fn special_key_token(key: Key) -> Option<&'static str> {
        match key {
            Key::Return | Key::KpReturn => Some("enter"),
            Key::Tab => Some("tab"),
            Key::Escape => Some("escape"),
            Key::Backspace => Some("backspace"),
            Key::Delete | Key::KpDelete => Some("delete"),
            Key::Insert => Some("insert"),
            Key::UpArrow => Some("up"),
            Key::DownArrow => Some("down"),
            Key::LeftArrow => Some("left"),
            Key::RightArrow => Some("right"),
            Key::Home => Some("home"),
            Key::End => Some("end"),
            Key::PageUp => Some("pageup"),
            Key::PageDown => Some("pagedown"),
            Key::Space => Some("space"),
            Key::F1 => Some("f1"),
            Key::F2 => Some("f2"),
            Key::F3 => Some("f3"),
            Key::F4 => Some("f4"),
            Key::F5 => Some("f5"),
            Key::F6 => Some("f6"),
            Key::F7 => Some("f7"),
            Key::F8 => Some("f8"),
            Key::F9 => Some("f9"),
            Key::F10 => Some("f10"),
            Key::F11 => Some("f11"),
            Key::F12 => None,
            Key::PrintScreen => Some("printscreen"),
            Key::Pause => Some("pause"),
            Key::ScrollLock => Some("scrolllock"),
            Key::CapsLock => Some("capslock"),
            Key::NumLock => Some("numlock"),
            _ => None,
        }
    }

    fn printable_key_char(key: Key, shift: bool) -> Option<String> {
        let ch = match key {
            Key::KeyA => 'a',
            Key::KeyB => 'b',
            Key::KeyC => 'c',
            Key::KeyD => 'd',
            Key::KeyE => 'e',
            Key::KeyF => 'f',
            Key::KeyG => 'g',
            Key::KeyH => 'h',
            Key::KeyI => 'i',
            Key::KeyJ => 'j',
            Key::KeyK => 'k',
            Key::KeyL => 'l',
            Key::KeyM => 'm',
            Key::KeyN => 'n',
            Key::KeyO => 'o',
            Key::KeyP => 'p',
            Key::KeyQ => 'q',
            Key::KeyR => 'r',
            Key::KeyS => 's',
            Key::KeyT => 't',
            Key::KeyU => 'u',
            Key::KeyV => 'v',
            Key::KeyW => 'w',
            Key::KeyX => 'x',
            Key::KeyY => 'y',
            Key::KeyZ => 'z',
            Key::Num0 => '0',
            Key::Num1 => '1',
            Key::Num2 => '2',
            Key::Num3 => '3',
            Key::Num4 => '4',
            Key::Num5 => '5',
            Key::Num6 => '6',
            Key::Num7 => '7',
            Key::Num8 => '8',
            Key::Num9 => '9',
            Key::Minus => if shift { '_' } else { '-' },
            Key::Equal => if shift { '+' } else { '=' },
            Key::LeftBracket => if shift { '{' } else { '[' },
            Key::RightBracket => if shift { '}' } else { ']' },
            Key::BackSlash => if shift { '|' } else { '\\' },
            Key::SemiColon => if shift { ':' } else { ';' },
            Key::Quote => if shift { '"' } else { '\'' },
            Key::BackQuote => if shift { '~' } else { '`' },
            Key::Comma => if shift { '<' } else { ',' },
            Key::Dot => if shift { '>' } else { '.' },
            Key::Slash => if shift { '?' } else { '/' },
            Key::Space => ' ',
            _ => return None,
        };
        Some(ch.to_string())
    }

    fn build_combo_keys(&self, key: Key) -> Option<Vec<String>> {
        if Self::is_modifier(key) {
            return None;
        }

        let main = Self::special_key_token(key)
            .map(str::to_string)
            .or_else(|| Self::printable_key_char(key, self.modifiers.shift))?;

        let mut parts = Vec::new();
        if self.modifiers.ctrl {
            parts.push("ctrl".into());
        }
        if self.modifiers.alt {
            parts.push("alt".into());
        }
        if self.modifiers.shift {
            parts.push("shift".into());
        }
        if self.modifiers.meta {
            parts.push("win".into());
        }
        parts.push(main);
        Some(parts)
    }

    fn on_key_press(&mut self, key: Key) {
        if key == Key::F12 {
            return;
        }

        self.update_modifiers(key, true);

        if Self::is_modifier(key) {
            return;
        }

        if key == Key::Backspace {
            if !self.text_buf.is_empty() {
                self.text_buf.pop();
            } else if let Some(keys) = self.build_combo_keys(key) {
                self.push_key_combo(keys);
            }
            return;
        }

        let has_mod = self.modifiers.ctrl || self.modifiers.alt || self.modifiers.meta;
        let is_special = Self::special_key_token(key).is_some();

        if has_mod || is_special {
            if let Some(keys) = self.build_combo_keys(key) {
                self.push_key_combo(keys);
            }
            return;
        }

        if let Some(ch) = Self::printable_key_char(key, self.modifiers.shift) {
            self.text_buf.push_str(&ch);
        }
    }

    pub fn on_event(&mut self, event: Event) {
        match event.event_type {
            EventType::MouseMove { x, y } => {
                self.mouse_x = x;
                self.mouse_y = y;
            }
            EventType::ButtonPress(button) => {
                if button == Button::Unknown(0) {
                    return;
                }
                let btn = match button {
                    Button::Right => "right",
                    _ => "left",
                };
                self.push_step(json!({
                    "action": "click",
                    "x": self.mouse_x.round() as i64,
                    "y": self.mouse_y.round() as i64,
                    "button": btn,
                }));
            }
            EventType::ButtonRelease(_) => {}
            EventType::Wheel { delta_x, delta_y } => {
                let (direction, amount) = if delta_y.abs() >= delta_x.abs() {
                    if delta_y < 0 {
                        ("up", (-delta_y) as i64)
                    } else {
                        ("down", delta_y as i64)
                    }
                } else if delta_x < 0 {
                    ("left", (-delta_x) as i64)
                } else {
                    ("right", delta_x as i64)
                };
                let amount = amount.max(1).min(20);
                self.push_step(json!({
                    "action": "scroll",
                    "direction": direction,
                    "amount": amount,
                }));
            }
            EventType::KeyPress(key) => self.on_key_press(key),
            EventType::KeyRelease(key) => {
                self.update_modifiers(key, false);
            }
        }
    }
}

pub fn is_stop_key(event: &Event) -> bool {
    matches!(event.event_type, EventType::KeyPress(Key::F12))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rdev::{Button, EventType};

    fn key_press(key: Key) -> Event {
        Event {
            time: std::time::SystemTime::now(),
            name: None,
            event_type: EventType::KeyPress(key),
        }
    }

    #[test]
    fn click_produces_desktop_step() {
        let mut state = RecorderState::new();
        state.mouse_x = 100.0;
        state.mouse_y = 200.0;
        state.on_event(Event {
            time: std::time::SystemTime::now(),
            name: None,
            event_type: EventType::ButtonPress(Button::Left),
        });
        let steps = state.flush_and_take_steps();
        assert_eq!(steps.len(), 1);
        assert_eq!(steps[0]["action"], "click");
        assert_eq!(steps[0]["x"], 100);
        assert_eq!(steps[0]["y"], 200);
    }

    #[test]
    fn arrow_key_produces_key_combo() {
        let mut state = RecorderState::new();
        state.on_event(key_press(Key::DownArrow));
        let steps = state.flush_and_take_steps();
        assert_eq!(steps.len(), 1);
        assert_eq!(steps[0]["action"], "keyCombo");
        assert_eq!(steps[0]["keys"], json!(["down"]));
    }

    #[test]
    fn ctrl_c_produces_combo_array() {
        let mut state = RecorderState::new();
        state.on_event(key_press(Key::ControlLeft));
        state.on_event(key_press(Key::KeyC));
        let steps = state.flush_and_take_steps();
        assert_eq!(steps.len(), 1);
        assert_eq!(steps[0]["keys"], json!(["ctrl", "c"]));
    }

    #[test]
    fn enter_produces_key_combo() {
        let mut state = RecorderState::new();
        state.on_event(key_press(Key::Return));
        let steps = state.flush_and_take_steps();
        assert_eq!(steps[0]["keys"], json!(["enter"]));
    }
}
