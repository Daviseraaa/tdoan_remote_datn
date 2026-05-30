#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

mod convert;
mod fonts;
mod gui;
mod record_engine;
mod replay;
mod store;

use record_engine::engine;

#[cfg(windows)]
fn attach_parent_console() {
    use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
    unsafe {
        AttachConsole(ATTACH_PARENT_PROCESS);
    }
}

fn print_usage() {
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

fn run_record_cli(name: &str) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(windows)]
    attach_parent_console();

    eprintln!("Dang ghi... Nhan F12 de dung va luu.");
    eprintln!("Thu muc: {}", store::recordings_dir().display());

    let eng = engine();
    eng.start(name.to_string())?;

    while eng.is_recording() {
        if eng.take_hotkey_stop() {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }

    let saved = eng.stop_and_save()?;
    eprintln!("Da luu: {}", saved.path);
    eprintln!("ID: {}", saved.id);
    eprintln!("Ten: {}", saved.name);
    Ok(())
}

fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.len() < 2 {
        if let Err(e) = gui::run() {
            eprintln!("GUI error: {e}");
            std::process::exit(1);
        }
        return;
    }

    match args[1].as_str() {
        "gui" | "app" => {
            if let Err(e) = gui::run() {
                eprintln!("GUI error: {e}");
                std::process::exit(1);
            }
        }
        "record" => {
            let mut name = String::new();
            let mut i = 2;
            while i < args.len() {
                if args[i] == "--name" && i + 1 < args.len() {
                    name = args[i + 1].clone();
                    i += 2;
                } else {
                    i += 1;
                }
            }
            if let Err(e) = run_record_cli(&name) {
                eprintln!("Loi: {e}");
                std::process::exit(1);
            }
        }
        "replay" => {
            #[cfg(windows)]
            attach_parent_console();
            let path = match args.get(2) {
                Some(p) => std::path::PathBuf::from(p),
                None => {
                    eprintln!("Usage: datn-desktop-recorder replay <path.json>");
                    std::process::exit(2);
                }
            };
            let outcome = replay::run_replay(&path);
            if outcome.ok {
                if !outcome.message.is_empty() {
                    println!("{}", outcome.message);
                }
            } else {
                eprintln!("{}", outcome.message);
                std::process::exit(1);
            }
        }
        "help" | "--help" | "-h" => {
            #[cfg(windows)]
            attach_parent_console();
            print_usage();
        }
        _ => {
            #[cfg(windows)]
            attach_parent_console();
            print_usage();
            std::process::exit(1);
        }
    }
}
