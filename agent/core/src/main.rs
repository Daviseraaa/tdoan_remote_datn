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
        _ => {
            eprintln!(
                "Usage:\n  datn-agent-native [agent]   WebSocket agent (mặc định)\n  datn-agent-native service   Windows Service\n  datn-agent-native worker    Named pipe user + desktop\n  datn-agent-native desktop-exec\n  datn-agent-native ping-console\n"
            );
            std::process::exit(2);
        }
    }
}
