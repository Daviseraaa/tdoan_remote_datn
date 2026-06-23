//! Lấy ký tự thực tế từ phím bấm theo bố cục Windows (Telex/VNI/IME…).

use rdev::Key;
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetKeyboardState, MapVirtualKeyW, ToUnicode, MAPVK_VK_TO_VSC, VK_SHIFT,
};

#[derive(Default, Clone, Copy)]
pub struct KeyModifiers {
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
    pub meta: bool,
}

pub fn text_from_key_press(key: Key, mods: &KeyModifiers, event_name: Option<&str>) -> Option<String> {
    if mods.ctrl || mods.alt || mods.meta {
        return None;
    }
    if let Some(name) = event_name {
        if let Some(text) = text_from_rdev_name(name) {
            return Some(text);
        }
    }
    text_from_to_unicode(key, mods.shift)
}

fn text_from_rdev_name(name: &str) -> Option<String> {
    let n = name.trim();
    if n.is_empty() {
        return None;
    }
    match n {
        "Shift"
        | "Control"
        | "Alt"
        | "Meta"
        | "Return"
        | "Tab"
        | "Escape"
        | "Backspace"
        | "Delete"
        | "Insert"
        | "Home"
        | "End"
        | "PageUp"
        | "PageDown"
        | "Up"
        | "Down"
        | "Left"
        | "Right"
        | "Space"
        | "CapsLock"
        | "NumLock"
        | "ScrollLock"
        | "Pause"
        | "PrintScreen" => None,
        _ => Some(n.to_string()),
    }
}

fn text_from_to_unicode(key: Key, shift: bool) -> Option<String> {
    let vk = key_to_vk(key)?;
    unsafe {
        let mut state = [0u8; 256];
        if GetKeyboardState(state.as_mut_ptr()) == 0 {
            return None;
        }
        state[VK_SHIFT as usize] = if shift { 0x80 } else { 0 };
        let scan = MapVirtualKeyW(vk as u32, MAPVK_VK_TO_VSC);
        if scan == 0 {
            return None;
        }
        let mut buf = [0u16; 8];
        let n = ToUnicode(
            vk as u32,
            scan,
            state.as_ptr(),
            buf.as_mut_ptr(),
            buf.len() as i32,
            0,
        );
        if n <= 0 {
            return None;
        }
        String::from_utf16(&buf[..n as usize]).ok()
    }
}

fn key_to_vk(key: Key) -> Option<u16> {
    Some(match key {
        Key::KeyA => 0x41,
        Key::KeyB => 0x42,
        Key::KeyC => 0x43,
        Key::KeyD => 0x44,
        Key::KeyE => 0x45,
        Key::KeyF => 0x46,
        Key::KeyG => 0x47,
        Key::KeyH => 0x48,
        Key::KeyI => 0x49,
        Key::KeyJ => 0x4A,
        Key::KeyK => 0x4B,
        Key::KeyL => 0x4C,
        Key::KeyM => 0x4D,
        Key::KeyN => 0x4E,
        Key::KeyO => 0x4F,
        Key::KeyP => 0x50,
        Key::KeyQ => 0x51,
        Key::KeyR => 0x52,
        Key::KeyS => 0x53,
        Key::KeyT => 0x54,
        Key::KeyU => 0x55,
        Key::KeyV => 0x56,
        Key::KeyW => 0x57,
        Key::KeyX => 0x58,
        Key::KeyY => 0x59,
        Key::KeyZ => 0x5A,
        Key::Num0 => 0x30,
        Key::Num1 => 0x31,
        Key::Num2 => 0x32,
        Key::Num3 => 0x33,
        Key::Num4 => 0x34,
        Key::Num5 => 0x35,
        Key::Num6 => 0x36,
        Key::Num7 => 0x37,
        Key::Num8 => 0x38,
        Key::Num9 => 0x39,
        Key::Minus => 0xBD,
        Key::Equal => 0xBB,
        Key::LeftBracket => 0xDB,
        Key::RightBracket => 0xDD,
        Key::BackSlash => 0xDC,
        Key::SemiColon => 0xBA,
        Key::Quote => 0xDE,
        Key::BackQuote => 0xC0,
        Key::Comma => 0xBC,
        Key::Dot => 0xBE,
        Key::Slash => 0xBF,
        Key::Space => 0x20,
        _ => return None,
    })
}
