use async_trait::async_trait;
use serde_json::json;

use crate::tasks::registry::{TaskContext, TaskExecute, TaskHandler};
use crate::tasks::types::TaskOutcome;

pub struct Handler;

#[async_trait]
impl TaskHandler for Handler {
    fn task_type(&self) -> &'static str {
        "SYSTEM_INFO"
    }

    async fn run(&self, _ctx: &TaskContext<'_>, _task: &TaskExecute) -> TaskOutcome {
        let mut sys = sysinfo::System::new_all();
        sys.refresh_all();
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().into_owned())
            .unwrap_or_default();
        let v = json!({
            "hostname": hostname,
            "platform": std::env::consts::OS,
            "arch": std::env::consts::ARCH,
            "cpus": sys.cpus().len(),
            "totalMemory": sys.total_memory(),
            "freeMemory": sys.available_memory(),
        });
        (true, 0, None, Some(v))
    }
}
