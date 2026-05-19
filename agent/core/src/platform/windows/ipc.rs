//! NDJSON IPC v1 (legacy worker pipe; desktop không dùng).

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const IPC_PROTOCOL_VERSION: u32 = 1;
pub const PIPE_SVC: &str = r"\\.\pipe\DATN_Agent_IPC_v1";
pub const PIPE_USER: &str = r"\\.\pipe\DATN_Agent_IPC_user_v1";

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

impl IpcResponseV1 {
    pub fn ok_json(request_id: String, result: Value) -> Self {
        Self {
            v: IPC_PROTOCOL_VERSION,
            request_id,
            ok: true,
            result: Some(result),
            error: None,
        }
    }

    pub fn err_json(request_id: String, code: &str, message: String) -> Self {
        Self {
            v: IPC_PROTOCOL_VERSION,
            request_id,
            ok: false,
            result: None,
            error: Some(IpcErrorBody {
                code: code.to_string(),
                message,
            }),
        }
    }
}

pub fn response_line(res: &IpcResponseV1) -> Result<String, serde_json::Error> {
    let mut s = serde_json::to_string(res)?;
    s.push('\n');
    Ok(s)
}
