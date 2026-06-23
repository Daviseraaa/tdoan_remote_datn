#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

mod cli;
mod convert;
#[cfg(windows)]
mod keyboard_win;
mod gui;
mod record_engine;
mod replay;
mod store;

fn main() {
    #[cfg(windows)]
    stationhub_windows_uia::enable_per_monitor_v2();

    let args: Vec<String> = std::env::args().collect();
    let code = if args.len() < 2 {
        match gui::run() {
            Ok(()) => 0,
            Err(e) => {
                eprintln!("GUI error: {e}");
                1
            }
        }
    } else {
        cli::dispatch(&args)
    };
    std::process::exit(code);
}
