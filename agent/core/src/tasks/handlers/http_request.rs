use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::Method;
use serde_json::{json, Map, Value};
use std::str::FromStr;
use std::time::Duration;

use crate::tasks::registry::{TaskContext, TaskExecute, TaskHandler};
use crate::tasks::types::TaskOutcome;

pub struct Handler;

const ALLOWED_METHODS: &[&str] = &["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

fn extract_url(task: &TaskExecute) -> String {
    if let Some(Value::Object(p)) = &task.payload {
        if let Some(s) = p.get("url").and_then(|x| x.as_str()) {
            let u = s.trim();
            if !u.is_empty() {
                return u.to_string();
            }
        }
    }
    task.command.trim().to_string()
}

fn extract_method(task: &TaskExecute) -> String {
    if let Some(Value::Object(p)) = &task.payload {
        if let Some(s) = p.get("method").and_then(|x| x.as_str()) {
            let m = s.trim().to_uppercase();
            if ALLOWED_METHODS.contains(&m.as_str()) {
                return m;
            }
        }
    }
    "GET".to_string()
}

fn build_headers(map: &Map<String, Value>) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    let Some(Value::Object(h)) = map.get("headers") else {
        return Ok(headers);
    };
    for (k, v) in h {
        let val = match v {
            Value::String(s) => s.clone(),
            other => other.to_string(),
        };
        let name = HeaderName::from_str(k).map_err(|e| format!("header {k}: {e}"))?;
        let hv = HeaderValue::from_str(&val).map_err(|e| format!("header {k}: {e}"))?;
        headers.insert(name, hv);
    }
    Ok(headers)
}

fn extract_body(map: &Map<String, Value>) -> Option<String> {
    match map.get("body") {
        None => None,
        Some(Value::String(s)) => {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(s.clone())
            }
        }
        Some(v) => Some(v.to_string()),
    }
}

fn parse_method(method: &str) -> Method {
    Method::from_bytes(method.as_bytes()).unwrap_or(Method::GET)
}

#[async_trait]
impl TaskHandler for Handler {
    fn task_type(&self) -> &'static str {
        "HTTP_REQUEST"
    }

    async fn run(&self, ctx: &TaskContext<'_>, task: &TaskExecute) -> TaskOutcome {
        let url = extract_url(task);
        if url.is_empty() {
            return (false, -1, Some("URL trống".into()), None);
        }
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return (
                false,
                -1,
                Some("URL phải bắt đầu bằng http:// hoặc https://".into()),
                None,
            );
        }

        let method = extract_method(task);
        let timeout_ms = if task.timeout > 0 {
            task.timeout
        } else {
            60_000
        };
        let max_bytes = ctx.config.max_output_bytes;
        let payload_map = task.payload.as_ref().and_then(|v| v.as_object());

        let headers = match payload_map {
            Some(p) => match build_headers(p) {
                Ok(h) => h,
                Err(e) => return (false, -1, Some(e), None),
            },
            None => HeaderMap::new(),
        };
        let body = payload_map.and_then(extract_body);
        let send_body = body.as_ref().filter(|_| method != "GET" && method != "HEAD");

        let client = match reqwest::Client::builder()
            .timeout(Duration::from_millis(timeout_ms))
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()
        {
            Ok(c) => c,
            Err(e) => return (false, -1, Some(format!("HTTP client: {e}")), None),
        };

        let mut final_headers = headers;
        if let Some(b) = send_body {
            if !final_headers.contains_key(reqwest::header::CONTENT_TYPE) {
                let trimmed = b.trim();
                if (trimmed.starts_with('{') && trimmed.ends_with('}'))
                    || (trimmed.starts_with('[') && trimmed.ends_with(']'))
                {
                    if let Ok(ct) = HeaderValue::from_str("application/json") {
                        final_headers.insert(reqwest::header::CONTENT_TYPE, ct);
                    }
                }
            }
        }

        let mut req = client
            .request(parse_method(&method), &url)
            .headers(final_headers);
        if let Some(b) = send_body {
            req = req.body(b.clone());
        }

        let res = match req.send().await {
            Ok(r) => r,
            Err(e) => {
                let payload = json!({
                    "stdout": "",
                    "stderr": e.to_string(),
                    "statusCode": 0,
                    "ok": false,
                    "error": e.to_string(),
                });
                return (false, -1, Some(e.to_string()), Some(payload));
            }
        };

        let status = res.status().as_u16();
        let resp_headers: Map<String, Value> = res
            .headers()
            .iter()
            .map(|(k, v)| {
                (
                    k.to_string(),
                    Value::String(v.to_str().unwrap_or("").to_string()),
                )
            })
            .collect();

        let bytes = match res.bytes().await {
            Ok(b) => b,
            Err(e) => return (false, -1, Some(e.to_string()), None),
        };

        let mut body_str = String::from_utf8_lossy(&bytes).into_owned();
        let truncated = body_str.len() > max_bytes;
        if truncated {
            body_str.truncate(max_bytes);
        }

        let ok = (200..300).contains(&status);
        let parsed_json = serde_json::from_str::<Value>(&body_str).ok();
        let data = parsed_json.unwrap_or_else(|| Value::String(body_str.clone()));

        let payload = json!({
            "stdout": body_str,
            "stderr": "",
            "statusCode": status,
            "ok": ok,
            "truncated": truncated,
            "headers": resp_headers,
            "data": data,
        });

        // Process exit: 0 = success (wire/server expect this). HTTP status stays in payload.statusCode.
        let process_exit = if ok {
            0
        } else if status > 0 {
            status as i32
        } else {
            1
        };
        (ok, process_exit, None, Some(payload))
    }
}
