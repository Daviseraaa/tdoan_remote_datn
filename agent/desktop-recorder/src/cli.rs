use std::path::PathBuf;
use std::thread;
use std::time::Duration;

use crate::record_engine::engine;
use crate::replay;
use crate::store;

#[cfg(windows)]
fn attach_parent_console() {
    use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
    unsafe {
        AttachConsole(ATTACH_PARENT_PROCESS);
    }
}

pub fn print_usage() {
    eprintln!("DATN Desktop Recorder (Windows)");
    eprintln!();
    eprintln!("Usage:");
    eprintln!("  datn-desktop-recorder              Mo giao dien (GUI)");
    eprintln!("  datn-desktop-recorder gui          Mo giao dien");
    eprintln!("  datn-desktop-recorder record [--name \"Ten\"]  Ghi CLI (F12 dung)");
    eprintln!("  datn-desktop-recorder replay <file.json>       Chay lai ban ghi");
    eprintln!();
    eprintln!("  Luu tai: %ProgramData%\\DATN\\desktop-recordings\\");
}

fn run_record(name: &str, capture_uia: bool, show_highlight: bool) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(windows)]
    attach_parent_console();

    eprintln!("Dang ghi... Nhan F12 de dung va luu.");
    if capture_uia {
        eprintln!("UIA: bat (gan selector vao buoc click).");
    }
    if show_highlight {
        eprintln!("Vien highlight: bat.");
    }
    eprintln!("Thu muc: {}", store::recordings_dir().display());

    let eng = engine();
    eng.start(name.to_string(), capture_uia, show_highlight)?;

    while eng.is_recording() {
        if eng.take_hotkey_stop() {
            break;
        }
        thread::sleep(Duration::from_millis(100));
    }

    let saved = eng.stop_and_save()?;
    eprintln!("Da luu: {}", saved.path);
    eprintln!("ID: {}", saved.id);
    eprintln!("Ten: {}", saved.name);
    Ok(())
}

fn parse_record_flags(args: &[String]) -> (String, bool, bool) {
    let mut name = String::new();
    let mut capture_uia = true;
    let mut show_highlight = true;
    let mut i = 2;
    while i < args.len() {
        if args[i] == "--name" && i + 1 < args.len() {
            name = args[i + 1].clone();
            i += 2;
        } else if args[i] == "--no-uia" {
            capture_uia = false;
            i += 1;
        } else if args[i] == "--no-highlight" {
            show_highlight = false;
            i += 1;
        } else {
            i += 1;
        }
    }
    (name, capture_uia, show_highlight)
}

/// Trả về exit code.
pub fn dispatch(args: &[String]) -> i32 {
    match args.get(1).map(String::as_str) {
        Some("gui") | Some("app") => match crate::gui::run() {
            Ok(()) => 0,
            Err(e) => {
                eprintln!("GUI error: {e}");
                1
            }
        },
        Some("record") => {
            let (name, capture_uia, show_highlight) = parse_record_flags(args);
            match run_record(&name, capture_uia, show_highlight) {
                Ok(()) => 0,
                Err(e) => {
                    eprintln!("Loi: {e}");
                    1
                }
            }
        }
        Some("replay") => {
            #[cfg(windows)]
            attach_parent_console();
            let path = match args.get(2) {
                Some(p) => PathBuf::from(p),
                None => {
                    eprintln!("Usage: datn-desktop-recorder replay <path.json>");
                    return 2;
                }
            };
            let outcome = replay::run_replay(&path);
            if outcome.ok {
                if !outcome.message.is_empty() {
                    println!("{}", outcome.message);
                }
                0
            } else {
                eprintln!("{}", outcome.message);
                1
            }
        }
        Some("help") | Some("--help") | Some("-h") => {
            #[cfg(windows)]
            attach_parent_console();
            print_usage();
            0
        }
        _ => {
            #[cfg(windows)]
            attach_parent_console();
            print_usage();
            1
        }
    }
}
