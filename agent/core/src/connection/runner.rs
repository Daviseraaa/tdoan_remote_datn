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
use crate::platform::Platform;
use crate::tasks::{run_task, supported_task_types, TaskContext, TaskExecute};

const NS: &str = "/ws/agent";
const TASK_EXECUTE: &str = "task:execute";
const TASK_RESULT: &str = "task:result";
const AGENT_HEARTBEAT: &str = "agent:heartbeat";

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
    let capabilities: Vec<&str> = supported_task_types(platform);
    json!({
        "os": format!("{} {}", std::env::consts::OS, std::env::consts::ARCH),
        "hostname": hostname::get()
            .map(|h| h.to_string_lossy().into_owned())
            .unwrap_or_default(),
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "ip": snap.ip,
        "cpuCount": sysinfo::System::new().cpus().len(),
        "totalMemory": snap.ram_total,
        "agentVersion": cfg.agent_version,
        "capabilities": capabilities,
    })
}

/// Agent foreground / service: kết nối Socket.IO, heartbeat, xử lý `task:execute` cho đến khi `stop` = true.
pub async fn run_with_stop(stop: Arc<AtomicBool>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let _ = env_logger::try_init();
    let cfg = AgentConfig::load();
    info!("Config: {}", env_load::default_config_path().display());
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
    let sem = Arc::new(Semaphore::new(cfg.task_max_concurrency.max(1)));

    let sem_t = sem.clone();
    let cfg_t = cfg.clone();
    let platform_t = platform.clone();
    let client = ClientBuilder::new(base)
        .namespace(NS)
        .transport_type(TransportType::Websocket)
        .auth(auth)
        .reconnect(true)
        .on(TASK_EXECUTE, move |payload: Payload, client: Client| {
            let sem = sem_t.clone();
            let cfg = cfg_t.clone();
            let platform = platform_t.clone();
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
                tokio::spawn(async move {
                    let _permit = permit;
                    let started_at = now_ms();
                    info!("Running task {} type {}", tid, task.task_type);
                    let ctx = TaskContext {
                        config: &cfg,
                        platform: &platform,
                    };
                    let wire = run_task(&ctx, task.clone()).await;
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
        .on("error", |err, _: Client| {
            async move {
                warn!("socket error: {:?}", err);
            }
            .boxed()
        })
        .connect()
        .await?;

    info!("Connected to server");

    const TELEMETRY_INTERVAL_MS: u64 = 2000;
    let hb_client = client.clone();
    let hb_stop = stop.clone();
    let hb = tokio::spawn(async move {
        let mut intv =
            tokio::time::interval(Duration::from_millis(TELEMETRY_INTERVAL_MS));
        intv.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut telemetry_sampler = TelemetrySampler::new();
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
            if let Err(e) = hb_client.emit(AGENT_HEARTBEAT, body).await {
                error!("emit {}: {}", AGENT_HEARTBEAT, e);
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
