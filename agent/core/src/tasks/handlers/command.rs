use async_trait::async_trait;
use serde_json::json;

use crate::platform::shell;
use crate::tasks::registry::{TaskContext, TaskExecute, TaskHandler};
use crate::tasks::types::TaskOutcome;

pub struct CommandHandler;

pub struct ScriptHandler;

async fn run_shell_task(ctx: &TaskContext<'_>, t: &TaskExecute) -> TaskOutcome {
    if ctx.is_cancelled() {
        return (
            false,
            -1,
            Some("Task cancelled".into()),
            Some(json!({ "cancelled": true })),
        );
    }
    let timeout_ms = if t.timeout > 0 {
        t.timeout
    } else {
        ctx.config.command_timeout_ms
    };
    let res = shell::execute_command_with_cancel(
        &t.command,
        &ctx.config.default_shell,
        timeout_ms,
        ctx.config.max_output_bytes,
        ctx.cancel.clone(),
    )
    .await;
    if res.cancelled || ctx.is_cancelled() {
        return (
            false,
            -1,
            Some("Task cancelled".into()),
            Some(json!({ "cancelled": true })),
        );
    }
    let ok = res.exit_code == 0 && !res.timed_out;
    let payload = json!({
        "stdout": res.stdout,
        "stderr": res.stderr,
        "timedOut": res.timed_out,
        "exitCode": res.exit_code,
        "signal": serde_json::Value::Null,
    });
    (ok, res.exit_code, None, Some(payload))
}

#[async_trait]
impl TaskHandler for CommandHandler {
    fn task_type(&self) -> &'static str {
        "COMMAND"
    }

    async fn run(&self, ctx: &TaskContext<'_>, task: &TaskExecute) -> TaskOutcome {
        run_shell_task(ctx, task).await
    }
}

#[async_trait]
impl TaskHandler for ScriptHandler {
    fn task_type(&self) -> &'static str {
        "SCRIPT"
    }

    async fn run(&self, ctx: &TaskContext<'_>, task: &TaskExecute) -> TaskOutcome {
        run_shell_task(ctx, task).await
    }
}
