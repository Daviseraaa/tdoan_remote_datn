pub mod agent_files;
pub mod chrome_profiles;
pub mod chrome_scripts_store;
pub mod desktop_recordings_store;
pub mod cloak_runner;
pub mod close_app;
pub mod focus_app;
pub mod open_app;
pub mod remote;
pub mod open_browser;
pub mod shell;
pub mod telegram_api;

pub use agent_files::{
    list_agent_files, read_agent_file, write_agent_file, station_hub_root, AgentFileEntry,
    AgentFileReadResult, AgentFileWriteResult,
};
pub use chrome_profiles::{list_system_chrome_profiles, ChromeProfileEntry};
pub use chrome_scripts_store::list_local_chrome_scripts;
pub use desktop_recordings_store::list_local_desktop_recordings;

#[cfg(windows)]
pub mod windows;

use std::sync::Arc;

use async_trait::async_trait;
use serde_json::Value;

use crate::tasks::cancel::TaskCancelHandle;

pub use open_app::OpenAppSuccess;

/// Facade cho hành vi phụ thuộc hệ điều hành.
pub struct Platform {
    open_app: Arc<dyn OpenApp>,
    desktop: Arc<dyn DesktopAutomation>,
}

impl Platform {
    pub fn current() -> Self {
        Self {
            open_app: Arc::new(DefaultOpenApp),
            desktop: Arc::new(desktop_for_host()),
        }
    }

    pub fn open_app(&self) -> &dyn OpenApp {
        self.open_app.as_ref()
    }

    pub fn desktop(&self) -> &dyn DesktopAutomation {
        self.desktop.as_ref()
    }
}

#[async_trait]
pub trait OpenApp: Send + Sync {
    async fn resolve_and_launch(
        &self,
        query: &str,
        reuse_existing: bool,
        maximize_window: bool,
    ) -> Result<OpenAppSuccess, String>;
}

#[async_trait]
pub trait DesktopAutomation: Send + Sync {
    fn is_available(&self) -> bool;
    async fn run_steps(
        &self,
        steps: Value,
        cancel: Option<Arc<TaskCancelHandle>>,
    ) -> Result<Value, String>;
}

struct DefaultOpenApp;

#[async_trait]
impl OpenApp for DefaultOpenApp {
    async fn resolve_and_launch(
        &self,
        query: &str,
        reuse_existing: bool,
        maximize_window: bool,
    ) -> Result<OpenAppSuccess, String> {
        open_app::open_app_resolve(query, reuse_existing, maximize_window).await
    }
}

#[cfg(windows)]
fn desktop_for_host() -> impl DesktopAutomation {
    WindowsDesktop
}

#[cfg(not(windows))]
fn desktop_for_host() -> impl DesktopAutomation {
    StubDesktop
}

#[cfg(windows)]
struct WindowsDesktop;

#[cfg(windows)]
#[async_trait]
impl DesktopAutomation for WindowsDesktop {
    fn is_available(&self) -> bool {
        true
    }

    async fn run_steps(
        &self,
        steps: Value,
        cancel: Option<Arc<TaskCancelHandle>>,
    ) -> Result<Value, String> {
        windows::desktop::run_steps_json(
            Some(serde_json::json!({ "steps": steps })),
            cancel,
        )
        .await
    }
}

#[cfg(not(windows))]
struct StubDesktop;

#[cfg(not(windows))]
#[async_trait]
impl DesktopAutomation for StubDesktop {
    fn is_available(&self) -> bool {
        false
    }

    async fn run_steps(
        &self,
        _steps: Value,
        _cancel: Option<Arc<TaskCancelHandle>>,
    ) -> Result<Value, String> {
        Err("DESKTOP_AUTOMATION chỉ trên Windows".into())
    }
}
