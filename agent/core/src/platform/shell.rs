//! Chạy shell (PowerShell / cmd).

use std::process::{Command, Stdio};
use std::time::Duration;

use tokio::time::timeout;

#[derive(Debug, Clone)]
pub struct ExecuteResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub timed_out: bool,
}

const DANGEROUS: &[&str] = &[
    "format ", // disk format
    "mkfs",
];

pub fn assert_safe_command(command: &str) -> Result<(), String> {
    let c = command.trim();
    if c.is_empty() {
        return Err("Command is empty".into());
    }
    let lower = c.to_lowercase();
    for pat in DANGEROUS {
        if lower.contains(pat) && (lower.contains("c:") || lower.contains("/dev/")) {
            return Err(format!("Dangerous command rejected: {}", pat));
        }
    }
    Ok(())
}

pub async fn execute_command(
    command: &str,
    shell: &str,
    timeout_ms: u64,
    max_output_bytes: usize,
) -> ExecuteResult {
    if let Err(e) = assert_safe_command(command) {
        return ExecuteResult {
            exit_code: -1,
            stdout: String::new(),
            stderr: e,
            timed_out: false,
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

    let res = timeout(
        Duration::from_millis(timeout_ms.max(1)),
        tokio::task::spawn_blocking(move || run_sync(cmd, &args, max_output_bytes)),
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
            },
            Err(j) => ExecuteResult {
                exit_code: -1,
                stdout: String::new(),
                stderr: format!("task join: {}", j),
                timed_out: false,
            },
        },
        Err(_) => ExecuteResult {
            exit_code: -1,
            stdout: String::new(),
            stderr: String::new(),
            timed_out: true,
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

fn run_sync(program: &str, args: &[String], max_output_bytes: usize) -> Result<ExecuteResult, String> {
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

    let child = cmd.spawn().map_err(|e| e.to_string())?;

    let out = child.wait_with_output().map_err(|e| e.to_string())?;
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
    Ok(ExecuteResult {
        exit_code: out.status.code().unwrap_or(-1),
        stdout,
        stderr,
        timed_out: false,
    })
}
