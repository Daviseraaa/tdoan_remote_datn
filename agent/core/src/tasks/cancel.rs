//! Theo dõi và hủy task đang chạy trên agent.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

#[derive(Debug)]
pub struct TaskCancelHandle {
    cancelled: AtomicBool,
    child_pid: AtomicU32,
}

impl TaskCancelHandle {
    pub fn new() -> Self {
        Self {
            cancelled: AtomicBool::new(false),
            child_pid: AtomicU32::new(0),
        }
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    pub fn request_cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
        let pid = self.child_pid.load(Ordering::SeqCst);
        if pid > 0 {
            kill_process_tree(pid);
        }
    }

    pub fn set_child_pid(&self, pid: u32) {
        self.child_pid.store(pid, Ordering::SeqCst);
        if self.is_cancelled() && pid > 0 {
            kill_process_tree(pid);
        }
    }
}

pub fn kill_process_tree(pid: u32) {
    if pid == 0 {
        return;
    }
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("kill")
            .args(["-TERM", &format!("-{}", pid)])
            .status();
    }
}

#[derive(Debug, Default)]
pub struct TaskCancelRegistry {
    inner: Mutex<HashMap<String, Arc<TaskCancelHandle>>>,
}

impl TaskCancelRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&self, task_id: &str) -> Arc<TaskCancelHandle> {
        let handle = Arc::new(TaskCancelHandle::new());
        if let Ok(mut map) = self.inner.lock() {
            map.insert(task_id.to_string(), handle.clone());
        }
        handle
    }

    pub fn unregister(&self, task_id: &str) {
        if let Ok(mut map) = self.inner.lock() {
            map.remove(task_id);
        }
    }

    pub fn cancel(&self, task_id: &str) -> bool {
        let handle = self
            .inner
            .lock()
            .ok()
            .and_then(|map| map.get(task_id).cloned());
        if let Some(h) = handle {
            h.request_cancel();
            true
        } else {
            false
        }
    }
}
