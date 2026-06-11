use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use futures_util::FutureExt;
use log::{error, info, warn};
use rust_socketio::asynchronous::Client;
use rust_socketio::asynchronous::ClientBuilder;
use rust_socketio::{Payload, TransportType};
use serde_json::json;
use tokio::sync::Semaphore;

use crate::config::{env_load, AgentConfig};
use crate::connection::telemetry::TelemetrySampler;
use crate::platform::{
    list_agent_files, list_local_chrome_scripts, list_local_desktop_recordings,
    list_system_chrome_profiles, read_agent_file, write_agent_file, Platform,
};
use crate::tasks::{run_task, supported_task_types, TaskCancelRegistry, TaskContext, TaskExecute};

const NS: &str = "/ws/agent";
const TASK_EXECUTE: &str = "task:execute";
const TASK_CANCEL: &str = "task:cancel";
const TASK_RESULT: &str = "task:result";
const AGENT_HEARTBEAT: &str = "agent:heartbeat";
const AGENT_STATUS: &str = "agent:status";
const AGENT_SUBSCRIPTION_EXPIRED: &str = "agent:subscription:expired";
const AGENT_SESSION_REVOKED: &str = "agent:session:revoked";

fn log_socket_auth_failure(reason: &str) {
    error!("Server rejected agent connection: {}", reason);
    eprintln!(
        "[StationHub] Socket.IO: kết nối THẤT BẠI — {}",
        reason
    );
}
const CHROME_PROFILES_SYNC: &str = "agent:chrome-profiles:sync";
const CHROME_PROFILES_RESULT: &str = "agent:chrome-profiles:result";
const CHROME_SCRIPTS_SYNC: &str = "agent:chrome-scripts:sync";
const CHROME_SCRIPTS_RESULT: &str = "agent:chrome-scripts:result";
const CHROME_SCRIPTS_LIST_MAX: usize = 500;
const DESKTOP_RECORDINGS_SYNC: &str = "agent:desktop-recordings:sync";
const DESKTOP_RECORDINGS_RESULT: &str = "agent:desktop-recordings:result";
const DESKTOP_RECORDINGS_LIST_MAX: usize = 500;
const FILES_LIST_SYNC: &str = "agent:files:list";
const FILES_LIST_RESULT: &str = "agent:files:list:result";
const FILES_READ_SYNC: &str = "agent:files:read";
const FILES_READ_RESULT: &str = "agent:files:read:result";
const FILES_WRITE_SYNC: &str = "agent:files:write";
const FILES_WRITE_RESULT: &str = "agent:files:write:result";
const REMOTE_START_SYNC: &str = "agent:remote:start";
const REMOTE_START_RESULT: &str = "agent:remote:start:result";
const REMOTE_STOP_SYNC: &str = "agent:remote:stop";
const REMOTE_STOP_RESULT: &str = "agent:remote:stop:result";

fn first_json(payload: Payload) -> Option<serde_json::Value> {
    match payload {
        Payload::Text(mut v) => {
            if v.is_empty() {
                None
            } else if v.len() == 1 {
                Some(v.remove(0))
            } else {
                Some(serde_json::Value::Array(v))
            }
        }
        #[allow(deprecated)]
        Payload::String(s) => serde_json::from_str(&s).ok(),
        Payload::Binary(_) => None,
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn build_metadata(
    cfg: &AgentConfig,
    platform: &Platform,
    sampler: &mut TelemetrySampler,
) -> serde_json::Value {
    let snap = sampler.sample();
    let capabilities: Vec<&str> = supported_task_types(platform, cfg);
    let mut meta = json!({
        "os": format!("{} {}", std::env::consts::OS, std::env::consts::ARCH),
        "hostname": hostname::get()
            .map(|h| h.to_string_lossy().into_owned())
            .unwrap_or_default(),
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "ip": snap.ip,
        "cpuCount": sampler.logical_cpu_count(),
        "totalMemory": snap.ram_total,
        "agentVersion": cfg.agent_version,
        "capabilities": capabilities,
    });
    if let Some(obj) = meta.as_object_mut() {
        if let Some(ra) = platform_remote_access_metadata().as_object() {
            for (k, v) in ra {
                obj.insert(k.clone(), v.clone());
            }
        }
    }
    if let Some(wol) = meta.get("wolMacAddress").and_then(|v| v.as_str()) {
        let bcast = meta.get("wolBroadcast").and_then(|v| v.as_str()).unwrap_or("—");
        info!(
            "Remote access: wolMac={} wolBroadcast={} rdpEnabled={}",
            wol,
            bcast,
            meta.get("rdpEnabled").and_then(|v| v.as_bool()).unwrap_or(false)
        );
    } else {
        let nics = meta
            .get("networkInterfaces")
            .and_then(|v| v.as_array())
            .map(|a| a.len())
            .unwrap_or(0);
        warn!("Remote access: chưa có wolMacAddress ({} NIC báo cáo)", nics);
    }
    meta
}

#[cfg(windows)]
fn platform_remote_access_metadata() -> serde_json::Value {
    crate::platform::windows::host_info::remote_access_metadata()
}

#[cfg(not(windows))]
fn platform_remote_access_metadata() -> serde_json::Value {
    serde_json::json!({})
}

/// Agent foreground / service: kết nối Socket.IO, heartbeat, xử lý `task:execute` cho đến khi `stop` = true.
pub async fn run_with_stop(stop: Arc<AtomicBool>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let _ = env_logger::try_init();
    let cfg = AgentConfig::load();
    let config_path = env_load::default_config_path();
    info!("Config: {}", config_path.display());
    info!(
        "CHROME_EXTENSION_ENABLED={} file={} (config: {})",
        crate::config::settings::chrome_extension_enabled_now(),
        env_load::read_key_from_active_config("CHROME_EXTENSION_ENABLED")
            .unwrap_or_else(|| "?".into()),
        config_path.display()
    );
    let platform = Arc::new(Platform::current());
    let mut telemetry_sampler = TelemetrySampler::new();
    telemetry_sampler.refresh_ip_if_needed().await;
    let metadata = build_metadata(&cfg, &platform, &mut telemetry_sampler);
    let auth = json!({
        "agentKey": cfg.agent_key,
        "metadata": metadata,
    });

    let base = cfg.engine_io_base();
    info!("Connecting {} namespace {}", base, NS);

    let cfg = Arc::new(cfg);

    #[cfg(windows)]
    tokio::spawn(async {
        if let Err(e) = crate::platform::windows::chrome_bridge::run_chrome_bridge_pipe_forever().await
        {
            error!("[chrome-bridge] pipe server: {}", e);
        }
    });

    let sem = Arc::new(Semaphore::new(cfg.task_max_concurrency.max(1)));
    let cancel_registry = Arc::new(TaskCancelRegistry::new());
    let server_authenticated = Arc::new(AtomicBool::new(false));

    let sem_t = sem.clone();
    let cfg_t = cfg.clone();
    let platform_t = platform.clone();
    let cancel_reg_execute = cancel_registry.clone();
    let cancel_reg_cancel = cancel_registry.clone();
    let auth_for_status = server_authenticated.clone();
    let auth_for_sub = server_authenticated.clone();
    let auth_for_revoked = server_authenticated.clone();
    let builder = ClientBuilder::new(base.clone())
        .namespace(NS)
        .transport_type(TransportType::Websocket)
        .auth(auth)
        .reconnect(true)
        .on(TASK_EXECUTE, move |payload: Payload, client: Client| {
            let sem = sem_t.clone();
            let cfg = cfg_t.clone();
            let platform = platform_t.clone();
            let cancel_registry = cancel_reg_execute.clone();
            async move {
                let Some(v) = first_json(payload) else {
                    warn!("task:execute: empty payload");
                    return;
                };
                let Some(task) = TaskExecute::from_json(&v) else {
                    warn!("task:execute: invalid json");
                    return;
                };
                let tid = task.task_id.clone();
                let permit = match sem.clone().acquire_owned().await {
                    Ok(p) => p,
                    Err(_) => return,
                };
                let cancel_handle = cancel_registry.register(&tid);
                tokio::spawn(async move {
                    let _permit = permit;
                    let started_at = now_ms();
                    info!("Running task {} type {}", tid, task.task_type);
                    let ctx = TaskContext {
                        config: &cfg,
                        platform: &platform,
                        cancel: Some(cancel_handle.clone()),
                    };
                    let wire = run_task(&ctx, task.clone()).await;
                    cancel_registry.unregister(&tid);
                    let completed_at = now_ms();
                    let body = json!({
                        "taskId": tid,
                        "status": wire.status,
                        "result": wire.output,
                        "exitCode": wire.exit_code,
                        "startedAt": started_at,
                        "completedAt": completed_at,
                    });
                    if let Err(e) = client.emit(TASK_RESULT, body).await {
                        error!("emit task:result: {}", e);
                    }
                });
            }
            .boxed()
        })
        .on(TASK_CANCEL, move |payload: Payload, _client: Client| {
            let cancel_registry = cancel_reg_cancel.clone();
            async move {
                let Some(v) = first_json(payload) else {
                    warn!("task:cancel: empty payload");
                    return;
                };
                let task_id = v
                    .get("taskId")
                    .and_then(|x| x.as_str())
                    .unwrap_or_default();
                if task_id.is_empty() {
                    warn!("task:cancel: missing taskId");
                    return;
                }
                if cancel_registry.cancel(task_id) {
                    info!("Cancel requested for task {}", task_id);
                } else {
                    warn!("task:cancel: task {} not running on agent", task_id);
                }
            }
            .boxed()
        })
        .on(CHROME_PROFILES_SYNC, move |payload: Payload, client: Client| {
            async move {
                let request_id = first_json(payload)
                    .and_then(|v| v.get("requestId").and_then(|r| r.as_str()).map(String::from))
                    .unwrap_or_default();
                tokio::spawn(async move {
                    let (ok, profiles, error) =
                        match tokio::task::spawn_blocking(list_system_chrome_profiles).await {
                            Ok(Ok(list)) => {
                                (true, serde_json::to_value(&list).unwrap_or(json!([])), None)
                            }
                            Ok(Err(e)) => (false, json!([]), Some(e)),
                            Err(e) => (false, json!([]), Some(format!("spawn_blocking: {e}"))),
                        };
                    let body = json!({
                        "requestId": request_id,
                        "ok": ok,
                        "profiles": profiles,
                        "error": error,
                    });
                    if let Err(e) = client.emit(CHROME_PROFILES_RESULT, body).await {
                        error!("emit chrome-profiles result: {}", e);
                    }
                });
            }
            .boxed()
        })
        .on(CHROME_SCRIPTS_SYNC, move |payload: Payload, client: Client| {
            async move {
                let request_id = first_json(payload)
                    .and_then(|v| v.get("requestId").and_then(|r| r.as_str()).map(String::from))
                    .unwrap_or_default();
                tokio::spawn(async move {
                    let (ok, scripts, error) = match tokio::task::spawn_blocking(move || {
                        list_local_chrome_scripts(CHROME_SCRIPTS_LIST_MAX)
                    })
                    .await
                    {
                        Ok(Ok(list)) => {
                            (true, serde_json::to_value(&list).unwrap_or(json!([])), None)
                        }
                        Ok(Err(e)) => (false, json!([]), Some(e)),
                        Err(e) => (false, json!([]), Some(format!("spawn_blocking: {e}"))),
                    };
                    let body = json!({
                        "requestId": request_id,
                        "ok": ok,
                        "scripts": scripts,
                        "error": error,
                    });
                    if let Err(e) = client.emit(CHROME_SCRIPTS_RESULT, body).await {
                        error!("emit chrome-scripts result: {}", e);
                    }
                });
            }
            .boxed()
        })
        .on(DESKTOP_RECORDINGS_SYNC, move |payload: Payload, client: Client| {
            async move {
                let request_id = first_json(payload)
                    .and_then(|v| v.get("requestId").and_then(|r| r.as_str()).map(String::from))
                    .unwrap_or_default();
                tokio::spawn(async move {
                    let (ok, recordings, error) =
                        match tokio::task::spawn_blocking(move || {
                            list_local_desktop_recordings(DESKTOP_RECORDINGS_LIST_MAX)
                        })
                        .await
                        {
                            Ok(Ok(list)) => {
                                (true, serde_json::to_value(&list).unwrap_or(json!([])), None)
                            }
                            Ok(Err(e)) => (false, json!([]), Some(e)),
                            Err(e) => (false, json!([]), Some(format!("spawn_blocking: {e}"))),
                        };
                    let body = json!({
                        "requestId": request_id,
                        "ok": ok,
                        "recordings": recordings,
                        "error": error,
                    });
                    if let Err(e) = client.emit(DESKTOP_RECORDINGS_RESULT, body).await {
                        error!("emit desktop-recordings result: {}", e);
                    }
                });
            }
            .boxed()
        })
        .on(FILES_LIST_SYNC, move |payload: Payload, client: Client| {
            async move {
                let v = first_json(payload);
                let request_id = v
                    .as_ref()
                    .and_then(|j| j.get("requestId").and_then(|r| r.as_str()))
                    .unwrap_or_default()
                    .to_string();
                let path = v
                    .as_ref()
                    .and_then(|j| j.get("path").and_then(|r| r.as_str()))
                    .unwrap_or_default()
                    .to_string();
                tokio::spawn(async move {
                    let path_for_task = path.clone();
                    let (ok, entries, error) =
                        match tokio::task::spawn_blocking(move || list_agent_files(&path_for_task))
                            .await
                        {
                            Ok(Ok(list)) => {
                                (true, serde_json::to_value(&list).unwrap_or(json!([])), None)
                            }
                            Ok(Err(e)) => (false, json!([]), Some(e)),
                            Err(e) => (false, json!([]), Some(format!("spawn_blocking: {e}"))),
                        };
                    let body = json!({
                        "requestId": request_id,
                        "ok": ok,
                        "entries": entries,
                        "path": path,
                        "root": crate::platform::agent_files::filesystem_root_label(),
                        "error": error,
                    });
                    if let Err(e) = client.emit(FILES_LIST_RESULT, body).await {
                        error!("emit files:list result: {}", e);
                    }
                });
            }
            .boxed()
        })
        .on(FILES_READ_SYNC, move |payload: Payload, client: Client| {
            async move {
                let v = first_json(payload);
                let request_id = v
                    .as_ref()
                    .and_then(|j| j.get("requestId").and_then(|r| r.as_str()))
                    .unwrap_or_default()
                    .to_string();
                let path = v
                    .as_ref()
                    .and_then(|j| j.get("path").and_then(|r| r.as_str()))
                    .unwrap_or_default()
                    .to_string();
                let max_bytes = v
                    .as_ref()
                    .and_then(|j| j.get("maxBytes").and_then(|r| r.as_u64()))
                    .map(|n| n as usize);
                tokio::spawn(async move {
                    let path_for_task = path.clone();
                    let (ok, file, error) = match tokio::task::spawn_blocking(move || {
                        read_agent_file(&path_for_task, max_bytes)
                    })
                    .await
                    {
                        Ok(Ok(data)) => {
                            (true, serde_json::to_value(&data).unwrap_or(json!(null)), None)
                        }
                        Ok(Err(e)) => (false, json!(null), Some(e)),
                        Err(e) => (false, json!(null), Some(format!("spawn_blocking: {e}"))),
                    };
                    let body = json!({
                        "requestId": request_id,
                        "ok": ok,
                        "file": file,
                        "error": error,
                    });
                    if let Err(e) = client.emit(FILES_READ_RESULT, body).await {
                        error!("emit files:read result: {}", e);
                    }
                });
            }
            .boxed()
        })
        .on(FILES_WRITE_SYNC, move |payload: Payload, client: Client| {
            async move {
                let v = first_json(payload);
                let request_id = v
                    .as_ref()
                    .and_then(|j| j.get("requestId").and_then(|r| r.as_str()))
                    .unwrap_or_default()
                    .to_string();
                let path = v
                    .as_ref()
                    .and_then(|j| j.get("path").and_then(|r| r.as_str()))
                    .unwrap_or_default()
                    .to_string();
                let content = v
                    .as_ref()
                    .and_then(|j| j.get("content").and_then(|r| r.as_str()))
                    .unwrap_or_default()
                    .to_string();
                let encoding = v
                    .as_ref()
                    .and_then(|j| j.get("encoding").and_then(|r| r.as_str()))
                    .unwrap_or("utf-8")
                    .to_string();
                let upload_id = v
                    .as_ref()
                    .and_then(|j| j.get("uploadId").and_then(|r| r.as_str()))
                    .map(String::from);
                let chunk_index = v
                    .as_ref()
                    .and_then(|j| j.get("chunkIndex").and_then(|r| r.as_u64()))
                    .map(|n| n as u32);
                let total_chunks = v
                    .as_ref()
                    .and_then(|j| j.get("totalChunks").and_then(|r| r.as_u64()))
                    .map(|n| n as u32);
                tokio::spawn(async move {
                    let path_for_task = path.clone();
                    let content_for_task = content.clone();
                    let encoding_for_task = encoding.clone();
                    let upload_id_for_task = upload_id.clone();
                    let (ok, file, error) = match tokio::task::spawn_blocking(move || {
                        write_agent_file(
                            &path_for_task,
                            &content_for_task,
                            &encoding_for_task,
                            upload_id_for_task.as_deref(),
                            chunk_index,
                            total_chunks,
                        )
                    })
                    .await
                    {
                        Ok(Ok(data)) => {
                            (true, serde_json::to_value(&data).unwrap_or(json!(null)), None)
                        }
                        Ok(Err(e)) => (false, json!(null), Some(e)),
                        Err(e) => (false, json!(null), Some(format!("spawn_blocking: {e}"))),
                    };
                    let body = json!({
                        "requestId": request_id,
                        "ok": ok,
                        "file": file,
                        "error": error,
                    });
                    if let Err(e) = client.emit(FILES_WRITE_RESULT, body).await {
                        error!("emit files:write result: {}", e);
                    }
                });
            }
            .boxed()
        })
        .on(REMOTE_START_SYNC, move |payload: Payload, client: Client| {
            async move {
                let v = first_json(payload);
                let request_id = v
                    .as_ref()
                    .and_then(|j| j.get("requestId").and_then(|r| r.as_str()))
                    .unwrap_or_default()
                    .to_string();
                let provider = v
                    .as_ref()
                    .and_then(|j| j.get("provider").and_then(|r| r.as_str()))
                    .unwrap_or("rustdesk")
                    .to_string();
                // Chạy nền — tránh block Socket.IO (ping/heartbeat) khi mở RustDesk.
                tokio::spawn(async move {
                    let provider_for_task = provider.clone();
                    let (ok, message, error, rustdesk_id, rustdesk_password) =
                        match tokio::task::spawn_blocking(move || {
                            let cfg = crate::config::settings::rustdesk_config_now();
                            if cfg.exe_path.trim().is_empty() {
                                return Err(
                                    "Chưa cấu hình RUSTDESK_EXE_PATH trong Cài đặt agent".into(),
                                );
                            }
                            if cfg.id.trim().is_empty() {
                                return Err("Chưa cấu hình RUSTDESK_ID trong Cài đặt agent".into());
                            }
                            if cfg.password.is_empty() {
                                return Err(
                                    "Chưa cấu hình RUSTDESK_PASSWORD trong Cài đặt agent".into(),
                                );
                            }
                            let msg = crate::platform::remote::start_remote(
                                &provider_for_task,
                                &cfg.exe_path,
                            )?;
                            Ok((msg, cfg.id.trim().to_string(), cfg.password))
                        })
                        .await
                        {
                            Ok(Ok((msg, id, pass))) => (true, Some(msg), None, Some(id), Some(pass)),
                            Ok(Err(e)) => (false, None, Some(e), None, None),
                            Err(e) => (
                                false,
                                None,
                                Some(format!("spawn_blocking: {e}")),
                                None,
                                None,
                            ),
                        };

                    let mut body = json!({
                        "requestId": request_id,
                        "ok": ok,
                        "provider": provider,
                        "message": message,
                        "error": error,
                    });
                    if let Some(obj) = body.as_object_mut() {
                        if let Some(id) = rustdesk_id {
                            obj.insert("rustdeskId".into(), json!(id));
                        }
                        if let Some(pass) = rustdesk_password {
                            obj.insert("rustdeskPassword".into(), json!(pass));
                        }
                    }
                    if let Err(e) = client.emit(REMOTE_START_RESULT, body).await {
                        error!("emit remote:start result: {}", e);
                    }
                });
            }
            .boxed()
        })
        .on(REMOTE_STOP_SYNC, move |payload: Payload, client: Client| {
            async move {
                let v = first_json(payload);
                let request_id = v
                    .as_ref()
                    .and_then(|j| j.get("requestId").and_then(|r| r.as_str()))
                    .unwrap_or_default()
                    .to_string();
                let provider = v
                    .as_ref()
                    .and_then(|j| j.get("provider").and_then(|r| r.as_str()))
                    .unwrap_or("rustdesk")
                    .to_string();

                tokio::spawn(async move {
                    let provider_for_task = provider.clone();
                    let (ok, message, error) = match tokio::task::spawn_blocking(move || {
                        crate::platform::remote::stop_remote(&provider_for_task)
                    })
                    .await
                    {
                        Ok(Ok(msg)) => (true, Some(msg), None),
                        Ok(Err(e)) => (false, None, Some(e)),
                        Err(e) => (false, None, Some(format!("spawn_blocking: {e}"))),
                    };

                    let body = json!({
                        "requestId": request_id,
                        "ok": ok,
                        "provider": provider,
                        "message": message,
                        "error": error,
                    });
                    if let Err(e) = client.emit(REMOTE_STOP_RESULT, body).await {
                        error!("emit remote:stop result: {}", e);
                    }
                });
            }
            .boxed()
        })
        .on(AGENT_STATUS, move |payload: Payload, _: Client| {
            let auth = auth_for_status.clone();
            async move {
                let Some(v) = first_json(payload) else {
                    return;
                };
                let status = v
                    .get("status")
                    .and_then(|s| s.as_str())
                    .unwrap_or_default();
                if status.eq_ignore_ascii_case("ONLINE") {
                    auth.store(true, Ordering::SeqCst);
                    info!("Server authenticated agent (status=ONLINE)");
                    eprintln!(
                        "[StationHub] Socket.IO: kết nối THÀNH CÔNG — server đã xác thực Agent Key"
                    );
                }
            }
            .boxed()
        })
        .on(AGENT_SUBSCRIPTION_EXPIRED, move |payload: Payload, _: Client| {
            let auth = auth_for_sub.clone();
            async move {
                auth.store(false, Ordering::SeqCst);
                let msg = first_json(payload)
                    .and_then(|v| v.get("message").and_then(|m| m.as_str()).map(String::from))
                    .unwrap_or_else(|| "Gói đăng ký đã hết hạn".into());
                log_socket_auth_failure(&msg);
            }
            .boxed()
        })
        .on(AGENT_SESSION_REVOKED, move |payload: Payload, _: Client| {
            let auth = auth_for_revoked.clone();
            async move {
                auth.store(false, Ordering::SeqCst);
                let msg = first_json(payload)
                    .and_then(|v| v.get("message").and_then(|m| m.as_str()).map(String::from))
                    .unwrap_or_else(|| "Phiên agent bị thu hồi — kiểm tra Agent Key".into());
                log_socket_auth_failure(&msg);
            }
            .boxed()
        })
        .on("error", |err, _: Client| {
            async move {
                warn!("socket error: {:?}", err);
            }
            .boxed()
        });

    info!("Connecting to {} namespace {} …", base, NS);
    eprintln!("[StationHub] Socket.IO: đang kết nối {}{} …", base, NS);

    let client = match builder.connect().await {
        Ok(c) => {
            info!("Socket transport up — {} {} (awaiting server auth)", base, NS);
            eprintln!(
                "[StationHub] Socket.IO: transport OK — chờ xác thực Agent Key…"
            );
            let auth_timeout = server_authenticated.clone();
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_secs(6)).await;
                if !auth_timeout.load(Ordering::SeqCst) {
                    log_socket_auth_failure(
                        "Agent Key không hợp lệ hoặc server từ chối kết nối — kiểm tra Cài đặt",
                    );
                }
            });
            c
        }
        Err(e) => {
            error!("Socket connect failed — {} {}: {}", base, NS, e);
            eprintln!(
                "[StationHub] Socket.IO: kết nối THẤT BẠI — {}{} — {}",
                base, NS, e
            );
            return Err(e.into());
        }
    };

    const TELEMETRY_INTERVAL_MS: u64 = 2000;
    let hb_client = client.clone();
    let hb_stop = stop.clone();
    let hb = tokio::spawn(async move {
        let mut intv =
            tokio::time::interval(Duration::from_millis(TELEMETRY_INTERVAL_MS));
        intv.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut telemetry_sampler = TelemetrySampler::new();
        let mut heartbeat_fail_streak: u32 = 0;
        loop {
            intv.tick().await;
            if hb_stop.load(Ordering::SeqCst) {
                break;
            }
            telemetry_sampler.refresh_ip_if_needed().await;
            let snap = telemetry_sampler.sample();
            let cpu = (f64::from(snap.cpu_percent) * 10.0).round() / 10.0;
            let body = json!({
                "timestamp": snap.timestamp,
                "ip": snap.ip,
                "cpuPercent": cpu,
                "ramUsedBytes": snap.ram_used,
                "ramTotalBytes": snap.ram_total,
                "ramLabel": snap.ram_label,
            });
            match hb_client.emit(AGENT_HEARTBEAT, body).await {
                Ok(()) => heartbeat_fail_streak = 0,
                Err(e) => {
                    heartbeat_fail_streak += 1;
                    error!(
                        "emit {}: {} (streak {})",
                        AGENT_HEARTBEAT, e, heartbeat_fail_streak
                    );
                    if heartbeat_fail_streak >= 3 {
                        warn!(
                            "heartbeat fail streak — disconnect để reconnect Socket.IO"
                        );
                        let _ = hb_client.disconnect().await;
                        heartbeat_fail_streak = 0;
                    }
                }
            }
        }
    });

    while !stop.load(Ordering::SeqCst) {
        tokio::time::sleep(Duration::from_millis(200)).await;
    }

    hb.abort();
    let _ = client.disconnect().await;
    info!("Agent stopped");
    Ok(())
}

pub async fn run_foreground() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let stop = Arc::new(AtomicBool::new(false));
    let s = stop.clone();
    tokio::spawn(async move {
        if tokio::signal::ctrl_c().await.is_ok() {
            info!("Ctrl+C, shutting down");
            s.store(true, Ordering::SeqCst);
        }
    });
    run_with_stop(stop).await
}
