//! Chrome extension bridge — named pipe `\\.\pipe\StationHub_ChromeBridge_v1`.

use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::Duration;

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio::time::timeout;

use super::ipc::{IpcRequestV1, IPC_PROTOCOL_VERSION};

pub const PIPE_CHROME_BRIDGE: &str = r"\\.\pipe\StationHub_ChromeBridge_v1";

enum BridgeCmd {
    Forward {
        request_id: String,
        body: Value,
        reply: oneshot::Sender<Result<Value, String>>,
    },
}

struct BridgeState {
    cmd_tx: Option<mpsc::Sender<BridgeCmd>>,
}

static STATE: OnceLock<Mutex<BridgeState>> = OnceLock::new();

fn state() -> &'static Mutex<BridgeState> {
    STATE.get_or_init(|| Mutex::new(BridgeState { cmd_tx: None }))
}

pub fn is_bridge_connected() -> bool {
    state()
        .try_lock()
        .map(|g| g.cmd_tx.is_some())
        .unwrap_or(false)
}

/// Chờ chrome-bridge (native host) kết nối pipe — extension thường cần vài giây sau khi mở Chrome.
pub async fn wait_for_bridge_connected(timeout_ms: u64) -> Result<(), String> {
    let timeout_ms = timeout_ms.clamp(1_000, 120_000);
    let deadline =
        std::time::Instant::now() + Duration::from_millis(timeout_ms);
    while std::time::Instant::now() < deadline {
        if is_bridge_connected() {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    let secs = timeout_ms / 1000;
    Err(format!(
        "Không kết nối được extension Chrome sau {secs} giây.\n\n\
         Trên máy agent:\n\
         1. Giải nén gói StationHub Chrome Recorder và chạy Cai-dat.bat\n\
         2. Chrome → chrome://extensions → bật extension StationHub\n\
         3. Tắt Chrome hẳn (Thoát) rồi mở lại\n\
         4. Mở StationHub Agent (icon khay hệ thống) — không chỉ Windows Service"
    ))
}

const MSG_BRIDGE_OFFLINE: &str = "Chrome extension chưa sẵn sàng trên máy agent. \
Chạy Cai-dat.bat từ gói cài đặt, bật extension trên Chrome, tắt Chrome hẳn rồi mở lại. \
StationHub Agent phải đang chạy (icon khay hệ thống).";

fn user_bridge_error(raw: &str) -> String {
    let lower = raw.to_lowercase();
    if lower.contains("timeout") {
        return "Thao tác trên trang quá lâu — trang có thể chưa tải xong hoặc phần tử không còn trên màn hình.".into();
    }
    if lower.contains("no matching tab") || lower.contains("no matching") {
        return "Không tìm thấy tab trình duyệt phù hợp. Mở đúng trang web trước khi chạy.".into();
    }
    if lower.contains("content script") {
        return "Không thao tác được trên tab này. Thử mở lại trang hoặc dùng trang http/https.".into();
    }
    if !raw.is_empty() && raw.len() <= 180 && !raw.contains("pipe") && !raw.contains("bridge task") {
        return raw.to_string();
    }
    MSG_BRIDGE_OFFLINE.to_string()
}

/// Chạy lại danh sách bước Chrome extension (click / fill / delay / …).
pub async fn replay_steps(
    steps_arr: &[Value],
    step_payload_fn: impl Fn(&serde_json::Map<String, Value>) -> Value,
    default_wait_ms: u64,
    max_steps: usize,
    url_allowed: impl Fn(&str) -> bool,
) -> Result<Value, String> {
    if steps_arr.is_empty() {
        return Err("steps rỗng".into());
    }
    if steps_arr.len() > max_steps {
        return Err(format!(
            "Quá nhiều bước ({} > {})",
            steps_arr.len(),
            max_steps
        ));
    }

    let mut outcomes = Vec::new();
    for (idx, step) in steps_arr.iter().enumerate() {
        let o = match step.as_object() {
            Some(o) => o,
            None => return Err(format!("step {} không phải object", idx)),
        };
        let action = o.get("action").and_then(|a| a.as_str()).unwrap_or("");
        if action.is_empty() {
            return Err(format!("step {} thiếu action", idx));
        }

        let payload = step_payload_fn(o);
        let step_wait = o
            .get("timeoutMs")
            .and_then(|x| x.as_u64())
            .unwrap_or(default_wait_ms);

        let result = execute(action, payload, step_wait).await;
        match result {
            Ok(v) => {
                if let Some(url) = v.get("url").and_then(|x| x.as_str()) {
                    if !url_allowed(url) {
                        return Err(format!("URL không được phép: {}", url));
                    }
                }
                outcomes.push(serde_json::json!({
                    "step": idx,
                    "action": action,
                    "ok": true,
                    "result": v
                }));
            }
            Err(e) => {
                return Err(format!(
                    "Bước {} ({}): {}",
                    idx + 1,
                    action,
                    user_bridge_error(&e)
                ));
            }
        }
    }

    Ok(serde_json::json!({
        "outcomes": outcomes,
        "steps": steps_arr.len()
    }))
}

pub async fn execute(action: &str, payload: Value, wait_ms: u64) -> Result<Value, String> {
    let tx = {
        let g = state().lock().await;
        g.cmd_tx.clone().ok_or_else(|| MSG_BRIDGE_OFFLINE.to_string())?
    };

    let request_id = format!(
        "req-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    );

    let chrome_msg = json!({
        "v": 1,
        "requestId": request_id,
        "action": action,
        "payload": payload,
    });

    let (reply_tx, reply_rx) = oneshot::channel();
    tx.send(BridgeCmd::Forward {
        request_id: request_id.clone(),
        body: chrome_msg,
        reply: reply_tx,
    })
    .await
    .map_err(|_| MSG_BRIDGE_OFFLINE.to_string())?;

    let dur = Duration::from_millis(wait_ms.max(1000).min(300_000));
    match timeout(dur, reply_rx).await {
        Ok(Ok(Ok(v))) => Ok(v),
        Ok(Ok(Err(e))) => Err(user_bridge_error(&e)),
        Ok(Err(_)) => Err(MSG_BRIDGE_OFFLINE.to_string()),
        Err(_) => Err(user_bridge_error(&format!("timeout after {wait_ms}ms"))),
    }
}

pub async fn run_chrome_bridge_pipe_forever() -> std::io::Result<()> {
    use tokio::io::split;
    use tokio::net::windows::named_pipe::ServerOptions;

    loop {
        let server = ServerOptions::new().create(PIPE_CHROME_BRIDGE)?;
        server.connect().await?;
        log::info!("[chrome-bridge] extension host connected to agent pipe");
        let (read_half, write_half) = split(server);
        let (cmd_tx, mut cmd_rx) = mpsc::channel::<BridgeCmd>(16);

        {
            let mut g = state().lock().await;
            g.cmd_tx = Some(cmd_tx);
        }

        let mut lines = BufReader::new(read_half).lines();
        let mut write_half = write_half;
        let mut pending: HashMap<String, oneshot::Sender<Result<Value, String>>> = HashMap::new();

        loop {
            tokio::select! {
                cmd = cmd_rx.recv() => {
                    let Some(BridgeCmd::Forward { request_id, body, reply }) = cmd else { break; };
                    pending.insert(request_id.clone(), reply);
                    let ipc = IpcRequestV1 {
                        v: IPC_PROTOCOL_VERSION,
                        request_id: request_id.clone(),
                        capability: "chrome".into(),
                        method: "forwardToExtension".into(),
                        payload: Some(body),
                    };
                    let mut line = match serde_json::to_string(&ipc) {
                        Ok(s) => s,
                        Err(_) => {
                            pending.remove(&request_id);
                            continue;
                        }
                    };
                    line.push('\n');
                    if write_half.write_all(line.as_bytes()).await.is_err()
                        || write_half.flush().await.is_err()
                    {
                        if let Some(tx) = pending.remove(&request_id) {
                            let _ = tx.send(Err(MSG_BRIDGE_OFFLINE.to_string()));
                        }
                        break;
                    }
                }
                line = lines.next_line() => {
                    match line {
                        Ok(Some(l)) => {
                            let t = l.trim();
                            if t.is_empty() { continue; }
                            let req: IpcRequestV1 = match serde_json::from_str(t) {
                                Ok(r) => r,
                                Err(_) => continue,
                            };
                            if req.method != "extensionResponse" {
                                continue;
                            }
                            let payload = match req.payload {
                                Some(p) => p,
                                None => continue,
                            };
                            let req_id = payload
                                .get("requestId")
                                .and_then(|x| x.as_str())
                                .unwrap_or("")
                                .to_string();
                            if let Some(tx) = pending.remove(&req_id) {
                                let ok = payload.get("ok").and_then(|x| x.as_bool()).unwrap_or(false);
                                if ok {
                                    let result = payload.get("result").cloned().unwrap_or(payload);
                                    let _ = tx.send(Ok(result));
                                } else {
                                    let err = payload
                                        .get("error")
                                        .and_then(|x| x.as_str())
                                        .unwrap_or("extension error");
                                    let _ = tx.send(Err(err.to_string()));
                                }
                            }
                        }
                        Ok(None) | Err(_) => break,
                    }
                }
            }
        }

        {
            let mut g = state().lock().await;
            g.cmd_tx = None;
        }
        log::warn!("[chrome-bridge] extension host disconnected from agent pipe");
        for (_, tx) in pending.drain() {
            let _ = tx.send(Err(MSG_BRIDGE_OFFLINE.to_string()));
        }
    }
}
