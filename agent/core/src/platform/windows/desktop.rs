//! Thực thi desktop automation qua Win32 (session hiện tại).

use serde_json::{json, Value};
use std::time::Duration;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT, KEYBD_EVENT_FLAGS,
    KEYEVENTF_KEYUP, KEYEVENTF_UNICODE, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
    MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEEVENTF_WHEEL, MOUSEINPUT, VIRTUAL_KEY,
};
use windows::Win32::UI::WindowsAndMessaging::SetCursorPos;

const WHEEL_DELTA: i32 = 120;
const CURSOR_SETTLE_MS: u64 = 40;

fn set_cursor_physical(x: i32, y: i32) -> Result<(), String> {
    datn_windows_uia::set_physical_cursor(x, y).or_else(|_| unsafe {
        SetCursorPos(x, y).map_err(|e| e.message().to_string())
    })
}

pub async fn run_steps_json(payload: Option<Value>) -> Result<Value, String> {
    datn_windows_uia::enable_per_monitor_v2();

    let steps = payload
        .as_ref()
        .and_then(|p| p.get("steps"))
        .ok_or_else(|| "missing payload.steps".to_string())?;
    let arr = steps.as_array().ok_or("steps must be array")?;
    let mut outcomes: Vec<Value> = Vec::new();

    for (idx, step) in arr.iter().enumerate() {
        let i = idx + 1;
        let obj = step.as_object().ok_or("step must be object")?;
        let action = obj
            .get("action")
            .and_then(|a| a.as_str())
            .ok_or("step.action required")?;
        match action {
            "delay" => {
                let ms = obj
                    .get("ms")
                    .and_then(|n| n.as_u64())
                    .or_else(|| obj.get("ms").and_then(|n| n.as_i64()).map(|n| n as u64))
                    .ok_or("delay.ms")?;
                tokio::time::sleep(Duration::from_millis(ms.min(120_000))).await;
                outcomes.push(json!({"index": i, "action": action, "ok": true}));
            }
            "openApp" => {
                let target = obj
                    .get("target")
                    .and_then(|t| t.as_str())
                    .ok_or("openApp.target")?;
                crate::platform::open_app::open_app_resolve(target)
                    .await
                    .map_err(|e| e)?;
                outcomes.push(json!({"index": i, "action": action, "ok": true, "detail": target}));
            }
            "move" => {
                let x = as_i32(obj.get("x")).ok_or("move.x")?;
                let y = as_i32(obj.get("y")).ok_or("move.y")?;
                set_cursor_physical(x, y)?;
                outcomes.push(json!({"index": i, "action": action, "ok": true}));
            }
            "click" => {
                let step_val = Value::Object(obj.clone());
                let focused = datn_windows_uia::focus_host_for_step(&step_val);
                if focused {
                    tokio::time::sleep(Duration::from_millis(datn_windows_uia::focus_settle_ms())).await;
                }

                let (x, y) = datn_windows_uia::resolve_click_point_for_step(&step_val)
                    .ok_or("click: thiếu tọa độ x/y")?;

                let mut via = "coords";
                if let Some(uia) = obj.get("uia") {
                    if let Some(mode) = datn_windows_uia::try_invoke_click(uia, x, y) {
                        via = mode;
                    }
                }

                if via == "coords" {
                    set_cursor_physical(x, y)?;
                    tokio::time::sleep(Duration::from_millis(CURSOR_SETTLE_MS)).await;
                    let button = obj
                        .get("button")
                        .and_then(|b| b.as_str())
                        .unwrap_or("left");
                    let double = obj.get("double").and_then(|b| b.as_bool()).unwrap_or(false);
                    let n = if double { 2 } else { 1 };
                    for _ in 0..n {
                        click_mouse(button)?;
                    }
                }
                outcomes.push(json!({
                    "index": i,
                    "action": action,
                    "ok": true,
                    "via": via,
                    "x": x,
                    "y": y,
                    "focused": focused,
                }));
            }
            "typeText" => {
                let step_val = Value::Object(obj.clone());
                let focused = datn_windows_uia::focus_host_for_step(&step_val);
                if focused {
                    tokio::time::sleep(Duration::from_millis(datn_windows_uia::focus_settle_ms())).await;
                }
                let text = obj
                    .get("text")
                    .and_then(|t| t.as_str())
                    .ok_or("typeText.text")?;
                type_unicode_text(text)?;
                outcomes.push(json!({"index": i, "action": action, "ok": true}));
            }
            "keyCombo" => {
                let names = parse_key_combo_names(obj)?;
                if names.is_empty() {
                    return Err("keyCombo.keys empty".to_string());
                }
                press_combo(&names)?;
                outcomes.push(json!({"index": i, "action": action, "ok": true}));
            }
            "scroll" => {
                let dir = obj
                    .get("direction")
                    .and_then(|d| d.as_str())
                    .ok_or("scroll.direction")?;
                let amount = obj
                    .get("amount")
                    .and_then(|a| a.as_i64())
                    .unwrap_or(3) as i32;
                scroll_mouse(dir, amount.clamp(1, 100))?;
                outcomes.push(json!({"index": i, "action": action, "ok": true}));
            }
            other => return Err(format!("unknown action: {}", other)),
        }
    }

    Ok(json!({ "outcomes": outcomes, "steps": arr.len() }))
}

fn as_i32(v: Option<&Value>) -> Option<i32> {
    v.and_then(|x| {
        if let Some(n) = x.as_i64() {
            return Some(n as i32);
        }
        if let Some(n) = x.as_u64() {
            return Some(n as i32);
        }
        x.as_f64().map(|f| f as i32)
    })
}

unsafe fn send_inputs(inputs: &[INPUT]) -> Result<(), String> {
    let n = SendInput(inputs, std::mem::size_of::<INPUT>() as i32);
    if n as usize != inputs.len() {
        return Err(format!("SendInput returned {}", n));
    }
    Ok(())
}

fn mouse_input(
    flags: windows::Win32::UI::Input::KeyboardAndMouse::MOUSE_EVENT_FLAGS,
    data: u32,
) -> INPUT {
    INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouseData: data,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

fn keybd_vk(vk: VIRTUAL_KEY, up: bool) -> Result<(), String> {
    let flags = if up {
        KEYEVENTF_KEYUP
    } else {
        KEYBD_EVENT_FLAGS(0)
    };
    let input = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    unsafe { send_inputs(&[input]) }
}

fn click_mouse(button: &str) -> Result<(), String> {
    let (down, up) = if button == "right" {
        (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP)
    } else {
        (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP)
    };
    unsafe {
        send_inputs(&[mouse_input(down, 0), mouse_input(up, 0)])?;
    }
    Ok(())
}

fn scroll_mouse(direction: &str, amount: i32) -> Result<(), String> {
    let delta = WHEEL_DELTA.saturating_mul(amount);
    let signed = match direction {
        "up" => delta,
        "down" => -delta,
        "left" | "right" => {
            return Err("horizontal scroll not implemented in native".to_string());
        }
        _ => return Err(format!("bad scroll direction {}", direction)),
    };
    unsafe {
        send_inputs(&[mouse_input(MOUSEEVENTF_WHEEL, signed as u32)])?;
    }
    Ok(())
}

fn type_unicode_text(text: &str) -> Result<(), String> {
    for ch in text.chars() {
        let mut buf = [0u16; 2];
        let enc = ch.encode_utf16(&mut buf);
        for &u in enc.iter() {
            let down = INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VIRTUAL_KEY(0),
                        wScan: u,
                        dwFlags: KEYEVENTF_UNICODE,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            };
            let up = INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VIRTUAL_KEY(0),
                        wScan: u,
                        dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            };
            unsafe {
                send_inputs(&[down])?;
                send_inputs(&[up])?;
            }
        }
    }
    Ok(())
}

fn parse_key_combo_names(obj: &serde_json::Map<String, Value>) -> Result<Vec<String>, String> {
    let keys_val = obj.get("keys").ok_or("keyCombo.keys")?;
    if let Some(arr) = keys_val.as_array() {
        let names: Vec<String> = arr
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.trim().to_string()))
            .filter(|s| !s.is_empty())
            .collect();
        return Ok(names);
    }
    if let Some(s) = keys_val.as_str() {
        return Ok(s
            .split('+')
            .map(|p| p.trim().to_string())
            .filter(|p| !p.is_empty())
            .collect());
    }
    Err("keyCombo.keys phải là mảng hoặc chuỗi (vd. ctrl+c)".into())
}

fn vk_from_name(s: &str) -> Result<VIRTUAL_KEY, String> {
    let k = s.trim().to_lowercase();
    let vk = match k.as_str() {
        "enter" | "return" => VIRTUAL_KEY(0x0D),
        "tab" => VIRTUAL_KEY(0x09),
        "space" => VIRTUAL_KEY(0x20),
        "escape" | "esc" => VIRTUAL_KEY(0x1B),
        "backspace" => VIRTUAL_KEY(0x08),
        "delete" | "del" => VIRTUAL_KEY(0x2E),
        "up" => VIRTUAL_KEY(0x26),
        "down" => VIRTUAL_KEY(0x28),
        "left" => VIRTUAL_KEY(0x25),
        "right" => VIRTUAL_KEY(0x27),
        "home" => VIRTUAL_KEY(0x24),
        "end" => VIRTUAL_KEY(0x23),
        "pageup" => VIRTUAL_KEY(0x21),
        "pagedown" => VIRTUAL_KEY(0x22),
        "insert" => VIRTUAL_KEY(0x2D),
        "printscreen" | "prtsc" => VIRTUAL_KEY(0x2C),
        "pause" | "break" => VIRTUAL_KEY(0x13),
        "scrolllock" => VIRTUAL_KEY(0x91),
        "capslock" => VIRTUAL_KEY(0x14),
        "numlock" => VIRTUAL_KEY(0x90),
        "ctrl" | "control" => VIRTUAL_KEY(0x11),
        "alt" => VIRTUAL_KEY(0x12),
        "shift" => VIRTUAL_KEY(0x10),
        "win" | "meta" | "super" => VIRTUAL_KEY(0x5B),
        "f1" => VIRTUAL_KEY(0x70),
        "f2" => VIRTUAL_KEY(0x71),
        "f3" => VIRTUAL_KEY(0x72),
        "f4" => VIRTUAL_KEY(0x73),
        "f5" => VIRTUAL_KEY(0x74),
        "f6" => VIRTUAL_KEY(0x75),
        "f7" => VIRTUAL_KEY(0x76),
        "f8" => VIRTUAL_KEY(0x77),
        "f9" => VIRTUAL_KEY(0x78),
        "f10" => VIRTUAL_KEY(0x79),
        "f11" => VIRTUAL_KEY(0x7A),
        "f12" => VIRTUAL_KEY(0x7B),
        _ if k.len() == 1 => {
            let c = k.chars().next().unwrap();
            let vk_short = unsafe {
                windows::Win32::UI::Input::KeyboardAndMouse::VkKeyScanW(c as u16)
            };
            if vk_short == -1 {
                return Err(format!("cannot map key {}", s));
            }
            VIRTUAL_KEY(vk_short as u16 & 0xFF)
        }
        _ => return Err(format!("unknown key: {}", s)),
    };
    Ok(vk)
}

fn press_combo(names: &[String]) -> Result<(), String> {
    let mut vks: Vec<VIRTUAL_KEY> = Vec::new();
    for n in names {
        vks.push(vk_from_name(n)?);
    }
    for vk in &vks {
        keybd_vk(*vk, false)?;
    }
    for vk in vks.iter().rev() {
        keybd_vk(*vk, true)?;
    }
    Ok(())
}

pub fn run_steps_stdio() -> Result<(), String> {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| e.to_string())?;
    rt.block_on(run_steps_stdio_async())
}

async fn run_steps_stdio_async() -> Result<(), String> {
    let mut buf = String::new();
    std::io::Read::read_to_string(&mut std::io::stdin(), &mut buf).map_err(|e| e.to_string())?;
    let v: Value = serde_json::from_str(buf.trim()).map_err(|e| e.to_string())?;
    let out = run_steps_json(Some(v)).await?;
    println!("{}", serde_json::to_string(&out).map_err(|e| e.to_string())?);
    Ok(())
}
