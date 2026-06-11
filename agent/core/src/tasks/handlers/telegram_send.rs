use async_trait::async_trait;
use serde_json::{json, Value};

use crate::platform::agent_files::read_agent_file_bytes;
use crate::platform::telegram_api;
use crate::tasks::registry::{TaskContext, TaskExecute, TaskHandler};
use crate::tasks::types::TaskOutcome;

pub struct Handler;

const MAX_FILE_BYTES: usize = 50 * 1024 * 1024;

fn payload_str<'a>(p: &'a Value, keys: &[&str]) -> Option<&'a str> {
    for k in keys {
        if let Some(s) = p.get(*k).and_then(|v| v.as_str()) {
            let t = s.trim();
            if !t.is_empty() {
                return Some(t);
            }
        }
    }
    None
}

fn parse_mode(p: &Value, has_file: bool) -> &'static str {
    if let Some(m) = payload_str(p, &["mode", "sendAs", "telegramSendAs"]) {
        let m = m.to_lowercase();
        if m == "message" || m == "text" {
            return "message";
        }
        if m == "photo" {
            return "photo";
        }
        if m == "document" || m == "file" {
            return "document";
        }
    }
    if has_file {
        "document"
    } else {
        "message"
    }
}

#[async_trait]
impl TaskHandler for Handler {
    fn task_type(&self) -> &'static str {
        "TELEGRAM_SEND"
    }

    async fn run(&self, _ctx: &TaskContext<'_>, task: &TaskExecute) -> TaskOutcome {
        let Some(p) = task.payload.as_ref() else {
            return (
                false,
                -1,
                Some("TELEGRAM_SEND: thiếu payload".into()),
                None,
            );
        };

        let bot_token = match payload_str(p, &["botToken"]) {
            Some(t) => t,
            None => {
                return (
                    false,
                    -1,
                    Some("TELEGRAM_SEND: thiếu botToken (server inject khi dispatch)".into()),
                    None,
                );
            }
        };

        let chat_id = match payload_str(p, &["chatId", "chat_id"]) {
            Some(c) => c,
            None => {
                return (
                    false,
                    -1,
                    Some("TELEGRAM_SEND: thiếu chatId".into()),
                    None,
                );
            }
        };

        let file_path = payload_str(p, &["filePath", "file_path", "path"]);
        let mode = parse_mode(p, file_path.is_some());
        let caption = payload_str(p, &["caption"]);
        let file_name_override = payload_str(p, &["fileName", "telegramFileName", "file_name"]);

        let result = match mode {
            "message" => {
                let text = match payload_str(p, &["text", "message", "content"]) {
                    Some(t) => t,
                    None => {
                        return (
                            false,
                            -1,
                            Some("TELEGRAM_SEND: mode message cần text".into()),
                            None,
                        );
                    }
                };
                telegram_api::send_message_text(bot_token, chat_id, text)
                    .await
                    .map(|id| ("sendMessage", id))
            }
            "photo" | "document" => {
                let path = match file_path {
                    Some(p) => p,
                    None => {
                        return (
                            false,
                            -1,
                            Some("TELEGRAM_SEND: cần filePath trên agent".into()),
                            None,
                        );
                    }
                };
                let (bytes, mime, name) = match read_agent_file_bytes(path, Some(MAX_FILE_BYTES)) {
                    Ok(v) => v,
                    Err(e) => return (false, -1, Some(e), None),
                };
                let file_name = file_name_override.unwrap_or(&name);
                let cap = caption;
                if mode == "photo" {
                    telegram_api::send_photo_file(
                        bot_token,
                        chat_id,
                        bytes,
                        file_name,
                        &mime,
                        cap,
                    )
                    .await
                    .map(|id| ("sendPhoto", id))
                } else {
                    telegram_api::send_document_file(
                        bot_token,
                        chat_id,
                        bytes,
                        file_name,
                        &mime,
                        cap,
                    )
                    .await
                    .map(|id| ("sendDocument", id))
                }
            }
            _ => Err("mode không hợp lệ".into()),
        };

        match result {
            Ok((method, message_id)) => (
                true,
                0,
                None,
                Some(json!({
                    "method": method,
                    "messageId": message_id,
                    "chatId": chat_id,
                    "mode": mode,
                    "filePath": file_path,
                })),
            ),
            Err(e) => (false, -1, Some(e), None),
        }
    }
}
