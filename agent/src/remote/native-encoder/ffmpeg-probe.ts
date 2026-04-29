import { spawn } from 'child_process';

export interface FfmpegProbeResult {
  available: boolean;
  executable: string;
  encoders: string[];
}

const KNOWN_ENCODERS = ['h264_nvenc', 'h264_amf', 'h264_qsv', 'libx264'];

export async function probeFfmpeg(executable: string): Promise<FfmpegProbeResult> {
  const out = await run(executable, ['-hide_banner', '-encoders']);
  if (!out.ok) {
    return { available: false, executable, encoders: [] };
  }
  const encoders = KNOWN_ENCODERS.filter((name) => out.stdout.includes(name));
  return { available: true, executable, encoders };
}

function run(cmd: string, args: string[]): Promise<{ ok: boolean; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += String(d);
    });
    child.stderr.on('data', (d) => {
      stderr += String(d);
    });
    child.on('error', () => resolve({ ok: false, stdout: '' }));
    child.on('close', (code) => {
      resolve({ ok: code === 0, stdout: `${stdout}\n${stderr}` });
    });
  });
}
