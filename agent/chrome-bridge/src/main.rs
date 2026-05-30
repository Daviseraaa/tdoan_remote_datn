//! Native Messaging host: Chrome extension <-> DATN agent (`\\.\pipe\DATN_ChromeBridge_v1`).
//! Ghi script local hoạt động cả khi agent chưa chạy (chỉ cần pipe cho automation).

mod native_stdio;
mod pipe_client;
mod script_store;

use std::io::stdout;
use std::sync::atomic::{AtomicBool, Ordering};
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

fn send_to_chrome(
    chrome_out: &Arc<Mutex<std::io::Stdout>>,
    body: &Value,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let bytes = serde_json::to_vec(body)?;
    let mut out = chrome_out.lock().map_err(|_| "stdout lock poisoned")?;
    write_message(&mut *out, &bytes)?;
    Ok(())
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

async fn handle_recording_complete(
    v: &Value,
    chrome_out: &Arc<Mutex<std::io::Stdout>>,
    pipe_write: &mut Option<tokio::io::WriteHalf<tokio::net::windows::named_pipe::NamedPipeClient>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let script = v.get("script").cloned().unwrap_or(json!({}));
    match script_store::save_recording_script(&script) {
        Ok(saved) => {
            send_to_chrome(
                chrome_out,
                &json!({
                    "type": "recordingSaved",
                    "ok": true,
                    "id": saved.id,
                    "savedPath": saved.path,
                }),
            )?;
            if let Some(pipe) = pipe_write.as_mut() {
                let ipc = IpcRequestV1 {
                    v: IPC_PROTOCOL_VERSION,
                    request_id: String::new(),
                    capability: "chrome".into(),
                    method: "recordingSaved".into(),
                    payload: Some(json!({
                        "id": saved.id,
                        "savedPath": saved.path,
                        "name": saved.name,
                    })),
                };
                let _ = write_ipc_line(pipe, &ipc).await;
            }
        }
        Err(e) => {
            send_to_chrome(
                chrome_out,
                &json!({
                    "type": "recordingSaved",
                    "ok": false,
                    "error": e.to_string(),
                }),
            )?;
        }
    }
    Ok(())
}

async fn handle_extension_to_agent(
    v: Value,
    chrome_out: &Arc<Mutex<std::io::Stdout>>,
    pipe_write: &mut Option<tokio::io::WriteHalf<tokio::net::windows::named_pipe::NamedPipeClient>>,
) {
    let req_id = v
        .get("requestId")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();

    let Some(pipe) = pipe_write.as_mut() else {
        let err_body = json!({
            "v": 1,
            "requestId": req_id,
            "ok": false,
            "error": "Agent offline — chạy DATN agent (tray) để dùng automation. Ghi script vẫn lưu local khi dừng ghi."
        });
        let _ = send_to_chrome(chrome_out, &err_body);
        return;
    };

    let ipc = IpcRequestV1 {
        v: IPC_PROTOCOL_VERSION,
        request_id: req_id.clone(),
        capability: "chrome".into(),
        method: "extensionResponse".into(),
        payload: Some(v),
    };
    if write_ipc_line(pipe, &ipc).await.is_err() {
        *pipe_write = None;
        let err_body = json!({
            "v": 1,
            "requestId": req_id,
            "ok": false,
            "error": "Mất kết nối agent pipe"
        });
        let _ = send_to_chrome(chrome_out, &err_body);
    }
}

async fn handle_list_chrome_scripts(
    v: &Value,
    chrome_out: &Arc<Mutex<std::io::Stdout>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let request_id = v
        .get("requestId")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let limit = v
        .get("limit")
        .and_then(|x| x.as_u64())
        .unwrap_or(20) as usize;

    let scripts = script_store::list_recording_scripts(limit)?;
    send_to_chrome(
        chrome_out,
        &json!({
            "type": "chromeScriptsListed",
            "requestId": request_id,
            "ok": true,
            "scripts": scripts,
        }),
    )?;
    Ok(())
}

async fn handle_delete_chrome_script(
    v: &Value,
    chrome_out: &Arc<Mutex<std::io::Stdout>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let request_id = v
        .get("requestId")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .to_string();
    let id = v.get("id").and_then(|x| x.as_str());
    let script_path = v.get("scriptPath").and_then(|x| x.as_str());

    match script_store::delete_recording_script(id, script_path) {
        Ok(()) => {
            send_to_chrome(
                chrome_out,
                &json!({
                    "type": "chromeScriptDeleted",
                    "requestId": request_id,
                    "ok": true,
                }),
            )?;
        }
        Err(e) => {
            send_to_chrome(
                chrome_out,
                &json!({
                    "type": "chromeScriptDeleted",
                    "requestId": request_id,
                    "ok": false,
                    "error": e.to_string(),
                }),
            )?;
        }
    }
    Ok(())
}

async fn run_pipe_loop(
    pipe: tokio::net::windows::named_pipe::NamedPipeClient,
    chrome_out: Arc<Mutex<std::io::Stdout>>,
    pipe_write_tx: mpsc::Sender<tokio::io::WriteHalf<tokio::net::windows::named_pipe::NamedPipeClient>>,
    pipe_lost_tx: mpsc::Sender<()>,
    pipe_active: Arc<AtomicBool>,
) {
    let (pipe_read, pipe_write) = tokio::io::split(pipe);
    if pipe_write_tx.send(pipe_write).await.is_err() {
        return;
    }

    let _ = send_to_chrome(
        &chrome_out,
        &json!({ "type": "bridgeConnected", "ok": true, "agentPipe": true }),
    );

    let mut lines = BufReader::new(pipe_read).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        let req: IpcRequestV1 = match serde_json::from_str(t) {
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
    pipe_active.store(false, Ordering::Release);
    let _ = pipe_lost_tx.send(()).await;
}

async fn run() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let chrome_out = Arc::new(Mutex::new(stdout()));

    send_to_chrome(
        &chrome_out,
        &json!({ "type": "bridgeConnected", "ok": true, "agentPipe": false }),
    )?;

    let (chrome_tx, mut chrome_rx) = mpsc::channel::<Vec<u8>>(32);
    let (pipe_write_tx, mut pipe_write_rx) =
        mpsc::channel::<tokio::io::WriteHalf<tokio::net::windows::named_pipe::NamedPipeClient>>(1);
    let (pipe_lost_tx, mut pipe_lost_rx) = mpsc::channel::<()>(4);

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

    let chrome_out_pipe = chrome_out.clone();
    let pipe_active = Arc::new(AtomicBool::new(false));
    tokio::spawn(async move {
        loop {
            if !pipe_active.swap(true, Ordering::AcqRel) {
                if let Ok(pipe) = connect_with_retry(12_000).await {
                    let active = pipe_active.clone();
                    tokio::spawn(run_pipe_loop(
                        pipe,
                        chrome_out_pipe.clone(),
                        pipe_write_tx.clone(),
                        pipe_lost_tx.clone(),
                        active,
                    ));
                } else {
                    pipe_active.store(false, Ordering::Release);
                }
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;
        }
    });

    let mut pipe_write: Option<tokio::io::WriteHalf<tokio::net::windows::named_pipe::NamedPipeClient>> =
        None;

    loop {
        tokio::select! {
            buf = chrome_rx.recv() => {
                let Some(buf) = buf else { break };
                let v: Value = match serde_json::from_slice(&buf) {
                    Ok(x) => x,
                    Err(_) => continue,
                };

                let t = v.get("type").and_then(|x| x.as_str()).unwrap_or("");
                if t == "recordingComplete" {
                    let _ = handle_recording_complete(&v, &chrome_out, &mut pipe_write).await;
                    continue;
                }
                if t == "listChromeScripts" {
                    let res = handle_list_chrome_scripts(&v, &chrome_out).await;
                    if res.is_err() {
                        let err = res.err().unwrap().to_string();
                        let request_id = v
                            .get("requestId")
                            .and_then(|x| x.as_str())
                            .unwrap_or("")
                            .to_string();
                        let _ = send_to_chrome(
                            &chrome_out,
                            &json!({
                                "type": "chromeScriptsListed",
                                "requestId": request_id,
                                "ok": false,
                                "error": err,
                            }),
                        );
                    }
                    continue;
                }
                if t == "deleteChromeScript" {
                    let res = handle_delete_chrome_script(&v, &chrome_out).await;
                    if res.is_err() {
                        let err = res.err().unwrap().to_string();
                        let request_id = v
                            .get("requestId")
                            .and_then(|x| x.as_str())
                            .unwrap_or("")
                            .to_string();
                        let _ = send_to_chrome(
                            &chrome_out,
                            &json!({
                                "type": "chromeScriptDeleted",
                                "requestId": request_id,
                                "ok": false,
                                "error": err,
                            }),
                        );
                    }
                    continue;
                }

                handle_extension_to_agent(v, &chrome_out, &mut pipe_write).await;
            }
            pw = pipe_write_rx.recv() => {
                if let Some(p) = pw {
                    pipe_write = Some(p);
                }
            }
            _ = pipe_lost_rx.recv() => {
                pipe_write = None;
                let _ = send_to_chrome(
                    &chrome_out,
                    &json!({ "type": "bridgeConnected", "ok": true, "agentPipe": false }),
                );
            }
        }
    }
    Ok(())
}
