mod chrome_script_cli;
mod desktop_replay_cli;
mod config;
mod connection;
mod platform;
mod protocol;
mod tasks;

#[cfg(not(windows))]
fn main() {
    let mut args = std::env::args();
    args.next();
    let cmd = args.next();
    if matches!(cmd.as_deref(), None | Some("agent")) {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("runtime");
        if let Err(e) = rt.block_on(connection::runner::run_foreground()) {
            eprintln!("{}", e);
            std::process::exit(1);
        }
        return;
    }
    eprintln!("datn-agent-native: chế độ service/worker/desktop chỉ trên Windows.");
    std::process::exit(1);
}

#[cfg(windows)]
fn main() {
    datn_windows_uia::enable_per_monitor_v2();

    let mut args = std::env::args();
    let _exe = args.next();
    let cmd = args.next();
    match cmd.as_deref() {
        None | Some("agent") => {
            let rt = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
                .expect("runtime");
            if let Err(e) = rt.block_on(connection::runner::run_foreground()) {
                eprintln!("{}", e);
                std::process::exit(1);
            }
        }
        Some("service") => {
            if let Err(e) = platform::windows::service::run() {
                eprintln!("[service] dispatcher: {}", e);
                std::process::exit(1);
            }
        }
        Some("worker") => {
            let rt = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
                .expect("runtime");
            rt.block_on(async {
                if let Err(e) = platform::windows::pipe_server::run_user_pipe_forever().await {
                    eprintln!("[worker] {}", e);
                    std::process::exit(1);
                }
            });
        }
        Some("desktop-exec") => {
            if let Err(e) = platform::windows::desktop::run_steps_stdio() {
                eprintln!("{}", e);
                std::process::exit(1);
            }
        }
        Some("config-print") => {
            let path = config::env_load::default_config_path();
            config::env_load::load_env_files();
            let cfg = config::AgentConfig::load();
            let raw = std::env::var("CHROME_EXTENSION_ENABLED").unwrap_or_else(|_| "<unset>".into());
            let file = config::env_load::read_key_from_active_config("CHROME_EXTENSION_ENABLED")
                .unwrap_or_else(|| "<missing>".into());
            println!("config_file={}", path.display());
            println!("CHROME_EXTENSION_ENABLED file={file}");
            println!("CHROME_EXTENSION_ENABLED env={raw}");
            println!(
                "chrome_extension_enabled (effective)={}",
                config::settings::chrome_extension_enabled_now()
            );
            println!("desktop_automation_enabled={}", cfg.desktop_automation_enabled);
        }
        Some("ping-console") => {
            let rt = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
                .expect("runtime");
            eprintln!(
                "[ping-console] pipe {} (Ctrl+C dừng)",
                platform::windows::ipc::PIPE_SVC
            );
            rt.block_on(async {
                let _ = platform::windows::pipe_server::run_svc_pipe_forever().await;
            });
        }
        Some("chrome-replay") => {
            let path = match args.next() {
                Some(p) => std::path::PathBuf::from(p),
                None => {
                    eprintln!("Usage: datn-agent-native chrome-replay <path.json>");
                    std::process::exit(2);
                }
            };
            let rt = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
                .expect("runtime");
            if let Err(e) = rt.block_on(chrome_script_cli::run_chrome_replay(path)) {
                eprintln!("{}", e);
                std::process::exit(1);
            }
        }
        Some("desktop-replay") => {
            let path = match args.next() {
                Some(p) => std::path::PathBuf::from(p),
                None => {
                    eprintln!("Usage: datn-agent-native desktop-replay <path.json>");
                    std::process::exit(2);
                }
            };
            let rt = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
                .expect("runtime");
            if let Err(e) = rt.block_on(desktop_replay_cli::run_desktop_replay(path)) {
                eprintln!("{}", e);
                std::process::exit(1);
            }
        }
        _ => {
            eprintln!(
                "Usage:\n  datn-agent-native [agent]   WebSocket agent (mặc định)\n  datn-agent-native service   Windows Service\n  datn-agent-native worker    Named pipe user + desktop\n  datn-agent-native desktop-exec\n  datn-agent-native config-print\n  datn-agent-native ping-console\n  datn-agent-native chrome-replay <file.json>\n  datn-agent-native desktop-replay <file.json>\n"
            );
            std::process::exit(2);
        }
    }
}
