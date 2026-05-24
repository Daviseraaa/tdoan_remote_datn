//! NDJSON client tới agent pipe `\\.\pipe\DATN_ChromeBridge_v1`.

use std::io::{BufRead, ErrorKind, Write};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader as AsyncBufReader};
use tokio::net::windows::named_pipe::ClientOptions;

pub const PIPE_CHROME_BRIDGE: &str = r"\\.\pipe\DATN_ChromeBridge_v1";
pub const IPC_PROTOCOL_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcRequestV1 {
    pub v: u32,
    pub request_id: String,
    pub capability: String,
    pub method: String,
    #[serde(default)]
    pub payload: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcErrorBody {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcResponseV1 {
    pub v: u32,
    pub request_id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<IpcErrorBody>,
}

pub async fn connect_with_retry(max_wait_ms: u64) -> std::io::Result<tokio::net::windows::named_pipe::NamedPipeClient> {
    let step = std::time::Duration::from_millis(500);
    let deadline = std::time::Instant::now() + std::time::Duration::from_millis(max_wait_ms);
    loop {
        match ClientOptions::new().open(PIPE_CHROME_BRIDGE) {
            Ok(c) => return Ok(c),
            Err(e) if std::time::Instant::now() < deadline => {
                tokio::time::sleep(step).await;
                let _ = e;
            }
            Err(e) => return Err(e),
        }
    }
}

pub async fn write_request(
    client: &mut tokio::net::windows::named_pipe::NamedPipeClient,
    req: &IpcRequestV1,
) -> std::io::Result<()> {
    let mut line = serde_json::to_string(req)?;
    line.push('\n');
    client.write_all(line.as_bytes()).await?;
    client.flush().await
}

pub async fn read_response_line(
    lines: &mut AsyncBufReader<tokio::net::windows::named_pipe::NamedPipeClient>,
) -> std::io::Result<IpcResponseV1> {
    let mut buf = String::new();
    loop {
        buf.clear();
        let n = lines.read_line(&mut buf).await?;
        if n == 0 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::UnexpectedEof,
                "pipe closed",
            ));
        }
        let t = buf.trim();
        if t.is_empty() {
            continue;
        }
        let res: IpcResponseV1 = serde_json::from_str(t).map_err(|e| {
            std::io::Error::new(ErrorKind::InvalidData, e.to_string())
        })?;
        return Ok(res);
    }
}

#[allow(dead_code)]
pub fn write_request_sync(
    client: &mut impl Write,
    req: &IpcRequestV1,
) -> std::io::Result<()> {
    let mut line = serde_json::to_string(req)?;
    line.push('\n');
    client.write_all(line.as_bytes())?;
    client.flush()
}

#[allow(dead_code)]
pub fn read_response_sync(reader: &mut impl BufRead) -> std::io::Result<IpcResponseV1> {
    let mut line = String::new();
    loop {
        line.clear();
        if reader.read_line(&mut line)? == 0 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::UnexpectedEof,
                "pipe closed",
            ));
        }
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        return serde_json::from_str(t).map_err(|e| {
            std::io::Error::new(ErrorKind::InvalidData, e.to_string())
        });
    }
}
