import type { Socket } from 'socket.io';

/** Chuẩn hóa `::ffff:192.168.1.1` → IPv4. */
export function normalizeIp(raw: string): string {
  const s = raw.trim();
  if (s.startsWith('::ffff:')) {
    return s.slice(7);
  }
  return s;
}

export function isPrivateOrLoopback(ip: string): boolean {
  const n = normalizeIp(ip);
  if (!n || n === '::1' || n === '127.0.0.1') {
    return true;
  }
  if (n.startsWith('10.') || n.startsWith('192.168.') || n.startsWith('169.254.')) {
    return true;
  }
  if (n.startsWith('172.')) {
    const second = Number.parseInt(n.split('.')[1] ?? '', 10);
    if (second >= 16 && second <= 31) {
      return true;
    }
  }
  return false;
}

/** IP peer nhìn từ server (ưu tiên reverse-proxy headers). */
export function resolveSocketPeerIp(client: Socket): string {
  const xff = client.handshake.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return normalizeIp(xff.split(',')[0]);
  }
  const xReal = client.handshake.headers['x-real-ip'];
  if (typeof xReal === 'string' && xReal.trim()) {
    return normalizeIp(xReal);
  }
  return normalizeIp(client.handshake.address || '');
}

/**
 * IP hiển thị: ưu tiên public IP từ socket server, sau đó IP agent báo (nếu public).
 * Tránh hiển thị 192.168.x khi server đã thấy public IP của NAT.
 */
export function pickDisplayIp(peerIp: string, reportedIp: string): string {
  const peer = normalizeIp(peerIp);
  const reported = normalizeIp(reportedIp);
  if (peer && !isPrivateOrLoopback(peer)) {
    return peer;
  }
  if (reported && !isPrivateOrLoopback(reported)) {
    return reported;
  }
  return peer || reported || '';
}
