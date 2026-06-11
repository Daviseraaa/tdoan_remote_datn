use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;

use crate::config::settings::AgentConfig;
use crate::platform::Platform;
use crate::protocol::{cancelled_task_wire, tool_result_to_task_wire, TaskWire};

use super::cancel::TaskCancelHandle;
use super::handlers;
use super::types::TaskOutcome;

#[derive(Debug, Clone)]
pub struct TaskExecute {
    pub task_id: String,
    pub task_type: String,
    pub command: String,
    pub payload: Option<Value>,
    pub timeout: u64,
}

impl TaskExecute {
    pub fn from_json(v: &Value) -> Option<Self> {
        Some(Self {
            task_id: v.get("taskId")?.as_str()?.to_string(),
            task_type: v.get("type")?.as_str()?.to_string(),
            command: v
                .get("command")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            payload: v.get("payload").cloned(),
            timeout: v
                .get("timeout")
                .and_then(|x| x.as_u64())
                .or_else(|| v.get("timeout").and_then(|x| x.as_i64()).map(|x| x as u64))
                .unwrap_or(300_000),
        })
    }
}

pub struct TaskContext<'a> {
    pub config: &'a AgentConfig,
    pub platform: &'a Platform,
    pub cancel: Option<Arc<TaskCancelHandle>>,
}

impl TaskContext<'_> {
    pub fn is_cancelled(&self) -> bool {
        self.cancel
            .as_ref()
            .map(|c| c.is_cancelled())
            .unwrap_or(false)
    }
}

#[async_trait]
pub trait TaskHandler: Send + Sync {
    fn task_type(&self) -> &'static str;
    async fn run(&self, ctx: &TaskContext<'_>, task: &TaskExecute) -> TaskOutcome;
}

static HANDLERS: &[&dyn TaskHandler] = &[
    &handlers::command::CommandHandler,
    &handlers::command::ScriptHandler,
    &handlers::system_info::Handler,
    &handlers::file_operation::Handler,
    &handlers::open_app::Handler,
    &handlers::open_browser::Handler,
    &handlers::close_app::Handler,
    &handlers::desktop::Handler,
    &handlers::chrome_extension::Handler,
    &handlers::screen_capture::Handler,
    &handlers::http_request::Handler,
    &handlers::telegram_send::Handler,
];

pub fn supported_task_types(platform: &Platform, _cfg: &AgentConfig) -> Vec<&'static str> {
    HANDLERS
        .iter()
        .map(|h| h.task_type())
        .filter(|t| {
            if *t == "DESKTOP_AUTOMATION" {
                platform.desktop().is_available()
            } else if *t == "CHROME_EXTENSION" {
                cfg!(windows) && crate::config::settings::chrome_extension_enabled_now()
            } else if *t == "SCREEN_CAPTURE" {
                cfg!(windows) && _cfg.screen_capture_enabled
            } else {
                true
            }
        })
        .collect()
}

fn normalize_task_type(raw: &str) -> String {
    raw.trim().to_uppercase()
}

pub async fn run_task(ctx: &TaskContext<'_>, task: TaskExecute) -> TaskWire {
    if ctx.is_cancelled() {
        return cancelled_task_wire("Task cancelled before start");
    }

    let task_type = normalize_task_type(&task.task_type);
    let handler = HANDLERS
        .iter()
        .find(|h| h.task_type() == task_type.as_str());

    let (ok, ec, msg, pay) = match handler {
        Some(h) => h.run(ctx, &task).await,
        None => {
            let supported = supported_task_types(ctx.platform, ctx.config).join(", ");
            (
                false,
                -1,
                Some(format!(
                    "Unknown task type: {} (supported: {})",
                    task.task_type, supported
                )),
                None,
            )
        }
    };

    let cancelled = ctx.is_cancelled()
        || pay
            .as_ref()
            .and_then(|p| p.get("cancelled"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

    if cancelled {
        return cancelled_task_wire(msg.as_deref().unwrap_or("Task cancelled"));
    }

    tool_result_to_task_wire(ok, ec, msg.as_deref(), pay)
}
