use async_trait::async_trait;

use crate::tasks::registry::{TaskContext, TaskExecute, TaskHandler};
use crate::tasks::types::TaskOutcome;

pub struct Handler;

#[async_trait]
impl TaskHandler for Handler {
    fn task_type(&self) -> &'static str {
        "FILE_OPERATION"
    }

    async fn run(&self, _ctx: &TaskContext<'_>, _task: &TaskExecute) -> TaskOutcome {
        (
            false,
            -1,
            Some("FILE_OPERATION not implemented".into()),
            None,
        )
    }
}
