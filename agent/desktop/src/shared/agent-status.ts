import * as os from 'os';
import { loadDesktopConfig } from './config';

export type ConnectionPhase =
  | 'stopped'
  | 'starting'
  | 'connecting'
  | 'connected'
  | 'failed';

export interface AgentStatusSnapshot {
  processRunning: boolean;
  connection: ConnectionPhase;
  serverUrl: string;
  hostname: string;
  agentVersion: string;
  hasAgentKey: boolean;
  lastEvent: string;
  lastEventAt: string | null;
  recentLines: string[];
}

const MAX_LINES = 8;

let processRunning = false;
let connection: ConnectionPhase = 'stopped';
let lastEvent = 'Chưa khởi động';
let lastEventAt: string | null = null;
const recentLines: string[] = [];

function touch(msg: string) {
  lastEvent = msg;
  lastEventAt = new Date().toISOString();
}

export function setAgentProcessRunning(running: boolean): void {
  processRunning = running;
  if (!running) {
    connection = 'stopped';
    touch('Agent đã dừng');
    return;
  }
  if (connection === 'stopped') {
    connection = 'starting';
    touch('Agent đang khởi động…');
  }
}

export function ingestAgentLogLine(line: string): void {
  const trimmed = line.trim();
  if (!trimmed) return;

  recentLines.push(trimmed);
  if (recentLines.length > MAX_LINES) recentLines.shift();

  const lower = trimmed.toLowerCase();

  if (/socket\.io:\s*đang kết nối/i.test(trimmed)) {
    connection = 'connecting';
    touch('Đang kết nối server…');
    return;
  }
  if (/socket\.io:.*chờ xác thực/i.test(trimmed)) {
    connection = 'connecting';
    touch('Đang xác thực Agent Key…');
    return;
  }
  if (/socket\.io:\s*kết nối thành công/i.test(trimmed)) {
    connection = 'connected';
    touch('Đã kết nối server');
    return;
  }
  if (/socket\.io:\s*kết nối thất bại/i.test(trimmed)) {
    connection = 'failed';
    const detail = trimmed.split('—').pop()?.trim() || trimmed;
    touch(`Kết nối thất bại — ${detail}`);
    return;
  }
  if (/rust agent đã khởi động/i.test(lower)) {
    if (connection === 'stopped') connection = 'starting';
    touch('Agent đang chạy');
    return;
  }
  if (/rust agent thoát/i.test(lower)) {
    connection = 'stopped';
    processRunning = false;
    touch('Agent thoát bất thường');
  }
}

export function getAgentStatus(): AgentStatusSnapshot {
  const cfg = loadDesktopConfig();
  return {
    processRunning,
    connection,
    serverUrl: cfg.serverUrl,
    hostname: cfg.hostname || os.hostname(),
    agentVersion: cfg.agentVersion,
    hasAgentKey: Boolean(cfg.agentKey?.trim()),
    lastEvent,
    lastEventAt,
    recentLines: [...recentLines],
  };
}

export function resetAgentStatusOnStart(): void {
  processRunning = true;
  connection = 'starting';
  touch('Đang khởi động agent…');
}
