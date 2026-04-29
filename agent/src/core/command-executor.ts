import { spawn } from 'child_process';
import { config } from '../config';

export interface ExecuteOptions {
  shell: 'powershell' | 'cmd';
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface ExecuteResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  signal?: string | null;
}

const DANGEROUS_PATTERNS = [
  /format\s+[a-z]:/i,
  /del\s+\/[fqs]\s+[a-z]:\\/i,
  /rd\s+\/s\s+\/q\s+[a-z]:\\/i,
  /rm\s+-rf\s+\//i,
  /mkfs\./i,
  />\s*\/dev\/sd[a-z]/i,
];

export function assertSafeCommand(command: string): void {
  if (!command || typeof command !== 'string') {
    throw new Error('Command is empty');
  }
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(`Dangerous command rejected: ${pattern.source}`);
    }
  }
}

export function executeCommand(
  command: string,
  options: Partial<ExecuteOptions> = {},
): Promise<ExecuteResult> {
  const shell = options.shell ?? config.defaultShell;
  const timeoutMs = options.timeoutMs ?? config.commandTimeoutMs;
  const maxOutputBytes = options.maxOutputBytes ?? config.maxOutputBytes;

  assertSafeCommand(command);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    let killed = false;

    const spawnArgs =
      shell === 'powershell'
        ? {
            cmd: 'powershell.exe',
            args: [
              '-NoProfile',
              '-NonInteractive',
              '-ExecutionPolicy',
              'Bypass',
              '-Command',
              command,
            ],
          }
        : {
            cmd: 'cmd.exe',
            args: ['/c', command],
          };

    const child = spawn(spawnArgs.cmd, spawnArgs.args, {
      windowsHide: true,
      env: process.env,
    });

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      killed = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 2000);
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdoutBytes >= maxOutputBytes) return;
      const str = chunk.toString('utf8');
      stdoutBytes += chunk.length;
      if (stdoutBytes <= maxOutputBytes) {
        stdout += str;
      } else {
        stdout += str.slice(0, maxOutputBytes - (stdoutBytes - chunk.length));
        stdout += '\n...[OUTPUT_TRUNCATED]';
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      if (stderrBytes >= maxOutputBytes) return;
      const str = chunk.toString('utf8');
      stderrBytes += chunk.length;
      if (stderrBytes <= maxOutputBytes) {
        stderr += str;
      } else {
        stderr += str.slice(0, maxOutputBytes - (stderrBytes - chunk.length));
        stderr += '\n...[STDERR_TRUNCATED]';
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeoutHandle);
      resolve({
        exitCode: -1,
        stdout,
        stderr: stderr + `\n[SPAWN_ERROR] ${err.message}`,
        timedOut,
      });
    });

    child.on('close', (code, signal) => {
      clearTimeout(timeoutHandle);
      resolve({
        exitCode: code ?? (killed ? -1 : 0),
        stdout,
        stderr,
        timedOut,
        signal: signal ?? null,
      });
    });
  });
}
