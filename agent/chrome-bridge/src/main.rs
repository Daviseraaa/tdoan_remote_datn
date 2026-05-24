//! Native Messaging host: Chrome extension <-> DATN agent (`\\.\pipe\DATN_ChromeBridge_v1`).

mod native_stdio;
mod pipe_client;

use std::io::{stdout, Write};
use std::sync::{Arc, Mutex};

use pipe_client::{connect_with_retry, IpcRequestV1, IPC_PROTOCOL_VERSION};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::mpsc;

use native_stdio::{read_message, write_message};

#[tokio::main]
async fn main() {
    if let Err(e) = run().await {
        eprintln!("[datn-chrome-bridge] {}", e);
        std::process::exit(1);
    }
}

async fn write_ipc_line(
    pipe: &mut tokio::io::WriteHalf<tokio::net::windows::named_pipe::NamedPipeClient>,
    req: &IpcRequestV1,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut line = serde_json::to_string(req)?;
    line.push('\n');
    pipe.write_all(line.as_bytes()).await?;
    pipe.flush().await?;
    Ok(())
}

async fn run() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let pipe = connect_with_retry(30_000).await?;
    let (pipe_read, pipe_write) = tokio::io::split(pipe);
    let mut pipe_lines = BufReader::new(pipe_read);
    let mut pipe_write = pipe_write;

    let ping = serde_json::to_vec(&json!({ "type": "bridgeConnected", "ok": true }))?;
    {
        let mut out = stdout();
        write_message(&mut out, &ping)?;
    }

    let chrome_out = Arc::new(Mutex::new(stdout()));
    let (chrome_tx, mut chrome_rx) = mpsc::channel::<Vec<u8>>(32);

    std::thread::spawn(move || {
        let mut stdin = std::io::stdin();
        loop {
            match read_message(&mut stdin) {
                Ok(None) => break,
                Ok(Some(buf)) => {
                    if chrome_tx.blocking_send(buf).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    let mut line_buf = String::new();
    loop {
        tokio::select! {
            read_res = pipe_lines.read_line(&mut line_buf) => {
                match read_res {
                    Ok(0) => break,
                    Ok(_) => {
                        let t = line_buf.trim().to_string();
                        line_buf.clear();
                        if t.is_empty() { continue; }
                        let req: IpcRequestV1 = match serde_json::from_str(&t) {
                            Ok(r) => r,
                            Err(_) => continue,
                        };
                        if req.method == "forwardToExtension" {
                            if let Some(payload) = req.payload {
                                if let Ok(body) = serde_json::to_vec(&payload) {
                                    if let Ok(mut out) = chrome_out.lock() {
                                        let _ = write_message(&mut *out, &body);
                                    }
                                }
                            }
                        }
                    }
                    Err(_) => break,
                }
            }
            msg = chrome_rx.recv() => {
                let Some(buf) = msg else { break; };
                let v: Value = match serde_json::from_slice(&buf) {
                    Ok(x) => x,
                    Err(_) => continue,
                };
                let req_id = v
                    .get("requestId")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string();
                let ipc = IpcRequestV1 {
                    v: IPC_PROTOCOL_VERSION,
                    request_id: req_id,
                    capability: "chrome".into(),
                    method: "extensionResponse".into(),
                    payload: Some(v),
                };
                if write_ipc_line(&mut pipe_write, &ipc).await.is_err() {
                    break;
                }
            }
        }
    }
    Ok(())
}
