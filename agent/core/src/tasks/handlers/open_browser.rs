use async_trait::async_trait;
use serde_json::{json, Value};

use crate::platform::cloak_runner::{self, ChromeProfileOptions};
use crate::platform::open_browser;
use crate::tasks::registry::{TaskContext, TaskExecute, TaskHandler};
use crate::tasks::types::TaskOutcome;

pub struct Handler;

fn extract_url(t: &TaskExecute) -> String {
    let mut url = String::new();
    if let Some(Value::Object(p)) = &t.payload {
        if let Some(s) = p.get("url").and_then(|x| x.as_str()) {
            url = s.trim().to_string();
        }
        if url.is_empty() {
            if let Some(s) = p.get("path").and_then(|x| x.as_str()) {
                url = s.trim().to_string();
            }
        }
    }
    if url.is_empty() {
        url = t.command.trim().to_string();
    }
    url
}

struct PayloadOpts {
    headless: Option<bool>,
    humanize: Option<bool>,
    user_data_dir: Option<String>,
    keep_open: Option<bool>,
    use_chrome_profile: Option<bool>,
    chrome_profile: Option<String>,
    chrome_user_data_dir: Option<String>,
    chrome_executable_path: Option<String>,
}

fn payload_opts(t: &TaskExecute) -> PayloadOpts {
    let mut o = PayloadOpts {
        headless: None,
        humanize: None,
        user_data_dir: None,
        keep_open: None,
        use_chrome_profile: None,
        chrome_profile: None,
        chrome_user_data_dir: None,
        chrome_executable_path: None,
    };
    if let Some(Value::Object(p)) = &t.payload {
        o.headless = p.get("headless").and_then(|x| x.as_bool());
        o.humanize = p.get("humanize").and_then(|x| x.as_bool());
        o.keep_open = p.get("keepOpen").and_then(|x| x.as_bool());
        o.use_chrome_profile = p.get("useChromeProfile").and_then(|x| x.as_bool());
        o.user_data_dir = p
            .get("userDataDir")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        o.chrome_profile = p
            .get("chromeProfile")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        o.chrome_user_data_dir = p
            .get("chromeUserDataDir")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        o.chrome_executable_path = p
            .get("chromeExecutablePath")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
    }
    o
}

#[async_trait]
impl TaskHandler for Handler {
    fn task_type(&self) -> &'static str {
        "OPEN_BROWSER"
    }

    async fn run(&self, ctx: &TaskContext<'_>, task: &TaskExecute) -> TaskOutcome {
        let url = extract_url(task);
        if url.is_empty() {
            return (
                false,
                -1,
                Some("Cần URL (command hoặc payload.url)".into()),
                None,
            );
        }
        let url = match open_browser::normalize_url_for_task(&url) {
            Ok(u) => u,
            Err(e) => return (false, -1, Some(e), None),
        };

        if !cloak_runner::cloak_runner_available() {
            return (
                false,
                -1,
                Some(
                    "Thiếu datn-cloak-runner. Chạy: npm run build:cloak-runner (hoặc python cloak-runner/main.py)."
                        .into(),
                ),
                None,
            );
        }

        let p = payload_opts(task);
        let headless = p.headless.unwrap_or(ctx.config.open_browser_headless);
        let humanize = p.humanize.unwrap_or(ctx.config.open_browser_humanize);
        let keep_open = p.keep_open.unwrap_or(ctx.config.open_browser_keep_open);
        // Cloak vs Chrome: chỉ admin quyết định qua payload task (useChromeProfile).
        let use_chrome_profile = p.use_chrome_profile.unwrap_or(false);

        let profile = if use_chrome_profile {
            None
        } else {
            p.user_data_dir.or_else(|| {
                let d = ctx.config.open_browser_profile_dir.trim();
                if d.is_empty() {
                    None
                } else {
                    Some(d.to_string())
                }
            })
        };

        let chrome_profile = if use_chrome_profile {
            Some(p.chrome_profile.unwrap_or_else(|| "Default".to_string()))
        } else {
            None
        };

        let chrome_user_data_dir = if use_chrome_profile {
            p.chrome_user_data_dir
        } else {
            None
        };

        let chrome_executable = if use_chrome_profile {
            p.chrome_executable_path
        } else {
            None
        };

        let timeout_ms = if task.timeout > 0 {
            task.timeout
        } else {
            ctx.config.command_timeout_ms
        };

        let chrome = ChromeProfileOptions {
            use_chrome_profile,
            chrome_profile,
            chrome_user_data_dir,
            chrome_executable_path: chrome_executable,
        };

        match cloak_runner::open_url(
            &url,
            headless,
            humanize,
            profile,
            keep_open,
            timeout_ms,
            chrome,
        )
        .await
        {
            Ok(s) => (
                true,
                0,
                None,
                Some(json!({
                    "url": s.url,
                    "title": s.title,
                    "method": s.method,
                    "keepOpen": keep_open,
                    "useChromeProfile": use_chrome_profile,
                    "chromeProfile": s.chrome_profile,
                    "chromeUserDataDir": s.chrome_user_data_dir,
                    "runnerPid": s.runner_pid,
                })),
            ),
            Err(e) => (false, -1, Some(e), None),
        }
    }
}
