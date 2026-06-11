use super::desktop;
use super::ipc::{IpcRequestV1, IpcResponseV1, IPC_PROTOCOL_VERSION};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

pub async fn handle_request(req: IpcRequestV1, allow_desktop: bool) -> IpcResponseV1 {
    let id = req.request_id.clone();
    if req.v != IPC_PROTOCOL_VERSION {
        return IpcResponseV1::err_json(
            id,
            "VERSION",
            format!("unsupported protocol v={}", req.v),
        );
    }

    match (req.capability.as_str(), req.method.as_str()) {
        ("system", "ping") => IpcResponseV1::ok_json(id, json!({ "pong": true, "ts": chrono_like_ms() })),
        ("echo", _) => IpcResponseV1::ok_json(
            id,
            json!({ "echo": req.payload.unwrap_or(Value::Null) }),
        ),
        ("desktop", "runSteps") if allow_desktop => match desktop::run_steps_json(req.payload, None).await {
            Ok(v) => IpcResponseV1::ok_json(id, v),
            Err(e) => IpcResponseV1::err_json(id, "DESKTOP", e),
        },
        ("desktop", _) => IpcResponseV1::err_json(
            id,
            "FORBIDDEN",
            "desktop capability disabled on this pipe".to_string(),
        ),
        _ => IpcResponseV1::err_json(
            id,
            "UNKNOWN",
            format!("unknown {}.{}", req.capability, req.method),
        ),
    }
}

fn chrono_like_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub async fn handle_connection<R, W>(allow_desktop: bool, read: R, mut write: W)
where
    R: tokio::io::AsyncRead + Unpin,
    W: tokio::io::AsyncWrite + Unpin,
{
    let mut lines = BufReader::new(read).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let req: IpcRequestV1 = match serde_json::from_str(line) {
            Ok(r) => r,
            Err(e) => {
                let res = IpcResponseV1::err_json(
                    "parse-error".to_string(),
                    "PARSE",
                    e.to_string(),
                );
                if let Ok(s) = super::ipc::response_line(&res) {
                    let _ = write.write_all(s.as_bytes()).await;
                }
                let _ = write.flush().await;
                continue;
            }
        };
        let res = handle_request(req, allow_desktop).await;
        if let Ok(s) = super::ipc::response_line(&res) {
            let _ = write.write_all(s.as_bytes()).await;
            let _ = write.flush().await;
        }
    }
}
