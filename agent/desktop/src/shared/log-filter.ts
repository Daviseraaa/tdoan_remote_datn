export type UiLogLevel = 'INFO' | 'WARN' | 'ERROR';

/** Ẩn URL, đường dẫn, MAC khỏi text hiển thị user. */
export function redactSensitive(text: string): string {
  return text
    .replace(/https?:\/\/[^\s]+/gi, '[server]')
    .replace(/wss?:\/\/[^\s]+/gi, '[server]')
    .replace(/[A-F0-9]{2}(?::[A-F0-9]{2}){5}/gi, '[mac]')
    .replace(/(?:[A-Za-z]:\\|\/)?(?:ProgramData|Users|Windows)[^\s]*/gi, '[path]')
    .replace(/namespace\s+\S+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripRustTracing(raw: string): string {
  const m = raw.match(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s+(?:ERROR|WARN|INFO|DEBUG|TRACE)\s+[\w:]+:\s*(.+)$/i,
  );
  if (m?.[1]) return m[1].trim();
  const station = raw.match(/\[StationHub\]\s*(.+)$/i);
  if (station?.[1]) return station[1].trim();
  return raw.trim();
}

function rustTraceLevel(raw: string): UiLogLevel | null {
  const m = raw.match(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s+(ERROR|WARN|INFO|DEBUG|TRACE)\s/i,
  );
  if (!m) return null;
  const lv = m[1].toUpperCase();
  if (lv === 'ERROR') return 'ERROR';
  if (lv === 'WARN') return 'WARN';
  return 'INFO';
}

function isInternalNoise(body: string): boolean {
  return (
    /^Config:/i.test(body) ||
    /^CHROME_EXTENSION_/i.test(body) ||
    /^Remote access:/i.test(body) ||
    /^Connecting(\s+to)?\s/i.test(body) ||
    /^Socket transport up/i.test(body) ||
    /stationhub_agent_native::/i.test(body)
  );
}

/**
 * Chỉ log có giá trị cho tab Kết nối — bỏ tracing nội bộ, không lộ server/path.
 */
export function formatUserLog(
  raw: string,
  streamLevel: UiLogLevel,
): { level: UiLogLevel; text: string } | null {
  const msg = raw.trim();
  if (!msg) return null;

  if (/^Rust agent đã khởi động/i.test(msg)) {
    return { level: 'INFO', text: 'Agent đã khởi động' };
  }
  if (/^Rust agent thoát/i.test(msg)) {
    const sig = msg.match(/signal=(\S+)/)?.[1];
    const abnormal = sig && sig !== 'SIGTERM' && sig !== 'null';
    return {
      level: 'WARN',
      text: abnormal ? 'Agent thoát bất thường' : 'Agent đã dừng',
    };
  }
  if (/^Thiếu .+stationhub_agent/i.test(msg)) {
    return { level: 'ERROR', text: 'Không tìm thấy agent core — build lại agent' };
  }

  if (/\[StationHub\]\s*Socket\.IO:\s*đang kết nối/i.test(msg)) {
    return { level: 'INFO', text: 'Đang kết nối server…' };
  }
  if (/\[StationHub\]\s*Socket\.IO:\s*transport OK/i.test(msg)) {
    return { level: 'INFO', text: 'Đang xác thực Agent Key…' };
  }
  if (/\[StationHub\]\s*Socket\.IO:\s*kết nối THÀNH CÔNG/i.test(msg)) {
    return { level: 'INFO', text: 'Đã kết nối — xác thực thành công' };
  }
  if (/\[StationHub\]\s*Socket\.IO:\s*kết nối THẤT BẠI/i.test(msg)) {
    const detail = msg.split('—').slice(1).join('—').trim();
    const safe = redactSensitive(detail) || 'Không thể kết nối';
    return { level: 'ERROR', text: `Kết nối thất bại — ${safe}` };
  }

  if (/Server authenticated agent/i.test(msg)) {
    return null;
  }

  if (/heartbeat fail streak/i.test(msg)) {
    return { level: 'WARN', text: 'Mất kết nối — đang thử lại…' };
  }

  const traceLv = rustTraceLevel(msg);
  const body = stripRustTracing(msg);

  if (traceLv === 'ERROR' || traceLv === 'WARN') {
    if (body && !isInternalNoise(body)) {
      const text = redactSensitive(body);
      if (text) return { level: traceLv, text };
    }
  }

  if (streamLevel === 'ERROR' && /\b(panic|fatal)\b/i.test(msg)) {
    const text = redactSensitive(stripRustTracing(msg));
    if (text && !isInternalNoise(text)) {
      return { level: 'ERROR', text };
    }
  }

  return null;
}
