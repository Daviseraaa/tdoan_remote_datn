//! Gọi Telegram Bot API (multipart upload).

use serde::Deserialize;

const API_BASE: &str = "https://api.telegram.org";

#[derive(Debug, Deserialize)]
struct TgResponse<T> {
    ok: bool,
    result: Option<T>,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SendMessageResult {
    message_id: i64,
}

async fn post_multipart(
    bot_token: &str,
    method: &str,
    chat_id: &str,
    field_name: &str,
    file_name: &str,
    mime: &str,
    bytes: Vec<u8>,
    caption: Option<&str>,
) -> Result<i64, String> {
    let chat_id = chat_id.trim();
    if chat_id.is_empty() {
        return Err("chatId trống".into());
    }
    let token = bot_token.trim();
    if token.is_empty() {
        return Err("botToken trống".into());
    }

    let url = format!("{}/bot{}/{}", API_BASE, token, method);
    let file_part = reqwest::multipart::Part::bytes(bytes)
        .file_name(file_name.to_string())
        .mime_str(mime)
        .map_err(|e| e.to_string())?;

    let mut form = reqwest::multipart::Form::new()
        .text("chat_id", chat_id.to_string())
        .part(field_name.to_string(), file_part);

    if let Some(cap) = caption.filter(|s| !s.is_empty()) {
        form = form.text("caption", cap.to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .post(&url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("{method} request: {e}"))?;

    let status = res.status();
    let body = res.text().await.map_err(|e| e.to_string())?;
    let parsed: TgResponse<SendMessageResult> =
        serde_json::from_str(&body).map_err(|e| format!("{method} JSON: {e} — {body}"))?;

    if !parsed.ok {
        return Err(parsed
            .description
            .unwrap_or_else(|| format!("HTTP {status}")));
    }

    parsed
        .result
        .map(|r| r.message_id)
        .ok_or_else(|| format!("{method} thiếu message_id: {body}"))
}

pub async fn send_photo_bytes(
    bot_token: &str,
    chat_id: &str,
    png: &[u8],
    caption: Option<&str>,
) -> Result<i64, String> {
    post_multipart(
        bot_token,
        "sendPhoto",
        chat_id,
        "photo",
        "screenshot.png",
        "image/png",
        png.to_vec(),
        caption,
    )
    .await
}

pub async fn send_document_bytes(
    bot_token: &str,
    chat_id: &str,
    png: &[u8],
    file_name: &str,
    caption: Option<&str>,
) -> Result<i64, String> {
    let name = if file_name.trim().is_empty() {
        "screenshot.png".to_string()
    } else {
        file_name.trim().to_string()
    };
    post_multipart(
        bot_token,
        "sendDocument",
        chat_id,
        "document",
        &name,
        "image/png",
        png.to_vec(),
        caption,
    )
    .await
}
