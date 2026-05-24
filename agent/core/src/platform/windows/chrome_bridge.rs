//! Chrome extension bridge — named pipe `\\.\pipe\DATN_ChromeBridge_v1`.

use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::Duration;

use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio::time::timeout;

use super::ipc::{IpcRequestV1, IPC_PROTOCOL_VERSION};

pub const PIPE_CHROME_BRIDGE: &str = r"\\.\pipe\DATN_ChromeBridge_v1";

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

pub async fn execute(action: &str, payload: Value, wait_ms: u64) -> Result<Value, String> {
    let tx = {
        let g = state().lock().await;
        g.cmd_tx.clone().ok_or_else(|| {
            "Chrome bridge offline — mở Chrome, bật extension DATN, agent phải đang chạy."
                .to_string()
        })?
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
    .map_err(|_| "bridge task stopped".to_string())?;

    let dur = Duration::from_millis(wait_ms.max(1000).min(300_000));
    match timeout(dur, reply_rx).await {
        Ok(Ok(Ok(v))) => Ok(v),
        Ok(Ok(Err(e))) => Err(e),
        Ok(Err(_)) => Err("bridge response channel closed".into()),
        Err(_) => Err(format!("timeout after {}ms", wait_ms)),
    }
}

pub async fn run_chrome_bridge_pipe_forever() -> std::io::Result<()> {
    use tokio::io::split;
    use tokio::net::windows::named_pipe::ServerOptions;

    loop {
        let server = ServerOptions::new().create(PIPE_CHROME_BRIDGE)?;
        server.connect().await?;
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
                            let _ = tx.send(Err("pipe write failed".into()));
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
        for (_, tx) in pending.drain() {
            let _ = tx.send(Err("bridge disconnected".into()));
        }
    }
}
