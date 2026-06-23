//! Chạy shell (PowerShell / cmd).

use std::process::{Command, Stdio};
use std::sync::Arc;
use std::sync::mpsc;
use std::time::Duration;

use tokio::time::timeout;

use crate::tasks::cancel::TaskCancelHandle;

#[derive(Debug, Clone)]
pub struct ExecuteResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub timed_out: bool,
    pub cancelled: bool,
}

const DANGEROUS: &[&str] = &["mkfs"];

/// `format C:` / `format D:` — không chặn cờ kiểu `--merge-output-format`.
fn looks_like_windows_format(lower: &str) -> bool {
    let mut search = 0;
    while let Some(rel) = lower[search..].find("format") {
        let abs = search + rel;
        if abs > 0 && lower.as_bytes()[abs - 1] == b'-' {
            search = abs + 6;
            continue;
        }
        if let Some(rest) = lower[abs..].strip_prefix("format ") {
            let t = rest.trim_start();
            if t.len() >= 2 && t.as_bytes()[1] == b':' && t.as_bytes()[0].is_ascii_alphabetic() {
                return true;
            }
        }
        search = abs + 6;
    }
    false
}

pub fn assert_safe_command(command: &str) -> Result<(), String> {
    let c = command.trim();
    if c.is_empty() {
        return Err("Command is empty".into());
    }
    let lower = c.to_lowercase();
    for pat in DANGEROUS {
        if lower.contains(pat) && lower.contains("/dev/") {
            return Err(format!("Dangerous command rejected: {}", pat));
        }
    }
    if looks_like_windows_format(&lower) {
        return Err("Dangerous command rejected: format".into());
    }
    Ok(())
}

pub async fn execute_command(
    command: &str,
    shell: &str,
    timeout_ms: u64,
    max_output_bytes: usize,
) -> ExecuteResult {
    execute_command_with_cancel(command, shell, timeout_ms, max_output_bytes, None).await
}

pub async fn execute_command_with_cancel(
    command: &str,
    shell: &str,
    timeout_ms: u64,
    max_output_bytes: usize,
    cancel: Option<Arc<TaskCancelHandle>>,
) -> ExecuteResult {
    if let Some(c) = &cancel {
        if c.is_cancelled() {
            return ExecuteResult {
                exit_code: -1,
                stdout: String::new(),
                stderr: "Task cancelled".into(),
                timed_out: false,
                cancelled: true,
            };
        }
    }

    if let Err(e) = assert_safe_command(command) {
        return ExecuteResult {
            exit_code: -1,
            stdout: String::new(),
            stderr: e,
            timed_out: false,
            cancelled: false,
        };
    }

    let shell = shell.to_lowercase();
    let (cmd, args): (&str, Vec<String>) = if shell == "cmd" {
        ("cmd.exe", vec!["/c".into(), command.into()])
    } else {
        (
            "powershell.exe",
            vec![
                "-NoProfile".into(),
                "-NonInteractive".into(),
                "-ExecutionPolicy".into(),
                "Bypass".into(),
                "-Command".into(),
                command.into(),
            ],
        )
    };

    let cancel_for_blocking = cancel.clone();
    let res = timeout(
        Duration::from_millis(timeout_ms.max(1)),
        tokio::task::spawn_blocking(move || {
            run_sync(cmd, &args, max_output_bytes, cancel_for_blocking)
        }),
    )
    .await;

    match res {
        Ok(join_res) => match join_res {
            Ok(Ok(r)) => r,
            Ok(Err(e)) => ExecuteResult {
                exit_code: -1,
                stdout: String::new(),
                stderr: e,
                timed_out: false,
                cancelled: false,
            },
            Err(j) => ExecuteResult {
                exit_code: -1,
                stdout: String::new(),
                stderr: format!("task join: {}", j),
                timed_out: false,
                cancelled: false,
            },
        },
        Err(_) => ExecuteResult {
            exit_code: -1,
            stdout: String::new(),
            stderr: String::new(),
            timed_out: true,
            cancelled: false,
        },
    }
}

#[cfg(windows)]
fn creation_flags() -> u32 {
    0x0800_0000
}

#[cfg(not(windows))]
fn creation_flags() -> u32 {
    0
}

fn run_sync(
    program: &str,
    args: &[String],
    max_output_bytes: usize,
    cancel: Option<Arc<TaskCancelHandle>>,
) -> Result<ExecuteResult, String> {
    let mut cmd = Command::new(program);
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(creation_flags());
    }

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    if let Some(c) = &cancel {
        c.set_child_pid(child.id());
        if c.is_cancelled() {
            let _ = child.kill();
            return Ok(ExecuteResult {
                exit_code: -1,
                stdout: String::new(),
                stderr: "Task cancelled".into(),
                timed_out: false,
                cancelled: true,
            });
        }
    }

    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(child.wait_with_output());
    });

    loop {
        if let Some(c) = &cancel {
            if c.is_cancelled() {
                return Ok(ExecuteResult {
                    exit_code: -1,
                    stdout: String::new(),
                    stderr: "Task cancelled".into(),
                    timed_out: false,
                    cancelled: true,
                });
            }
        }
        match rx.try_recv() {
            Ok(Ok(out)) => {
                let mut stdout = String::from_utf8_lossy(&out.stdout).into_owned();
                let mut stderr = String::from_utf8_lossy(&out.stderr).into_owned();
                if stdout.len() > max_output_bytes {
                    stdout.truncate(max_output_bytes);
                    stdout.push_str("\n...[OUTPUT_TRUNCATED]");
                }
                if stderr.len() > max_output_bytes {
                    stderr.truncate(max_output_bytes);
                    stderr.push_str("\n...[STDERR_TRUNCATED]");
                }
                return Ok(ExecuteResult {
                    exit_code: out.status.code().unwrap_or(-1),
                    stdout,
                    stderr,
                    timed_out: false,
                    cancelled: false,
                });
            }
            Ok(Err(e)) => return Err(e.to_string()),
            Err(mpsc::TryRecvError::Empty) => {
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(mpsc::TryRecvError::Disconnected) => {
                return Err("child wait thread exited unexpectedly".into());
            }
        }
    }
}
